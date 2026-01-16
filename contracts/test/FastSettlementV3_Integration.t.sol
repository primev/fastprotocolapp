// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Test, console2} from "forge-std/Test.sol";
import {FastSettlementV3} from "../src/FastSettlementV3.sol";
import {IFastSettlementV3} from "../src/interfaces/IFastSettlementV3.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {MessageHashUtils} from "@openzeppelin/contracts/utils/cryptography/MessageHashUtils.sol";

import {ERC1967Proxy} from "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";

// ============ Mocks ============
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

contract MockSwapRouter {
    function swap(
        address tokenIn,
        uint256 amountIn,
        address tokenOut,
        uint256 amountOut,
        bool isEthOut
    ) external payable {
        IERC20(tokenIn).transferFrom(msg.sender, address(this), amountIn);
        if (isEthOut) {
            (bool s, ) = msg.sender.call{value: amountOut}("");
            require(s, "ETH transfer failed");
        } else {
            MockERC20(tokenOut).mint(msg.sender, amountOut);
        }
    }
}

// ============ Integration Test ============
contract FastSettlementV3IntegrationTest is Test {
    // Real Contracts
    FastSettlementV3 public settlement;
    address public permit2; // Deployed via deployCode
    MockSwapRouter public swapRouter;
    MockERC20 public tokenIn;
    MockERC20 public tokenOut;

    // Actors
    address public owner = makeAddr("owner");
    address public executor;
    uint256 public executorKey;
    address public user;
    uint256 public userKey;
    address public recipient = makeAddr("recipient");
    address public treasury = makeAddr("treasury");

    // Permit2 Constants (Copied from PermitHash.sol / Permit2.sol)
    bytes32 public constant TOKEN_PERMISSIONS_TYPEHASH =
        keccak256("TokenPermissions(address token,uint256 amount)");
    string public constant PERMIT_WITNESS_TRANSFER_TYPE_STUB =
        "PermitWitnessTransferFrom(TokenPermissions permitted,address spender,uint256 nonce,uint256 deadline,";

    function setUp() public {
        // Setup user and executor with private keys
        (user, userKey) = makeAddrAndKey("user");
        (executor, executorKey) = makeAddrAndKey("executor");

        // 1. Deploy Real Permit2
        permit2 = deployCode("out/Permit2.sol/Permit2.json");

        // 2. Deploy Tokens
        tokenIn = new MockERC20("Token In", "TIN", 18);
        tokenOut = new MockERC20("Token Out", "TOUT", 18);

        // 3. Deploy Swap Router
        swapRouter = new MockSwapRouter();

        // 4. Deploy Settlement Contract linked to Real Permit2 (via Proxy)
        vm.startPrank(owner);
        FastSettlementV3 impl = new FastSettlementV3(permit2);
        ERC1967Proxy proxy = new ERC1967Proxy(
            address(impl),
            abi.encodeCall(FastSettlementV3.initialize, (executor, treasury))
        );
        settlement = FastSettlementV3(payable(address(proxy)));
        vm.stopPrank();

        // 5. Fund User and Approve Permit2
        tokenIn.mint(user, 1000e18);
        vm.prank(user);
        IERC20(tokenIn).approve(permit2, type(uint256).max);

        // 6. Fund swap router with ETH for ETH output tests
        vm.deal(address(swapRouter), 1000e18);
    }

    function test_Integration_RealPermit2_ERC20toERC20() public {
        uint256 amountIn = 100e18;
        uint256 amountOut = 90e18;
        uint256 nonce = 0;
        uint256 deadline = block.timestamp + 1 hours;

        // 1. Create Intent
        IFastSettlementV3.Intent memory intent = IFastSettlementV3.Intent({
            user: user,
            inputToken: address(tokenIn),
            outputToken: address(tokenOut),
            inputAmt: amountIn,
            userAmtOut: amountOut,
            recipient: recipient,
            deadline: deadline,
            nonce: nonce
        });

        // 2. Create Swap Call
        IFastSettlementV3.SwapCall memory call = IFastSettlementV3.SwapCall({
            to: address(swapRouter),
            value: 0,
            data: abi.encodeWithSelector(
                MockSwapRouter.swap.selector,
                address(tokenIn),
                amountIn,
                address(tokenOut),
                amountOut,
                false
            )
        });

        // 3. Sign the Intent (Construct EIP-712 Signature for Permit2)
        bytes memory signature = _getPermitSignature(intent, userKey);

        // 4. Execute via Executor
        vm.prank(executor);
        settlement.execute(intent, signature, call);

        // 5. Verification
        assertEq(tokenIn.balanceOf(user), 1000e18 - amountIn); // User pulled
        assertEq(tokenIn.balanceOf(address(swapRouter)), amountIn); // SwapRouter received
        assertEq(tokenOut.balanceOf(recipient), amountOut); // Recipient received
    }

    function test_Integration_RealPermit2_ERC20toETH() public {
        uint256 amountIn = 100e18;
        uint256 amountOut = 1e18; // 1 ETH
        uint256 nonce = 0;
        uint256 deadline = block.timestamp + 1 hours;

        // 1. Create Intent
        IFastSettlementV3.Intent memory intent = IFastSettlementV3.Intent({
            user: user,
            inputToken: address(tokenIn),
            outputToken: address(0), // ETH output
            inputAmt: amountIn,
            userAmtOut: amountOut,
            recipient: recipient,
            deadline: deadline,
            nonce: nonce
        });

        // 2. Create Swap Call
        IFastSettlementV3.SwapCall memory call = IFastSettlementV3.SwapCall({
            to: address(swapRouter),
            value: 0,
            data: abi.encodeWithSelector(
                MockSwapRouter.swap.selector,
                address(tokenIn),
                amountIn,
                address(tokenOut), // tokenOut ignored when isEthOut=true
                amountOut,
                true // isEthOut
            )
        });

        // 3. Sign
        bytes memory signature = _getPermitSignature(intent, userKey);

        // 4. Execute
        uint256 recipientEthBefore = recipient.balance;
        vm.prank(executor);
        settlement.execute(intent, signature, call);

        // 5. Verification
        assertEq(tokenIn.balanceOf(user), 1000e18 - amountIn);
        assertEq(recipient.balance - recipientEthBefore, amountOut);
    }

    function test_Integration_RealPermit2_InvalidSignature() public {
        uint256 amountIn = 100e18;
        uint256 amountOut = 90e18;
        uint256 nonce = 0;
        uint256 deadline = block.timestamp + 1 hours;

        IFastSettlementV3.Intent memory intent = IFastSettlementV3.Intent({
            user: user,
            inputToken: address(tokenIn),
            outputToken: address(tokenOut),
            inputAmt: amountIn,
            userAmtOut: amountOut,
            recipient: recipient,
            deadline: deadline,
            nonce: nonce
        });

        IFastSettlementV3.SwapCall memory call = IFastSettlementV3.SwapCall({
            to: address(swapRouter),
            value: 0,
            data: abi.encodeWithSelector(
                MockSwapRouter.swap.selector,
                address(tokenIn),
                amountIn,
                address(tokenOut),
                amountOut,
                false
            )
        });

        // Sign with wrong key
        bytes memory badSignature = _getPermitSignature(intent, executorKey);

        // Should revert (Permit2 signature validation)
        vm.prank(executor);
        vm.expectRevert(); // Permit2 will revert with InvalidSigner or similar
        settlement.execute(intent, badSignature, call);
    }

    function test_Integration_RealPermit2_TamperedIntent_Amount() public {
        uint256 amountIn = 100e18;
        uint256 amountOut = 90e18;

        IFastSettlementV3.Intent memory intent = IFastSettlementV3.Intent({
            user: user,
            inputToken: address(tokenIn),
            outputToken: address(tokenOut),
            inputAmt: amountIn,
            userAmtOut: amountOut,
            recipient: recipient,
            deadline: block.timestamp + 1 hours,
            nonce: 0
        });

        // Sign ORIGINAL intent
        bytes memory signature = _getPermitSignature(intent, userKey);

        // Tamper with input amount
        intent.inputAmt = 50e18;

        IFastSettlementV3.SwapCall memory call = IFastSettlementV3.SwapCall({
            to: address(swapRouter),
            value: 0,
            data: abi.encodeWithSelector(
                MockSwapRouter.swap.selector,
                address(tokenIn),
                intent.inputAmt,
                address(tokenOut),
                amountOut,
                false
            )
        });

        vm.prank(executor);
        // Should revert because signature doesn't match new amount
        vm.expectRevert();
        settlement.execute(intent, signature, call);
    }

    function test_Integration_RealPermit2_TamperedIntent_Recipient() public {
        uint256 amountIn = 100e18;
        uint256 amountOut = 90e18;

        IFastSettlementV3.Intent memory intent = IFastSettlementV3.Intent({
            user: user,
            inputToken: address(tokenIn),
            outputToken: address(tokenOut),
            inputAmt: amountIn,
            userAmtOut: amountOut,
            recipient: recipient,
            deadline: block.timestamp + 1 hours,
            nonce: 0
        });

        // Sign ORIGINAL intent
        bytes memory signature = _getPermitSignature(intent, userKey);

        // Tamper with recipient
        intent.recipient = makeAddr("attacker");

        IFastSettlementV3.SwapCall memory call = IFastSettlementV3.SwapCall({
            to: address(swapRouter),
            value: 0,
            data: abi.encodeWithSelector(
                MockSwapRouter.swap.selector,
                address(tokenIn),
                amountIn,
                address(tokenOut),
                amountOut,
                false
            )
        });

        vm.prank(executor);
        // Should revert because signature doesn't match new recipient
        vm.expectRevert();
        settlement.execute(intent, signature, call);
    }

    function test_Integration_UnauthorizedExecutor() public {
        uint256 amountIn = 100e18;
        uint256 amountOut = 90e18;

        IFastSettlementV3.Intent memory intent = IFastSettlementV3.Intent({
            user: user,
            inputToken: address(tokenIn),
            outputToken: address(tokenOut),
            inputAmt: amountIn,
            userAmtOut: amountOut,
            recipient: recipient,
            deadline: block.timestamp + 1 hours,
            nonce: 0
        });

        IFastSettlementV3.SwapCall memory call = IFastSettlementV3.SwapCall({
            to: address(swapRouter),
            value: 0,
            data: abi.encodeWithSelector(
                MockSwapRouter.swap.selector,
                address(tokenIn),
                amountIn,
                address(tokenOut),
                amountOut,
                false
            )
        });

        bytes memory signature = _getPermitSignature(intent, userKey);

        // Non-executor tries to call
        address randomCaller = makeAddr("randomCaller");
        vm.prank(randomCaller);
        vm.expectRevert(IFastSettlementV3.UnauthorizedExecutor.selector);
        settlement.execute(intent, signature, call);
    }

    // ============ Helper: Generate Real Permit2 Signature ============

    function _getPermitSignature(
        IFastSettlementV3.Intent memory intent,
        uint256 pvtKey
    ) internal view returns (bytes memory) {
        // 1. Build Witness (The Intent Struct Hash)
        bytes32 witness = keccak256(
            abi.encode(
                settlement.INTENT_TYPEHASH(),
                intent.user,
                intent.inputToken,
                intent.outputToken,
                intent.inputAmt,
                intent.userAmtOut,
                intent.recipient,
                intent.deadline,
                intent.nonce
            )
        );

        // 2. Build TypeHash for PermitWitnessTransferFrom
        string memory witnessTypeString = settlement.WITNESS_TYPE_STRING();
        bytes32 typeHash = keccak256(
            abi.encodePacked(PERMIT_WITNESS_TRANSFER_TYPE_STUB, witnessTypeString)
        );

        // 3. Build TokenPermissions Hash
        bytes32 tokenPermissionsHash = keccak256(
            abi.encode(TOKEN_PERMISSIONS_TYPEHASH, intent.inputToken, intent.inputAmt)
        );

        // 4. Build Full Struct Hash
        bytes32 structHash = keccak256(
            abi.encode(
                typeHash,
                tokenPermissionsHash,
                address(settlement), // Spender
                intent.nonce,
                intent.deadline,
                witness
            )
        );

        // 5. Build EIP-712 Digest using Permit2's Domain Separator
        (bool success, bytes memory data) = permit2.staticcall(
            abi.encodeWithSignature("DOMAIN_SEPARATOR()")
        );
        require(success, "Failed to get domain separator");
        bytes32 permit2DomainSeparator = abi.decode(data, (bytes32));

        bytes32 digest = MessageHashUtils.toTypedDataHash(permit2DomainSeparator, structHash);

        // 6. Sign
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(pvtKey, digest);
        return abi.encodePacked(r, s, v);
    }
}
