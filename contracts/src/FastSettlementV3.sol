// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {Ownable2Step, Ownable} from "@openzeppelin/contracts/access/Ownable2Step.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {IPermit2} from "./interfaces/IPermit2.sol";
import {IFastSettlementV3} from "./interfaces/IFastSettlementV3.sol";

/// @title FastSettlementV3
/// @notice Implementation of IFastSettlementV3.
contract FastSettlementV3 is IFastSettlementV3, Ownable2Step, ReentrancyGuard {
    using SafeERC20 for IERC20;

    // ============ Immutable & State Variables ============

    IPermit2 public immutable PERMIT2;
    address public executor; // Authorized caller of execute()
    address public treasury;

    // ============ Type Hashes & Strings ============

    bytes32 public constant INTENT_TYPEHASH =
        keccak256(
            bytes(
                "Intent(address user,address inputToken,address outputToken,uint256 sellAmount,uint256 userAmtOut,address recipient,uint256 deadline,uint256 nonce)"
            )
        );

    string public constant WITNESS_TYPE_STRING =
        "Intent witness)Intent(address user,address inputToken,address outputToken,uint256 sellAmount,uint256 userAmtOut,address recipient,uint256 deadline,uint256 nonce)TokenPermissions(address token,uint256 amount)";

    // ============ Modifiers ============

    modifier onlyExecutor() {
        if (msg.sender != executor) revert UnauthorizedExecutor();
        _;
    }

    // ============ Constructor ============

    constructor(address _executor, address _permit2, address _treasury) Ownable(msg.sender) {
        if (_permit2 == address(0)) revert InvalidPermit2();
        if (_treasury == address(0)) revert BadTreasury();
        executor = _executor;
        PERMIT2 = IPermit2(_permit2);
        treasury = _treasury;
    }

    // ============ Receive ============

    receive() external payable {}

    // ============ Main Execution ============

    function execute(
        Intent calldata intent,
        bytes calldata signature,
        SwapCall calldata swapData
    ) external payable onlyExecutor nonReentrant returns (uint256 received, uint256 surplus) {
        // 1. Validate Intent Constraints (Basic)
        if (block.timestamp > intent.deadline) revert IntentExpired();
        // Nonce is checked by Permit2
        if (intent.recipient == address(0)) revert BadRecipient();
        if (intent.sellAmount == 0) revert BadSellAmount();
        if (intent.userAmtOut == 0) revert BadUserAmtOut();

        // 2. Pull Funds via Permit2 Witness
        // The Witness IS the Intent struct.
        // The signature verifies: Permit(token, amount, nonce, deadline) + Witness(Intent)

        IPermit2.PermitTransferFrom memory permit = IPermit2.PermitTransferFrom({
            permitted: IPermit2.TokenPermissions({
                token: intent.inputToken,
                amount: intent.sellAmount
            }),
            nonce: intent.nonce,
            deadline: intent.deadline
        });

        IPermit2.SignatureTransferDetails memory transferDetails = IPermit2
            .SignatureTransferDetails({to: address(this), requestedAmount: intent.sellAmount});

        // Hash the intent using our TypeHash
        bytes32 witness = keccak256(
            abi.encode(
                INTENT_TYPEHASH,
                intent.user,
                intent.inputToken,
                intent.outputToken,
                intent.sellAmount,
                intent.userAmtOut,
                intent.recipient,
                intent.deadline,
                intent.nonce
            )
        );

        // Call Permit2. This validates signature, nonce, deadline, and transfers tokens.
        PERMIT2.permitWitnessTransferFrom(
            permit,
            transferDetails,
            intent.user,
            witness,
            WITNESS_TYPE_STRING,
            signature
        );

        // 3. Approve Swap Target
        IERC20(intent.inputToken).forceApprove(swapData.to, intent.sellAmount);

        // 4. Measure Balance Before
        uint256 balBefore = _getBalance(intent.outputToken);

        // 5. Execute Swap Call
        (bool success, bytes memory ret) = swapData.to.call{value: swapData.value}(swapData.data);
        if (!success) {
            // Bubble revert reason
            assembly {
                revert(add(ret, 32), mload(ret))
            }
        }

        // 6. Measure Balance After
        uint256 balAfter = _getBalance(intent.outputToken);
        received = balAfter - balBefore;

        // 7. Enforce userAmtOut
        if (received < intent.userAmtOut) revert InsufficientOut(received, intent.userAmtOut);

        // 8. Distribute Proceeds
        if (intent.outputToken == address(0)) {
            // Pay user
            (bool paySuccess, ) = intent.recipient.call{value: intent.userAmtOut}("");
            require(paySuccess, "ETH transfer to recipient failed");

            // Pay treasury surplus
            surplus = received - intent.userAmtOut;
            if (surplus > 0) {
                (bool treasSuccess, ) = treasury.call{value: surplus}("");
                require(treasSuccess, "ETH transfer to treasury failed");
            }
        } else {
            // Pay user
            IERC20(intent.outputToken).safeTransfer(intent.recipient, intent.userAmtOut);

            // Pay treasury surplus
            surplus = received - intent.userAmtOut;
            if (surplus > 0) {
                IERC20(intent.outputToken).safeTransfer(treasury, surplus);
            }
        }

        // 9. Cleanup
        // Reset approval
        IERC20(intent.inputToken).forceApprove(swapData.to, 0);

        // Refund any leftover input tokens to user (if any)
        uint256 inputRemains = IERC20(intent.inputToken).balanceOf(address(this));
        if (inputRemains > 0) {
            IERC20(intent.inputToken).safeTransfer(intent.user, inputRemains);
        }

        emit IntentExecuted(
            intent.user,
            intent.inputToken,
            intent.outputToken,
            intent.sellAmount,
            intent.userAmtOut,
            received,
            surplus
        );
    }

    // ============ Admin ============

    function setExecutor(address _newExecutor) external onlyOwner {
        address old = executor;
        executor = _newExecutor;
        emit ExecutorUpdated(old, _newExecutor);
    }

    function setTreasury(address _newTreasury) external onlyOwner {
        if (_newTreasury == address(0)) revert BadTreasury();
        address old = treasury;
        treasury = _newTreasury;
        emit TreasuryUpdated(old, _newTreasury);
    }

    function rescueTokens(address token, uint256 amount) external onlyOwner {
        if (token == address(0)) {
            (bool s, ) = msg.sender.call{value: amount}("");
            require(s, "Rescue ETH failed");
        } else {
            IERC20(token).safeTransfer(msg.sender, amount);
        }
    }

    // ============ Internal Helpers ============

    function _getBalance(address token) internal view returns (uint256) {
        if (token == address(0)) {
            return address(this).balance;
        } else {
            return IERC20(token).balanceOf(address(this));
        }
    }
}
