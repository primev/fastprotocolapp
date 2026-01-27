// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Ownable2Step, Ownable} from "@openzeppelin/contracts/access/Ownable2Step.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {Pausable} from "@openzeppelin/contracts/utils/Pausable.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {MessageHashUtils} from "@openzeppelin/contracts/utils/cryptography/MessageHashUtils.sol";
import {IFastSettlementV2, IExecutor} from "./interfaces/IFastSettlementV2.sol";

/// @notice Minimal interface for Permit2 SignatureTransfer
interface ISignatureTransfer {
    struct TokenPermissions {
        address token;
        uint256 amount;
    }

    struct PermitTransferFrom {
        TokenPermissions permitted;
        uint256 nonce;
        uint256 deadline;
    }

    struct SignatureTransferDetails {
        address to;
        uint256 requestedAmount;
    }

    function permitWitnessTransferFrom(
        PermitTransferFrom memory permit,
        SignatureTransferDetails calldata transferDetails,
        address owner,
        bytes32 witness,
        string calldata witnessTypeString,
        bytes calldata signature
    ) external;
}

/// @title FastSettlementV2
/// @notice Production-grade intent settlement contract for the Fast Protocol
/// @dev Implements EIP-712 signed intents with Permit2 integration and Reactor pattern
/// @dev V2: Reactor-style execution with strict checks
/// @author Fast Protocol
contract FastSettlementV2 is IFastSettlementV2, Ownable2Step, ReentrancyGuard, Pausable {
    using SafeERC20 for IERC20;

    // ============ Constants ============

    /// @notice The Permit2 contract address (canonical deployment)
    ISignatureTransfer public immutable PERMIT2;

    /// @notice Maximum nonce value to prevent lockout
    uint256 public constant MAX_NONCE = type(uint256).max - 1000;

    /// @notice Basis points denominator (100% = 10000)
    uint256 public constant BPS_DENOMINATOR = 10000;

    /// @notice EIP-712 typehash for Intent struct
    /// @dev Uses uint256 for deadline to match Permit2 conventions
    bytes32 public constant INTENT_TYPEHASH =
        keccak256(
            "Intent(address maker,address recipient,address tokenIn,address tokenOut,uint256 amountIn,uint256 amountOut,uint256 deadline,uint256 nonce,bytes32 refId)"
        );

    /// @notice Witness type string for Permit2 integration
    string public constant WITNESS_TYPE_STRING =
        "Intent witness)Intent(address maker,address recipient,address tokenIn,address tokenOut,uint256 amountIn,uint256 amountOut,uint256 deadline,uint256 nonce,bytes32 refId)TokenPermissions(address token,uint256 amount)";

    /// @notice Nonce domain separator to avoid Permit2 collision
    bytes32 public constant NONCE_DOMAIN = keccak256("FastSettlement.nonce.v2");

    // ============ Immutables ============

    /// @notice Chain ID cached at deployment for fork detection
    uint256 private immutable _CACHED_CHAIN_ID;

    /// @notice Domain separator cached at deployment
    bytes32 private immutable _CACHED_DOMAIN_SEPARATOR;

    // ============ Storage ============

    /// @notice Maps executor address to authorization status
    mapping(address => bool) private _executors;

    /// @notice Whether the executor whitelist is currently active
    bool public isExecutorWhitelistActive;

    /// @notice Maps maker => transformed nonce => used status
    mapping(address => mapping(uint256 => bool)) private _usedNonces;

    /// @notice Maps maker => minimum valid nonce
    mapping(address => uint256) private _minNonces;

    /// @notice Address that receives protocol's share of surplus
    address private _surplusRecipient;

    // ============ Constructor ============

    /// @notice Deploys the settlement contract
    /// @param permit2_ The Permit2 contract address
    /// @param owner_ The initial owner address
    /// @param surplusRecipient_ The initial surplus recipient
    constructor(address permit2_, address owner_, address surplusRecipient_) Ownable(owner_) {
        // Note: owner_ validation is handled by OpenZeppelin's Ownable (throws OwnableInvalidOwner)
        if (permit2_ == address(0)) revert InvalidPermit2Address();
        if (surplusRecipient_ == address(0)) revert InvalidSurplusRecipient();

        PERMIT2 = ISignatureTransfer(permit2_);
        _surplusRecipient = surplusRecipient_;
        isExecutorWhitelistActive = true;

        _CACHED_CHAIN_ID = block.chainid;
        _CACHED_DOMAIN_SEPARATOR = _computeDomainSeparator();
    }

    // ============ Modifiers ============

    /// @notice Restricts function to authorized executors if whitelist is active
    modifier checkExecutor() {
        if (isExecutorWhitelistActive && !_executors[msg.sender]) {
            revert UnauthorizedExecutor();
        }
        _;
    }

    // ============ External Functions ============

    /// @inheritdoc IFastSettlementV2
    function settle(
        Intent calldata intent,
        bytes calldata signature,
        bytes calldata executorData
    ) external override checkExecutor nonReentrant whenNotPaused {
        // 1. Validate intent (expiry, nonce, basics)
        _validateIntentBasic(intent);

        bytes32 intentId = _hashIntent(intent);
        uint256 transformedNonce = _transformNonce(intent.nonce);

        // 2. Mark nonce used (CEI) to prevent reentrancy/replay
        _usedNonces[intent.maker][transformedNonce] = true;

        // 3. Pull tokens from user directly to the executor
        // Note: The signature must sign 'msg.sender' (the executor) as the spender in Permit2
        _pullToExecutor(intent, signature);

        // 4. Execute Executor Callback
        // No return value required.
        // For ETH: Executor must send ETH to this contract.
        // For ERC20: Executor must approve this contract AND have enough balance.
        IExecutor(msg.sender).execute(intent, executorData);

        // 5. Verify Outcome and Distribute
        uint256 protocolAmt;

        if (intent.tokenOut == address(0)) {
            // ETH Output Flow
            // Check if we have enough ETH to pay the user
            // We expect the executor to have sent at least 'amountOut'
            if (address(this).balance < intent.amountOut) {
                revert InsufficientOutput(address(this).balance, intent.amountOut);
            }

            // Calculations
            // Surplus is whatever is left after paying the user
            // Note: We snapshot balance once, but here we can just check what we have
            uint256 available = address(this).balance;
            protocolAmt = available - intent.amountOut;

            // Distribute
            _sendETH(intent.recipient, intent.amountOut);

            if (protocolAmt > 0) {
                _sendETH(_surplusRecipient, protocolAmt);
            }
        } else {
            // ERC20 Output Flow
            // Assume executor logic is correct. We just blindly transfer 'amountOut' from executor to recipient.
            // If executor failed to approve or doesn't have balance, this reverts.
            // surplus is expected to be transferred by the executor

            IERC20(intent.tokenOut).safeTransferFrom(
                msg.sender,
                intent.recipient,
                intent.amountOut
            );

            // protocolAmt is 0 for ERC20
        }

        emit IntentSettled(
            intentId,
            intent.maker,
            intent.tokenIn,
            intent.tokenOut,
            intent.amountIn,
            intent.amountOut,
            protocolAmt
        );
    }

    /// @inheritdoc IFastSettlementV2
    function validate(
        Intent calldata intent,
        bytes calldata signature
    ) external view override returns (bool isValid, string memory reason) {
        if (block.timestamp > intent.deadline) return (false, "Expired");

        uint256 transformedNonce = _transformNonce(intent.nonce);
        if (
            _usedNonces[intent.maker][transformedNonce] || intent.nonce < _minNonces[intent.maker]
        ) {
            return (false, "Nonce Invalid");
        }

        if (signature.length == 0) return (false, "Missing Signature");

        return (true, "");
    }

    /// @inheritdoc IFastSettlementV2
    function setExecutor(address executor, bool allowed) external override onlyOwner {
        if (executor == address(0)) revert InvalidExecutorAddress();
        _executors[executor] = allowed;
        emit ExecutorUpdated(executor, allowed);
    }

    /// @inheritdoc IFastSettlementV2
    function setExecutorWhitelistActive(bool active) external override onlyOwner {
        isExecutorWhitelistActive = active;
        emit ExecutorWhitelistActiveUpdated(active);
    }

    /// @inheritdoc IFastSettlementV2
    function setSurplusRecipient(address recipient) external override onlyOwner {
        if (recipient == address(0)) revert InvalidSurplusRecipient();
        address old = _surplusRecipient;
        _surplusRecipient = recipient;
        emit SurplusRecipientUpdated(old, recipient);
    }

    /// @inheritdoc IFastSettlementV2
    function invalidateNoncesUpTo(uint256 newMinNonce) external override {
        uint256 currentMin = _minNonces[msg.sender];
        if (newMinNonce <= currentMin) revert InvalidNonceIncrement();
        if (newMinNonce > MAX_NONCE) revert NonceTooHigh();

        _minNonces[msg.sender] = newMinNonce;
        emit NonceInvalidated(msg.sender, newMinNonce);
    }

    /// @inheritdoc IFastSettlementV2
    function pause() external override onlyOwner {
        _pause();
    }

    /// @inheritdoc IFastSettlementV2
    function unpause() external override onlyOwner {
        _unpause();
    }

    /// @inheritdoc IFastSettlementV2
    function rescueTokens(address token, address to, uint256 amount) external override onlyOwner {
        if (to == address(0)) revert InvalidRecipient();
        IERC20(token).safeTransfer(to, amount);
        emit TokensRescued(token, to, amount);
    }

    // ============ View Functions ============

    /// @inheritdoc IFastSettlementV2
    function getIntentId(Intent calldata intent) external view override returns (bytes32) {
        return _hashIntent(intent);
    }

    /// @inheritdoc IFastSettlementV2
    function isNonceUsed(address maker, uint256 nonce) external view override returns (bool) {
        uint256 transformedNonce = _transformNonce(nonce);
        return _usedNonces[maker][transformedNonce] || nonce < _minNonces[maker];
    }

    /// @inheritdoc IFastSettlementV2
    function getMinNonce(address maker) external view override returns (uint256) {
        return _minNonces[maker];
    }

    /// @inheritdoc IFastSettlementV2
    function isExecutorAllowed(address executor) external view override returns (bool) {
        return _executors[executor];
    }

    /// @inheritdoc IFastSettlementV2
    function getSurplusRecipient() external view override returns (address) {
        return _surplusRecipient;
    }

    /// @inheritdoc IFastSettlementV2
    function DOMAIN_SEPARATOR() public view override returns (bytes32) {
        // Recompute if chain ID changed (fork protection)
        if (block.chainid != _CACHED_CHAIN_ID) {
            return _computeDomainSeparator();
        }
        return _CACHED_DOMAIN_SEPARATOR;
    }

    // ============ Internal Functions ============

    function _validateIntentBasic(Intent calldata intent) internal view {
        if (block.timestamp > intent.deadline) revert TransactionExpired();
        if (intent.amountIn == 0) revert("Zero input");
        if (intent.amountOut == 0) revert("Zero output");
        // Permit2 does not support pulling ETH, so tokenIn must be a valid address
        if (intent.tokenIn == address(0)) revert("ETH input not supported");

        uint256 transformedNonce = _transformNonce(intent.nonce);
        if (
            _usedNonces[intent.maker][transformedNonce] || intent.nonce < _minNonces[intent.maker]
        ) {
            revert NonceAlreadyUsed();
        }
    }

    /// @notice Sends ETH to a recipient
    function _sendETH(address to, uint256 amount) internal {
        (bool success, ) = to.call{value: amount}("");
        if (!success) revert("ETH transfer failed");
    }

    function _pullToExecutor(Intent calldata intent, bytes calldata signature) internal {
        bytes32 witness = _computeIntentWitness(intent);

        ISignatureTransfer.PermitTransferFrom memory permit = ISignatureTransfer
            .PermitTransferFrom({
                permitted: ISignatureTransfer.TokenPermissions({
                    token: intent.tokenIn,
                    amount: intent.amountIn
                }),
                nonce: intent.nonce,
                deadline: intent.deadline
            });

        // Transfer directly to msg.sender (the executor)
        ISignatureTransfer.SignatureTransferDetails memory transferDetails = ISignatureTransfer
            .SignatureTransferDetails({to: msg.sender, requestedAmount: intent.amountIn});

        try
            PERMIT2.permitWitnessTransferFrom(
                permit,
                transferDetails,
                intent.maker,
                witness,
                WITNESS_TYPE_STRING,
                signature
            )
        {
            // Success
        } catch {
            revert Permit2TransferFailed();
        }
    }

    function _transformNonce(uint256 nonce) internal pure returns (uint256) {
        return uint256(keccak256(abi.encode(NONCE_DOMAIN, nonce)));
    }

    function _computeDomainSeparator() internal view returns (bytes32) {
        return
            keccak256(
                abi.encode(
                    keccak256(
                        "EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)"
                    ),
                    keccak256("FastSettlement"),
                    keccak256("2"),
                    block.chainid,
                    address(this)
                )
            );
    }

    function _hashIntent(Intent calldata intent) internal view returns (bytes32) {
        bytes32 structHash = keccak256(
            abi.encode(
                INTENT_TYPEHASH,
                intent.maker,
                intent.recipient,
                intent.tokenIn,
                intent.tokenOut,
                intent.amountIn,
                intent.amountOut,
                intent.deadline,
                intent.nonce,
                intent.refId
            )
        );

        return MessageHashUtils.toTypedDataHash(DOMAIN_SEPARATOR(), structHash);
    }

    function _computeIntentWitness(Intent calldata intent) internal pure returns (bytes32) {
        return
            keccak256(
                abi.encode(
                    INTENT_TYPEHASH,
                    intent.maker,
                    intent.recipient,
                    intent.tokenIn,
                    intent.tokenOut,
                    intent.amountIn,
                    intent.amountOut,
                    intent.deadline,
                    intent.nonce,
                    intent.refId
                )
            );
    }

    receive() external payable {}
}
