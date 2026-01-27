// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Test, console2} from "forge-std/Test.sol";
import {FastSettlementV2} from "../src/FastSettlementV2.sol";
import {IFastSettlementV2, IExecutor} from "../src/interfaces/IFastSettlementV2.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {Pausable} from "@openzeppelin/contracts/utils/Pausable.sol";

// ============ Mock Contracts ============

contract MockERC20 is ERC20 {
    uint8 private _decimals;

    constructor(string memory name, string memory symbol, uint8 decimals_) ERC20(name, symbol) {
        _decimals = decimals_;
    }

    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }

    function decimals() public view override returns (uint8) {
        return _decimals;
    }
}

contract MockPermit2 {
    struct TokenPermissions {
        address token;
        uint256 amount;
    }

    struct PermitTransferFrom {
        TokenPermissions permitted;
        uint256 nonce;
        uint256 deadline;
    }

    struct SignatureTransferDetails {
        address to;
        uint256 requestedAmount;
    }

    mapping(address => mapping(address => mapping(uint256 => bool))) public usedNonces;

    function permitWitnessTransferFrom(
        PermitTransferFrom memory permit,
        SignatureTransferDetails calldata transferDetails,
        address owner_,
        bytes32,
        string calldata,
        bytes calldata
    ) external {
        // Simple mock - transfer to the requested recipient (executor)
        require(!usedNonces[owner_][msg.sender][permit.nonce], "Nonce used");
        usedNonces[owner_][msg.sender][permit.nonce] = true;

        IERC20(permit.permitted.token).transferFrom(
            owner_,
            transferDetails.to,
            transferDetails.requestedAmount
        );
    }
}

contract MockExecutor is IExecutor {
    address public settlement;
    bool public shouldFail;
    bool public stealFunds;
    uint256 public outputAmountOverride;
    bool public skipApproval;

    constructor(address _settlement) {
        settlement = _settlement;
    }

    receive() external payable {}

    function setShouldFail(bool _fail) external {
        shouldFail = _fail;
    }

    function setStealFunds(bool _steal) external {
        stealFunds = _steal;
    }

    function setOutputAmountOverride(uint256 _amount) external {
        outputAmountOverride = _amount;
    }

    function setSkipApproval(bool _skip) external {
        skipApproval = _skip;
    }

    // Execute now returns void
    function execute(IFastSettlementV2.Intent calldata intent, bytes calldata) external override {
        require(msg.sender == settlement, "Only settlement");

        if (shouldFail) {
            revert("Executor failed");
        }

        if (stealFunds) {
            return;
        }

        // Mock swap: Mint output tokens to SELF (Executor)
        // In real world, we would swap input for output
        uint256 amountToProvide = outputAmountOverride > 0
            ? outputAmountOverride
            : intent.amountOut;

        if (intent.tokenOut == address(0)) {
            // ETH Output Flow
            // Send ETH to settlement contract
            // We assume MockExecutor has been dealt ETH
            (bool success, ) = settlement.call{value: amountToProvide}("");
            require(success, "MockExecutor: ETH transfer failed");
        } else {
            // ERC20 Output Flow
            MockERC20(intent.tokenOut).mint(address(this), amountToProvide);

            // Approve settlement contract to pull output tokens
            if (!skipApproval) {
                IERC20(intent.tokenOut).approve(settlement, amountToProvide);
            }
        }
    }
}

// ============ Test Contract ============

contract FastSettlementV2Test is Test {
    FastSettlementV2 public settlement;
    MockPermit2 public permit2;
    MockExecutor public executor;
    MockERC20 public tokenIn;
    MockERC20 public tokenOut;

    address public owner = makeAddr("owner");
    address public user = makeAddr("user");
    address public recipient = makeAddr("recipient");
    address public surplusRecipient = makeAddr("surplusRecipient");
    address public attacker = makeAddr("attacker");

    function setUp() public {
        // Deploy mocks
        permit2 = new MockPermit2();
        tokenIn = new MockERC20("Token In", "TIN", 18);
        tokenOut = new MockERC20("Token Out", "TOUT", 18);

        // Deploy settlement
        vm.prank(owner);
        settlement = new FastSettlementV2(address(permit2), owner, surplusRecipient);

        // Deploy executor
        executor = new MockExecutor(address(settlement));

        // Setup permissions
        vm.startPrank(owner);
        settlement.setExecutor(address(executor), true);
        vm.stopPrank();

        // Fund user
        tokenIn.mint(user, 1000000e18);
        vm.prank(user);
        tokenIn.approve(address(permit2), type(uint256).max);
    }

    // ============ Constructor Tests ============

    function test_Constructor_RevertsOnZeroPermit2() public {
        vm.expectRevert(IFastSettlementV2.InvalidPermit2Address.selector);
        new FastSettlementV2(address(0), owner, surplusRecipient);
    }

    function test_Constructor_RevertsOnZeroOwner() public {
        vm.expectRevert(abi.encodeWithSelector(Ownable.OwnableInvalidOwner.selector, address(0)));
        new FastSettlementV2(address(permit2), address(0), surplusRecipient);
    }

    // ============ Basic Settlement Tests ============

    function test_Settle_Success() public {
        IFastSettlementV2.Intent memory intent = _createIntent(
            user,
            100e18,
            90e18,
            address(tokenOut)
        );

        vm.prank(address(executor));
        settlement.settle(intent, "", "");

        // User spent tokens
        assertEq(tokenIn.balanceOf(user), 1000000e18 - 100e18);

        // Executor received tokens (via Permit2)
        assertEq(tokenIn.balanceOf(address(executor)), 100e18);

        // Recipient received tokens
        assertEq(tokenOut.balanceOf(recipient), 90e18);
    }

    function test_Settle_ETH_Success() public {
        IFastSettlementV2.Intent memory intent = _createIntent(user, 100e18, 90e18, address(0));

        // Fund executor with ETH
        vm.deal(address(executor), 100e18);

        uint256 recipientEthBefore = recipient.balance;
        uint256 surplusEthBefore = surplusRecipient.balance;

        vm.prank(address(executor));
        settlement.settle(intent, "", "");

        // Check ETH balances
        assertEq(recipient.balance - recipientEthBefore, 90e18);
        assertEq(surplusRecipient.balance - surplusEthBefore, 0); // No surplus

        // User still spent input tokens
        assertEq(tokenIn.balanceOf(user), 1000000e18 - 100e18);
    }

    function test_Settle_ETH_Surplus() public {
        IFastSettlementV2.Intent memory intent = _createIntent(user, 100e18, 90e18, address(0));

        // Fund executor with extra ETH
        vm.deal(address(executor), 100e18);

        // Executor sends 100 ETH (10 surplus)
        executor.setOutputAmountOverride(100e18);

        uint256 recipientEthBefore = recipient.balance;
        uint256 surplusEthBefore = surplusRecipient.balance;

        vm.prank(address(executor));
        settlement.settle(intent, "", "");

        assertEq(recipient.balance - recipientEthBefore, 90e18);
        assertEq(surplusRecipient.balance - surplusEthBefore, 10e18);
    }

    function test_Settle_RevertsForNonExecutor() public {
        IFastSettlementV2.Intent memory intent = _createIntent(
            user,
            100e18,
            90e18,
            address(tokenOut)
        );

        vm.prank(attacker);
        vm.expectRevert(IFastSettlementV2.UnauthorizedExecutor.selector);
        settlement.settle(intent, "", "");
    }

    function test_Settle_RevertsWhenPaused() public {
        vm.prank(owner);
        settlement.pause();

        IFastSettlementV2.Intent memory intent = _createIntent(
            user,
            100e18,
            90e18,
            address(tokenOut)
        );

        vm.prank(address(executor));
        vm.expectRevert(abi.encodeWithSelector(Pausable.EnforcedPause.selector));
        settlement.settle(intent, "", "");
    }

    function test_Settle_RevertsWhenExecutorFails() public {
        IFastSettlementV2.Intent memory intent = _createIntent(
            user,
            100e18,
            90e18,
            address(tokenOut)
        );

        executor.setShouldFail(true);

        vm.prank(address(executor));
        vm.expectRevert("Executor failed");
        settlement.settle(intent, "", "");
    }

    /*
    DEPRECATED: We no longer check for insufficient output in ERC20 flow via a specific error if we blindly transfer.
    Wait, if we blindly transfer 'amountOut', SafeERC20 will revert with "ERC20: transfer amount exceeds balance" or "insufficient allowance".
    We keep this test but expect the standard SafeERC20 revert message (or generic revert) instead of InsufficientOutput.
    HOWEVER, for ETH flow, we DO check InsufficientOutput.
    */
    function test_Settle_ETH_RevertsWhenInsufficient() public {
        IFastSettlementV2.Intent memory intent = _createIntent(user, 100e18, 90e18, address(0));

        // Executor only sends 89 ETH (less than 90)
        vm.deal(address(executor), 100e18);
        executor.setOutputAmountOverride(89e18);

        vm.prank(address(executor));
        // We expect custom error InsufficientOutput(received, required)
        vm.expectRevert(
            abi.encodeWithSelector(IFastSettlementV2.InsufficientOutput.selector, 89e18, 90e18)
        );
        settlement.settle(intent, "", "");
    }

    function test_Settle_RevertsWhenExecutorFailsApproval() public {
        IFastSettlementV2.Intent memory intent = _createIntent(
            user,
            100e18,
            90e18,
            address(tokenOut)
        );

        // Executor forgets to approve
        executor.setSkipApproval(true);

        vm.prank(address(executor));
        vm.expectRevert();
        settlement.settle(intent, "", "");
    }

    /*
    Updated: ERC20 Surplus is NOT captured by contract anymore.
    We verify recipient gets amountOut. Surplus Recipient gets nothing (0).
    */
    function test_Settle_ERC20_IgnoresSurplus() public {
        IFastSettlementV2.Intent memory intent = _createIntent(
            user,
            100e18,
            90e18,
            address(tokenOut)
        );

        // Executor has 100 tokens, intent asks for 90.
        // Even if executor approves 100, contract only pulls 90.
        executor.setOutputAmountOverride(100e18);

        vm.prank(address(executor));
        settlement.settle(intent, "", "");

        assertEq(tokenOut.balanceOf(recipient), 90e18);
        // Surplus recipient gets nothing from contract
        assertEq(tokenOut.balanceOf(surplusRecipient), 0);

        // Executor keeps the rest (10)
        assertEq(tokenOut.balanceOf(address(executor)), 10e18);
    }

    // ============ Validate Tests ============

    function test_Validate_Success() public {
        IFastSettlementV2.Intent memory intent = _createIntent(
            user,
            100e18,
            90e18,
            address(tokenOut)
        );
        (bool valid, string memory reason) = settlement.validate(intent, "0x1234");
        assertTrue(valid);
        assertEq(reason, "");
    }

    function test_Validate_Expired() public {
        IFastSettlementV2.Intent memory intent = _createIntent(
            user,
            100e18,
            90e18,
            address(tokenOut)
        );
        intent.deadline = block.timestamp - 1;

        (bool valid, string memory reason) = settlement.validate(intent, "0x1234");
        assertFalse(valid);
        assertEq(reason, "Expired");
    }

    function test_Validate_NonceUsed() public {
        IFastSettlementV2.Intent memory intent = _createIntent(
            user,
            100e18,
            90e18,
            address(tokenOut)
        );

        vm.prank(address(executor));
        settlement.settle(intent, "", "");

        (bool valid, string memory reason) = settlement.validate(intent, "0x1234");
        assertFalse(valid);
        assertEq(reason, "Nonce Invalid");
    }

    // ============ Admin Function Tests ============

    function test_Admin_SetExecutor() public {
        address newExecutor = makeAddr("newExecutor");

        vm.prank(owner);
        settlement.setExecutor(newExecutor, true);

        assertTrue(settlement.isExecutorAllowed(newExecutor));

        vm.prank(owner);
        settlement.setExecutor(newExecutor, false);

        assertFalse(settlement.isExecutorAllowed(newExecutor));
    }

    function test_Admin_SetExecutorWhitelistActive() public {
        assertTrue(settlement.isExecutorWhitelistActive());

        vm.prank(owner);
        settlement.setExecutorWhitelistActive(false);

        assertFalse(settlement.isExecutorWhitelistActive());

        IFastSettlementV2.Intent memory intent = _createIntent(
            user,
            100e18,
            90e18,
            address(tokenOut)
        );
        MockExecutor randomExecutor = new MockExecutor(address(settlement));

        // This fails if randomExecutor doesn't implement callback
        // We just check that the call reaches "checkExecutor" logic basically and passes
        // But settlement logic requires valid callback. MockExecutor has it.
        vm.deal(address(randomExecutor), 1 ether); // Gas? No logic needs eth

        vm.prank(address(randomExecutor));
        settlement.settle(intent, "", "");
    }

    function test_Admin_SetSurplusRecipient() public {
        address newRecipient = makeAddr("newRecipient");

        vm.prank(owner);
        settlement.setSurplusRecipient(newRecipient);

        assertEq(settlement.getSurplusRecipient(), newRecipient);
    }

    // ============ Helper Functions ============

    function _createIntent(
        address maker,
        uint256 amountIn,
        uint256 amountOut,
        address _tokenOut
    ) internal view returns (IFastSettlementV2.Intent memory) {
        return
            IFastSettlementV2.Intent({
                maker: maker,
                recipient: recipient,
                tokenIn: address(tokenIn),
                tokenOut: _tokenOut,
                amountIn: amountIn,
                amountOut: amountOut,
                deadline: block.timestamp + 1 hours,
                nonce: 1,
                refId: bytes32(0)
            });
    }
}
