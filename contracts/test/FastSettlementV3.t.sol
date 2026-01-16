// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Test, console2} from "forge-std/Test.sol";
import {FastSettlementV3} from "../src/FastSettlementV3.sol";
import {IFastSettlementV3} from "../src/interfaces/IFastSettlementV3.sol";
import {IPermit2} from "../src/interfaces/IPermit2.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";

// ============ Mocks ============

contract MockERC20 is ERC20 {
    constructor(string memory name, string memory symbol) ERC20(name, symbol) {}
    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }
}

contract MockPermit2 is IPermit2 {
    mapping(address => mapping(address => mapping(uint256 => bool))) public usedNonces;

    function permitTransferFrom(
        PermitTransferFrom memory,
        SignatureTransferDetails calldata,
        address,
        bytes calldata
    ) external {
        // Not used
    }

    function permitWitnessTransferFrom(
        PermitTransferFrom memory permit,
        SignatureTransferDetails calldata transferDetails,
        address owner,
        bytes32 /*witness*/,
        string calldata /*witnessTypeString*/,
        bytes calldata /*signature*/
    ) external {
        // Mock checks
        if (usedNonces[owner][msg.sender][permit.nonce]) {
            revert("InvalidNonce");
        }
        usedNonces[owner][msg.sender][permit.nonce] = true;

        if (block.timestamp > permit.deadline) {
            revert("Expired");
        }

        // Transfer tokens
        IERC20(permit.permitted.token).transferFrom(
            owner,
            transferDetails.to,
            transferDetails.requestedAmount
        );
    }
}

contract MockSwapRouter {
    function swap(
        address tokenIn,
        uint256 amountIn,
        address tokenOut,
        uint256 amountOut,
        bool isEthOut
    ) external payable {
        // Pull input tokens (FastSettlementV3 approves us)
        IERC20(tokenIn).transferFrom(msg.sender, address(this), amountIn);

        // Send output
        if (isEthOut) {
            // Assume we have ETH (deal in test)
            (bool s, ) = msg.sender.call{value: amountOut}("");
            require(s, "MockSwapRouter: ETH transfer failed");
        } else {
            MockERC20(tokenOut).mint(msg.sender, amountOut);
        }
    }
}

// ============ Test Contract ============

contract FastSettlementV3Test is Test {
    FastSettlementV3 public settlement;
    MockPermit2 public permit2;
    MockSwapRouter public swapRouter;
    MockERC20 public tokenIn;
    MockERC20 public tokenOut;

    address public executor = makeAddr("executor");
    address public user = makeAddr("user");
    address public recipient = makeAddr("recipient");
    address public treasury = makeAddr("treasury");

    function setUp() public {
        permit2 = new MockPermit2();
        swapRouter = new MockSwapRouter();
        tokenIn = new MockERC20("Token In", "TIN");
        tokenOut = new MockERC20("Token Out", "TOUT");

        settlement = new FastSettlementV3(executor, address(permit2), treasury);

        tokenIn.mint(user, 1000e18);
        vm.prank(user);
        tokenIn.approve(address(permit2), type(uint256).max);

        vm.deal(address(swapRouter), 1000e18); // Give swap router ETH
    }

    // Helpers
    function _createIntent(
        uint256 amountIn,
        uint256 userAmtOut,
        bool isEth
    ) internal view returns (IFastSettlementV3.Intent memory) {
        return
            IFastSettlementV3.Intent({
                user: user,
                inputToken: address(tokenIn),
                outputToken: isEth ? address(0) : address(tokenOut),
                sellAmount: amountIn,
                userAmtOut: userAmtOut,
                recipient: recipient,
                deadline: block.timestamp + 1 hours,
                nonce: 0
            });
    }

    function _createSwapCall(
        uint256 amountIn,
        uint256 amountOut,
        bool isEth
    ) internal view returns (IFastSettlementV3.SwapCall memory) {
        return
            IFastSettlementV3.SwapCall({
                to: address(swapRouter),
                value: 0,
                data: abi.encodeWithSelector(
                    MockSwapRouter.swap.selector,
                    address(tokenIn),
                    amountIn,
                    address(tokenOut),
                    amountOut,
                    isEth
                )
            });
    }

    // Tests

    function testExecute_ERC20toERC20_Success() public {
        uint256 amountIn = 100e18;
        uint256 userAmtOut = 90e18;
        // Exact match
        uint256 actualOut = 90e18;

        IFastSettlementV3.Intent memory intent = _createIntent(amountIn, userAmtOut, false);
        IFastSettlementV3.SwapCall memory call = _createSwapCall(amountIn, actualOut, false);

        vm.prank(executor);
        settlement.execute(intent, bytes("fakeSig"), call);

        assertEq(tokenIn.balanceOf(user), 1000e18 - amountIn);
        assertEq(tokenOut.balanceOf(recipient), actualOut);
        assertEq(tokenOut.balanceOf(treasury), 0);
    }

    function testExecute_Surplus() public {
        uint256 amountIn = 100e18;
        uint256 userAmtOut = 90e18;
        uint256 actualOut = 100e18; // 10 surplus

        IFastSettlementV3.Intent memory intent = _createIntent(amountIn, userAmtOut, false);
        IFastSettlementV3.SwapCall memory call = _createSwapCall(amountIn, actualOut, false);

        vm.prank(executor);
        settlement.execute(intent, bytes("fakeSig"), call);

        assertEq(tokenOut.balanceOf(recipient), 90e18);
        assertEq(tokenOut.balanceOf(treasury), 10e18); // Surplus captured by contract treasury
    }

    function testExecute_InsufficientOut() public {
        uint256 amountIn = 100e18;
        uint256 userAmtOut = 90e18;
        uint256 actualOut = 89e18; // Too low

        IFastSettlementV3.Intent memory intent = _createIntent(amountIn, userAmtOut, false);
        IFastSettlementV3.SwapCall memory call = _createSwapCall(amountIn, actualOut, false);

        vm.prank(executor);
        vm.expectRevert(
            abi.encodeWithSignature("InsufficientOut(uint256,uint256)", actualOut, userAmtOut)
        );
        settlement.execute(intent, bytes("fakeSig"), call);
    }

    function testExecute_ETH_Success() public {
        uint256 amountIn = 100e18;
        uint256 userAmtOut = 90e18;
        uint256 actualOut = 95e18; // 5 surplus

        IFastSettlementV3.Intent memory intent = _createIntent(amountIn, userAmtOut, true);
        IFastSettlementV3.SwapCall memory call = _createSwapCall(amountIn, actualOut, true);

        uint256 recipientEthBefore = recipient.balance;
        uint256 treasuryEthBefore = treasury.balance;

        vm.prank(executor);
        settlement.execute(intent, bytes("fakeSig"), call);

        assertEq(recipient.balance - recipientEthBefore, 90e18);
        assertEq(treasury.balance - treasuryEthBefore, 5e18);
    }

    function testExecute_ReplayProtection() public {
        // MockPermit2 handles nonces.
        uint256 amountIn = 100e18;
        IFastSettlementV3.Intent memory intent = _createIntent(amountIn, 90e18, false);
        IFastSettlementV3.SwapCall memory call = _createSwapCall(amountIn, 90e18, false);

        vm.startPrank(executor);
        settlement.execute(intent, bytes("fakeSig"), call);

        // Replay
        vm.expectRevert("InvalidNonce"); // MockPermit2 error
        settlement.execute(intent, bytes("fakeSig"), call);
        vm.stopPrank();
    }

    function testExecute_UnauthorizedExecutor() public {
        IFastSettlementV3.Intent memory intent = _createIntent(100e18, 90e18, false);
        IFastSettlementV3.SwapCall memory call = _createSwapCall(100e18, 90e18, false);

        vm.prank(makeAddr("randomCaller"));
        vm.expectRevert(IFastSettlementV3.UnauthorizedExecutor.selector);
        settlement.execute(intent, bytes("fakeSig"), call);
    }

    function testSetExecutor() public {
        address newExecutor = makeAddr("newExecutor");
        settlement.setExecutor(newExecutor);
        assertEq(settlement.executor(), newExecutor);
    }

    function testSetTreasury() public {
        address newTreasury = makeAddr("newTreasury");
        settlement.setTreasury(newTreasury);
        assertEq(settlement.treasury(), newTreasury);
    }

    function testRescueTokens() public {
        // Send accidental tokens
        tokenIn.mint(address(settlement), 50e18);

        settlement.rescueTokens(address(tokenIn), 50e18);
        assertEq(tokenIn.balanceOf(address(this)), 50e18);
    }

    function testExecute_RevertIfTokensBypassContract() public {
        uint256 amountIn = 100e18;
        uint256 userAmtOut = 90e18;

        IFastSettlementV3.Intent memory intent = _createIntent(amountIn, userAmtOut, false);

        // Construct call that sends 0 to contract (simulating funds went elsewhere)
        IFastSettlementV3.SwapCall memory call = IFastSettlementV3.SwapCall({
            to: address(swapRouter),
            value: 0,
            data: abi.encodeWithSelector(
                MockSwapRouter.swap.selector,
                address(tokenIn),
                amountIn,
                address(tokenOut),
                0, // AmountOut to contract is 0
                false
            )
        });

        vm.prank(executor);
        vm.expectRevert(abi.encodeWithSignature("InsufficientOut(uint256,uint256)", 0, userAmtOut));
        settlement.execute(intent, bytes("fakeSig"), call);
    }
}
