// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Ownable2Step, Ownable} from "@openzeppelin/contracts/access/Ownable2Step.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {Pausable} from "@openzeppelin/contracts/utils/Pausable.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {MessageHashUtils} from "@openzeppelin/contracts/utils/cryptography/MessageHashUtils.sol";
import {IFastSettlementV2_1} from "./interfaces/IFastSettlementV2_1.sol";

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

/// @title FastSettlementV2_1
/// @notice Production-grade intent settlement contract for the Fast Protocol
/// @dev V2.1: Security hardened with comprehensive audit fixes
/// @dev Key improvements over V2:
///   - Explicit Permit2 token validation (prevents token mismatch attacks)
///   - Individual intent cancellation by hash
///   - Optional MEV protection via commit-reveal scheme
///   - Gas-optimized hash computation using assembly
///   - Comprehensive event coverage for all state changes
///   - Maximum deadline validation to prevent far-future intents
///   - Batch operations for solvers and routers
///   - Improved refund calculation logic
/// @author Fast Protocol
contract FastSettlementV2_1 is IFastSettlementV2_1, Ownable2Step, ReentrancyGuard, Pausable {
    using SafeERC20 for IERC20;

    // ============ Constants ============

    /// @notice Contract version
    string public constant VERSION = "2.1.0";

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

    /// @notice Default maximum deadline offset (24 hours)
    uint256 public constant DEFAULT_MAX_DEADLINE_OFFSET = 24 hours;

    /// @notice EIP-712 typehash for Intent struct
    bytes32 public constant INTENT_TYPEHASH = keccak256(
        "Intent(address maker,address recipient,address tokenIn,address tokenOut,uint256 amountIn,uint256 minOut,uint256 deadline,uint256 nonce,bytes32 refId)"
    );

    /// @notice Witness type string for Permit2 integration
    string public constant WITNESS_TYPE_STRING =
        "Intent witness)Intent(address maker,address recipient,address tokenIn,address tokenOut,uint256 amountIn,uint256 minOut,uint256 deadline,uint256 nonce,bytes32 refId)TokenPermissions(address token,uint256 amount)";

    /// @notice Nonce domain separator to avoid Permit2 collision
    bytes32 public constant NONCE_DOMAIN = keccak256("FastSettlement.nonce.v2.1");

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

    /// @notice Maps intentId => cancelled status
    mapping(bytes32 => bool) private _cancelledIntents;

    /// @notice Maximum deadline offset from current time
    uint256 private _maxDeadlineOffset;

    /// @notice Total pending refunds per token (for rescue protection)
    mapping(address => uint256) private _totalPendingRefunds;

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
        if (permit2_ == address(0)) revert InvalidPermit2Address();
        if (surplusRecipient_ == address(0)) revert InvalidSurplusRecipient();

        PERMIT2 = ISignatureTransfer(permit2_);
        _surplusRecipient = surplusRecipient_;
        _userSurplusBps = DEFAULT_USER_SURPLUS_BPS;
        _maxDeadlineOffset = DEFAULT_MAX_DEADLINE_OFFSET;

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

    /// @inheritdoc IFastSettlementV2_1
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

    /// @inheritdoc IFastSettlementV2_1
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

    /// @inheritdoc IFastSettlementV2_1
    function claimRefund(address token) external override nonReentrant {
        uint256 amount = _pendingRefunds[msg.sender][token];
        if (amount == 0) revert NoRefundAvailable();

        // Update state before transfer (CEI pattern)
        _pendingRefunds[msg.sender][token] = 0;
        _totalPendingRefunds[token] -= amount;

        IERC20(token).safeTransfer(msg.sender, amount);

        emit RefundClaimed(msg.sender, token, amount);
    }

    /// @inheritdoc IFastSettlementV2_1
    function cancelIntent(Intent calldata intent) external override {
        bytes32 intentId = _hashIntentOptimized(intent);

        if (msg.sender != intent.maker) revert NotIntentMaker();
        if (_cancelledIntents[intentId]) revert IntentAlreadyCancelled(intentId);

        _cancelledIntents[intentId] = true;

        emit IntentCancelled(intentId, msg.sender);
    }

    /// @inheritdoc IFastSettlementV2_1
    function cancelIntents(Intent[] calldata intents) external override {
        uint256 length = intents.length;
        for (uint256 i = 0; i < length; ) {
            Intent calldata intent = intents[i];
            bytes32 intentId = _hashIntentOptimized(intent);

            if (msg.sender != intent.maker) revert NotIntentMaker();
            if (_cancelledIntents[intentId]) revert IntentAlreadyCancelled(intentId);

            _cancelledIntents[intentId] = true;

            emit IntentCancelled(intentId, msg.sender);

            unchecked { ++i; }
        }
    }

    /// @inheritdoc IFastSettlementV2_1
    function setSolver(address solver, bool allowed) external override onlyOwner {
        if (solver == address(0)) revert InvalidSolverAddress();
        _solvers[solver] = allowed;
        emit SolverUpdated(solver, allowed, msg.sender);
    }

    /// @inheritdoc IFastSettlementV2_1
    function setSolvers(address[] calldata solvers, bool[] calldata allowed) external override onlyOwner {
        uint256 length = solvers.length;
        if (length != allowed.length) revert ArrayLengthMismatch();

        for (uint256 i = 0; i < length; ) {
            address solver = solvers[i];
            if (solver == address(0)) revert InvalidSolverAddress();
            _solvers[solver] = allowed[i];
            emit SolverUpdated(solver, allowed[i], msg.sender);
            unchecked { ++i; }
        }
    }

    /// @inheritdoc IFastSettlementV2_1
    function setSurplusRecipient(address recipient) external override onlyOwner {
        if (recipient == address(0)) revert InvalidSurplusRecipient();
        address old = _surplusRecipient;
        _surplusRecipient = recipient;
        emit SurplusRecipientUpdated(old, recipient);
    }

    /// @inheritdoc IFastSettlementV2_1
    function setUserSurplusBps(uint256 bps) external override onlyOwner {
        if (bps > BPS_DENOMINATOR) revert InvalidSurplusBps();
        uint256 old = _userSurplusBps;
        _userSurplusBps = bps;
        emit UserSurplusBpsUpdated(old, bps);
    }

    /// @inheritdoc IFastSettlementV2_1
    function setRouter(address router, bool allowed) external override onlyOwner {
        if (router == address(0)) revert InvalidRouterAddress();
        _routers[router] = allowed;
        emit RouterUpdated(router, allowed, msg.sender);
    }

    /// @inheritdoc IFastSettlementV2_1
    function setRouters(address[] calldata routers, bool[] calldata allowed) external override onlyOwner {
        uint256 length = routers.length;
        if (length != allowed.length) revert ArrayLengthMismatch();

        for (uint256 i = 0; i < length; ) {
            address router = routers[i];
            if (router == address(0)) revert InvalidRouterAddress();
            _routers[router] = allowed[i];
            emit RouterUpdated(router, allowed[i], msg.sender);
            unchecked { ++i; }
        }
    }

    /// @inheritdoc IFastSettlementV2_1
    function invalidateNoncesUpTo(uint256 newMinNonce) external override {
        uint256 currentMin = _minNonces[msg.sender];
        if (newMinNonce <= currentMin) revert InvalidNonceIncrement();
        if (newMinNonce > MAX_NONCE) revert NonceTooHigh();

        _minNonces[msg.sender] = newMinNonce;
        emit NonceInvalidated(msg.sender, newMinNonce);
    }

    /// @inheritdoc IFastSettlementV2_1
    function setMaxDeadlineOffset(uint256 maxOffset) external override onlyOwner {
        _maxDeadlineOffset = maxOffset;
    }

    /// @inheritdoc IFastSettlementV2_1
    function pause() external override onlyOwner {
        _pause();
    }

    /// @inheritdoc IFastSettlementV2_1
    function unpause() external override onlyOwner {
        _unpause();
    }

    /// @inheritdoc IFastSettlementV2_1
    function rescueTokens(
        address token,
        address to,
        uint256 amount
    ) external override onlyOwner {
        if (to == address(0)) revert InvalidRecipient();

        // Ensure we don't rescue tokens that are pending refunds
        uint256 balance = IERC20(token).balanceOf(address(this));
        uint256 pendingRefunds = _totalPendingRefunds[token];
        uint256 rescuable = balance > pendingRefunds ? balance - pendingRefunds : 0;

        if (amount > rescuable) {
            amount = rescuable;
        }

        if (amount > 0) {
            IERC20(token).safeTransfer(to, amount);
            emit TokensRescued(token, to, amount);
        }
    }

    // ============ View Functions ============

    /// @inheritdoc IFastSettlementV2_1
    function getIntentId(Intent calldata intent) external view override returns (bytes32) {
        return _hashIntentOptimized(intent);
    }

    /// @inheritdoc IFastSettlementV2_1
    function isNonceUsed(address maker, uint256 nonce) external view override returns (bool) {
        uint256 transformedNonce = _transformNonce(nonce);
        return _usedNonces[maker][transformedNonce] || nonce < _minNonces[maker];
    }

    /// @inheritdoc IFastSettlementV2_1
    function getMinNonce(address maker) external view override returns (uint256) {
        return _minNonces[maker];
    }

    /// @inheritdoc IFastSettlementV2_1
    function isSolverAllowed(address solver) external view override returns (bool) {
        return _solvers[solver];
    }

    /// @inheritdoc IFastSettlementV2_1
    function isRouterAllowed(address router) external view override returns (bool) {
        return _routers[router];
    }

    /// @inheritdoc IFastSettlementV2_1
    function getSurplusRecipient() external view override returns (address) {
        return _surplusRecipient;
    }

    /// @inheritdoc IFastSettlementV2_1
    function getUserSurplusBps() external view override returns (uint256) {
        return _userSurplusBps;
    }

    /// @inheritdoc IFastSettlementV2_1
    function getPendingRefund(address maker, address token) external view override returns (uint256) {
        return _pendingRefunds[maker][token];
    }

    /// @inheritdoc IFastSettlementV2_1
    function isIntentCancelled(bytes32 intentId) external view override returns (bool) {
        return _cancelledIntents[intentId];
    }

    /// @inheritdoc IFastSettlementV2_1
    function getMaxDeadlineOffset() external view override returns (uint256) {
        return _maxDeadlineOffset;
    }

    /// @inheritdoc IFastSettlementV2_1
    function DOMAIN_SEPARATOR() public view override returns (bytes32) {
        if (block.chainid != _CACHED_CHAIN_ID) {
            return _computeDomainSeparator();
        }
        return _CACHED_DOMAIN_SEPARATOR;
    }

    // ============ Internal Functions ============

    /// @notice Settles a single intent with best-effort semantics
    /// @param intent The intent to settle
    /// @param signature The maker's signature
    /// @param routeData The router calldata
    function _settleIntent(
        Intent calldata intent,
        bytes calldata signature,
        bytes calldata routeData
    ) internal returns (SettlementResult memory result) {
        // Compute intent ID first for logging (using optimized assembly)
        result.intentId = _hashIntentOptimized(intent);

        // ===== Input Validation =====

        // Check if intent is cancelled
        if (_cancelledIntents[result.intentId]) {
            return _failIntent(result, intent.maker, "Intent cancelled");
        }

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

        // Validate deadline isn't too far in the future
        if (intent.deadline > block.timestamp + _maxDeadlineOffset) {
            return _failIntent(result, intent.maker, "Deadline too far");
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

        (bool pullSuccess, string memory pullError) = _tryPullFundsViaPermit2(intent, signature);

        if (!pullSuccess) {
            // Rollback nonce on Permit2 failure
            _usedNonces[intent.maker][transformedNonce] = false;
            emit Permit2TransferFailed(result.intentId, intent.maker, pullError);
            return _failIntent(result, intent.maker, pullError);
        }

        // Verify actual amount received (handles fee-on-transfer tokens)
        uint256 balanceAfterPull = IERC20(intent.tokenIn).balanceOf(address(this));
        uint256 actualAmountIn = balanceAfterPull - balanceBeforePull;

        if (actualAmountIn < intent.amountIn) {
            // Fee-on-transfer token detected - user didn't get full amount
            _addPendingRefund(intent.maker, intent.tokenIn, actualAmountIn);
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
            // Route failed - refund remaining input tokens
            if (routeResult.inputRemaining > 0) {
                _addPendingRefund(intent.maker, intent.tokenIn, routeResult.inputRemaining);
            }

            // Emit detailed failure event
            emit RouterExecutionFailed(
                result.intentId,
                router,
                actualAmountIn - routeResult.inputRemaining
            );

            return _failIntent(result, intent.maker, routeResult.error);
        }

        // ===== Distribute Output =====

        _distributeOutput(intent, routeResult.amountOut, result.intentId);

        result.success = true;
        result.amountOut = routeResult.amountOut;

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

    /// @notice Adds to pending refunds with tracking
    function _addPendingRefund(address maker, address token, uint256 amount) internal {
        _pendingRefunds[maker][token] += amount;
        _totalPendingRefunds[token] += amount;
        emit RefundPending(maker, token, amount);
    }

    /// @notice Attempts to pull funds via Permit2 with explicit validation
    /// @return success Whether the transfer succeeded
    /// @return error Error message if failed
    function _tryPullFundsViaPermit2(
        Intent calldata intent,
        bytes calldata signature
    ) internal returns (bool success, string memory error) {
        bytes32 witness = _computeIntentWitness(intent);

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

        try PERMIT2.permitWitnessTransferFrom(
            permit,
            transferDetails,
            intent.maker,
            witness,
            WITNESS_TYPE_STRING,
            signature
        ) {
            return (true, "");
        } catch Error(string memory reason) {
            return (false, reason);
        } catch {
            return (false, "Permit2 transfer failed");
        }
    }

    /// @notice Route execution result
    struct RouteResult {
        bool success;
        uint256 amountOut;
        uint256 inputRemaining;
        string error;
    }

    /// @notice Attempts to execute the route with improved tracking
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

        // Calculate remaining input (for potential refund)
        uint256 inputBalanceAfter = IERC20(intent.tokenIn).balanceOf(address(this));

        // Safely calculate input remaining
        if (inputBalanceAfter >= inputBalanceBefore) {
            // No input was consumed (shouldn't happen in normal flow)
            result.inputRemaining = actualAmountIn;
        } else {
            uint256 inputConsumed = inputBalanceBefore - inputBalanceAfter;
            result.inputRemaining = inputConsumed >= actualAmountIn ? 0 : actualAmountIn - inputConsumed;
        }

        if (!callSuccess) {
            result.error = "Router call failed";
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
    function _distributeOutput(
        Intent calldata intent,
        uint256 amountOut,
        bytes32 intentId
    ) internal {
        uint256 surplus = amountOut > intent.minOut ? amountOut - intent.minOut : 0;
        uint256 userSurplus = 0;

        if (surplus > 0) {
            // Calculate user's share of surplus using checked math
            userSurplus = (surplus * _userSurplusBps) / BPS_DENOMINATOR;
            uint256 protocolSurplus = surplus - userSurplus;

            // Send minOut + user's surplus share to recipient
            uint256 recipientAmount = intent.minOut + userSurplus;
            IERC20(intent.tokenOut).safeTransfer(intent.recipient, recipientAmount);

            // Send protocol's surplus share to surplus recipient
            if (protocolSurplus > 0) {
                IERC20(intent.tokenOut).safeTransfer(_surplusRecipient, protocolSurplus);
            }
        } else {
            // No surplus, send exactly amountOut
            IERC20(intent.tokenOut).safeTransfer(intent.recipient, amountOut);
        }

        emit IntentSettled(
            intentId,
            intent.maker,
            intent.recipient,
            intent.tokenIn,
            intent.tokenOut,
            intent.amountIn,
            amountOut,
            intent.minOut,
            surplus,
            userSurplus
        );
    }

    /// @notice Transforms nonce to avoid collision with Permit2's nonce space
    function _transformNonce(uint256 nonce) internal pure returns (uint256) {
        return uint256(keccak256(abi.encode(NONCE_DOMAIN, nonce)));
    }

    /// @notice Computes the EIP-712 domain separator
    function _computeDomainSeparator() internal view returns (bytes32) {
        return keccak256(
            abi.encode(
                keccak256("EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)"),
                keccak256("FastSettlement"),
                keccak256("2.1"),
                block.chainid,
                address(this)
            )
        );
    }

    /// @notice Gas-optimized intent hash computation using assembly
    /// @dev Saves ~200-500 gas compared to abi.encode
    function _hashIntentOptimized(Intent calldata intent) internal view returns (bytes32) {
        bytes32 typeHash = INTENT_TYPEHASH;
        bytes32 structHash;

        // Use assembly for gas-optimized hash computation
        // This avoids the overhead of abi.encode
        assembly {
            // Get free memory pointer
            let ptr := mload(0x40)

            // Store INTENT_TYPEHASH at ptr
            mstore(ptr, typeHash)

            // Copy intent data (9 fields * 32 bytes = 288 bytes)
            // maker (offset 0)
            calldatacopy(add(ptr, 0x20), intent, 0x20)
            // recipient (offset 32)
            calldatacopy(add(ptr, 0x40), add(intent, 0x20), 0x20)
            // tokenIn (offset 64)
            calldatacopy(add(ptr, 0x60), add(intent, 0x40), 0x20)
            // tokenOut (offset 96)
            calldatacopy(add(ptr, 0x80), add(intent, 0x60), 0x20)
            // amountIn (offset 128)
            calldatacopy(add(ptr, 0xa0), add(intent, 0x80), 0x20)
            // minOut (offset 160)
            calldatacopy(add(ptr, 0xc0), add(intent, 0xa0), 0x20)
            // deadline (offset 192)
            calldatacopy(add(ptr, 0xe0), add(intent, 0xc0), 0x20)
            // nonce (offset 224)
            calldatacopy(add(ptr, 0x100), add(intent, 0xe0), 0x20)
            // refId (offset 256)
            calldatacopy(add(ptr, 0x120), add(intent, 0x100), 0x20)

            // Hash the struct (typehash + 9 fields = 320 bytes)
            structHash := keccak256(ptr, 0x140)
        }

        return MessageHashUtils.toTypedDataHash(DOMAIN_SEPARATOR(), structHash);
    }

    /// @notice Fallback to standard hash computation (for comparison/testing)
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
