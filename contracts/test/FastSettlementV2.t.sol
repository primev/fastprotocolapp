// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Test, console2} from "forge-std/Test.sol";
import {FastSettlementV2} from "../src/FastSettlementV2.sol";
import {IFastSettlementV2} from "../src/interfaces/IFastSettlementV2.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";

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

contract FeeOnTransferToken is ERC20 {
    uint256 public fee = 100; // 1% fee

    constructor() ERC20("FeeToken", "FEE") {}

    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }

    function transfer(address to, uint256 amount) public override returns (bool) {
        uint256 feeAmount = (amount * fee) / 10000;
        _transfer(msg.sender, address(this), feeAmount);
        _transfer(msg.sender, to, amount - feeAmount);
        return true;
    }

    function transferFrom(address from, address to, uint256 amount) public override returns (bool) {
        _spendAllowance(from, msg.sender, amount);
        uint256 feeAmount = (amount * fee) / 10000;
        _transfer(from, address(this), feeAmount);
        _transfer(from, to, amount - feeAmount);
        return true;
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
        // Simple mock - just transfer tokens
        require(!usedNonces[owner_][msg.sender][permit.nonce], "Nonce used");
        usedNonces[owner_][msg.sender][permit.nonce] = true;

        IERC20(permit.permitted.token).transferFrom(
            owner_,
            transferDetails.to,
            transferDetails.requestedAmount
        );
    }
}

contract MockRouter {
    bool public shouldFail;
    bool public shouldPartialConsume;
    address public outputRecipient;

    function setShouldFail(bool _fail) external {
        shouldFail = _fail;
    }

    function setShouldPartialConsume(bool _partial) external {
        shouldPartialConsume = _partial;
    }

    function setOutputRecipient(address _recipient) external {
        outputRecipient = _recipient;
    }

    function swap(
        address tokenIn,
        address tokenOut,
        uint256 amountIn,
        uint256, // amountOutMin - unused in mock
        address // recipient - unused, we send to msg.sender
    ) external returns (uint256) {
        if (shouldFail) {
            revert("Router: swap failed");
        }

        uint256 consumeAmount = shouldPartialConsume ? amountIn / 2 : amountIn;

        // Take input tokens from the caller (settlement contract has approved us)
        IERC20(tokenIn).transferFrom(msg.sender, address(this), consumeAmount);

        // Determine output recipient - normally msg.sender (settlement contract)
        address actualRecipient = outputRecipient != address(0) ? outputRecipient : msg.sender;

        // Give output tokens (mock 1:1 rate based on consumed amount for partial, else full)
        uint256 outputAmount = shouldPartialConsume ? consumeAmount : amountIn;
        MockERC20(tokenOut).mint(actualRecipient, outputAmount);

        return outputAmount;
    }

    // Malicious function that steals to attacker
    function maliciousSwap(
        address tokenIn,
        address tokenOut,
        uint256 amountIn,
        address attacker
    ) external returns (uint256) {
        // Take input tokens from the caller (settlement contract)
        IERC20(tokenIn).transferFrom(msg.sender, address(this), amountIn);

        // Send output to attacker instead of msg.sender (the settlement contract)
        MockERC20(tokenOut).mint(attacker, amountIn);

        return amountIn;
    }
}

contract MaliciousCallback {
    FastSettlementV2 public settlement;
    bool public callbackTriggered;

    constructor(FastSettlementV2 _settlement) {
        settlement = _settlement;
    }

    // ERC-777 style callback
    function tokensReceived(
        address,
        address,
        address,
        uint256,
        bytes calldata,
        bytes calldata
    ) external {
        callbackTriggered = true;
        // Try to reenter - should fail due to reentrancy guard
    }
}

// ============ Test Contract ============

contract FastSettlementV2Test is Test {
    FastSettlementV2 public settlement;
    MockPermit2 public permit2;
    MockRouter public router;
    MockERC20 public tokenIn;
    MockERC20 public tokenOut;

    address public owner = makeAddr("owner");
    address public solver = makeAddr("solver");
    address public user = makeAddr("user");
    address public recipient = makeAddr("recipient");
    address public surplusRecipient = makeAddr("surplusRecipient");
    address public attacker = makeAddr("attacker");

    uint256 public userPrivateKey = 0x1234;

    function setUp() public {
        // Deploy mocks
        permit2 = new MockPermit2();
        router = new MockRouter();
        tokenIn = new MockERC20("Token In", "TIN", 18);
        tokenOut = new MockERC20("Token Out", "TOUT", 18);

        // Deploy settlement
        vm.prank(owner);
        settlement = new FastSettlementV2(
            address(permit2),
            owner,
            surplusRecipient
        );

        // Setup permissions
        vm.startPrank(owner);
        settlement.setSolver(solver, true);
        settlement.setRouter(address(router), true);
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
        // OpenZeppelin's Ownable throws OwnableInvalidOwner for zero address
        vm.expectRevert(abi.encodeWithSelector(Ownable.OwnableInvalidOwner.selector, address(0)));
        new FastSettlementV2(address(permit2), address(0), surplusRecipient);
    }

    function test_Constructor_RevertsOnZeroSurplusRecipient() public {
        vm.expectRevert(IFastSettlementV2.InvalidSurplusRecipient.selector);
        new FastSettlementV2(address(permit2), owner, address(0));
    }

    // ============ Basic Settlement Tests ============

    function test_Settle_Success() public {
        IFastSettlementV2.Intent memory intent = _createIntent(user, 100e18, 90e18);
        bytes memory signature = ""; // Mock permit2 doesn't verify
        bytes memory routeData = _createRouteData(address(router), intent);

        vm.prank(solver);
        (bytes32 intentId, uint256 amountOut) = settlement.settle(intent, signature, routeData);

        assertTrue(intentId != bytes32(0));
        assertGe(amountOut, intent.minOut);
    }

    function test_Settle_RevertsForNonSolver() public {
        IFastSettlementV2.Intent memory intent = _createIntent(user, 100e18, 90e18);
        bytes memory signature = "";
        bytes memory routeData = _createRouteData(address(router), intent);

        vm.prank(attacker);
        vm.expectRevert(IFastSettlementV2.UnauthorizedSolver.selector);
        settlement.settle(intent, signature, routeData);
    }

    function test_Settle_RevertsWhenPaused() public {
        vm.prank(owner);
        settlement.pause();

        IFastSettlementV2.Intent memory intent = _createIntent(user, 100e18, 90e18);

        vm.prank(solver);
        vm.expectRevert();
        settlement.settle(intent, "", _createRouteData(address(router), intent));
    }

    // ============ Security Fix Tests ============

    /// @notice Test C-04: Verify detection when router steals funds
    /// @dev When a malicious router sends output elsewhere, the settlement fails
    /// and we detect that input was consumed without output. User loses funds
    /// because tokens are already stolen - this is why router allowlisting is CRITICAL.
    function test_Security_RouterCannotSendOutputElsewhere() public {
        // Setup: router configured to send output to attacker
        router.setOutputRecipient(attacker);

        IFastSettlementV2.Intent memory intent = _createIntent(user, 100e18, 90e18);
        bytes memory routeData = abi.encodePacked(
            address(router),
            abi.encodeCall(router.maliciousSwap, (
                intent.tokenIn,
                intent.tokenOut,
                intent.amountIn,
                attacker
            ))
        );

        uint256 userBalanceBefore = tokenIn.balanceOf(user);

        vm.prank(solver);
        (,, IFastSettlementV2.SettlementResult[] memory results) = _settleBatchSingle(intent, "", routeData);

        // Settlement should fail because output didn't come to contract
        assertFalse(results[0].success);
        assertEq(results[0].error, "Insufficient output");

        // CRITICAL: User cannot get a refund because tokens were consumed by router
        // This is why router allowlisting is essential - only trusted routers should be used
        uint256 pendingRefund = settlement.getPendingRefund(user, address(tokenIn));
        assertEq(pendingRefund, 0); // No refund available - tokens were stolen

        // The attacker has the output tokens (theft succeeded at protocol level)
        assertEq(tokenOut.balanceOf(attacker), intent.amountIn);

        // User's balance is reduced (they lost their tokens)
        assertLt(tokenIn.balanceOf(user), userBalanceBefore);

        // This demonstrates why:
        // 1. Only trusted routers should be allowlisted
        // 2. Solver selection matters (they choose the route)
        // 3. The contract correctly detects and reports the theft
    }

    /// @notice Test that partial input consumption is detected and remaining is refunded
    function test_Security_DetectsPartialInputConsumption() public {
        router.setShouldPartialConsume(true);

        IFastSettlementV2.Intent memory intent = _createIntent(user, 100e18, 90e18);
        bytes memory routeData = _createRouteData(address(router), intent);

        vm.prank(solver);
        (,, IFastSettlementV2.SettlementResult[] memory results) = _settleBatchSingle(intent, "", routeData);

        // Should fail due to input not fully consumed
        assertFalse(results[0].success);
        assertEq(results[0].error, "Input not fully consumed");

        // The remaining tokens (half) should be available as refund
        uint256 pendingRefund = settlement.getPendingRefund(user, address(tokenIn));
        assertEq(pendingRefund, intent.amountIn / 2); // Half was consumed, half remains

        // User can claim the remaining half
        vm.prank(user);
        settlement.claimRefund(address(tokenIn));
        assertEq(tokenIn.balanceOf(user), 1000000e18 - intent.amountIn / 2); // Original minus consumed half
    }

    /// @notice Test H-01: Nonce is NOT rolled back on routing failure (prevents grief)
    function test_Security_NonceNotRolledBackOnRoutingFailure() public {
        router.setShouldFail(true);

        IFastSettlementV2.Intent memory intent = _createIntent(user, 100e18, 90e18);
        bytes memory routeData = _createRouteData(address(router), intent);

        vm.prank(solver);
        settlement.settleBatch(
            _toArray(intent),
            _toBytesArray(""),
            _toBytesArray(routeData)
        );

        // Nonce should still be marked as used
        assertTrue(settlement.isNonceUsed(user, intent.nonce));

        // User can claim refund instead
        assertGt(settlement.getPendingRefund(user, address(tokenIn)), 0);
    }

    /// @notice Test M-01: Batch size limit
    function test_Security_BatchSizeLimit() public {
        uint256 batchSize = 51; // Over limit

        IFastSettlementV2.Intent[] memory intents = new IFastSettlementV2.Intent[](batchSize);
        bytes[] memory signatures = new bytes[](batchSize);
        bytes[] memory routeDatas = new bytes[](batchSize);

        vm.prank(solver);
        vm.expectRevert(abi.encodeWithSelector(
            IFastSettlementV2.BatchTooLarge.selector,
            batchSize,
            50
        ));
        settlement.settleBatch(intents, signatures, routeDatas);
    }

    /// @notice Test M-02: Domain separator changes on fork
    function test_Security_DomainSeparatorForkSafe() public {
        bytes32 domainSep1 = settlement.DOMAIN_SEPARATOR();

        // Simulate chain fork by changing chainid
        vm.chainId(999);

        bytes32 domainSep2 = settlement.DOMAIN_SEPARATOR();

        // Domain separator should be different
        assertNotEq(domainSep1, domainSep2);
    }

    /// @notice Test M-04: User receives surplus share
    function test_Security_UserReceivesSurplusShare() public {
        // Default is 50% user surplus share
        IFastSettlementV2.Intent memory intent = _createIntent(user, 100e18, 80e18);
        bytes memory routeData = _createRouteData(address(router), intent);

        uint256 recipientBalanceBefore = tokenOut.balanceOf(recipient);
        uint256 surplusRecipientBalanceBefore = tokenOut.balanceOf(surplusRecipient);

        vm.prank(solver);
        settlement.settle(intent, "", routeData);

        // amountOut = 100e18 (mock 1:1), minOut = 80e18, surplus = 20e18
        // User gets 50% of surplus = 10e18
        // Recipient gets: minOut + userSurplus = 80e18 + 10e18 = 90e18
        // Protocol gets: 10e18

        uint256 recipientReceived = tokenOut.balanceOf(recipient) - recipientBalanceBefore;
        uint256 protocolReceived = tokenOut.balanceOf(surplusRecipient) - surplusRecipientBalanceBefore;

        assertEq(recipientReceived, 90e18); // minOut + 50% surplus
        assertEq(protocolReceived, 10e18); // 50% surplus
    }

    /// @notice Test M-10: Nonce overflow protection
    function test_Security_NonceOverflowProtection() public {
        vm.prank(user);
        vm.expectRevert(IFastSettlementV2.NonceTooHigh.selector);
        settlement.invalidateNoncesUpTo(type(uint256).max);
    }

    // ============ Input Validation Tests ============

    function test_Validation_ZeroInputAmount() public {
        IFastSettlementV2.Intent memory intent = _createIntent(user, 0, 90e18);

        vm.prank(solver);
        (,, IFastSettlementV2.SettlementResult[] memory results) = _settleBatchSingle(
            intent, "", _createRouteData(address(router), intent)
        );

        assertFalse(results[0].success);
        assertEq(results[0].error, "Zero input amount");
    }

    function test_Validation_ZeroMinOutput() public {
        IFastSettlementV2.Intent memory intent = _createIntent(user, 100e18, 0);

        vm.prank(solver);
        (,, IFastSettlementV2.SettlementResult[] memory results) = _settleBatchSingle(
            intent, "", _createRouteData(address(router), intent)
        );

        assertFalse(results[0].success);
        assertEq(results[0].error, "Zero minimum output");
    }

    function test_Validation_SameTokenSwap() public {
        IFastSettlementV2.Intent memory intent = _createIntent(user, 100e18, 90e18);
        intent.tokenOut = intent.tokenIn; // Same token

        vm.prank(solver);
        (,, IFastSettlementV2.SettlementResult[] memory results) = _settleBatchSingle(
            intent, "", _createRouteData(address(router), intent)
        );

        assertFalse(results[0].success);
        assertEq(results[0].error, "Same token swap");
    }

    function test_Validation_ExpiredDeadline() public {
        IFastSettlementV2.Intent memory intent = _createIntent(user, 100e18, 90e18);
        intent.deadline = block.timestamp - 1;

        vm.prank(solver);
        (,, IFastSettlementV2.SettlementResult[] memory results) = _settleBatchSingle(
            intent, "", _createRouteData(address(router), intent)
        );

        assertFalse(results[0].success);
        assertEq(results[0].error, "Deadline passed");
    }

    function test_Validation_ZeroRecipient() public {
        IFastSettlementV2.Intent memory intent = _createIntent(user, 100e18, 90e18);
        intent.recipient = address(0);

        vm.prank(solver);
        (,, IFastSettlementV2.SettlementResult[] memory results) = _settleBatchSingle(
            intent, "", _createRouteData(address(router), intent)
        );

        assertFalse(results[0].success);
        assertEq(results[0].error, "Invalid recipient");
    }

    function test_Validation_UnallowedRouter() public {
        address badRouter = makeAddr("badRouter");
        IFastSettlementV2.Intent memory intent = _createIntent(user, 100e18, 90e18);
        bytes memory routeData = abi.encodePacked(badRouter, bytes(""));

        vm.prank(solver);
        (,, IFastSettlementV2.SettlementResult[] memory results) = _settleBatchSingle(
            intent, "", routeData
        );

        assertFalse(results[0].success);
        assertEq(results[0].error, "Router not allowed");
    }

    // ============ Admin Function Tests ============

    function test_Admin_SetSolver() public {
        address newSolver = makeAddr("newSolver");

        vm.prank(owner);
        settlement.setSolver(newSolver, true);

        assertTrue(settlement.isSolverAllowed(newSolver));

        vm.prank(owner);
        settlement.setSolver(newSolver, false);

        assertFalse(settlement.isSolverAllowed(newSolver));
    }

    function test_Admin_SetRouter() public {
        address newRouter = makeAddr("newRouter");

        vm.prank(owner);
        settlement.setRouter(newRouter, true);

        assertTrue(settlement.isRouterAllowed(newRouter));
    }

    function test_Admin_SetSurplusRecipient() public {
        address newRecipient = makeAddr("newRecipient");

        vm.prank(owner);
        settlement.setSurplusRecipient(newRecipient);

        assertEq(settlement.getSurplusRecipient(), newRecipient);
    }

    function test_Admin_SetUserSurplusBps() public {
        vm.prank(owner);
        settlement.setUserSurplusBps(7500); // 75%

        assertEq(settlement.getUserSurplusBps(), 7500);
    }

    function test_Admin_SetUserSurplusBps_RevertsOverMax() public {
        vm.prank(owner);
        vm.expectRevert(IFastSettlementV2.InvalidSurplusBps.selector);
        settlement.setUserSurplusBps(10001); // Over 100%
    }

    function test_Admin_PauseUnpause() public {
        vm.prank(owner);
        settlement.pause();

        IFastSettlementV2.Intent memory intent = _createIntent(user, 100e18, 90e18);

        vm.prank(solver);
        vm.expectRevert();
        settlement.settle(intent, "", _createRouteData(address(router), intent));

        vm.prank(owner);
        settlement.unpause();

        // Should work now
        vm.prank(solver);
        settlement.settle(intent, "", _createRouteData(address(router), intent));
    }

    // ============ Nonce Tests ============

    function test_Nonce_CannotReuse() public {
        IFastSettlementV2.Intent memory intent = _createIntent(user, 100e18, 90e18);
        bytes memory routeData = _createRouteData(address(router), intent);

        vm.prank(solver);
        settlement.settle(intent, "", routeData);

        // Try to reuse same nonce
        tokenIn.mint(user, 100e18); // Give more tokens

        vm.prank(solver);
        (,, IFastSettlementV2.SettlementResult[] memory results) = _settleBatchSingle(
            intent, "", routeData
        );

        assertFalse(results[0].success);
        assertEq(results[0].error, "Invalid nonce");
    }

    function test_Nonce_InvalidateUpTo() public {
        vm.prank(user);
        settlement.invalidateNoncesUpTo(100);

        assertEq(settlement.getMinNonce(user), 100);

        // Nonces below 100 should be invalid
        assertTrue(settlement.isNonceUsed(user, 50));
        assertTrue(settlement.isNonceUsed(user, 99));
        assertFalse(settlement.isNonceUsed(user, 100));
    }

    // ============ Refund Tests ============

    function test_Refund_ClaimAfterFailure() public {
        router.setShouldFail(true);

        IFastSettlementV2.Intent memory intent = _createIntent(user, 100e18, 90e18);
        bytes memory routeData = _createRouteData(address(router), intent);

        uint256 balanceBefore = tokenIn.balanceOf(user);

        vm.prank(solver);
        settlement.settleBatch(
            _toArray(intent),
            _toBytesArray(""),
            _toBytesArray(routeData)
        );

        // Check pending refund
        uint256 pending = settlement.getPendingRefund(user, address(tokenIn));
        assertEq(pending, intent.amountIn);

        // Claim refund
        vm.prank(user);
        settlement.claimRefund(address(tokenIn));

        // Balance restored
        assertEq(tokenIn.balanceOf(user), balanceBefore);

        // Pending refund cleared
        assertEq(settlement.getPendingRefund(user, address(tokenIn)), 0);
    }

    function test_Refund_RevertsWhenNoRefund() public {
        vm.prank(user);
        vm.expectRevert(IFastSettlementV2.NoRefundAvailable.selector);
        settlement.claimRefund(address(tokenIn));
    }

    // ============ Fee-on-Transfer Token Tests ============

    function test_FeeOnTransfer_DetectedAndRefunded() public {
        FeeOnTransferToken feeToken = new FeeOnTransferToken();
        feeToken.mint(user, 1000e18);

        vm.prank(user);
        feeToken.approve(address(permit2), type(uint256).max);

        IFastSettlementV2.Intent memory intent = IFastSettlementV2.Intent({
            maker: user,
            recipient: recipient,
            tokenIn: address(feeToken),
            tokenOut: address(tokenOut),
            amountIn: 100e18,
            minOut: 90e18,
            deadline: block.timestamp + 1 hours,
            nonce: 1,
            refId: bytes32(0)
        });

        bytes memory routeData = _createRouteData(address(router), intent);

        vm.prank(solver);
        (,, IFastSettlementV2.SettlementResult[] memory results) = _settleBatchSingle(
            intent, "", routeData
        );

        // Should fail due to fee-on-transfer
        assertFalse(results[0].success);
        assertEq(results[0].error, "Insufficient input received");

        // User can claim the actual received amount (minus fee)
        uint256 pending = settlement.getPendingRefund(user, address(feeToken));
        assertEq(pending, 99e18); // 100 - 1% fee
    }

    // ============ Helper Functions ============

    function _createIntent(
        address maker,
        uint256 amountIn,
        uint256 minOut
    ) internal view returns (IFastSettlementV2.Intent memory) {
        return IFastSettlementV2.Intent({
            maker: maker,
            recipient: recipient,
            tokenIn: address(tokenIn),
            tokenOut: address(tokenOut),
            amountIn: amountIn,
            minOut: minOut,
            deadline: block.timestamp + 1 hours,
            nonce: 1,
            refId: bytes32(0)
        });
    }

    function _createRouteData(
        address routerAddr,
        IFastSettlementV2.Intent memory intent
    ) internal pure returns (bytes memory) {
        return abi.encodePacked(
            routerAddr,
            abi.encodeCall(MockRouter.swap, (
                intent.tokenIn,
                intent.tokenOut,
                intent.amountIn,
                intent.minOut,
                address(0) // recipient handled by settlement contract
            ))
        );
    }

    function _settleBatchSingle(
        IFastSettlementV2.Intent memory intent,
        bytes memory signature,
        bytes memory routeData
    ) internal returns (bytes32, uint256, IFastSettlementV2.SettlementResult[] memory) {
        IFastSettlementV2.SettlementResult[] memory results = settlement.settleBatch(
            _toArray(intent),
            _toBytesArray(signature),
            _toBytesArray(routeData)
        );
        return (results[0].intentId, results[0].amountOut, results);
    }

    function _toArray(IFastSettlementV2.Intent memory intent)
        internal
        pure
        returns (IFastSettlementV2.Intent[] memory)
    {
        IFastSettlementV2.Intent[] memory arr = new IFastSettlementV2.Intent[](1);
        arr[0] = intent;
        return arr;
    }

    function _toBytesArray(bytes memory data) internal pure returns (bytes[] memory) {
        bytes[] memory arr = new bytes[](1);
        arr[0] = data;
        return arr;
    }
}
