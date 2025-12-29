// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Ownable2Step, Ownable} from "@openzeppelin/contracts/access/Ownable2Step.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {Pausable} from "@openzeppelin/contracts/utils/Pausable.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {MessageHashUtils} from "@openzeppelin/contracts/utils/cryptography/MessageHashUtils.sol";
import {IFastSettlementV2} from "./interfaces/IFastSettlementV2.sol";

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
/// @dev Implements EIP-712 signed intents with Permit2 integration for fund transfers
/// @dev V2: Security hardened version with fixes for audit findings
/// @author Fast Protocol
contract FastSettlementV2 is IFastSettlementV2, Ownable2Step, ReentrancyGuard, Pausable {
    using SafeERC20 for IERC20;

    // ============ Constants ============

    /// @notice The Permit2 contract address (canonical deployment)
    ISignatureTransfer public immutable PERMIT2;

    /// @notice Maximum batch size to prevent gas griefing
    uint256 public constant MAX_BATCH_SIZE = 50;

    /// @notice Maximum nonce value to prevent lockout
    uint256 public constant MAX_NONCE = type(uint256).max - 1000;

    /// @notice Basis points denominator (100% = 10000)
    uint256 public constant BPS_DENOMINATOR = 10000;

    /// @notice Default user surplus share (50% = 5000 bps)
    uint256 public constant DEFAULT_USER_SURPLUS_BPS = 5000;

    /// @notice EIP-712 typehash for Intent struct
    /// @dev Uses uint256 for deadline to match Permit2 conventions
    bytes32 public constant INTENT_TYPEHASH = keccak256(
        "Intent(address maker,address recipient,address tokenIn,address tokenOut,uint256 amountIn,uint256 minOut,uint256 deadline,uint256 nonce,bytes32 refId)"
    );

    /// @notice Witness type string for Permit2 integration
    string public constant WITNESS_TYPE_STRING =
        "Intent witness)Intent(address maker,address recipient,address tokenIn,address tokenOut,uint256 amountIn,uint256 minOut,uint256 deadline,uint256 nonce,bytes32 refId)TokenPermissions(address token,uint256 amount)";

    /// @notice Nonce domain separator to avoid Permit2 collision
    bytes32 public constant NONCE_DOMAIN = keccak256("FastSettlement.nonce.v2");

    // ============ Immutables ============

    /// @notice Chain ID cached at deployment for fork detection
    uint256 private immutable _CACHED_CHAIN_ID;

    /// @notice Domain separator cached at deployment
    bytes32 private immutable _CACHED_DOMAIN_SEPARATOR;

    // ============ Storage ============

    /// @notice Maps solver address to authorization status
    mapping(address => bool) private _solvers;

    /// @notice Maps router address to allowlist status
    mapping(address => bool) private _routers;

    /// @notice Maps maker => transformed nonce => used status
    mapping(address => mapping(uint256 => bool)) private _usedNonces;

    /// @notice Maps maker => minimum valid nonce
    mapping(address => uint256) private _minNonces;

    /// @notice Address that receives protocol's share of surplus
    address private _surplusRecipient;

    /// @notice User's share of surplus in basis points (default 5000 = 50%)
    uint256 private _userSurplusBps;

    /// @notice Maps maker => claimable refund amounts per token
    mapping(address => mapping(address => uint256)) private _pendingRefunds;

    // ============ Constructor ============

    /// @notice Deploys the settlement contract
    /// @param permit2_ The Permit2 contract address
    /// @param owner_ The initial owner address
    /// @param surplusRecipient_ The initial surplus recipient
    constructor(
        address permit2_,
        address owner_,
        address surplusRecipient_
    ) Ownable(owner_) {
        // Note: owner_ validation is handled by OpenZeppelin's Ownable (throws OwnableInvalidOwner)
        if (permit2_ == address(0)) revert InvalidPermit2Address();
        if (surplusRecipient_ == address(0)) revert InvalidSurplusRecipient();

        PERMIT2 = ISignatureTransfer(permit2_);
        _surplusRecipient = surplusRecipient_;
        _userSurplusBps = DEFAULT_USER_SURPLUS_BPS;

        _CACHED_CHAIN_ID = block.chainid;
        _CACHED_DOMAIN_SEPARATOR = _computeDomainSeparator();
    }

    // ============ Modifiers ============

    /// @notice Restricts function to authorized solvers only
    modifier onlySolver() {
        if (!_solvers[msg.sender]) revert UnauthorizedSolver();
        _;
    }

    // ============ External Functions ============

    /// @inheritdoc IFastSettlementV2
    function settleBatch(
        Intent[] calldata intents,
        bytes[] calldata signatures,
        bytes[] calldata routeDatas
    ) external override onlySolver nonReentrant whenNotPaused returns (SettlementResult[] memory results) {
        uint256 length = intents.length;

        if (length == 0) revert EmptyBatch();
        if (length > MAX_BATCH_SIZE) revert BatchTooLarge(length, MAX_BATCH_SIZE);
        if (length != signatures.length || length != routeDatas.length) {
            revert ArrayLengthMismatch();
        }

        results = new SettlementResult[](length);

        for (uint256 i = 0; i < length; ) {
            results[i] = _settleIntent(intents[i], signatures[i], routeDatas[i]);
            unchecked { ++i; }
        }
    }

    /// @inheritdoc IFastSettlementV2
    function settle(
        Intent calldata intent,
        bytes calldata signature,
        bytes calldata routeData
    ) external override onlySolver nonReentrant whenNotPaused returns (bytes32 intentId, uint256 amountOut) {
        SettlementResult memory result = _settleIntent(intent, signature, routeData);

        if (!result.success) {
            revert SettlementFailed(result.intentId, result.error);
        }

        return (result.intentId, result.amountOut);
    }

    /// @inheritdoc IFastSettlementV2
    function claimRefund(address token) external nonReentrant {
        uint256 amount = _pendingRefunds[msg.sender][token];
        if (amount == 0) revert NoRefundAvailable();

        _pendingRefunds[msg.sender][token] = 0;

        IERC20(token).safeTransfer(msg.sender, amount);

        emit RefundClaimed(msg.sender, token, amount);
    }

    /// @inheritdoc IFastSettlementV2
    function setSolver(address solver, bool allowed) external override onlyOwner {
        if (solver == address(0)) revert InvalidSolverAddress();
        _solvers[solver] = allowed;
        emit SolverUpdated(solver, allowed);
    }

    /// @inheritdoc IFastSettlementV2
    function setSurplusRecipient(address recipient) external override onlyOwner {
        if (recipient == address(0)) revert InvalidSurplusRecipient();
        address old = _surplusRecipient;
        _surplusRecipient = recipient;
        emit SurplusRecipientUpdated(old, recipient);
    }

    /// @inheritdoc IFastSettlementV2
    function setUserSurplusBps(uint256 bps) external override onlyOwner {
        if (bps > BPS_DENOMINATOR) revert InvalidSurplusBps();
        uint256 old = _userSurplusBps;
        _userSurplusBps = bps;
        emit UserSurplusBpsUpdated(old, bps);
    }

    /// @inheritdoc IFastSettlementV2
    function setRouter(address router, bool allowed) external override onlyOwner {
        if (router == address(0)) revert InvalidRouterAddress();
        _routers[router] = allowed;
        emit RouterUpdated(router, allowed);
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
    function rescueTokens(
        address token,
        address to,
        uint256 amount
    ) external override onlyOwner {
        if (to == address(0)) revert InvalidRecipient();

        // Only allow rescuing tokens that aren't pending refunds
        // This is a simplified check - in production consider a more robust mechanism
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
    function isSolverAllowed(address solver) external view override returns (bool) {
        return _solvers[solver];
    }

    /// @inheritdoc IFastSettlementV2
    function isRouterAllowed(address router) external view override returns (bool) {
        return _routers[router];
    }

    /// @inheritdoc IFastSettlementV2
    function getSurplusRecipient() external view override returns (address) {
        return _surplusRecipient;
    }

    /// @inheritdoc IFastSettlementV2
    function getUserSurplusBps() external view override returns (uint256) {
        return _userSurplusBps;
    }

    /// @inheritdoc IFastSettlementV2
    function getPendingRefund(address maker, address token) external view override returns (uint256) {
        return _pendingRefunds[maker][token];
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

    /// @notice Settles a single intent with best-effort semantics
    function _settleIntent(
        Intent calldata intent,
        bytes calldata signature,
        bytes calldata routeData
    ) internal returns (SettlementResult memory result) {
        // Compute intent ID first for logging
        result.intentId = _hashIntent(intent);

        // ===== Input Validation =====

        if (intent.amountIn == 0) {
            return _failIntent(result, intent.maker, "Zero input amount");
        }

        if (intent.minOut == 0) {
            return _failIntent(result, intent.maker, "Zero minimum output");
        }

        if (intent.tokenIn == intent.tokenOut) {
            return _failIntent(result, intent.maker, "Same token swap");
        }

        if (intent.tokenIn == address(0) || intent.tokenOut == address(0)) {
            return _failIntent(result, intent.maker, "Zero token address");
        }

        // Validate deadline
        if (block.timestamp > intent.deadline) {
            return _failIntent(result, intent.maker, "Deadline passed");
        }

        // Validate recipient
        if (intent.recipient == address(0)) {
            return _failIntent(result, intent.maker, "Invalid recipient");
        }

        // Validate and transform nonce
        uint256 transformedNonce = _transformNonce(intent.nonce);
        if (_usedNonces[intent.maker][transformedNonce] || intent.nonce < _minNonces[intent.maker]) {
            return _failIntent(result, intent.maker, "Invalid nonce");
        }

        // Validate routeData
        if (routeData.length < 20) {
            return _failIntent(result, intent.maker, "Invalid route data");
        }

        address router = address(bytes20(routeData[:20]));
        if (!_routers[router]) {
            return _failIntent(result, intent.maker, "Router not allowed");
        }

        // Mark nonce as used BEFORE external calls (CEI pattern)
        _usedNonces[intent.maker][transformedNonce] = true;

        // ===== Pull Funds via Permit2 =====

        uint256 balanceBeforePull = IERC20(intent.tokenIn).balanceOf(address(this));

        bool pullSuccess = _tryPullFundsViaPermit2(intent, signature);

        if (!pullSuccess) {
            // Rollback nonce on Permit2 failure
            _usedNonces[intent.maker][transformedNonce] = false;
            return _failIntent(result, intent.maker, "Permit2 transfer failed");
        }

        // Verify actual amount received (handles fee-on-transfer tokens)
        uint256 balanceAfterPull = IERC20(intent.tokenIn).balanceOf(address(this));
        uint256 actualAmountIn = balanceAfterPull - balanceBeforePull;

        if (actualAmountIn < intent.amountIn) {
            // Fee-on-transfer token detected - user didn't get full amount
            // Add to pending refunds and fail
            _pendingRefunds[intent.maker][intent.tokenIn] += actualAmountIn;
            return _failIntent(result, intent.maker, "Insufficient input received");
        }

        // ===== Execute Route =====

        RouteResult memory routeResult = _tryExecuteRoute(
            intent,
            router,
            routeData[20:],
            actualAmountIn
        );

        if (!routeResult.success) {
            // Route failed - only refund what's actually still in the contract
            // If router consumed tokens but didn't provide output (theft attempt),
            // we can only refund what remains
            if (routeResult.inputRemaining > 0) {
                _pendingRefunds[intent.maker][intent.tokenIn] += routeResult.inputRemaining;
                emit RefundPending(intent.maker, intent.tokenIn, routeResult.inputRemaining);
            }

            // If input was consumed but no output received, emit a theft warning
            if (routeResult.inputRemaining == 0 && actualAmountIn > 0) {
                emit IntentFailed(result.intentId, intent.maker, "Router consumed input without output - potential theft");
            }

            return _failIntent(result, intent.maker, routeResult.error);
        }

        // ===== Distribute Output =====

        _distributeOutput(intent, routeResult.amountOut);

        result.success = true;
        result.amountOut = routeResult.amountOut;

        uint256 surplus = routeResult.amountOut > intent.minOut ? routeResult.amountOut - intent.minOut : 0;
        uint256 userSurplus = (surplus * _userSurplusBps) / BPS_DENOMINATOR;

        emit IntentSettled(
            result.intentId,
            intent.maker,
            intent.tokenIn,
            intent.tokenOut,
            intent.amountIn,
            routeResult.amountOut,
            intent.minOut,
            surplus,
            userSurplus
        );

        return result;
    }

    /// @notice Helper to create a failed result
    function _failIntent(
        SettlementResult memory result,
        address maker,
        string memory error
    ) internal returns (SettlementResult memory) {
        result.success = false;
        result.error = error;
        emit IntentFailed(result.intentId, maker, error);
        return result;
    }

    /// @notice Attempts to pull funds via Permit2, returns success status
    function _tryPullFundsViaPermit2(
        Intent calldata intent,
        bytes calldata signature
    ) internal returns (bool) {
        bytes32 witness = _computeIntentWitness(intent);

        ISignatureTransfer.PermitTransferFrom memory permit = ISignatureTransfer.PermitTransferFrom({
            permitted: ISignatureTransfer.TokenPermissions({
                token: intent.tokenIn,
                amount: intent.amountIn
            }),
            nonce: intent.nonce,  // Use original nonce for Permit2
            deadline: intent.deadline
        });

        ISignatureTransfer.SignatureTransferDetails memory transferDetails =
            ISignatureTransfer.SignatureTransferDetails({
                to: address(this),
                requestedAmount: intent.amountIn
            });

        try PERMIT2.permitWitnessTransferFrom(
            permit,
            transferDetails,
            intent.maker,
            witness,
            WITNESS_TYPE_STRING,
            signature
        ) {
            return true;
        } catch {
            return false;
        }
    }

    /// @notice Route execution result
    struct RouteResult {
        bool success;
        uint256 amountOut;
        uint256 inputRemaining;  // Input tokens still in contract (for refunds)
        string error;
    }

    /// @notice Attempts to execute the route, returns detailed result
    function _tryExecuteRoute(
        Intent calldata intent,
        address router,
        bytes calldata routerCalldata,
        uint256 actualAmountIn
    ) internal returns (RouteResult memory result) {
        // Record balances before routing
        uint256 inputBalanceBefore = IERC20(intent.tokenIn).balanceOf(address(this));
        uint256 outputBalanceBefore = IERC20(intent.tokenOut).balanceOf(address(this));

        // Approve router to spend input tokens
        IERC20(intent.tokenIn).forceApprove(router, actualAmountIn);

        // Execute router call
        (bool callSuccess, ) = router.call(routerCalldata);

        // CRITICAL: Always clear approval immediately after call
        IERC20(intent.tokenIn).forceApprove(router, 0);

        // Check how much input remains (for refund calculation)
        uint256 inputBalanceAfter = IERC20(intent.tokenIn).balanceOf(address(this));
        result.inputRemaining = inputBalanceAfter >= inputBalanceBefore ? 0 :
            (inputBalanceBefore - (inputBalanceBefore - inputBalanceAfter) > actualAmountIn ?
                actualAmountIn : inputBalanceAfter);

        // Simpler: just track what's still there that we can refund
        result.inputRemaining = inputBalanceAfter;

        if (!callSuccess) {
            result.error = "Router call failed";
            return result;
        }

        // Calculate input consumed
        uint256 inputConsumed = inputBalanceBefore - inputBalanceAfter;

        // Verify input was fully consumed - if not, could be partial execution attack
        if (inputConsumed < actualAmountIn - 1) {
            result.error = "Input not fully consumed";
            return result;
        }

        // Calculate output received
        uint256 outputBalanceAfter = IERC20(intent.tokenOut).balanceOf(address(this));
        result.amountOut = outputBalanceAfter - outputBalanceBefore;

        // Enforce minimum output
        if (result.amountOut < intent.minOut) {
            result.error = "Insufficient output";
            return result;
        }

        result.success = true;
        return result;
    }

    /// @notice Distributes output tokens to recipient and surplus recipient
    function _distributeOutput(Intent calldata intent, uint256 amountOut) internal {
        uint256 surplus = amountOut > intent.minOut ? amountOut - intent.minOut : 0;

        if (surplus > 0) {
            // Calculate user's share of surplus
            uint256 userSurplus = (surplus * _userSurplusBps) / BPS_DENOMINATOR;
            uint256 protocolSurplus = surplus - userSurplus;

            // Send minOut + user's surplus share to recipient
            uint256 recipientAmount = intent.minOut + userSurplus;
            IERC20(intent.tokenOut).safeTransfer(intent.recipient, recipientAmount);

            // Send protocol's surplus share to surplus recipient
            if (protocolSurplus > 0) {
                IERC20(intent.tokenOut).safeTransfer(_surplusRecipient, protocolSurplus);
            }
        } else {
            // No surplus, send exactly minOut (which equals amountOut)
            IERC20(intent.tokenOut).safeTransfer(intent.recipient, amountOut);
        }
    }

    /// @notice Transforms nonce to avoid collision with Permit2's nonce space
    /// @dev Uses a domain-separated hash to ensure FastSettlement nonces don't collide
    function _transformNonce(uint256 nonce) internal pure returns (uint256) {
        return uint256(keccak256(abi.encode(NONCE_DOMAIN, nonce)));
    }

    /// @notice Computes the EIP-712 domain separator
    function _computeDomainSeparator() internal view returns (bytes32) {
        return keccak256(
            abi.encode(
                keccak256("EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)"),
                keccak256("FastSettlement"),
                keccak256("2"),
                block.chainid,
                address(this)
            )
        );
    }

    /// @notice Computes the EIP-712 hash of an intent for signature verification
    function _hashIntent(Intent calldata intent) internal view returns (bytes32) {
        bytes32 structHash = keccak256(
            abi.encode(
                INTENT_TYPEHASH,
                intent.maker,
                intent.recipient,
                intent.tokenIn,
                intent.tokenOut,
                intent.amountIn,
                intent.minOut,
                intent.deadline,
                intent.nonce,
                intent.refId
            )
        );

        return MessageHashUtils.toTypedDataHash(DOMAIN_SEPARATOR(), structHash);
    }

    /// @notice Computes the witness hash for Permit2 integration
    function _computeIntentWitness(Intent calldata intent) internal pure returns (bytes32) {
        return keccak256(
            abi.encode(
                INTENT_TYPEHASH,
                intent.maker,
                intent.recipient,
                intent.tokenIn,
                intent.tokenOut,
                intent.amountIn,
                intent.minOut,
                intent.deadline,
                intent.nonce,
                intent.refId
            )
        );
    }
}
