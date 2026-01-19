// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Initializable} from "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import {UUPSUpgradeable} from "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import {
    Ownable2StepUpgradeable
} from "@openzeppelin/contracts-upgradeable/access/Ownable2StepUpgradeable.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {Address} from "@openzeppelin/contracts/utils/Address.sol";
import {IFastSettlementV3} from "./interfaces/IFastSettlementV3.sol";
import {IPermit2} from "./interfaces/IPermit2.sol";
import {FastSettlementV3Storage} from "./FastSettlementV3Storage.sol";

/// @title FastSettlementV3
/// @notice V3 implementation using UUPS Upgradeable pattern.
contract FastSettlementV3 is
    Initializable,
    UUPSUpgradeable,
    Ownable2StepUpgradeable,
    ReentrancyGuard,
    IFastSettlementV3,
    FastSettlementV3Storage
{
    using SafeERC20 for IERC20;
    using Address for address payable;

    // ============ Constants & Immutables ============

    bytes32 public constant INTENT_TYPEHASH =
        keccak256(
            bytes(
                "Intent(address user,address inputToken,address outputToken,uint256 inputAmt,uint256 userAmtOut,address recipient,uint256 deadline,uint256 nonce)"
            )
        );

    string public constant WITNESS_TYPE_STRING =
        "Intent witness)Intent(address user,address inputToken,address outputToken,uint256 inputAmt,uint256 userAmtOut,address recipient,uint256 deadline,uint256 nonce)TokenPermissions(address token,uint256 amount)";

    IPermit2 public immutable PERMIT2;

    // ============ Constructor & Initializer ============

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor(address _permit2) {
        if (_permit2 == address(0)) revert InvalidPermit2();
        PERMIT2 = IPermit2(_permit2);
        _disableInitializers();
    }

    function initialize(address _executor, address _treasury) public initializer {
        if (_treasury == address(0)) revert BadTreasury();
        if (_executor == address(0)) revert BadExecutor();
        __Ownable_init(msg.sender);
        executor = _executor;
        treasury = _treasury;
    }

    // ============ UUPS Authorization ============

    function _authorizeUpgrade(address newImplementation) internal override onlyOwner {}

    // ============ Modifiers ============

    modifier onlyExecutor() {
        if (msg.sender != executor) revert UnauthorizedExecutor();
        _;
    }

    // ============ Receive ============

    receive() external payable {}

    // ============ Main Execution ============

    function execute(
        Intent calldata intent,
        bytes calldata signature,
        SwapCall calldata swapData
    ) external payable onlyExecutor nonReentrant returns (uint256 received, uint256 surplus) {
        // Validate constraints
        if (block.timestamp > intent.deadline) revert IntentExpired();
        if (intent.inputToken == address(0)) revert BadInputToken();
        if (intent.recipient == address(0)) revert BadRecipient();
        if (intent.inputAmt == 0) revert BadInputAmt();
        if (intent.userAmtOut == 0) revert BadUserAmtOut();

        // Track start balance
        uint256 startInputBal = _getBalance(intent.inputToken);

        // Pull funds
        IPermit2.PermitTransferFrom memory permit = IPermit2.PermitTransferFrom({
            permitted: IPermit2.TokenPermissions({
                token: intent.inputToken,
                amount: intent.inputAmt
            }),
            nonce: intent.nonce,
            deadline: intent.deadline
        });

        IPermit2.SignatureTransferDetails memory transferDetails = IPermit2
            .SignatureTransferDetails({to: address(this), requestedAmount: intent.inputAmt});

        bytes32 witness = keccak256(abi.encode(INTENT_TYPEHASH, intent));

        PERMIT2.permitWitnessTransferFrom(
            permit,
            transferDetails,
            intent.user,
            witness,
            WITNESS_TYPE_STRING,
            signature
        );

        // Approve swap contract
        IERC20(intent.inputToken).forceApprove(swapData.to, intent.inputAmt);

        // Execute swap
        uint256 outputBalBefore = _getBalance(intent.outputToken);

        (bool success, ) = swapData.to.call(swapData.data);
        if (!success) revert BadCallTarget();

        uint256 outputBalAfter = _getBalance(intent.outputToken);
        received = outputBalAfter - outputBalBefore;

        // Verify output, quote must account for fees
        if (received < intent.userAmtOut) revert InsufficientOut(received, intent.userAmtOut);

        // Distribute proceeds
        surplus = received - intent.userAmtOut;

        // Pay user
        if (intent.outputToken == address(0)) {
            payable(intent.recipient).sendValue(intent.userAmtOut);
        } else {
            IERC20(intent.outputToken).safeTransfer(intent.recipient, intent.userAmtOut);
        }

        // Pay treasury
        if (surplus > 0) {
            if (intent.outputToken == address(0)) {
                payable(treasury).sendValue(surplus);
            } else {
                IERC20(intent.outputToken).safeTransfer(treasury, surplus);
            }
        }

        // Reset approval
        IERC20(intent.inputToken).forceApprove(swapData.to, 0);

        // Refund unused input
        uint256 finalInputBal = _getBalance(intent.inputToken);
        if (finalInputBal > startInputBal) {
            uint256 unused = finalInputBal - startInputBal;
            // Refund
            IERC20(intent.inputToken).safeTransfer(intent.user, unused);
        }

        emit IntentExecuted(
            intent.user,
            intent.inputToken,
            intent.outputToken,
            intent.inputAmt,
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
            payable(msg.sender).sendValue(amount);
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
