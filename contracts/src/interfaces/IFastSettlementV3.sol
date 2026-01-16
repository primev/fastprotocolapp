// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/// @title IFastSettlementV3
/// @notice Interface for FastSettlementV3, defining structs, events, and errors.
interface IFastSettlementV3 {
    // ============ Structs ============

    struct Intent {
        address user;
        address inputToken;
        address outputToken; // address(0) for ETH
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

    // ============ Errors ============

    error IntentExpired();
    error BadNonce();
    error BadTreasury();
    error BadRecipient();
    error BadInputAmt();
    error BadUserAmtOut();
    error BadCallTarget();
    error UnauthorizedExecutor();
    error InsufficientOut(uint256 received, uint256 userAmtOut);
    error InvalidPermit2();

    // ============ Functions ============

    /// @notice Executes a user intent using Permit2 for input pulling and swap router for swapping.
    /// @param intent The user's signed intent.
    /// @param signature The Permit2 witness signature.
    /// @param details The call data for the swap router.
    /// @return received The amount of output tokens received.
    /// @return surplus The surplus amount sent to treasury.
    function execute(
        Intent calldata intent,
        bytes calldata signature,
        SwapCall calldata details
    ) external payable returns (uint256 received, uint256 surplus);

    /// @notice Sets the authorized executor who can call execute().
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
