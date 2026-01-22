// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Initializable} from "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import {UUPSUpgradeable} from "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import {
    Ownable2StepUpgradeable
} from "@openzeppelin/contracts-upgradeable/access/Ownable2StepUpgradeable.sol";
import {ReentrancyGuardTransient} from "@openzeppelin/contracts/utils/ReentrancyGuardTransient.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {Address} from "@openzeppelin/contracts/utils/Address.sol";
import {IFastSettlementV3} from "./interfaces/IFastSettlementV3.sol";
import {IPermit2} from "./interfaces/IPermit2.sol";
import {IWETH} from "./interfaces/IWETH.sol";
import {FastSettlementV3Storage} from "./FastSettlementV3Storage.sol";

/// @title FastSettlementV3
/// @notice V3 implementation using UUPS Upgradeable pattern with dual entry points.
contract FastSettlementV3 is
    Initializable,
    UUPSUpgradeable,
    Ownable2StepUpgradeable,
    ReentrancyGuardTransient,
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
    IWETH public immutable WETH;

    // ============ Constructor & Initializer ============

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor(address _permit2, address _weth) {
        if (_permit2 == address(0)) revert InvalidPermit2();
        if (_weth == address(0)) revert InvalidWETH();
        PERMIT2 = IPermit2(_permit2);
        WETH = IWETH(_weth);
        _disableInitializers();
    }

    function initialize(
        address _executor,
        address _treasury,
        address[] calldata _initialSwapTargets
    ) public initializer {
        if (_treasury == address(0)) revert BadTreasury();
        if (_executor == address(0)) revert BadExecutor();
        __Ownable_init(msg.sender);
        executor = _executor;
        treasury = _treasury;

        // Whitelist initial swap targets
        for (uint256 i = 0; i < _initialSwapTargets.length; i++) {
            allowedSwapTargets[_initialSwapTargets[i]] = true;
        }
    }

    function _authorizeUpgrade(address newImplementation) internal override onlyOwner {}

    modifier onlyExecutor() {
        if (msg.sender != executor) revert UnauthorizedExecutor();
        _;
    }

    receive() external payable {}

    // ============ External Execution Entry Points ============

    /// @inheritdoc IFastSettlementV3
    function executeWithPermit(
        Intent calldata intent,
        bytes calldata signature,
        SwapCall calldata swapData
    ) external onlyExecutor nonReentrant returns (uint256 received, uint256 surplus) {
        // Validate intent
        _validateIntent(intent);
        if (!allowedSwapTargets[swapData.to]) revert UnauthorizedSwapTarget();
        // For Permit2 path, inputToken must be ERC20
        if (intent.inputToken == address(0)) revert BadInputToken();
        // Pull funds via Permit2
        _pullWithPermit2(intent, signature);

        // Execute swap using the ERC20 input token
        return _execute(intent, swapData, intent.inputToken);
    }

    /// @inheritdoc IFastSettlementV3
    function executeWithETH(
        Intent calldata intent,
        SwapCall calldata swapData
    ) external payable nonReentrant returns (uint256 received, uint256 surplus) {
        // Input token must be ETH
        if (intent.inputToken != address(0)) revert ExpectedETHInput();
        if (intent.user != msg.sender) revert UnauthorizedCaller();
        if (msg.value != intent.inputAmt) revert InvalidETHAmount();
        if (!allowedSwapTargets[swapData.to]) revert UnauthorizedSwapTarget();
        _validateIntent(intent);
        // Wrap ETH
        WETH.deposit{value: msg.value}();
        // Execute swap using WETH
        return _execute(intent, swapData, address(WETH));
    }

    // ============ Internal Logic ============

    function _execute(
        Intent calldata intent,
        SwapCall calldata swapData,
        address actualInputToken
    ) internal returns (uint256 received, uint256 surplus) {
        // Cache output token
        address outputToken = intent.outputToken;
        // Track input balance (for refund logic)
        uint256 startInputBal = _getBalance(actualInputToken);
        // Approve swap contract
        IERC20(actualInputToken).forceApprove(swapData.to, intent.inputAmt);
        // Execute swap
        uint256 outputBalBefore = _getBalance(outputToken);

        (bool success, ) = swapData.to.call(swapData.data);
        if (!success) revert BadCallTarget();

        uint256 outputBalAfter = _getBalance(outputToken);
        received = outputBalAfter - outputBalBefore;

        // Verify output + calculate surplus
        if (received < intent.userAmtOut) revert InsufficientOut(received, intent.userAmtOut);
        surplus = received - intent.userAmtOut;

        // Pay user
        if (outputToken == address(0)) {
            payable(intent.recipient).sendValue(intent.userAmtOut);
        } else {
            IERC20(outputToken).safeTransfer(intent.recipient, intent.userAmtOut);
        }
        // Send surplus to treasury
        if (surplus > 0) {
            if (outputToken == address(0)) {
                payable(treasury).sendValue(surplus);
            } else {
                IERC20(outputToken).safeTransfer(treasury, surplus);
            }
        }
        // Reset approval
        IERC20(actualInputToken).forceApprove(swapData.to, 0);
        // Refund unused input
        uint256 finalInputBal = _getBalance(actualInputToken);
        if (finalInputBal > startInputBal) {
            uint256 unused = finalInputBal - startInputBal;
            IERC20(actualInputToken).safeTransfer(intent.user, unused);
        }

        emit IntentExecuted(
            intent.user,
            intent.inputToken,
            outputToken,
            intent.inputAmt,
            intent.userAmtOut,
            received,
            surplus
        );
    }

    function _validateIntent(Intent calldata intent) internal view {
        if (block.timestamp > intent.deadline) revert IntentExpired();
        if (intent.recipient == address(0)) revert BadRecipient();
        if (intent.inputAmt == 0) revert BadInputAmt();
        if (intent.userAmtOut == 0) revert BadUserAmtOut();
    }

    function _pullWithPermit2(Intent calldata intent, bytes calldata signature) internal {
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
    }

    // ============ Admin ============

    /// @inheritdoc IFastSettlementV3
    function setSwapTargets(
        address[] calldata targets,
        bool[] calldata allowed
    ) external onlyOwner {
        if (targets.length != allowed.length) revert ArrayLengthMismatch();
        for (uint256 i = 0; i < targets.length; i++) {
            allowedSwapTargets[targets[i]] = allowed[i];
        }
        emit SwapTargetsUpdated(targets, allowed);
    }

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

    function _getBalance(address token) internal view returns (uint256) {
        if (token == address(0)) {
            return address(this).balance;
        } else {
            return IERC20(token).balanceOf(address(this));
        }
    }
}
