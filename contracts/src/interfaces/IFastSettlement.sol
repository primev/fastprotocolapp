// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/// @title IFastSettlement
/// @notice Interface for the Fast Protocol Intent Settlement
/// @dev Defines the structures, events, and functions for intent-based swaps
interface IFastSettlement {
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
        uint64 deadline;
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
    /// @param tokenIn The token sold
    /// @param tokenOut The token bought
    /// @param amountIn The amount of tokenIn sold
    /// @param amountOut The actual amount of tokenOut received
    /// @param minOut The minimum amount that was guaranteed
    /// @param surplusRouted Amount of surplus (amountOut - minOut) sent to surplus recipient
    event IntentSettled(
        bytes32 indexed intentId,
        address indexed maker,
        address tokenIn,
        address tokenOut,
        uint256 amountIn,
        uint256 amountOut,
        uint256 minOut,
        uint256 surplusRouted
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

    /// @notice Emitted when a solver's authorization status changes
    /// @param solver The solver address
    /// @param allowed Whether the solver is now allowed
    event SolverUpdated(address indexed solver, bool allowed);

    /// @notice Emitted when the surplus recipient is updated
    /// @param oldRecipient The previous surplus recipient
    /// @param newRecipient The new surplus recipient
    event SurplusRecipientUpdated(address indexed oldRecipient, address indexed newRecipient);

    /// @notice Emitted when a router's allowlist status changes
    /// @param router The router address
    /// @param allowed Whether the router is now allowed
    event RouterUpdated(address indexed router, bool allowed);

    /// @notice Emitted when a user invalidates their nonces up to a certain value
    /// @param maker The user who invalidated nonces
    /// @param newMinNonce The new minimum valid nonce
    event NonceInvalidated(address indexed maker, uint256 newMinNonce);

    // ============ Errors ============

    /// @notice Thrown when caller is not an authorized solver
    error UnauthorizedSolver();

    /// @notice Thrown when the intent deadline has passed
    error DeadlinePassed();

    /// @notice Thrown when the nonce has already been used or is below minimum
    error InvalidNonce();

    /// @notice Thrown when the signature is invalid
    error InvalidSignature();

    /// @notice Thrown when the output amount is below minOut
    error InsufficientOutput(uint256 received, uint256 required);

    /// @notice Thrown when a router is not in the allowlist
    error RouterNotAllowed(address router);

    /// @notice Thrown when the recipient address is zero
    error InvalidRecipient();

    /// @notice Thrown when array lengths don't match
    error ArrayLengthMismatch();

    /// @notice Thrown when trying to set zero address as surplus recipient
    error InvalidSurplusRecipient();

    /// @notice Thrown when the token transfer failed
    error TransferFailed();

    /// @notice Thrown when the router call failed
    error RouterCallFailed();

    // ============ External Functions ============

    /// @notice Settles multiple intents in a single transaction (best-effort)
    /// @dev Each intent is settled independently; failures don't prevent other settlements
    /// @param intents Array of Intent structs to settle
    /// @param signatures Array of EIP-712 signatures from makers
    /// @param routeDatas Array of calldata for router calls
    /// @return results Array of settlement results for each intent
    function settleBatch(
        Intent[] calldata intents,
        bytes[] calldata signatures,
        bytes[] calldata routeDatas
    ) external returns (SettlementResult[] memory results);

    /// @notice Settles a single intent
    /// @dev Convenience wrapper around settleBatch for single intents
    /// @param intent The Intent struct to settle
    /// @param signature EIP-712 signature from the maker
    /// @param routeData Calldata for the router call
    /// @return intentId The hash of the settled intent
    /// @return amountOut The actual amount of tokenOut received
    function settle(
        Intent calldata intent,
        bytes calldata signature,
        bytes calldata routeData
    ) external returns (bytes32 intentId, uint256 amountOut);

    /// @notice Adds or removes a solver from the allowlist
    /// @dev Only callable by owner
    /// @param solver The solver address to update
    /// @param allowed Whether the solver should be allowed
    function setSolver(address solver, bool allowed) external;

    /// @notice Sets the address that receives surplus output
    /// @dev Only callable by owner. Surplus = amountOut - minOut
    /// @param recipient The new surplus recipient address
    function setSurplusRecipient(address recipient) external;

    /// @notice Adds or removes a router from the allowlist
    /// @dev Only callable by owner
    /// @param router The router address to update
    /// @param allowed Whether the router should be allowed
    function setRouter(address router, bool allowed) external;

    /// @notice Invalidates all nonces below the specified value for the caller
    /// @dev Useful for cancelling multiple pending intents
    /// @param newMinNonce The new minimum valid nonce (must be > current min)
    function invalidateNoncesUpTo(uint256 newMinNonce) external;

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

    /// @notice Returns the EIP-712 domain separator
    /// @return The domain separator hash
    function DOMAIN_SEPARATOR() external view returns (bytes32);
}
