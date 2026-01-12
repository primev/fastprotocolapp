// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/// @notice Interface for the executor callback
interface IExecutor {
    /// @notice Callback function executed by the settlement contract
    /// @param intent The intent being settled
    /// @param inputData Arbitrary data passed by the executor
    function execute(IFastSettlementV2.Intent calldata intent, bytes calldata inputData) external;
}

/// @title IFastSettlementV2
/// @notice Interface for the Fast Protocol Intent Settlement V2
/// @dev Reactor-style settlement with direct Permit2 pulling
interface IFastSettlementV2 {
    // ============ Structs ============

    /// @notice Represents a user's signed swap intent
    struct Intent {
        address maker;
        address recipient;
        address tokenIn;
        address tokenOut;
        uint256 amountIn;
        uint256 amountOut; // Was minOut
        uint256 deadline;
        uint256 nonce;
        bytes32 refId;
    }

    // ============ Events ============

    /// @notice Emitted when an intent is successfully settled
    /// @param intentId The computed hash of the intent
    /// @param maker The address that signed the intent
    /// @param tokenIn The token sold
    /// @param tokenOut The token bought
    /// @param amountIn The amount of tokenIn sold
    /// @param amountOut The requested amountOut
    /// @param protocolAmt The amount (if any) collected by protocol (Surplus/Spread)
    event IntentSettled(
        bytes32 indexed intentId,
        address indexed maker,
        address indexed tokenIn,
        address tokenOut,
        uint256 amountIn,
        uint256 amountOut,
        uint256 protocolAmt
    );

    /// @notice Emitted when an executor's authorization status changes
    event ExecutorUpdated(address indexed executor, bool allowed);

    /// @notice Emitted when the whitelist mode changes
    event ExecutorWhitelistActiveUpdated(bool active);

    /// @notice Emitted when the surplus recipient is updated
    event SurplusRecipientUpdated(address indexed oldRecipient, address indexed newRecipient);

    /// @notice Emitted when a user invalidates their nonces up to a certain value
    event NonceInvalidated(address indexed maker, uint256 newMinNonce);

    /// @notice Emitted when tokens are rescued by owner
    event TokensRescued(address indexed token, address indexed to, uint256 amount);

    // ============ Errors ============

    /// @notice Thrown when caller is not an authorized executor
    error UnauthorizedExecutor();

    /// @notice Thrown when settlement fails with details
    error SettlementFailed(bytes32 intentId, string reason);

    /// @notice Thrown when the output amount is insufficient (for ETH checks mainly)
    error InsufficientOutput(uint256 received, uint256 required);

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

    /// @notice Thrown when executor address is zero
    error InvalidExecutorAddress();

    /// @notice Thrown when nonce increment is invalid
    error InvalidNonceIncrement();

    /// @notice Thrown when nonce exceeds maximum allowed value
    error NonceTooHigh();

    /// @notice Thrown when transaction would expire soon
    error TransactionExpired();

    /// @notice Thrown when nonce is already used
    error NonceAlreadyUsed();

    /// @notice Thrown when Permit2 transfer fails
    error Permit2TransferFailed();

    // ============ External Functions ============

    /// @notice Settles a single intent
    /// @param intent The Intent struct to settle
    /// @param signature EIP-712 signature from the maker
    /// @param executorData Arbitrary data passed to the executor callback
    function settle(
        Intent calldata intent,
        bytes calldata signature,
        bytes calldata executorData
    ) external;

    /// @notice Validates an intent without executing it
    /// @param intent The intent to validate
    /// @param signature The signature to check
    /// @return isValid Whether the intent is valid
    /// @return reason Reason for invalidity (empty if valid)
    function validate(
        Intent calldata intent,
        bytes calldata signature
    ) external view returns (bool isValid, string memory reason);

    /// @notice Adds or removes an executor from the allowlist
    function setExecutor(address executor, bool allowed) external;

    /// @notice Sets whether the executor whitelist is active
    function setExecutorWhitelistActive(bool active) external;

    /// @notice Sets the address that receives protocol's share of surplus output
    function setSurplusRecipient(address recipient) external;

    /// @notice Invalidates all nonces below the specified value for the caller
    function invalidateNoncesUpTo(uint256 newMinNonce) external;

    /// @notice Pauses the contract
    function pause() external;

    /// @notice Unpauses the contract
    function unpause() external;

    /// @notice Allows owner to rescue tokens accidentally sent to the contract
    function rescueTokens(address token, address to, uint256 amount) external;

    // ============ View Functions ============

    /// @notice Computes the intent ID (EIP-712 hash)
    function getIntentId(Intent calldata intent) external view returns (bytes32);

    /// @notice Checks if a nonce has been used
    function isNonceUsed(address maker, uint256 nonce) external view returns (bool);

    /// @notice Gets the minimum valid nonce for a maker
    function getMinNonce(address maker) external view returns (uint256);

    /// @notice Checks if an executor is authorized
    function isExecutorAllowed(address executor) external view returns (bool);

    /// @notice Gets the current surplus recipient
    function getSurplusRecipient() external view returns (address);

    /// @notice Returns the EIP-712 domain separator
    function DOMAIN_SEPARATOR() external view returns (bytes32);
}
