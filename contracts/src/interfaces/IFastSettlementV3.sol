// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/// @title IFastSettlementV3
/// @notice Interface for FastSettlementV3, defining structs, events, and errors.
interface IFastSettlementV3 {
    // ============ Structs ============

    struct Intent {
        address user;
        address inputToken; // address(0) for native ETH input
        address outputToken; // address(0) for native ETH output
        uint256 inputAmt;
        uint256 userAmtOut;
        address recipient;
        uint256 deadline;
        uint256 nonce;
    }

    struct SwapCall {
        address to;
        uint256 value;
        bytes data;
    }

    // ============ Events ============

    event IntentExecuted(
        address indexed user,
        address indexed inputToken,
        address indexed outputToken,
        uint256 inputAmt,
        uint256 userAmtOut,
        uint256 received,
        uint256 surplus
    );

    event ExecutorUpdated(address indexed oldExecutor, address indexed newExecutor);
    event TreasuryUpdated(address indexed oldTreasury, address indexed newTreasury);
    event SwapTargetsUpdated(address[] targets, bool[] allowed);

    // ============ Errors ============

    error IntentExpired();
    error BadNonce();
    error BadTreasury();
    error BadExecutor();
    error BadRecipient();
    error BadInputToken();
    error BadInputAmt();
    error BadUserAmtOut();
    error BadCallTarget();
    error UnauthorizedExecutor();
    error InsufficientOut(uint256 received, uint256 userAmtOut);
    error InvalidPermit2();
    error InvalidWETH();
    error UnauthorizedCaller();
    error ExpectedETHInput();
    error InvalidETHAmount();
    error UnauthorizedSwapTarget();
    error ArrayLengthMismatch();

    // ============ Functions ============

    /// @notice Executes a user intent using Permit2 for input pulling. Callable only by executor.
    /// @param intent The user's signed intent.
    /// @param signature The Permit2 witness signature.
    /// @param swapData The call data for the swap router.
    /// @return received The amount of output tokens received.
    /// @return surplus The surplus amount sent to treasury.
    function executeWithPermit(
        Intent calldata intent,
        bytes calldata signature,
        SwapCall calldata swapData
    ) external returns (uint256 received, uint256 surplus);

    /// @notice Executes a swap using native ETH as input. Callable by anyone (user must be msg.sender).
    /// @param intent The user's intent (inputToken must be address(0)).
    /// @param swapData The call data for the swap router.
    /// @return received The amount of output tokens received.
    /// @return surplus The surplus amount sent to treasury.
    function executeWithETH(
        Intent calldata intent,
        SwapCall calldata swapData
    ) external payable returns (uint256 received, uint256 surplus);

    /// @notice Sets allowed swap targets in batch. Only owner.
    /// @param targets Array of swap target addresses.
    /// @param allowed Array of boolean values (true = allowed, false = disallowed).
    function setSwapTargets(address[] calldata targets, bool[] calldata allowed) external;

    /// @notice Sets the authorized executor who can call executeWithPermit().
    /// @param _newExecutor The new executor address.
    function setExecutor(address _newExecutor) external;

    /// @notice Sets the treasury address where surplus is sent.
    /// @param _newTreasury The new treasury address.
    function setTreasury(address _newTreasury) external;

    /// @notice Rescues tokens or ETH accidentally sent to the contract.
    /// @param token The token address to rescue (address(0) for ETH).
    /// @param amount The amount to rescue.
    function rescueTokens(address token, uint256 amount) external;
}
