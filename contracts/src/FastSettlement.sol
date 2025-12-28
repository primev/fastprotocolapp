// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {ECDSA} from "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import {MessageHashUtils} from "@openzeppelin/contracts/utils/cryptography/MessageHashUtils.sol";

/// @notice Minimal interface for Permit2 SignatureTransfer
/// @dev We use a minimal interface to avoid version conflicts with Permit2's =0.8.17 pragma
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
import {IFastSettlement} from "./interfaces/IFastSettlement.sol";

/// @title FastSettlement
/// @notice Production-grade intent settlement contract for the Fast Protocol
/// @dev Implements EIP-712 signed intents with Permit2 integration for fund transfers
/// @author Fast
contract FastSettlement is IFastSettlement, Ownable, ReentrancyGuard {
    using SafeERC20 for IERC20;

    // ============ Constants ============

    /// @notice The Permit2 contract address (canonical deployment)
    ISignatureTransfer public immutable PERMIT2;

    /// @notice EIP-712 typehash for Intent struct
    bytes32 public constant INTENT_TYPEHASH = keccak256(
        "Intent(address maker,address recipient,address tokenIn,address tokenOut,uint256 amountIn,uint256 minOut,uint64 deadline,uint256 nonce,bytes32 refId)"
    );

    /// @notice Witness type string for Permit2 integration
    /// @dev Must match the Intent struct for combined signature verification
    string public constant WITNESS_TYPE_STRING =
        "Intent witness)Intent(address maker,address recipient,address tokenIn,address tokenOut,uint256 amountIn,uint256 minOut,uint64 deadline,uint256 nonce,bytes32 refId)TokenPermissions(address token,uint256 amount)";

    // ============ Storage ============

    /// @notice Maps solver address to authorization status
    mapping(address => bool) private _solvers;

    /// @notice Maps router address to allowlist status
    mapping(address => bool) private _routers;

    /// @notice Maps maker => nonce => used status
    mapping(address => mapping(uint256 => bool)) private _usedNonces;

    /// @notice Maps maker => minimum valid nonce
    mapping(address => uint256) private _minNonces;

    /// @notice Address that receives surplus (amountOut - minOut)
    address private _surplusRecipient;

    /// @notice EIP-712 domain separator cached at deployment
    bytes32 private immutable _DOMAIN_SEPARATOR;

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
        require(permit2_ != address(0), "Invalid Permit2 address");
        require(surplusRecipient_ != address(0), "Invalid surplus recipient");

        PERMIT2 = ISignatureTransfer(permit2_);
        _surplusRecipient = surplusRecipient_;

        _DOMAIN_SEPARATOR = keccak256(
            abi.encode(
                keccak256("EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)"),
                keccak256("FastSettlement"),
                keccak256("1"),
                block.chainid,
                address(this)
            )
        );
    }

    // ============ Modifiers ============

    /// @notice Restricts function to authorized solvers only
    modifier onlySolver() {
        if (!_solvers[msg.sender]) revert UnauthorizedSolver();
        _;
    }

    // ============ External Functions ============

    /// @inheritdoc IFastSettlement
    function settleBatch(
        Intent[] calldata intents,
        bytes[] calldata signatures,
        bytes[] calldata routeDatas
    ) external override onlySolver nonReentrant returns (SettlementResult[] memory results) {
        uint256 length = intents.length;
        if (length != signatures.length || length != routeDatas.length) {
            revert ArrayLengthMismatch();
        }

        results = new SettlementResult[](length);

        for (uint256 i = 0; i < length; ) {
            results[i] = _settleIntent(intents[i], signatures[i], routeDatas[i]);
            unchecked { ++i; }
        }
    }

    /// @inheritdoc IFastSettlement
    function settle(
        Intent calldata intent,
        bytes calldata signature,
        bytes calldata routeData
    ) external override onlySolver nonReentrant returns (bytes32 intentId, uint256 amountOut) {
        SettlementResult memory result = _settleIntent(intent, signature, routeData);

        // For single settle, we revert on failure instead of returning failure status
        if (!result.success) {
            revert(result.error);
        }

        return (result.intentId, result.amountOut);
    }

    /// @inheritdoc IFastSettlement
    function setSolver(address solver, bool allowed) external override onlyOwner {
        _solvers[solver] = allowed;
        emit SolverUpdated(solver, allowed);
    }

    /// @inheritdoc IFastSettlement
    function setSurplusRecipient(address recipient) external override onlyOwner {
        if (recipient == address(0)) revert InvalidSurplusRecipient();
        address old = _surplusRecipient;
        _surplusRecipient = recipient;
        emit SurplusRecipientUpdated(old, recipient);
    }

    /// @inheritdoc IFastSettlement
    function setRouter(address router, bool allowed) external override onlyOwner {
        _routers[router] = allowed;
        emit RouterUpdated(router, allowed);
    }

    /// @inheritdoc IFastSettlement
    function invalidateNoncesUpTo(uint256 newMinNonce) external override {
        uint256 currentMin = _minNonces[msg.sender];
        require(newMinNonce > currentMin, "New min must be greater");
        _minNonces[msg.sender] = newMinNonce;
        emit NonceInvalidated(msg.sender, newMinNonce);
    }

    // ============ View Functions ============

    /// @inheritdoc IFastSettlement
    function getIntentId(Intent calldata intent) external view override returns (bytes32) {
        return _hashIntent(intent);
    }

    /// @inheritdoc IFastSettlement
    function isNonceUsed(address maker, uint256 nonce) external view override returns (bool) {
        return _usedNonces[maker][nonce] || nonce < _minNonces[maker];
    }

    /// @inheritdoc IFastSettlement
    function getMinNonce(address maker) external view override returns (uint256) {
        return _minNonces[maker];
    }

    /// @inheritdoc IFastSettlement
    function isSolverAllowed(address solver) external view override returns (bool) {
        return _solvers[solver];
    }

    /// @inheritdoc IFastSettlement
    function isRouterAllowed(address router) external view override returns (bool) {
        return _routers[router];
    }

    /// @inheritdoc IFastSettlement
    function getSurplusRecipient() external view override returns (address) {
        return _surplusRecipient;
    }

    /// @inheritdoc IFastSettlement
    function DOMAIN_SEPARATOR() external view override returns (bytes32) {
        return _DOMAIN_SEPARATOR;
    }

    // ============ Internal Functions ============

    /// @notice Settles a single intent with best-effort semantics
    /// @dev Returns success/failure status instead of reverting
    function _settleIntent(
        Intent calldata intent,
        bytes calldata signature,
        bytes calldata routeData
    ) internal returns (SettlementResult memory result) {
        // Compute intent ID first for logging
        result.intentId = _hashIntent(intent);

        // Validate deadline
        if (block.timestamp > intent.deadline) {
            result.success = false;
            result.error = "Deadline passed";
            emit IntentFailed(result.intentId, intent.maker, result.error);
            return result;
        }

        // Validate recipient
        if (intent.recipient == address(0)) {
            result.success = false;
            result.error = "Invalid recipient";
            emit IntentFailed(result.intentId, intent.maker, result.error);
            return result;
        }

        // Validate nonce
        if (_usedNonces[intent.maker][intent.nonce] || intent.nonce < _minNonces[intent.maker]) {
            result.success = false;
            result.error = "Invalid nonce";
            emit IntentFailed(result.intentId, intent.maker, result.error);
            return result;
        }

        // Mark nonce as used BEFORE external calls (CEI pattern)
        _usedNonces[intent.maker][intent.nonce] = true;

        // Pull funds from maker via Permit2
        try this._pullFundsViaPermit2(intent, signature) {
            // Funds pulled successfully
        } catch Error(string memory reason) {
            // Rollback nonce on failure
            _usedNonces[intent.maker][intent.nonce] = false;
            result.success = false;
            result.error = reason;
            emit IntentFailed(result.intentId, intent.maker, result.error);
            return result;
        } catch {
            _usedNonces[intent.maker][intent.nonce] = false;
            result.success = false;
            result.error = "Permit2 transfer failed";
            emit IntentFailed(result.intentId, intent.maker, result.error);
            return result;
        }

        // Execute routing and distribute output
        try this._executeRouteAndDistribute(intent, routeData) returns (uint256 amountOut) {
            result.success = true;
            result.amountOut = amountOut;

            uint256 surplus = amountOut > intent.minOut ? amountOut - intent.minOut : 0;

            emit IntentSettled(
                result.intentId,
                intent.maker,
                intent.tokenIn,
                intent.tokenOut,
                intent.amountIn,
                amountOut,
                intent.minOut,
                surplus
            );
        } catch Error(string memory reason) {
            // On routing failure, we need to return the input tokens to the maker
            // This is critical for user safety
            IERC20(intent.tokenIn).safeTransfer(intent.maker, intent.amountIn);

            result.success = false;
            result.error = reason;
            emit IntentFailed(result.intentId, intent.maker, result.error);
        } catch {
            // Return funds on unknown error
            IERC20(intent.tokenIn).safeTransfer(intent.maker, intent.amountIn);

            result.success = false;
            result.error = "Route execution failed";
            emit IntentFailed(result.intentId, intent.maker, result.error);
        }

        return result;
    }

    /// @notice Pulls funds from maker via Permit2 with witness
    /// @dev External function to allow try/catch, but only callable internally
    function _pullFundsViaPermit2(
        Intent calldata intent,
        bytes calldata signature
    ) external {
        require(msg.sender == address(this), "Internal only");

        // Compute the intent hash as witness
        bytes32 witness = _computeIntentWitness(intent);

        // Construct Permit2 transfer request
        ISignatureTransfer.PermitTransferFrom memory permit = ISignatureTransfer.PermitTransferFrom({
            permitted: ISignatureTransfer.TokenPermissions({
                token: intent.tokenIn,
                amount: intent.amountIn
            }),
            nonce: intent.nonce,
            deadline: intent.deadline
        });

        ISignatureTransfer.SignatureTransferDetails memory transferDetails =
            ISignatureTransfer.SignatureTransferDetails({
                to: address(this),
                requestedAmount: intent.amountIn
            });

        // Execute Permit2 transfer with witness verification
        PERMIT2.permitWitnessTransferFrom(
            permit,
            transferDetails,
            intent.maker,
            witness,
            WITNESS_TYPE_STRING,
            signature
        );
    }

    /// @notice Executes the router call and distributes output tokens
    /// @dev External function to allow try/catch, but only callable internally
    function _executeRouteAndDistribute(
        Intent calldata intent,
        bytes calldata routeData
    ) external returns (uint256 amountOut) {
        require(msg.sender == address(this), "Internal only");

        // Decode router target from routeData
        // Format: [20 bytes router address][remaining bytes calldata]
        require(routeData.length >= 20, "Invalid routeData");
        address router = address(bytes20(routeData[:20]));
        bytes calldata routerCalldata = routeData[20:];

        // Validate router is allowlisted
        if (!_routers[router]) revert RouterNotAllowed(router);

        // Record balance before routing
        uint256 balanceBefore = IERC20(intent.tokenOut).balanceOf(address(this));

        // Approve router to spend input tokens
        IERC20(intent.tokenIn).forceApprove(router, intent.amountIn);

        // Execute router call
        (bool success, ) = router.call(routerCalldata);
        if (!success) revert RouterCallFailed();

        // Clear any remaining approval for safety
        IERC20(intent.tokenIn).forceApprove(router, 0);

        // Calculate actual output using balance delta (don't trust return values)
        uint256 balanceAfter = IERC20(intent.tokenOut).balanceOf(address(this));
        amountOut = balanceAfter - balanceBefore;

        // Enforce minimum output
        if (amountOut < intent.minOut) {
            revert InsufficientOutput(amountOut, intent.minOut);
        }

        // Distribute output: minOut to recipient, surplus to surplus recipient
        IERC20(intent.tokenOut).safeTransfer(intent.recipient, intent.minOut);

        uint256 surplus = amountOut - intent.minOut;
        if (surplus > 0) {
            IERC20(intent.tokenOut).safeTransfer(_surplusRecipient, surplus);
        }

        return amountOut;
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

        return MessageHashUtils.toTypedDataHash(_DOMAIN_SEPARATOR, structHash);
    }

    /// @notice Computes the witness hash for Permit2 integration
    /// @dev This is the struct hash without the domain separator
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

    // ============ Emergency Functions ============

    /// @notice Allows owner to rescue tokens accidentally sent to the contract
    /// @dev Should only be used in emergencies, not for normal operations
    /// @param token The token to rescue
    /// @param to The recipient address
    /// @param amount The amount to rescue
    function rescueTokens(address token, address to, uint256 amount) external onlyOwner {
        IERC20(token).safeTransfer(to, amount);
    }
}
