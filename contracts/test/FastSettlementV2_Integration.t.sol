// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Test, console2} from "forge-std/Test.sol";
import {FastSettlementV2} from "../src/FastSettlementV2.sol";
import {IFastSettlementV2, IExecutor} from "../src/interfaces/IFastSettlementV2.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {MessageHashUtils} from "@openzeppelin/contracts/utils/cryptography/MessageHashUtils.sol";

// ============ Mocks ============
// Reuse standard mocks for Token and Executor, but use REAL Permit2
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

contract MockExecutor is IExecutor {
    address public settlement;
    function execute(IFastSettlementV2.Intent calldata intent, bytes calldata) external override {
        // Simple logic: Mint output token and approve settlement
        // In integration test, we assume token is MockERC20 so we can mint
        MockERC20(intent.tokenOut).mint(address(this), intent.amountOut);
        IERC20(intent.tokenOut).approve(msg.sender, intent.amountOut);
    }
}

// ============ Integration Test ============
contract FastSettlementV2IntegrationTest is Test {
    // Real Contracts
    FastSettlementV2 public settlement;
    address public permit2; // Deployed via deployCode
    MockExecutor public executor;
    MockERC20 public tokenIn;
    MockERC20 public tokenOut;

    // Actors
    address public owner = makeAddr("owner");
    address public user = makeAddr("user"); // Maker
    address public recipient = makeAddr("recipient");
    address public surplusRecipient = makeAddr("surplusRecipient");

    // User Pvt Key for signing
    uint256 public userKey;

    // Permit2 Constants (Copied from PermitHash.sol / Permit2.sol)
    bytes32 public constant TOKEN_PERMISSIONS_TYPEHASH =
        keccak256("TokenPermissions(address token,uint256 amount)");
    string public constant PERMIT_WITNESS_TRANSFER_TYPE_STUB =
        "PermitWitnessTransferFrom(TokenPermissions permitted,address spender,uint256 nonce,uint256 deadline,";

    function setUp() public {
        // Setup user with private key
        (user, userKey) = makeAddrAndKey("user");

        // 1. Deploy Real Permit2
        // We use deployCode to avoid importing incompatible 0.8.17 source directly
        permit2 = deployCode("out/Permit2.sol/Permit2.json");

        // 2. Deploy Tokens
        tokenIn = new MockERC20("Token In", "TIN", 18);
        tokenOut = new MockERC20("Token Out", "TOUT", 18);

        // 3. Deploy Settlement Contract linked to Real Permit2
        vm.prank(owner);
        settlement = new FastSettlementV2(permit2, owner, surplusRecipient);

        // 4. Deploy Executor
        executor = new MockExecutor(); // No settlement address needed in simple mock if we just trust caller?
        // Wait, simple mock needs to know who to approve.
        // Updated mock logic above implies it approves msg.sender (settlement)

        // 5. Whitelist Executor
        vm.prank(owner);
        settlement.setExecutor(address(executor), true);

        // 6. Fund User and Approve Permit2
        tokenIn.mint(user, 1000e18);
        vm.prank(user);
        IERC20(tokenIn).approve(permit2, type(uint256).max);
    }

    function test_Integration_RealPermit2_Success() public {
        uint256 amountIn = 100e18;
        uint256 amountOut = 90e18;
        uint256 nonce = 0;
        uint256 deadline = block.timestamp + 1 hours;

        // 1. Create Intent
        IFastSettlementV2.Intent memory intent = IFastSettlementV2.Intent({
            maker: user,
            recipient: recipient,
            tokenIn: address(tokenIn),
            tokenOut: address(tokenOut),
            amountIn: amountIn,
            amountOut: amountOut,
            deadline: deadline,
            nonce: nonce, // Permit2 tracks nonces globally per user?
            // Note: Permit2 nonce is just a uint256. FastSettlement transforms it.
            // But Permit2 also checks it?
            // Wait, Permit2 signature transfer uses 'nonce' in the signed data.
            // Does Permit2 enforce strictly increasing nonces?
            // SignatureTransfer: `_useUnorderedNonce`. It uses bitmap.
            // Nonce 0 is fine.
            refId: bytes32(0)
        });

        // 2. Sign the Intent (Construct EIP-712 Signature for Permit2)
        bytes memory signature = _getPermitSignature(intent, userKey);

        // 3. Execute Settle via Executor
        vm.prank(address(executor));
        settlement.settle(intent, signature, "");

        // 4. Verification
        assertEq(tokenIn.balanceOf(user), 1000e18 - amountIn); // User pulled
        assertEq(tokenIn.balanceOf(address(executor)), amountIn); // Executor received
        assertEq(tokenOut.balanceOf(recipient), amountOut); // Recipient received
    }

    // ============ Helper: Generate Real Permit2 Signature ============

    function _getPermitSignature(
        IFastSettlementV2.Intent memory intent,
        uint256 pvtKey
    ) internal view returns (bytes memory) {
        // 1. Build Witness (The Intent Struct Hash)
        bytes32 witness = keccak256(
            abi.encode(
                settlement.INTENT_TYPEHASH(),
                intent.maker,
                intent.recipient,
                intent.tokenIn,
                intent.tokenOut,
                intent.amountIn,
                intent.amountOut,
                intent.deadline,
                intent.nonce,
                intent.refId
            )
        );

        // 2. Build TypeHash for PermitWitnessTransferFrom
        // Permit2 constructs this dynamically: keccak256(abi.encodePacked(STUB, witnessTypeString))
        // Witness Type String from settlement contract
        string memory witnessTypeString = settlement.WITNESS_TYPE_STRING();
        bytes32 typeHash = keccak256(
            abi.encodePacked(PERMIT_WITNESS_TRANSFER_TYPE_STUB, witnessTypeString)
        );

        // 3. Build TokenPermissions Hash
        bytes32 tokenPermissionsHash = keccak256(
            abi.encode(TOKEN_PERMISSIONS_TYPEHASH, intent.tokenIn, intent.amountIn)
        );

        // 4. Build Full Struct Hash
        // keccak256(abi.encode(typeHash, tokenPermissionsHash, spender, nonce, deadline, witness))
        // Spender is the Settlement Contract
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

        // 5. Build EIP-712 Digest
        // Must use Permit2's Domain Separator!
        // We can fetch it via staticcall presumably? Or just compute it.
        // Permit2 is deployed at 'permit2' address.
        // It implements DOMAIN_SEPARATOR()
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
