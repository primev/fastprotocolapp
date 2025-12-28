// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Test, console2} from "forge-std/Test.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

import {FastSettlement} from "../src/FastSettlement.sol";
import {IFastSettlement} from "../src/interfaces/IFastSettlement.sol";

/// @notice Mock Permit2 contract for testing
/// @dev Simulates the Permit2 permitWitnessTransferFrom functionality
contract MockPermit2 {
    mapping(address => mapping(uint256 => bool)) public usedNonces;

    bytes32 public constant PERMIT2_DOMAIN_SEPARATOR_TYPEHASH =
        keccak256("EIP712Domain(string name,uint256 chainId,address verifyingContract)");

    bytes32 public constant TOKEN_PERMISSIONS_TYPEHASH =
        keccak256("TokenPermissions(address token,uint256 amount)");

    bytes32 public constant PERMIT_TRANSFER_FROM_TYPEHASH =
        keccak256("PermitWitnessTransferFrom(TokenPermissions permitted,address spender,uint256 nonce,uint256 deadline,Intent witness)Intent(address maker,address recipient,address tokenIn,address tokenOut,uint256 amountIn,uint256 minOut,uint64 deadline,uint256 nonce,bytes32 refId)TokenPermissions(address token,uint256 amount)");

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

    function DOMAIN_SEPARATOR() public view returns (bytes32) {
        return keccak256(
            abi.encode(
                PERMIT2_DOMAIN_SEPARATOR_TYPEHASH,
                keccak256("Permit2"),
                block.chainid,
                address(this)
            )
        );
    }

    function permitWitnessTransferFrom(
        PermitTransferFrom memory permit,
        SignatureTransferDetails calldata transferDetails,
        address owner,
        bytes32 witness,
        string calldata, // witnessTypeString
        bytes calldata signature
    ) external {
        // Verify deadline
        require(block.timestamp <= permit.deadline, "Permit2: expired");

        // Check nonce not used
        require(!usedNonces[owner][permit.nonce], "Permit2: nonce already used");
        usedNonces[owner][permit.nonce] = true;

        // Verify signature
        bytes32 digest = _computeDigest(permit, msg.sender, witness);
        address signer = _recover(digest, signature);
        require(signer == owner, "Permit2: invalid signature");

        // Transfer tokens from owner to recipient
        IERC20(permit.permitted.token).transferFrom(owner, transferDetails.to, transferDetails.requestedAmount);
    }

    function _computeDigest(
        PermitTransferFrom memory permit,
        address spender,
        bytes32 witness
    ) internal view returns (bytes32) {
        bytes32 tokenPermissionsHash = keccak256(
            abi.encode(TOKEN_PERMISSIONS_TYPEHASH, permit.permitted.token, permit.permitted.amount)
        );

        bytes32 structHash = keccak256(
            abi.encode(
                PERMIT_TRANSFER_FROM_TYPEHASH,
                tokenPermissionsHash,
                spender,
                permit.nonce,
                permit.deadline,
                witness
            )
        );

        return keccak256(abi.encodePacked("\x19\x01", DOMAIN_SEPARATOR(), structHash));
    }

    function _recover(bytes32 hash, bytes memory signature) internal pure returns (address) {
        require(signature.length == 65, "Invalid signature length");

        bytes32 r;
        bytes32 s;
        uint8 v;

        assembly {
            r := mload(add(signature, 32))
            s := mload(add(signature, 64))
            v := byte(0, mload(add(signature, 96)))
        }

        if (v < 27) v += 27;

        return ecrecover(hash, v, r, s);
    }
}

/// @notice Mock ERC20 token for testing
contract MockERC20 is IERC20 {
    string public name;
    string public symbol;
    uint8 public decimals = 18;
    uint256 public totalSupply;

    mapping(address => uint256) public balanceOf;
    mapping(address => mapping(address => uint256)) public allowance;

    constructor(string memory _name, string memory _symbol) {
        name = _name;
        symbol = _symbol;
    }

    function mint(address to, uint256 amount) external {
        balanceOf[to] += amount;
        totalSupply += amount;
        emit Transfer(address(0), to, amount);
    }

    function transfer(address to, uint256 amount) external returns (bool) {
        balanceOf[msg.sender] -= amount;
        balanceOf[to] += amount;
        emit Transfer(msg.sender, to, amount);
        return true;
    }

    function approve(address spender, uint256 amount) external returns (bool) {
        allowance[msg.sender][spender] = amount;
        emit Approval(msg.sender, spender, amount);
        return true;
    }

    function transferFrom(address from, address to, uint256 amount) external returns (bool) {
        if (allowance[from][msg.sender] != type(uint256).max) {
            allowance[from][msg.sender] -= amount;
        }
        balanceOf[from] -= amount;
        balanceOf[to] += amount;
        emit Transfer(from, to, amount);
        return true;
    }
}

/// @notice Mock router that simulates a DEX swap
contract MockRouter {
    function swap(
        address tokenIn,
        address tokenOut,
        uint256 amountIn,
        uint256 amountOut,
        address recipient
    ) external {
        // Pull tokenIn from caller (settlement contract)
        IERC20(tokenIn).transferFrom(msg.sender, address(this), amountIn);
        // Send tokenOut to recipient (settlement contract)
        IERC20(tokenOut).transfer(recipient, amountOut);
    }
}

/// @notice Malicious router that tries to drain funds
contract MaliciousRouter {
    address public owner;

    constructor() {
        owner = msg.sender;
    }

    function swap(
        address tokenIn,
        address, // tokenOut
        uint256, // amountIn
        uint256, // amountOut
        address // recipient
    ) external {
        // Try to steal more than approved
        uint256 balance = IERC20(tokenIn).balanceOf(msg.sender);
        IERC20(tokenIn).transferFrom(msg.sender, owner, balance);
    }
}

/// @title FastSettlementTest
/// @notice Comprehensive test suite for FastSettlement contract
contract FastSettlementTest is Test {
    // ============ Test Contracts ============
    MockPermit2 public permit2;
    FastSettlement public settlement;
    MockERC20 public tokenIn;
    MockERC20 public tokenOut;
    MockRouter public router;

    // ============ Test Accounts ============
    uint256 public ownerPrivateKey = 0x1;
    uint256 public solverPrivateKey = 0x2;
    uint256 public makerPrivateKey = 0x3;
    uint256 public surplusRecipientPrivateKey = 0x4;
    uint256 public randomPrivateKey = 0x5;

    address public owner;
    address public solver;
    address public maker;
    address public surplusRecipient;
    address public randomUser;

    // ============ Constants ============
    bytes32 constant INTENT_TYPEHASH = keccak256(
        "Intent(address maker,address recipient,address tokenIn,address tokenOut,uint256 amountIn,uint256 minOut,uint64 deadline,uint256 nonce,bytes32 refId)"
    );

    string constant PERMIT2_WITNESS_TYPE_STRING =
        "Intent witness)Intent(address maker,address recipient,address tokenIn,address tokenOut,uint256 amountIn,uint256 minOut,uint64 deadline,uint256 nonce,bytes32 refId)TokenPermissions(address token,uint256 amount)";

    bytes32 constant PERMIT2_DOMAIN_SEPARATOR_TYPEHASH =
        keccak256("EIP712Domain(string name,uint256 chainId,address verifyingContract)");

    bytes32 constant TOKEN_PERMISSIONS_TYPEHASH =
        keccak256("TokenPermissions(address token,uint256 amount)");

    bytes32 constant PERMIT_TRANSFER_FROM_TYPEHASH =
        keccak256("PermitWitnessTransferFrom(TokenPermissions permitted,address spender,uint256 nonce,uint256 deadline,Intent witness)Intent(address maker,address recipient,address tokenIn,address tokenOut,uint256 amountIn,uint256 minOut,uint64 deadline,uint256 nonce,bytes32 refId)TokenPermissions(address token,uint256 amount)");

    // ============ Setup ============

    function setUp() public {
        // Derive addresses from private keys
        owner = vm.addr(ownerPrivateKey);
        solver = vm.addr(solverPrivateKey);
        maker = vm.addr(makerPrivateKey);
        surplusRecipient = vm.addr(surplusRecipientPrivateKey);
        randomUser = vm.addr(randomPrivateKey);

        // Deploy contracts
        permit2 = new MockPermit2();
        settlement = new FastSettlement(address(permit2), owner, surplusRecipient);
        tokenIn = new MockERC20("Token In", "TIN");
        tokenOut = new MockERC20("Token Out", "TOUT");
        router = new MockRouter();

        // Setup permissions
        vm.startPrank(owner);
        settlement.setSolver(solver, true);
        settlement.setRouter(address(router), true);
        vm.stopPrank();

        // Mint tokens
        tokenIn.mint(maker, 1000 ether);
        tokenOut.mint(address(router), 10000 ether);

        // Approve Permit2 for maker
        vm.prank(maker);
        tokenIn.approve(address(permit2), type(uint256).max);
    }

    // ============ Helper Functions ============

    function _createIntent(
        uint256 amountIn,
        uint256 minOut,
        uint64 deadline,
        uint256 nonce
    ) internal view returns (IFastSettlement.Intent memory) {
        return IFastSettlement.Intent({
            maker: maker,
            recipient: maker,
            tokenIn: address(tokenIn),
            tokenOut: address(tokenOut),
            amountIn: amountIn,
            minOut: minOut,
            deadline: deadline,
            nonce: nonce,
            refId: bytes32(0)
        });
    }

    function _computeIntentWitness(IFastSettlement.Intent memory intent) internal pure returns (bytes32) {
        return keccak256(
            abi.encode(
                INTENT_TYPEHASH,
                intent.maker,
                intent.recipient,
                intent.tokenIn,
                intent.tokenOut,
                intent.amountIn,
                intent.minOut,
                intent.deadline,
                intent.nonce,
                intent.refId
            )
        );
    }

    function _getPermit2DomainSeparator() internal view returns (bytes32) {
        return permit2.DOMAIN_SEPARATOR();
    }

    function _signIntent(
        IFastSettlement.Intent memory intent,
        uint256 privateKey
    ) internal view returns (bytes memory) {
        // Compute the witness hash
        bytes32 witness = _computeIntentWitness(intent);

        // Compute token permissions hash
        bytes32 tokenPermissionsHash = keccak256(
            abi.encode(TOKEN_PERMISSIONS_TYPEHASH, intent.tokenIn, intent.amountIn)
        );

        // Compute the full Permit2 struct hash
        bytes32 structHash = keccak256(
            abi.encode(
                PERMIT_TRANSFER_FROM_TYPEHASH,
                tokenPermissionsHash,
                address(settlement),
                intent.nonce,
                intent.deadline,
                witness
            )
        );

        // Compute the EIP-712 digest
        bytes32 digest = keccak256(
            abi.encodePacked("\x19\x01", _getPermit2DomainSeparator(), structHash)
        );

        // Sign the digest
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(privateKey, digest);
        return abi.encodePacked(r, s, v);
    }

    function _createRouteData(uint256 amountOut) internal view returns (bytes memory) {
        bytes memory routerCalldata = abi.encodeWithSelector(
            MockRouter.swap.selector,
            address(tokenIn),
            address(tokenOut),
            100 ether, // amountIn
            amountOut,
            address(settlement)
        );
        return abi.encodePacked(address(router), routerCalldata);
    }

    // ============ Tests: Happy Path ============

    /// @notice Test successful single intent settlement
    function test_SettleSingleIntent() public {
        IFastSettlement.Intent memory intent = _createIntent(
            100 ether,  // amountIn
            90 ether,   // minOut
            uint64(block.timestamp + 1 hours),
            0           // nonce
        );

        bytes memory signature = _signIntent(intent, makerPrivateKey);
        bytes memory routeData = _createRouteData(100 ether);

        uint256 makerBalanceBefore = tokenOut.balanceOf(maker);

        vm.prank(solver);
        (bytes32 intentId, uint256 amountOut) = settlement.settle(intent, signature, routeData);

        // Verify intent was settled
        assertTrue(intentId != bytes32(0), "Intent ID should not be zero");
        assertEq(amountOut, 100 ether, "Amount out should be 100 ether");

        // Verify token distribution
        assertEq(tokenOut.balanceOf(maker), makerBalanceBefore + 90 ether, "Maker should receive minOut");
        assertEq(tokenOut.balanceOf(surplusRecipient), 10 ether, "Surplus recipient should receive surplus");

        // Verify nonce is used
        assertTrue(settlement.isNonceUsed(maker, 0), "Nonce should be used");
    }

    /// @notice Test successful batch settlement with multiple intents
    function test_SettleBatchMultipleIntents() public {
        uint256 numIntents = 3;
        IFastSettlement.Intent[] memory intents = new IFastSettlement.Intent[](numIntents);
        bytes[] memory signatures = new bytes[](numIntents);
        bytes[] memory routeDatas = new bytes[](numIntents);

        // Mint more tokens for multiple swaps
        tokenIn.mint(maker, 200 ether);

        for (uint256 i = 0; i < numIntents; i++) {
            intents[i] = _createIntent(
                100 ether,
                90 ether,
                uint64(block.timestamp + 1 hours),
                i
            );
            signatures[i] = _signIntent(intents[i], makerPrivateKey);
            routeDatas[i] = _createRouteData(100 ether);
        }

        vm.prank(solver);
        IFastSettlement.SettlementResult[] memory results = settlement.settleBatch(intents, signatures, routeDatas);

        // Verify all intents settled successfully
        for (uint256 i = 0; i < numIntents; i++) {
            assertTrue(results[i].success, "Intent should succeed");
            assertEq(results[i].amountOut, 100 ether, "Amount out should match");
            assertTrue(settlement.isNonceUsed(maker, i), "Nonce should be used");
        }
    }

    // ============ Tests: minOut Enforcement ============

    /// @notice Test that settlement reverts when output is below minOut
    function test_RevertWhen_OutputBelowMinOut() public {
        IFastSettlement.Intent memory intent = _createIntent(
            100 ether,
            110 ether,  // minOut higher than what router will give
            uint64(block.timestamp + 1 hours),
            0
        );

        bytes memory signature = _signIntent(intent, makerPrivateKey);
        bytes memory routeData = _createRouteData(100 ether); // Only provides 100 ether

        vm.prank(solver);
        // The error gets wrapped by the try/catch in _settleIntent
        vm.expectRevert("Route execution failed");
        settlement.settle(intent, signature, routeData);
    }

    /// @notice Test batch with minOut failure - should return funds and continue
    function test_BatchContinuesOnMinOutFailure() public {
        IFastSettlement.Intent[] memory intents = new IFastSettlement.Intent[](2);
        bytes[] memory signatures = new bytes[](2);
        bytes[] memory routeDatas = new bytes[](2);

        // First intent will fail (minOut too high)
        intents[0] = _createIntent(100 ether, 200 ether, uint64(block.timestamp + 1 hours), 0);
        signatures[0] = _signIntent(intents[0], makerPrivateKey);
        routeDatas[0] = _createRouteData(100 ether);

        // Second intent should succeed
        intents[1] = _createIntent(100 ether, 90 ether, uint64(block.timestamp + 1 hours), 1);
        signatures[1] = _signIntent(intents[1], makerPrivateKey);
        routeDatas[1] = _createRouteData(100 ether);

        uint256 makerBalanceBefore = tokenIn.balanceOf(maker);

        vm.prank(solver);
        IFastSettlement.SettlementResult[] memory results = settlement.settleBatch(intents, signatures, routeDatas);

        // First should fail
        assertFalse(results[0].success, "First intent should fail");

        // Second should succeed
        assertTrue(results[1].success, "Second intent should succeed");

        // Maker should get refund for failed intent (input tokens returned)
        // Net: only 100 ether spent (for second intent), not 200 ether
        assertEq(tokenIn.balanceOf(maker), makerBalanceBefore - 100 ether, "Only one intent worth should be spent");
    }

    // ============ Tests: Deadline Enforcement ============

    /// @notice Test that settlement fails when deadline has passed
    function test_RevertWhen_DeadlinePassed() public {
        IFastSettlement.Intent memory intent = _createIntent(
            100 ether,
            90 ether,
            uint64(block.timestamp - 1), // Deadline in the past
            0
        );

        bytes memory signature = _signIntent(intent, makerPrivateKey);
        bytes memory routeData = _createRouteData(100 ether);

        vm.prank(solver);
        vm.expectRevert("Deadline passed");
        settlement.settle(intent, signature, routeData);
    }

    /// @notice Test deadline enforcement in batch mode
    function test_BatchContinuesOnDeadlineFailure() public {
        IFastSettlement.Intent[] memory intents = new IFastSettlement.Intent[](2);
        bytes[] memory signatures = new bytes[](2);
        bytes[] memory routeDatas = new bytes[](2);

        // First intent has expired deadline
        intents[0] = _createIntent(100 ether, 90 ether, uint64(block.timestamp - 1), 0);
        signatures[0] = _signIntent(intents[0], makerPrivateKey);
        routeDatas[0] = _createRouteData(100 ether);

        // Second intent is valid
        intents[1] = _createIntent(100 ether, 90 ether, uint64(block.timestamp + 1 hours), 1);
        signatures[1] = _signIntent(intents[1], makerPrivateKey);
        routeDatas[1] = _createRouteData(100 ether);

        vm.prank(solver);
        IFastSettlement.SettlementResult[] memory results = settlement.settleBatch(intents, signatures, routeDatas);

        assertFalse(results[0].success, "First intent should fail");
        assertTrue(results[1].success, "Second intent should succeed");
    }

    // ============ Tests: Replay Protection ============

    /// @notice Test that same nonce cannot be used twice
    function test_RevertWhen_NonceReused() public {
        IFastSettlement.Intent memory intent = _createIntent(
            100 ether,
            90 ether,
            uint64(block.timestamp + 1 hours),
            0
        );

        bytes memory signature = _signIntent(intent, makerPrivateKey);
        bytes memory routeData = _createRouteData(100 ether);

        // First settlement should succeed
        vm.prank(solver);
        settlement.settle(intent, signature, routeData);

        // Mint more tokens and try to reuse nonce
        tokenIn.mint(maker, 100 ether);

        vm.prank(solver);
        vm.expectRevert("Invalid nonce");
        settlement.settle(intent, signature, routeData);
    }

    /// @notice Test nonce invalidation
    function test_InvalidateNoncesUpTo() public {
        // Invalidate nonces 0-9
        vm.prank(maker);
        settlement.invalidateNoncesUpTo(10);

        IFastSettlement.Intent memory intent = _createIntent(
            100 ether,
            90 ether,
            uint64(block.timestamp + 1 hours),
            5  // Nonce below minimum
        );

        bytes memory signature = _signIntent(intent, makerPrivateKey);
        bytes memory routeData = _createRouteData(100 ether);

        vm.prank(solver);
        vm.expectRevert("Invalid nonce");
        settlement.settle(intent, signature, routeData);

        // Nonce 10 should work
        IFastSettlement.Intent memory validIntent = _createIntent(
            100 ether,
            90 ether,
            uint64(block.timestamp + 1 hours),
            10
        );

        bytes memory validSignature = _signIntent(validIntent, makerPrivateKey);

        vm.prank(solver);
        (bytes32 intentId, ) = settlement.settle(validIntent, validSignature, routeData);
        assertTrue(intentId != bytes32(0), "Intent should settle");
    }

    // ============ Tests: Authorization ============

    /// @notice Test that unauthorized solver cannot settle
    function test_RevertWhen_UnauthorizedSolver() public {
        IFastSettlement.Intent memory intent = _createIntent(
            100 ether,
            90 ether,
            uint64(block.timestamp + 1 hours),
            0
        );

        bytes memory signature = _signIntent(intent, makerPrivateKey);
        bytes memory routeData = _createRouteData(100 ether);

        vm.prank(randomUser);
        vm.expectRevert(IFastSettlement.UnauthorizedSolver.selector);
        settlement.settle(intent, signature, routeData);
    }

    /// @notice Test solver authorization management
    function test_SetSolver() public {
        assertFalse(settlement.isSolverAllowed(randomUser), "Random user should not be solver");

        vm.prank(owner);
        settlement.setSolver(randomUser, true);

        assertTrue(settlement.isSolverAllowed(randomUser), "Random user should now be solver");

        vm.prank(owner);
        settlement.setSolver(randomUser, false);

        assertFalse(settlement.isSolverAllowed(randomUser), "Random user should no longer be solver");
    }

    // ============ Tests: Router Safety ============

    /// @notice Test that unallowlisted router cannot be used
    function test_RevertWhen_RouterNotAllowed() public {
        MockRouter unauthorizedRouter = new MockRouter();

        IFastSettlement.Intent memory intent = _createIntent(
            100 ether,
            90 ether,
            uint64(block.timestamp + 1 hours),
            0
        );

        bytes memory signature = _signIntent(intent, makerPrivateKey);

        // Create route data for unauthorized router
        bytes memory routerCalldata = abi.encodeWithSelector(
            MockRouter.swap.selector,
            address(tokenIn),
            address(tokenOut),
            100 ether,
            100 ether,
            address(settlement)
        );
        bytes memory routeData = abi.encodePacked(address(unauthorizedRouter), routerCalldata);

        vm.prank(solver);
        // The error gets wrapped by the try/catch in _settleIntent
        vm.expectRevert("Route execution failed");
        settlement.settle(intent, signature, routeData);
    }

    /// @notice Test that malicious router cannot drain funds beyond approval
    function test_MaliciousRouterCannotDrainFunds() public {
        MaliciousRouter maliciousRouter = new MaliciousRouter();

        // Allow malicious router (simulating a compromised allowlist scenario)
        vm.prank(owner);
        settlement.setRouter(address(maliciousRouter), true);

        // Mint extra tokens to settlement contract to test draining
        tokenIn.mint(address(settlement), 1000 ether);

        IFastSettlement.Intent memory intent = _createIntent(
            100 ether,
            90 ether,
            uint64(block.timestamp + 1 hours),
            0
        );

        bytes memory signature = _signIntent(intent, makerPrivateKey);

        bytes memory routerCalldata = abi.encodeWithSelector(
            MaliciousRouter.swap.selector,
            address(tokenIn),
            address(tokenOut),
            100 ether,
            100 ether,
            address(settlement)
        );
        bytes memory routeData = abi.encodePacked(address(maliciousRouter), routerCalldata);

        uint256 settlementBalanceBefore = tokenIn.balanceOf(address(settlement));

        // The settlement should fail because malicious router tries to take more
        // than the approved amount, OR it fails the minOut check
        vm.prank(solver);
        vm.expectRevert(); // Either transfer fails or output is 0
        settlement.settle(intent, signature, routeData);

        // Settlement contract should still have its original balance
        // (minus any that was pulled from maker which gets returned on failure)
        assertGe(tokenIn.balanceOf(address(settlement)), settlementBalanceBefore - 100 ether,
            "Settlement should not lose extra funds");
    }

    // ============ Tests: View Functions ============

    /// @notice Test getIntentId returns consistent hash
    function test_GetIntentId() public view {
        IFastSettlement.Intent memory intent = _createIntent(
            100 ether,
            90 ether,
            uint64(block.timestamp + 1 hours),
            0
        );

        bytes32 intentId1 = settlement.getIntentId(intent);
        bytes32 intentId2 = settlement.getIntentId(intent);

        assertEq(intentId1, intentId2, "Intent ID should be deterministic");
        assertTrue(intentId1 != bytes32(0), "Intent ID should not be zero");
    }

    /// @notice Test domain separator
    function test_DomainSeparator() public view {
        bytes32 domainSeparator = settlement.DOMAIN_SEPARATOR();
        assertTrue(domainSeparator != bytes32(0), "Domain separator should not be zero");
    }

    // ============ Tests: Admin Functions ============

    /// @notice Test surplus recipient update
    function test_SetSurplusRecipient() public {
        address newRecipient = address(0x123);

        vm.prank(owner);
        settlement.setSurplusRecipient(newRecipient);

        assertEq(settlement.getSurplusRecipient(), newRecipient, "Surplus recipient should be updated");
    }

    /// @notice Test cannot set zero address as surplus recipient
    function test_RevertWhen_SetZeroSurplusRecipient() public {
        vm.prank(owner);
        vm.expectRevert(IFastSettlement.InvalidSurplusRecipient.selector);
        settlement.setSurplusRecipient(address(0));
    }

    /// @notice Test router allowlist management
    function test_SetRouter() public {
        address newRouter = address(0x456);

        assertFalse(settlement.isRouterAllowed(newRouter), "Router should not be allowed initially");

        vm.prank(owner);
        settlement.setRouter(newRouter, true);

        assertTrue(settlement.isRouterAllowed(newRouter), "Router should be allowed");

        vm.prank(owner);
        settlement.setRouter(newRouter, false);

        assertFalse(settlement.isRouterAllowed(newRouter), "Router should be disallowed");
    }

    // ============ Tests: Edge Cases ============

    /// @notice Test settlement with zero recipient fails
    function test_RevertWhen_ZeroRecipient() public {
        IFastSettlement.Intent memory intent = IFastSettlement.Intent({
            maker: maker,
            recipient: address(0), // Invalid recipient
            tokenIn: address(tokenIn),
            tokenOut: address(tokenOut),
            amountIn: 100 ether,
            minOut: 90 ether,
            deadline: uint64(block.timestamp + 1 hours),
            nonce: 0,
            refId: bytes32(0)
        });

        bytes memory signature = _signIntent(intent, makerPrivateKey);
        bytes memory routeData = _createRouteData(100 ether);

        vm.prank(solver);
        vm.expectRevert("Invalid recipient");
        settlement.settle(intent, signature, routeData);
    }

    /// @notice Test array length mismatch in batch
    function test_RevertWhen_ArrayLengthMismatch() public {
        IFastSettlement.Intent[] memory intents = new IFastSettlement.Intent[](2);
        bytes[] memory signatures = new bytes[](1); // Mismatch
        bytes[] memory routeDatas = new bytes[](2);

        vm.prank(solver);
        vm.expectRevert(IFastSettlement.ArrayLengthMismatch.selector);
        settlement.settleBatch(intents, signatures, routeDatas);
    }

    /// @notice Test exact minOut (no surplus)
    function test_SettleWithExactMinOut() public {
        IFastSettlement.Intent memory intent = _createIntent(
            100 ether,
            100 ether, // Exact amount
            uint64(block.timestamp + 1 hours),
            0
        );

        bytes memory signature = _signIntent(intent, makerPrivateKey);
        bytes memory routeData = _createRouteData(100 ether);

        uint256 surplusRecipientBefore = tokenOut.balanceOf(surplusRecipient);

        vm.prank(solver);
        settlement.settle(intent, signature, routeData);

        // Surplus recipient should receive nothing
        assertEq(tokenOut.balanceOf(surplusRecipient), surplusRecipientBefore, "No surplus should be sent");
        assertEq(tokenOut.balanceOf(maker), 100 ether, "Maker should receive full output");
    }

    /// @notice Test rescue tokens functionality
    function test_RescueTokens() public {
        // Accidentally send tokens to settlement
        tokenOut.mint(address(settlement), 50 ether);

        uint256 ownerBalanceBefore = tokenOut.balanceOf(owner);

        vm.prank(owner);
        settlement.rescueTokens(address(tokenOut), owner, 50 ether);

        assertEq(tokenOut.balanceOf(owner), ownerBalanceBefore + 50 ether, "Owner should receive rescued tokens");
    }
}
