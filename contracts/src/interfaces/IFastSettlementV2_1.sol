// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/// @title IFastSettlementV2_1
/// @notice Interface for Fast Protocol Intent Settlement V2.1
/// @dev Security-hardened version with fixes from audit findings
/// @dev V2.1 Changes:
///   - Added explicit Permit2 token validation
///   - Added individual intent cancellation by hash
///   - Improved surplus calculation precision
///   - Added comprehensive event coverage
///   - Gas optimizations via assembly
///   - Maximum deadline validation
/// @dev Note: MEV protection not needed - intents are routed privately to solvers
interface IFastSettlementV2_1 {
    // ============ Structs ============

    /// @notice Represents a user's signed swap intent
    /// @param maker The address that signed the intent and owns the input tokens
    /// @param recipient The address that will receive the output tokens (can differ from maker)
    /// @param tokenIn The ERC20 token being sold
    /// @param tokenOut The ERC20 token being bought
    /// @param amountIn The exact amount of tokenIn to sell (exactIn model)
    /// @param minOut The minimum amount of tokenOut the user must receive (slippage protection)
    /// @param deadline Unix timestamp after which the intent is invalid
    /// @param nonce Unique identifier to prevent replay attacks
    /// @param refId Optional reference ID for UI/offchain correlation
    struct Intent {
        address maker;
        address recipient;
        address tokenIn;
        address tokenOut;
        uint256 amountIn;
        uint256 minOut;
        uint256 deadline;
        uint256 nonce;
        bytes32 refId;
    }

    /// @notice Result of settling an individual intent
    /// @param intentId The computed hash of the intent
    /// @param success Whether the settlement succeeded
    /// @param amountOut Actual amount of tokenOut received (0 if failed)
    /// @param error Error message if failed (empty if succeeded)
    struct SettlementResult {
        bytes32 intentId;
        bool success;
        uint256 amountOut;
        string error;
    }

    // ============ Events ============

    /// @notice Emitted when an intent is successfully settled
    /// @param intentId The computed hash of the intent
    /// @param maker The address that signed the intent
    /// @param recipient The address that received the output
    /// @param tokenIn The token sold
    /// @param tokenOut The token bought
    /// @param amountIn The amount of tokenIn sold
    /// @param amountOut The actual amount of tokenOut received
    /// @param minOut The minimum amount that was guaranteed
    /// @param totalSurplus Total surplus (amountOut - minOut)
    /// @param userSurplus User's share of the surplus
    event IntentSettled(
        bytes32 indexed intentId,
        address indexed maker,
        address indexed recipient,
        address tokenIn,
        address tokenOut,
        uint256 amountIn,
        uint256 amountOut,
        uint256 minOut,
        uint256 totalSurplus,
        uint256 userSurplus
    );

    /// @notice Emitted when an intent settlement fails in a batch
    /// @param intentId The computed hash of the intent
    /// @param maker The address that signed the intent
    /// @param reason The reason for failure
    event IntentFailed(
        bytes32 indexed intentId,
        address indexed maker,
        string reason
    );

    /// @notice Emitted when a refund is pending for a maker
    /// @param maker The address that will receive the refund
    /// @param token The token to be refunded
    /// @param amount The amount to be refunded
    event RefundPending(
        address indexed maker,
        address indexed token,
        uint256 amount
    );

    /// @notice Emitted when a maker claims their refund
    /// @param maker The address that claimed the refund
    /// @param token The token refunded
    /// @param amount The amount refunded
    event RefundClaimed(
        address indexed maker,
        address indexed token,
        uint256 amount
    );

    /// @notice Emitted when a solver's authorization status changes
    /// @param solver The solver address
    /// @param allowed Whether the solver is now allowed
    /// @param updatedBy The address that made the change
    event SolverUpdated(
        address indexed solver,
        bool allowed,
        address indexed updatedBy
    );

    /// @notice Emitted when the surplus recipient is updated
    /// @param oldRecipient The previous surplus recipient
    /// @param newRecipient The new surplus recipient
    event SurplusRecipientUpdated(
        address indexed oldRecipient,
        address indexed newRecipient
    );

    /// @notice Emitted when the user surplus basis points is updated
    /// @param oldBps The previous basis points
    /// @param newBps The new basis points
    event UserSurplusBpsUpdated(uint256 oldBps, uint256 newBps);

    /// @notice Emitted when a router's allowlist status changes
    /// @param router The router address
    /// @param allowed Whether the router is now allowed
    /// @param updatedBy The address that made the change
    event RouterUpdated(
        address indexed router,
        bool allowed,
        address indexed updatedBy
    );

    /// @notice Emitted when a user invalidates their nonces up to a certain value
    /// @param maker The user who invalidated nonces
    /// @param newMinNonce The new minimum valid nonce
    event NonceInvalidated(address indexed maker, uint256 newMinNonce);

    /// @notice Emitted when a specific intent is cancelled by hash
    /// @param intentId The cancelled intent hash
    /// @param maker The maker who cancelled
    event IntentCancelled(bytes32 indexed intentId, address indexed maker);

    /// @notice Emitted when tokens are rescued by owner
    /// @param token The token rescued
    /// @param to The recipient of rescued tokens
    /// @param amount The amount rescued
    event TokensRescued(
        address indexed token,
        address indexed to,
        uint256 amount
    );

    /// @notice Emitted when Permit2 transfer fails
    /// @param intentId The intent that failed
    /// @param maker The maker whose transfer failed
    /// @param reason The failure reason
    event Permit2TransferFailed(
        bytes32 indexed intentId,
        address indexed maker,
        string reason
    );

    /// @notice Emitted when router execution fails
    /// @param intentId The intent that failed
    /// @param router The router that failed
    /// @param inputConsumed Amount of input tokens consumed before failure
    event RouterExecutionFailed(
        bytes32 indexed intentId,
        address indexed router,
        uint256 inputConsumed
    );

    // ============ Errors ============

    /// @notice Thrown when caller is not an authorized solver
    error UnauthorizedSolver();

    /// @notice Thrown when settlement fails with details
    error SettlementFailed(bytes32 intentId, string reason);

    /// @notice Thrown when the output amount is below minOut
    error InsufficientOutput(uint256 received, uint256 required);

    /// @notice Thrown when a router is not in the allowlist
    error RouterNotAllowed(address router);

    /// @notice Thrown when array lengths don't match
    error ArrayLengthMismatch();

    /// @notice Thrown when batch is empty
    error EmptyBatch();

    /// @notice Thrown when batch exceeds maximum size
    error BatchTooLarge(uint256 provided, uint256 maximum);

    /// @notice Thrown when trying to set zero address as surplus recipient
    error InvalidSurplusRecipient();

    /// @notice Thrown when surplus basis points exceeds 100%
    error InvalidSurplusBps();

    /// @notice Thrown when recipient address is zero
    error InvalidRecipient();

    /// @notice Thrown when Permit2 address is zero
    error InvalidPermit2Address();

    /// @notice Thrown when owner address is zero
    error InvalidOwnerAddress();

    /// @notice Thrown when solver address is zero
    error InvalidSolverAddress();

    /// @notice Thrown when router address is zero
    error InvalidRouterAddress();

    /// @notice Thrown when nonce increment is invalid
    error InvalidNonceIncrement();

    /// @notice Thrown when nonce exceeds maximum allowed value
    error NonceTooHigh();

    /// @notice Thrown when no refund is available to claim
    error NoRefundAvailable();

    /// @notice Thrown when the router call failed
    error RouterCallFailed();

    /// @notice Thrown when permit token doesn't match intent tokenIn
    error PermitTokenMismatch(address permitToken, address intentToken);

    /// @notice Thrown when permit amount is less than intent amountIn
    error PermitAmountInsufficient(uint256 permitAmount, uint256 requiredAmount);

    /// @notice Thrown when intent is already cancelled
    error IntentAlreadyCancelled(bytes32 intentId);

    /// @notice Thrown when caller is not the intent maker
    error NotIntentMaker();

    /// @notice Thrown when deadline is too far in the future
    error DeadlineTooFar(uint256 deadline, uint256 maxDeadline);

    /// @notice Thrown when token address is zero
    error ZeroTokenAddress();

    /// @notice Thrown when amount is zero
    error ZeroAmount();

    /// @notice Thrown when trying to swap same token
    error SameTokenSwap();

    // ============ External Functions ============

    /// @notice Settles multiple intents in a single transaction (best-effort)
    /// @dev Each intent is settled independently; failures don't prevent other settlements
    /// @param intents Array of Intent structs to settle
    /// @param signatures Array of EIP-712 signatures from makers
    /// @param routeDatas Array of calldata for router calls (format: [20 bytes router][calldata])
    /// @return results Array of settlement results for each intent
    function settleBatch(
        Intent[] calldata intents,
        bytes[] calldata signatures,
        bytes[] calldata routeDatas
    ) external returns (SettlementResult[] memory results);

    /// @notice Settles a single intent
    /// @param intent The Intent struct to settle
    /// @param signature EIP-712 signature from the maker
    /// @param routeData Calldata for the router call (format: [20 bytes router][calldata])
    /// @return intentId The hash of the settled intent
    /// @return amountOut The actual amount of tokenOut received
    function settle(
        Intent calldata intent,
        bytes calldata signature,
        bytes calldata routeData
    ) external returns (bytes32 intentId, uint256 amountOut);

    /// @notice Claims pending refund for a specific token
    /// @dev Uses pull pattern for safety against malicious token callbacks
    /// @param token The token to claim refund for
    function claimRefund(address token) external;

    /// @notice Cancels a specific intent by its hash
    /// @dev Only the maker can cancel their own intent
    /// @param intent The intent to cancel
    function cancelIntent(Intent calldata intent) external;

    /// @notice Cancels multiple intents by their hashes
    /// @param intents The intents to cancel
    function cancelIntents(Intent[] calldata intents) external;

    /// @notice Adds or removes a solver from the allowlist
    /// @dev Only callable by owner
    /// @param solver The solver address to update
    /// @param allowed Whether the solver should be allowed
    function setSolver(address solver, bool allowed) external;

    /// @notice Batch update multiple solvers
    /// @dev Only callable by owner
    /// @param solvers Array of solver addresses
    /// @param allowed Array of allowed statuses
    function setSolvers(address[] calldata solvers, bool[] calldata allowed) external;

    /// @notice Sets the address that receives protocol's share of surplus output
    /// @dev Only callable by owner
    /// @param recipient The new surplus recipient address
    function setSurplusRecipient(address recipient) external;

    /// @notice Sets the user's share of surplus in basis points
    /// @dev Only callable by owner. 10000 = 100%, 5000 = 50%
    /// @param bps The new basis points value
    function setUserSurplusBps(uint256 bps) external;

    /// @notice Adds or removes a router from the allowlist
    /// @dev Only callable by owner
    /// @param router The router address to update
    /// @param allowed Whether the router should be allowed
    function setRouter(address router, bool allowed) external;

    /// @notice Batch update multiple routers
    /// @dev Only callable by owner
    /// @param routers Array of router addresses
    /// @param allowed Array of allowed statuses
    function setRouters(address[] calldata routers, bool[] calldata allowed) external;

    /// @notice Invalidates all nonces below the specified value for the caller
    /// @dev Useful for cancelling multiple pending intents
    /// @param newMinNonce The new minimum valid nonce (must be > current min, < MAX_NONCE)
    function invalidateNoncesUpTo(uint256 newMinNonce) external;

    /// @notice Sets the maximum allowed deadline offset
    /// @dev Only callable by owner
    /// @param maxOffset Maximum seconds from now for deadline
    function setMaxDeadlineOffset(uint256 maxOffset) external;

    /// @notice Pauses the contract
    /// @dev Only callable by owner
    function pause() external;

    /// @notice Unpauses the contract
    /// @dev Only callable by owner
    function unpause() external;

    /// @notice Allows owner to rescue tokens accidentally sent to the contract
    /// @dev Only callable by owner. Cannot rescue tokens that are pending refunds.
    /// @param token The token to rescue
    /// @param to The recipient address
    /// @param amount The amount to rescue
    function rescueTokens(address token, address to, uint256 amount) external;

    // ============ View Functions ============

    /// @notice Computes the intent ID (EIP-712 hash)
    /// @param intent The intent to hash
    /// @return The EIP-712 typed data hash
    function getIntentId(Intent calldata intent) external view returns (bytes32);

    /// @notice Checks if a nonce has been used
    /// @param maker The maker address
    /// @param nonce The nonce to check
    /// @return Whether the nonce has been used
    function isNonceUsed(address maker, uint256 nonce) external view returns (bool);

    /// @notice Gets the minimum valid nonce for a maker
    /// @param maker The maker address
    /// @return The minimum valid nonce
    function getMinNonce(address maker) external view returns (uint256);

    /// @notice Checks if a solver is authorized
    /// @param solver The solver address to check
    /// @return Whether the solver is authorized
    function isSolverAllowed(address solver) external view returns (bool);

    /// @notice Checks if a router is in the allowlist
    /// @param router The router address to check
    /// @return Whether the router is allowed
    function isRouterAllowed(address router) external view returns (bool);

    /// @notice Gets the current surplus recipient
    /// @return The surplus recipient address
    function getSurplusRecipient() external view returns (address);

    /// @notice Gets the current user surplus share in basis points
    /// @return The basis points value (5000 = 50%)
    function getUserSurplusBps() external view returns (uint256);

    /// @notice Gets the pending refund amount for a maker
    /// @param maker The maker address
    /// @param token The token address
    /// @return The pending refund amount
    function getPendingRefund(address maker, address token) external view returns (uint256);

    /// @notice Checks if an intent has been cancelled
    /// @param intentId The intent hash to check
    /// @return Whether the intent is cancelled
    function isIntentCancelled(bytes32 intentId) external view returns (bool);

    /// @notice Returns the maximum deadline offset
    /// @return Maximum seconds from now for deadline
    function getMaxDeadlineOffset() external view returns (uint256);

    /// @notice Returns the EIP-712 domain separator
    /// @dev Recomputes on chain fork for replay protection
    /// @return The domain separator hash
    function DOMAIN_SEPARATOR() external view returns (bytes32);

    /// @notice Returns the contract version
    /// @return Version string
    function VERSION() external pure returns (string memory);
}
