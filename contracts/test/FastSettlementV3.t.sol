// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Test, console2} from "forge-std/Test.sol";
import {FastSettlementV3} from "../src/FastSettlementV3.sol";
import {IFastSettlementV3} from "../src/interfaces/IFastSettlementV3.sol";
import {IPermit2} from "../src/interfaces/IPermit2.sol";
import {IWETH} from "../src/interfaces/IWETH.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";

import {ERC1967Proxy} from "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";

// ============ Mocks ============

contract MockERC20 is ERC20 {
    constructor(string memory name, string memory symbol) ERC20(name, symbol) {}
    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }
}

contract MockWETH is MockERC20 {
    constructor() MockERC20("Wrapped Ether", "WETH") {}

    function deposit() external payable {
        _mint(msg.sender, msg.value);
    }

    function withdraw(uint256 wad) external {
        _burn(msg.sender, wad);
        (bool success, ) = msg.sender.call{value: wad}("");
        require(success, "MockWETH: ETH transfer failed");
    }

    receive() external payable {
        _mint(msg.sender, msg.value);
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
    address public weth;

    constructor(address _weth) {
        weth = _weth;
    }

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

    // For WETH input swaps
    function swapWETH(uint256 amountIn, address tokenOut, uint256 amountOut) external {
        // Pull WETH from caller
        IERC20(weth).transferFrom(msg.sender, address(this), amountIn);

        // Send output
        MockERC20(tokenOut).mint(msg.sender, amountOut);
    }
}

// ============ Test Contract ============

contract FastSettlementV3Test is Test {
    FastSettlementV3 public settlement;
    MockPermit2 public permit2;
    MockSwapRouter public swapRouter;
    MockWETH public weth;
    MockERC20 public tokenIn;
    MockERC20 public tokenOut;

    address public executor = makeAddr("executor");
    address public user = makeAddr("user");
    address public recipient = makeAddr("recipient");
    address public treasury = makeAddr("treasury");

    function setUp() public {
        permit2 = new MockPermit2();
        weth = new MockWETH();
        swapRouter = new MockSwapRouter(address(weth));
        tokenIn = new MockERC20("Token In", "TIN");
        tokenOut = new MockERC20("Token Out", "TOUT");

        // Initial swap targets to whitelist
        address[] memory initialTargets = new address[](1);
        initialTargets[0] = address(swapRouter);

        FastSettlementV3 impl = new FastSettlementV3(address(permit2), address(weth));
        ERC1967Proxy proxy = new ERC1967Proxy(
            address(impl),
            abi.encodeCall(FastSettlementV3.initialize, (executor, treasury, initialTargets))
        );
        settlement = FastSettlementV3(payable(address(proxy)));

        tokenIn.mint(user, 1000e18);
        vm.prank(user);
        tokenIn.approve(address(permit2), type(uint256).max);

        vm.deal(address(swapRouter), 1000e18); // Give swap router ETH
        vm.deal(user, 1000e18); // Give user ETH for executeWithETH tests
    }

    // Helpers
    function _createIntent(
        uint256 amountIn,
        uint256 userAmtOut,
        bool isEthOutput
    ) internal view returns (IFastSettlementV3.Intent memory) {
        return
            IFastSettlementV3.Intent({
                user: user,
                inputToken: address(tokenIn),
                outputToken: isEthOutput ? address(0) : address(tokenOut),
                inputAmt: amountIn,
                userAmtOut: userAmtOut,
                recipient: recipient,
                deadline: block.timestamp + 1 hours,
                nonce: 0
            });
    }

    function _createETHInputIntent(
        uint256 amountIn,
        uint256 userAmtOut
    ) internal view returns (IFastSettlementV3.Intent memory) {
        return
            IFastSettlementV3.Intent({
                user: user,
                inputToken: address(0), // ETH input
                outputToken: address(tokenOut),
                inputAmt: amountIn,
                userAmtOut: userAmtOut,
                recipient: recipient,
                deadline: block.timestamp + 1 hours,
                nonce: 0
            });
    }

    function _createSwapCall(
        uint256 amountIn,
        uint256 amountOut,
        bool isEthOutput
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
                    isEthOutput
                )
            });
    }

    function _createWETHSwapCall(
        uint256 amountIn,
        uint256 amountOut
    ) internal view returns (IFastSettlementV3.SwapCall memory) {
        return
            IFastSettlementV3.SwapCall({
                to: address(swapRouter),
                value: 0,
                data: abi.encodeWithSelector(
                    MockSwapRouter.swapWETH.selector,
                    amountIn,
                    address(tokenOut),
                    amountOut
                )
            });
    }

    // ============ executeWithPermit Tests ============

    function testExecuteWithPermit_ERC20toERC20_Success() public {
        uint256 amountIn = 100e18;
        uint256 userAmtOut = 90e18;
        uint256 actualOut = 90e18;

        IFastSettlementV3.Intent memory intent = _createIntent(amountIn, userAmtOut, false);
        IFastSettlementV3.SwapCall memory call = _createSwapCall(amountIn, actualOut, false);

        vm.prank(executor);
        settlement.executeWithPermit(intent, bytes("fakeSig"), call);

        assertEq(tokenIn.balanceOf(user), 1000e18 - amountIn);
        assertEq(tokenOut.balanceOf(recipient), actualOut);
        assertEq(tokenOut.balanceOf(treasury), 0);
    }

    function testExecuteWithPermit_Surplus() public {
        uint256 amountIn = 100e18;
        uint256 userAmtOut = 90e18;
        uint256 actualOut = 100e18; // 10 surplus

        IFastSettlementV3.Intent memory intent = _createIntent(amountIn, userAmtOut, false);
        IFastSettlementV3.SwapCall memory call = _createSwapCall(amountIn, actualOut, false);

        vm.prank(executor);
        settlement.executeWithPermit(intent, bytes("fakeSig"), call);

        assertEq(tokenOut.balanceOf(recipient), 90e18);
        assertEq(tokenOut.balanceOf(treasury), 10e18);
    }

    function testExecuteWithPermit_InsufficientOut() public {
        uint256 amountIn = 100e18;
        uint256 userAmtOut = 90e18;
        uint256 actualOut = 89e18; // Too low

        IFastSettlementV3.Intent memory intent = _createIntent(amountIn, userAmtOut, false);
        IFastSettlementV3.SwapCall memory call = _createSwapCall(amountIn, actualOut, false);

        vm.prank(executor);
        vm.expectRevert(
            abi.encodeWithSignature("InsufficientOut(uint256,uint256)", actualOut, userAmtOut)
        );
        settlement.executeWithPermit(intent, bytes("fakeSig"), call);
    }

    function testExecuteWithPermit_ETHOutput_Success() public {
        uint256 amountIn = 100e18;
        uint256 userAmtOut = 90e18;
        uint256 actualOut = 95e18; // 5 surplus

        IFastSettlementV3.Intent memory intent = _createIntent(amountIn, userAmtOut, true);
        IFastSettlementV3.SwapCall memory call = _createSwapCall(amountIn, actualOut, true);

        uint256 recipientEthBefore = recipient.balance;
        uint256 treasuryEthBefore = treasury.balance;

        vm.prank(executor);
        settlement.executeWithPermit(intent, bytes("fakeSig"), call);

        assertEq(recipient.balance - recipientEthBefore, 90e18);
        assertEq(treasury.balance - treasuryEthBefore, 5e18);
    }

    function testExecuteWithPermit_ReplayProtection() public {
        uint256 amountIn = 100e18;
        IFastSettlementV3.Intent memory intent = _createIntent(amountIn, 90e18, false);
        IFastSettlementV3.SwapCall memory call = _createSwapCall(amountIn, 90e18, false);

        vm.startPrank(executor);
        settlement.executeWithPermit(intent, bytes("fakeSig"), call);

        // Replay
        vm.expectRevert("InvalidNonce"); // MockPermit2 error
        settlement.executeWithPermit(intent, bytes("fakeSig"), call);
        vm.stopPrank();
    }

    function testExecuteWithPermit_UnauthorizedExecutor() public {
        IFastSettlementV3.Intent memory intent = _createIntent(100e18, 90e18, false);
        IFastSettlementV3.SwapCall memory call = _createSwapCall(100e18, 90e18, false);

        vm.prank(makeAddr("randomCaller"));
        vm.expectRevert(IFastSettlementV3.UnauthorizedExecutor.selector);
        settlement.executeWithPermit(intent, bytes("fakeSig"), call);
    }

    function testExecuteWithPermit_RevertIfTokensBypassContract() public {
        uint256 amountIn = 100e18;
        uint256 userAmtOut = 90e18;

        IFastSettlementV3.Intent memory intent = _createIntent(amountIn, userAmtOut, false);

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
        settlement.executeWithPermit(intent, bytes("fakeSig"), call);
    }

    // ============ executeWithETH Tests ============

    function testExecuteWithETH_Success() public {
        uint256 amountIn = 1e18;
        uint256 userAmtOut = 900e18;
        uint256 actualOut = 950e18; // 50 surplus

        IFastSettlementV3.Intent memory intent = _createETHInputIntent(amountIn, userAmtOut);
        IFastSettlementV3.SwapCall memory call = _createWETHSwapCall(amountIn, actualOut);

        uint256 recipientBalBefore = tokenOut.balanceOf(recipient);
        uint256 treasuryBalBefore = tokenOut.balanceOf(treasury);

        vm.prank(user);
        settlement.executeWithETH{value: amountIn}(intent, call);

        assertEq(tokenOut.balanceOf(recipient) - recipientBalBefore, userAmtOut);
        assertEq(tokenOut.balanceOf(treasury) - treasuryBalBefore, 50e18);
    }

    function testExecuteWithETH_UnauthorizedCaller() public {
        IFastSettlementV3.Intent memory intent = _createETHInputIntent(1e18, 900e18);
        IFastSettlementV3.SwapCall memory call = _createWETHSwapCall(1e18, 900e18);

        // Someone else tries to execute user's intent
        address attacker = makeAddr("attacker");
        vm.deal(attacker, 10e18);

        vm.prank(attacker);
        vm.expectRevert(IFastSettlementV3.UnauthorizedCaller.selector);
        settlement.executeWithETH{value: 1e18}(intent, call);
    }

    function testExecuteWithETH_WrongInputToken() public {
        // Intent with ERC20 input, not ETH
        IFastSettlementV3.Intent memory intent = _createIntent(1e18, 900e18, false);
        IFastSettlementV3.SwapCall memory call = _createWETHSwapCall(1e18, 900e18);

        vm.prank(user);
        vm.expectRevert(IFastSettlementV3.ExpectedETHInput.selector);
        settlement.executeWithETH{value: 1e18}(intent, call);
    }

    function testExecuteWithETH_WrongETHAmount() public {
        IFastSettlementV3.Intent memory intent = _createETHInputIntent(1e18, 900e18);
        IFastSettlementV3.SwapCall memory call = _createWETHSwapCall(1e18, 900e18);

        vm.prank(user);
        vm.expectRevert(IFastSettlementV3.InvalidETHAmount.selector);
        settlement.executeWithETH{value: 0.5e18}(intent, call); // Wrong amount
    }

    // ============ Swap Target Whitelist Tests ============

    function testUnauthorizedSwapTarget() public {
        IFastSettlementV3.Intent memory intent = _createIntent(100e18, 90e18, false);

        // Create call to non-whitelisted address
        IFastSettlementV3.SwapCall memory call = IFastSettlementV3.SwapCall({
            to: makeAddr("maliciousRouter"),
            value: 0,
            data: bytes("")
        });

        vm.prank(executor);
        vm.expectRevert(IFastSettlementV3.UnauthorizedSwapTarget.selector);
        settlement.executeWithPermit(intent, bytes("fakeSig"), call);
    }

    function testSetSwapTargets() public {
        address newTarget = makeAddr("newRouter");
        address anotherTarget = makeAddr("anotherRouter");

        address[] memory targets = new address[](2);
        targets[0] = newTarget;
        targets[1] = anotherTarget;

        bool[] memory allowed = new bool[](2);
        allowed[0] = true;
        allowed[1] = true;

        settlement.setSwapTargets(targets, allowed);

        assertTrue(settlement.allowedSwapTargets(newTarget));
        assertTrue(settlement.allowedSwapTargets(anotherTarget));

        // Disable one
        allowed[0] = false;
        settlement.setSwapTargets(targets, allowed);

        assertFalse(settlement.allowedSwapTargets(newTarget));
        assertTrue(settlement.allowedSwapTargets(anotherTarget));
    }

    function testSetSwapTargets_ArrayLengthMismatch() public {
        address[] memory targets = new address[](2);
        targets[0] = makeAddr("a");
        targets[1] = makeAddr("b");

        bool[] memory allowed = new bool[](1);
        allowed[0] = true;

        vm.expectRevert(IFastSettlementV3.ArrayLengthMismatch.selector);
        settlement.setSwapTargets(targets, allowed);
    }

    // ============ Admin Tests ============

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

    function testRescueTokens_ETH() public {
        // Send accidental ETH
        vm.deal(address(settlement), 1e18);

        uint256 ownerBalBefore = address(this).balance;
        settlement.rescueTokens(address(0), 1e18);
        assertEq(address(this).balance - ownerBalBefore, 1e18);
    }

    // ============ Intent Validation Edge Cases ============

    function testExecuteWithPermit_ExpiredDeadline() public {
        IFastSettlementV3.Intent memory intent = IFastSettlementV3.Intent({
            user: user,
            inputToken: address(tokenIn),
            outputToken: address(tokenOut),
            inputAmt: 100e18,
            userAmtOut: 90e18,
            recipient: recipient,
            deadline: block.timestamp - 1, // Already expired
            nonce: 0
        });
        IFastSettlementV3.SwapCall memory call = _createSwapCall(100e18, 90e18, false);

        vm.prank(executor);
        vm.expectRevert(IFastSettlementV3.IntentExpired.selector);
        settlement.executeWithPermit(intent, bytes("fakeSig"), call);
    }

    function testExecuteWithPermit_ZeroRecipient() public {
        IFastSettlementV3.Intent memory intent = IFastSettlementV3.Intent({
            user: user,
            inputToken: address(tokenIn),
            outputToken: address(tokenOut),
            inputAmt: 100e18,
            userAmtOut: 90e18,
            recipient: address(0), // Bad recipient
            deadline: block.timestamp + 1 hours,
            nonce: 0
        });
        IFastSettlementV3.SwapCall memory call = _createSwapCall(100e18, 90e18, false);

        vm.prank(executor);
        vm.expectRevert(IFastSettlementV3.BadRecipient.selector);
        settlement.executeWithPermit(intent, bytes("fakeSig"), call);
    }

    function testExecuteWithPermit_ZeroInputAmt() public {
        IFastSettlementV3.Intent memory intent = IFastSettlementV3.Intent({
            user: user,
            inputToken: address(tokenIn),
            outputToken: address(tokenOut),
            inputAmt: 0, // Zero input
            userAmtOut: 90e18,
            recipient: recipient,
            deadline: block.timestamp + 1 hours,
            nonce: 0
        });
        IFastSettlementV3.SwapCall memory call = _createSwapCall(0, 90e18, false);

        vm.prank(executor);
        vm.expectRevert(IFastSettlementV3.BadInputAmt.selector);
        settlement.executeWithPermit(intent, bytes("fakeSig"), call);
    }

    function testExecuteWithPermit_ZeroUserAmtOut() public {
        IFastSettlementV3.Intent memory intent = IFastSettlementV3.Intent({
            user: user,
            inputToken: address(tokenIn),
            outputToken: address(tokenOut),
            inputAmt: 100e18,
            userAmtOut: 0, // Zero output
            recipient: recipient,
            deadline: block.timestamp + 1 hours,
            nonce: 0
        });
        IFastSettlementV3.SwapCall memory call = _createSwapCall(100e18, 0, false);

        vm.prank(executor);
        vm.expectRevert(IFastSettlementV3.BadUserAmtOut.selector);
        settlement.executeWithPermit(intent, bytes("fakeSig"), call);
    }

    function testExecuteWithPermit_BadInputToken() public {
        IFastSettlementV3.Intent memory intent = IFastSettlementV3.Intent({
            user: user,
            inputToken: address(0), // ETH not allowed in Permit2 path
            outputToken: address(tokenOut),
            inputAmt: 100e18,
            userAmtOut: 90e18,
            recipient: recipient,
            deadline: block.timestamp + 1 hours,
            nonce: 0
        });
        IFastSettlementV3.SwapCall memory call = _createSwapCall(100e18, 90e18, false);

        vm.prank(executor);
        vm.expectRevert(IFastSettlementV3.BadInputToken.selector);
        settlement.executeWithPermit(intent, bytes("fakeSig"), call);
    }

    // ============ Swap Failure Tests ============

    function testExecuteWithPermit_BadCallTarget() public {
        IFastSettlementV3.Intent memory intent = _createIntent(100e18, 90e18, false);

        // Create call with bad data that will cause the swap to fail
        address failingRouter = address(new FailingSwapRouter());

        // Whitelist the failing router
        address[] memory targets = new address[](1);
        targets[0] = failingRouter;
        bool[] memory allowed = new bool[](1);
        allowed[0] = true;
        settlement.setSwapTargets(targets, allowed);

        IFastSettlementV3.SwapCall memory call = IFastSettlementV3.SwapCall({
            to: failingRouter,
            value: 0,
            data: abi.encodeWithSelector(FailingSwapRouter.failingSwap.selector)
        });

        vm.prank(executor);
        vm.expectRevert(IFastSettlementV3.BadCallTarget.selector);
        settlement.executeWithPermit(intent, bytes("fakeSig"), call);
    }

    // ============ Input Refund Tests ============

    function testExecuteWithPermit_RefundsExtraTokensReturnedBySwap() public {
        uint256 amountIn = 100e18;
        uint256 amountOut = 90e18;
        uint256 extraReturned = 20e18; // Swap returns extra tokens to the contract

        IFastSettlementV3.Intent memory intent = _createIntent(amountIn, amountOut, false);

        // Create a router that returns extra tokens to the contract
        address bonusRouter = address(new BonusReturnRouter(address(tokenIn), address(tokenOut)));

        // Whitelist it
        address[] memory targets = new address[](1);
        targets[0] = bonusRouter;
        bool[] memory allowed = new bool[](1);
        allowed[0] = true;
        settlement.setSwapTargets(targets, allowed);

        IFastSettlementV3.SwapCall memory call = IFastSettlementV3.SwapCall({
            to: bonusRouter,
            value: 0,
            data: abi.encodeWithSelector(
                BonusReturnRouter.swapWithBonus.selector,
                amountIn,
                amountOut,
                extraReturned
            )
        });

        uint256 userBalBefore = tokenIn.balanceOf(user);

        vm.prank(executor);
        settlement.executeWithPermit(intent, bytes("fakeSig"), call);

        // User should get the extra tokens as a refund
        uint256 userBalAfter = tokenIn.balanceOf(user);
        // User started with 1000, lost 100 to permit2, got 20 back as refund = 920
        assertEq(
            userBalAfter,
            userBalBefore - amountIn + extraReturned,
            "User should receive refund of extra tokens"
        );
    }

    // ============ Treasury ETH Surplus Test ============

    function testExecuteWithPermit_ETHSurplusToTreasury() public {
        uint256 amountIn = 100e18;
        uint256 userAmtOut = 1e18; // User gets 1 ETH
        uint256 actualOut = 1.5e18; // Swap produces 1.5 ETH (0.5 surplus)

        IFastSettlementV3.Intent memory intent = _createIntent(amountIn, userAmtOut, true);
        IFastSettlementV3.SwapCall memory call = _createSwapCall(amountIn, actualOut, true);

        uint256 treasuryEthBefore = treasury.balance;

        vm.prank(executor);
        settlement.executeWithPermit(intent, bytes("fakeSig"), call);

        assertEq(treasury.balance - treasuryEthBefore, 0.5e18, "Treasury should get ETH surplus");
    }

    // ============ Admin Edge Cases ============

    function testSetTreasury_ZeroAddress() public {
        vm.expectRevert(IFastSettlementV3.BadTreasury.selector);
        settlement.setTreasury(address(0));
    }

    function testSetExecutor_ToZeroAddress() public {
        // This is allowed - disables executor
        settlement.setExecutor(address(0));
        assertEq(settlement.executor(), address(0));
    }

    // ============ executeWithETH Edge Cases ============

    function testExecuteWithETH_ExpiredDeadline() public {
        IFastSettlementV3.Intent memory intent = IFastSettlementV3.Intent({
            user: user,
            inputToken: address(0),
            outputToken: address(tokenOut),
            inputAmt: 1e18,
            userAmtOut: 900e18,
            recipient: recipient,
            deadline: block.timestamp - 1, // Expired
            nonce: 0
        });
        IFastSettlementV3.SwapCall memory call = _createWETHSwapCall(1e18, 900e18);

        vm.prank(user);
        vm.expectRevert(IFastSettlementV3.IntentExpired.selector);
        settlement.executeWithETH{value: 1e18}(intent, call);
    }

    function testExecuteWithETH_UnauthorizedSwapTarget() public {
        IFastSettlementV3.Intent memory intent = _createETHInputIntent(1e18, 900e18);

        IFastSettlementV3.SwapCall memory call = IFastSettlementV3.SwapCall({
            to: makeAddr("unwhitelistedRouter"),
            value: 0,
            data: bytes("")
        });

        vm.prank(user);
        vm.expectRevert(IFastSettlementV3.UnauthorizedSwapTarget.selector);
        settlement.executeWithETH{value: 1e18}(intent, call);
    }

    // ============ Receive ETH ============

    function testReceiveETH() public {
        vm.deal(address(this), 1e18);
        (bool success, ) = address(settlement).call{value: 1e18}("");
        assertTrue(success, "Should accept ETH");
        assertEq(address(settlement).balance, 1e18);
    }

    receive() external payable {}
}

// ============ Additional Mock Contracts ============

contract FailingSwapRouter {
    function failingSwap() external pure {
        revert("Swap failed");
    }
}

contract PartialConsumptionRouter {
    address public tokenIn;
    address public tokenOut;

    constructor(address _tokenIn, address _tokenOut) {
        tokenIn = _tokenIn;
        tokenOut = _tokenOut;
    }

    function partialSwap(uint256 pullAmount, uint256 consumeAmount, uint256 outputAmount) external {
        // Pull full amount from settlement
        IERC20(tokenIn).transferFrom(msg.sender, address(this), pullAmount);
        // Return unused portion to settlement (simulating a DEX that doesn't use all input)
        uint256 unused = pullAmount - consumeAmount;
        if (unused > 0) {
            IERC20(tokenIn).transfer(msg.sender, unused);
        }
        // Mint output
        MockERC20(tokenOut).mint(msg.sender, outputAmount);
    }
}

contract BonusReturnRouter {
    address public tokenIn;
    address public tokenOut;

    constructor(address _tokenIn, address _tokenOut) {
        tokenIn = _tokenIn;
        tokenOut = _tokenOut;
    }

    function swapWithBonus(uint256 pullAmount, uint256 outputAmount, uint256 bonusReturn) external {
        // Pull full amount from settlement
        IERC20(tokenIn).transferFrom(msg.sender, address(this), pullAmount);
        // Return the pulled amount back (DEX only needs to hold it temporarily)
        IERC20(tokenIn).transfer(msg.sender, pullAmount);
        // Swap also gives bonus tokens back (e.g., rebate, arbitrage profit, etc.)
        MockERC20(tokenIn).mint(msg.sender, bonusReturn);
        // Mint output
        MockERC20(tokenOut).mint(msg.sender, outputAmount);
    }
}
