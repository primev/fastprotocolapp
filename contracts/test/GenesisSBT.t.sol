// SPDX-License-Identifier: MIT
pragma solidity ^0.8.4;

import {Test} from "forge-std/Test.sol";
import {GenesisSBT} from "../src/GenesisSBT.sol";
import {IGenesisSBT} from "../src/IGenesisSBT.sol";
import {IERC4906} from "@openzeppelin/contracts/interfaces/IERC4906.sol";
import {IERC721} from "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import {Base64} from "@openzeppelin/contracts/utils/Base64.sol";

/// @notice Helper contract to expose Base64.decode for testing
contract Base64Helper {
    function decode(string memory data) external pure returns (bytes memory) {
        return Base64.decode(data);
    }
}

contract GenesisSBTTest is Test {
    GenesisSBT public sbt;
    address public owner;
    address public user1;
    address public user2;
    address public user3;

    string public constant ASSET_URI = "https://example.com/image.png";

    // =============================================================
    //                          EVENTS
    // =============================================================

    event Transfer(address indexed from, address indexed to, uint256 indexed tokenId);
    event Paused(address account);
    event Unpaused(address account);
    event OwnershipTransferStarted(address indexed previousOwner, address indexed newOwner);

    // =============================================================
    //                          SETUP
    // =============================================================

    function setUp() public {
        owner = makeAddr("owner");
        user1 = makeAddr("user1");
        user2 = makeAddr("user2");
        user3 = makeAddr("user3");

        vm.prank(owner);
        sbt = new GenesisSBT();
        sbt.initialize(ASSET_URI, owner);
    }

    // =============================================================
    //                    INITIALIZATION TESTS
    // =============================================================

    function test_Initialize() public {
        assertEq(sbt.owner(), owner);
        assertEq(sbt.name(), "Genesis SBT");
        assertEq(sbt.symbol(), "GSBT");
        assertEq(sbt.totalSupply(), 0);
        assertFalse(sbt.paused());
    }

    function test_Initialize_RevertIf_AlreadyInitialized() public {
        vm.expectRevert();
        sbt.initialize(ASSET_URI, owner);
    }

    // =============================================================
    //                       MINTING TESTS
    // =============================================================

    function test_Mint() public {
        vm.prank(user1);
        sbt.mint();

        assertEq(sbt.balanceOf(user1), 1);
        assertEq(sbt.ownerOf(1), user1);
        assertEq(sbt.totalSupply(), 1);
    }

    function test_Mint_EmitsTransferEvent() public {
        vm.expectEmit(true, true, true, false);
        emit Transfer(address(0), user1, 1);

        vm.prank(user1);
        sbt.mint();

        assertEq(sbt.balanceOf(user1), 1);
        assertEq(sbt.ownerOf(1), user1);
    }

    function test_Mint_RevertIf_AlreadyMinted() public {
        vm.prank(user1);
        sbt.mint();

        vm.expectRevert(IGenesisSBT.TokenAlreadyMinted.selector);
        vm.prank(user1);
        sbt.mint();
    }

    function test_Mint_RevertIf_Paused() public {
        vm.prank(owner);
        sbt.pause();

        vm.expectRevert();
        vm.prank(user1);
        sbt.mint();
    }

    function test_Mint_MultipleUsers() public {
        vm.prank(user1);
        sbt.mint();
        assertEq(sbt.totalSupply(), 1);
        assertEq(sbt.ownerOf(1), user1);

        vm.prank(user2);
        sbt.mint();
        assertEq(sbt.totalSupply(), 2);
        assertEq(sbt.ownerOf(2), user2);

        vm.prank(user3);
        sbt.mint();
        assertEq(sbt.totalSupply(), 3);
        assertEq(sbt.ownerOf(3), user3);
    }

    // =============================================================
    //                    ADMIN MINTING TESTS
    // =============================================================

    function test_AdminMint() public {
        address[] memory recipients = new address[](1);
        recipients[0] = user1;

        vm.prank(owner);
        sbt.adminMint(recipients);

        assertEq(sbt.balanceOf(user1), 1);
        assertEq(sbt.ownerOf(1), user1);
        assertEq(sbt.totalSupply(), 1);
    }

    function test_AdminMint_Batch() public {
        address[] memory recipients = new address[](3);
        recipients[0] = user1;
        recipients[1] = user2;
        recipients[2] = user3;

        vm.prank(owner);
        sbt.adminMint(recipients);

        assertEq(sbt.balanceOf(user1), 1);
        assertEq(sbt.balanceOf(user2), 1);
        assertEq(sbt.balanceOf(user3), 1);
        assertEq(sbt.ownerOf(1), user1);
        assertEq(sbt.ownerOf(2), user2);
        assertEq(sbt.ownerOf(3), user3);
        assertEq(sbt.totalSupply(), 3);
    }

    function test_AdminMint_SkipIfAlreadyMinted() public {
        // First mint to user1
        vm.prank(user1);
        sbt.mint();

        // Try to admin mint to user1 (should skip) and user2 (should mint)
        address[] memory recipients = new address[](2);
        recipients[0] = user1; // Already has token, should skip
        recipients[1] = user2; // Should mint

        vm.prank(owner);
        sbt.adminMint(recipients);

        assertEq(sbt.balanceOf(user1), 1); // Still 1, not 2
        assertEq(sbt.balanceOf(user2), 1); // Newly minted
        assertEq(sbt.totalSupply(), 2); // Only 2 total (user1's original + user2's new)
        assertEq(sbt.ownerOf(1), user1); // user1 has token 1
        assertEq(sbt.ownerOf(2), user2); // user2 has token 2
    }

    function test_AdminMint_SkipMultipleAlreadyMinted() public {
        // Mint to user1 and user2 first
        vm.prank(user1);
        sbt.mint();
        vm.prank(user2);
        sbt.mint();

        // Try to admin mint to all three, but user1 and user2 already have tokens
        address[] memory recipients = new address[](3);
        recipients[0] = user1; // Already has token, should skip
        recipients[1] = user2; // Already has token, should skip
        recipients[2] = user3; // Should mint

        vm.prank(owner);
        sbt.adminMint(recipients);

        assertEq(sbt.balanceOf(user1), 1); // Still 1
        assertEq(sbt.balanceOf(user2), 1); // Still 1
        assertEq(sbt.balanceOf(user3), 1); // Newly minted
        assertEq(sbt.totalSupply(), 3); // user1 + user2 + user3
        assertEq(sbt.ownerOf(1), user1); // user1 has token 1
        assertEq(sbt.ownerOf(2), user2); // user2 has token 2
        assertEq(sbt.ownerOf(3), user3); // user3 has token 3
    }

    function test_AdminMint_EmptyArray_RevertIf_Empty() public {
        address[] memory recipients = new address[](0);

        vm.expectRevert(IGenesisSBT.InvalidRecipients.selector);
        vm.prank(owner);
        sbt.adminMint(recipients);
    }

    function test_AdminMint_RevertIf_NotOwner() public {
        address[] memory recipients = new address[](1);
        recipients[0] = user2;

        vm.expectRevert();
        vm.prank(user1);
        sbt.adminMint(recipients);
    }

    function test_AdminMint_MixedAlreadyMintedAndNew() public {
        // Mint to user1 first
        vm.prank(user1);
        sbt.mint();

        // Admin mint to user1 (skip), user2 (mint), user1 again (skip), user3 (mint)
        address[] memory recipients = new address[](4);
        recipients[0] = user1; // Already has token, skip
        recipients[1] = user2; // Mint
        recipients[2] = user1; // Already has token, skip
        recipients[3] = user3; // Mint

        vm.prank(owner);
        sbt.adminMint(recipients);

        assertEq(sbt.balanceOf(user1), 1); // Still 1
        assertEq(sbt.balanceOf(user2), 1); // Newly minted
        assertEq(sbt.balanceOf(user3), 1); // Newly minted
        assertEq(sbt.totalSupply(), 3); // user1 + user2 + user3
        assertEq(sbt.ownerOf(1), user1); // user1 has token 1
        assertEq(sbt.ownerOf(2), user2); // user2 has token 2
        assertEq(sbt.ownerOf(3), user3); // user3 has token 3
    }

    // =============================================================
    //              TRANSFER PREVENTION TESTS
    // =============================================================

    function test_Transfer_RevertIf_TransferAttempted() public {
        vm.prank(user1);
        sbt.mint();

        vm.expectRevert(IGenesisSBT.SoulBoundToken_TransferNotAllowed.selector);
        vm.prank(user1);
        sbt.transferFrom(user1, user2, 1);
    }

    function test_Transfer_RevertIf_SafeTransferAttempted() public {
        vm.prank(user1);
        sbt.mint();

        vm.expectRevert(IGenesisSBT.SoulBoundToken_TransferNotAllowed.selector);
        vm.prank(user1);
        sbt.safeTransferFrom(user1, user2, 1);
    }

    function test_Transfer_RevertIf_ApprovedTransferAttempted() public {
        vm.prank(user1);
        sbt.mint();

        vm.prank(user1);
        sbt.approve(user2, 1);

        vm.expectRevert(IGenesisSBT.SoulBoundToken_TransferNotAllowed.selector);
        vm.prank(user2);
        sbt.transferFrom(user1, user3, 1);
    }

    // =============================================================
    //                  PAUSE/UNPAUSE TESTS
    // =============================================================

    function test_Pause() public {
        vm.prank(owner);
        sbt.pause();

        assertTrue(sbt.paused());
    }

    function test_Unpause() public {
        vm.prank(owner);
        sbt.pause();

        vm.prank(owner);
        sbt.unpause();

        assertFalse(sbt.paused());
    }

    function test_Pause_RevertIf_NotOwner() public {
        vm.expectRevert();
        vm.prank(user1);
        sbt.pause();
    }

    function test_Unpause_RevertIf_NotOwner() public {
        vm.prank(owner);
        sbt.pause();

        vm.expectRevert();
        vm.prank(user1);
        sbt.unpause();
    }

    function test_Mint_AfterUnpause() public {
        vm.prank(owner);
        sbt.pause();

        vm.prank(owner);
        sbt.unpause();

        vm.prank(user1);
        sbt.mint();

        assertEq(sbt.balanceOf(user1), 1);
    }

    // =============================================================
    //              METADATA MANAGEMENT TESTS
    // =============================================================

    function test_SetAssetURI() public {
        // Mint a token first
        vm.prank(user1);
        sbt.mint();

        string memory newURI = "https://example.com/new-image.png";

        vm.expectEmit(true, false, false, false);
        emit IERC4906.BatchMetadataUpdate(1, 1);

        vm.prank(owner);
        sbt.setAssetURI(newURI);

        // Verify by checking tokenURI includes the new URI
        string memory uri = sbt.tokenURI(1);

        // Extract and decode base64 to verify content
        bytes memory uriBytes = bytes(uri);
        uint256 prefixLength = 29; // "data:application/json;base64," length
        require(uriBytes.length > prefixLength, "URI too short");

        bytes memory base64Part = new bytes(uriBytes.length - prefixLength);
        for (uint256 i = 0; i < base64Part.length; i++) {
            base64Part[i] = uriBytes[prefixLength + i];
        }

        // Decode base64 to get JSON bytes using helper
        Base64Helper helper = new Base64Helper();
        bytes memory jsonBytes = helper.decode(string(base64Part));
        string memory json = string(jsonBytes);

        assertTrue(contains(json, newURI));
    }

    function test_SetAssetURI_RevertIf_NotOwner() public {
        vm.expectRevert();
        vm.prank(user1);
        sbt.setAssetURI("https://example.com/new.png");
    }

    function test_SetNftName() public {
        // Mint a token first
        vm.prank(user1);
        sbt.mint();

        string memory name = "Test NFT";

        vm.expectEmit(true, false, false, false);
        emit IERC4906.BatchMetadataUpdate(1, 1);

        vm.prank(owner);
        sbt.setNftName(name);

        assertEq(sbt._nftName(), name);
    }

    function test_SetNftName_RevertIf_NotOwner() public {
        vm.expectRevert();
        vm.prank(user1);
        sbt.setNftName("Test");
    }

    function test_SetNftDescription() public {
        // Mint a token first
        vm.prank(user1);
        sbt.mint();

        string memory description = "Test Description";

        vm.expectEmit(true, false, false, false);
        emit IERC4906.BatchMetadataUpdate(1, 1);

        vm.prank(owner);
        sbt.setNftDescription(description);

        assertEq(sbt._nftDescription(), description);
    }

    function test_SetNftDescription_RevertIf_NotOwner() public {
        vm.expectRevert();
        vm.prank(user1);
        sbt.setNftDescription("Desc");
    }

    // =============================================================
    //                    TOKEN URI TESTS
    // =============================================================

    function test_TokenURI() public {
        string memory name = "Genesis Token";
        string memory description = "A genesis soul bound token";

        vm.prank(owner);
        sbt.setNftName(name);
        vm.prank(owner);
        sbt.setNftDescription(description);

        vm.prank(user1);
        sbt.mint();

        string memory uri = sbt.tokenURI(1);

        // Verify URI format
        assertTrue(startsWith(uri, "data:application/json;base64,"));

        // Extract base64 part
        bytes memory uriBytes = bytes(uri);
        uint256 prefixLength = 29; // "data:application/json;base64," length
        require(uriBytes.length > prefixLength, "URI too short");

        bytes memory base64Part = new bytes(uriBytes.length - prefixLength);
        for (uint256 i = 0; i < base64Part.length; i++) {
            base64Part[i] = uriBytes[prefixLength + i];
        }

        // Decode base64 to get JSON bytes using helper
        Base64Helper helper = new Base64Helper();
        bytes memory jsonBytes = helper.decode(string(base64Part));
        string memory json = string(jsonBytes);

        // Verify JSON contains expected fields
        assertTrue(contains(json, name));
        assertTrue(contains(json, description));
        assertTrue(contains(json, ASSET_URI));
        assertTrue(contains(json, "1"));
    }

    function test_TokenURI_RevertIf_TokenNotFound() public {
        vm.expectRevert(IGenesisSBT.TokenNotFound.selector);
        sbt.tokenURI(1);
    }

    function test_TokenURI_ValidJSON() public {
        string memory name = "Test";
        string memory description = "Test Desc";

        vm.prank(owner);
        sbt.setNftName(name);
        vm.prank(owner);
        sbt.setNftDescription(description);

        vm.prank(user1);
        sbt.mint();

        string memory uri = sbt.tokenURI(1);

        // Decode and verify JSON structure
        bytes memory uriBytes = bytes(uri);
        assertGt(uriBytes.length, 0);
        assertTrue(startsWith(uri, "data:application/json;base64,"));
    }

    // =============================================================
    //              OWNERSHIP TRANSFER TESTS
    // =============================================================

    function test_TransferOwnership() public {
        address newOwner = makeAddr("newOwner");

        vm.prank(owner);
        sbt.transferOwnership(newOwner);

        assertEq(sbt.pendingOwner(), newOwner);
        assertEq(sbt.owner(), owner); // Still owner until accepted
    }

    function test_TransferOwnership_Event() public {
        address newOwner = makeAddr("newOwner");

        vm.expectEmit(true, true, false, false);
        emit OwnershipTransferStarted(owner, newOwner);

        vm.prank(owner);
        sbt.transferOwnership(newOwner);
    }

    function test_AcceptOwnership() public {
        address newOwner = makeAddr("newOwner");

        vm.prank(owner);
        sbt.transferOwnership(newOwner);

        vm.prank(newOwner);
        sbt.acceptOwnership();

        assertEq(sbt.owner(), newOwner);
        assertEq(sbt.pendingOwner(), address(0));
    }

    function test_AcceptOwnership_RevertIf_NotPendingOwner() public {
        address newOwner = makeAddr("newOwner");

        vm.prank(owner);
        sbt.transferOwnership(newOwner);

        vm.expectRevert();
        vm.prank(user1);
        sbt.acceptOwnership();
    }

    function test_TransferOwnership_RevertIf_NotOwner() public {
        address newOwner = makeAddr("newOwner");

        vm.expectRevert();
        vm.prank(user1);
        sbt.transferOwnership(newOwner);
    }

    function test_TransferOwnership_Cancel() public {
        address newOwner = makeAddr("newOwner");

        vm.prank(owner);
        sbt.transferOwnership(newOwner);
        assertEq(sbt.pendingOwner(), newOwner);

        // Cancel by transferring to zero address
        vm.prank(owner);
        sbt.transferOwnership(address(0));
        assertEq(sbt.pendingOwner(), address(0));
        assertEq(sbt.owner(), owner);
    }

    function test_TransferOwnership_ReplacePendingOwner() public {
        address newOwner1 = makeAddr("newOwner1");
        address newOwner2 = makeAddr("newOwner2");

        vm.prank(owner);
        sbt.transferOwnership(newOwner1);
        assertEq(sbt.pendingOwner(), newOwner1);

        vm.prank(owner);
        sbt.transferOwnership(newOwner2);
        assertEq(sbt.pendingOwner(), newOwner2);
    }

    function test_OwnershipTransfer_OwnerFunctionsStillWork() public {
        address newOwner = makeAddr("newOwner");

        vm.prank(owner);
        sbt.transferOwnership(newOwner);

        // Owner should still be able to perform owner functions
        vm.prank(owner);
        sbt.pause();

        assertTrue(sbt.paused());
    }

    function test_OwnershipTransfer_NewOwnerCanPerformFunctions() public {
        address newOwner = makeAddr("newOwner");

        vm.prank(owner);
        sbt.transferOwnership(newOwner);

        vm.prank(newOwner);
        sbt.acceptOwnership();

        // New owner should be able to perform owner functions
        vm.prank(newOwner);
        sbt.pause();
        
        vm.prank(newOwner);
        sbt.unpause();
    }

    // =============================================================
    //                  TOTAL SUPPLY TESTS
    // =============================================================

    function test_TotalSupply() public {
        assertEq(sbt.totalSupply(), 0);

        vm.prank(user1);
        sbt.mint();
        assertEq(sbt.totalSupply(), 1);
        assertEq(sbt.ownerOf(1), user1);

        vm.prank(user2);
        sbt.mint();
        assertEq(sbt.totalSupply(), 2);
        assertEq(sbt.ownerOf(2), user2);

        address[] memory recipients = new address[](3);
        recipients[0] = user3;
        recipients[1] = makeAddr("user4");
        recipients[2] = makeAddr("user5");
        vm.prank(owner);
        sbt.adminMint(recipients);
        assertEq(sbt.totalSupply(), 5);
        assertEq(sbt.ownerOf(3), user3);
        assertEq(sbt.ownerOf(4), makeAddr("user4"));
        assertEq(sbt.ownerOf(5), makeAddr("user5"));
    }

    // =============================================================
    //              INTERFACE SUPPORT TESTS
    // =============================================================

    function test_SupportsInterface_ERC4906() public {
        assertTrue(sbt.supportsInterface(type(IERC4906).interfaceId));
    }

    function test_SupportsInterface_ERC721() public {
        assertTrue(sbt.supportsInterface(type(IERC721).interfaceId));
    }

    // =============================================================
    //                  USER TOKEN ID MAPPING TESTS
    // =============================================================

    function test_UserTokenId_Mapping_InitialState() public {
        // Before minting, mapping should return 0
        assertEq(sbt.getTokenIdByAddress(user1), 0);
        assertEq(sbt.getTokenIdByAddress(user2), 0);
        assertEq(sbt.getTokenIdByAddress(user3), 0);
    }

    function test_UserTokenId_Mapping_SetOnMint() public {
        vm.prank(user1);
        sbt.mint();

        // Mapping should be set to token ID 1
        assertEq(sbt.getTokenIdByAddress(user1), 1);
        assertEq(sbt.ownerOf(1), user1);
    }

    function test_UserTokenId_Mapping_SetOnAdminMint() public {
        address[] memory recipients = new address[](1);
        recipients[0] = user1;

        vm.prank(owner);
        sbt.adminMint(recipients);

        // Mapping should be set to token ID 1
        assertEq(sbt.getTokenIdByAddress(user1), 1);
        assertEq(sbt.ownerOf(1), user1);
    }

    function test_UserTokenId_Mapping_MultipleUsers() public {
        vm.prank(user1);
        sbt.mint();
        assertEq(sbt.getTokenIdByAddress(user1), 1);

        vm.prank(user2);
        sbt.mint();
        assertEq(sbt.getTokenIdByAddress(user2), 2);

        vm.prank(user3);
        sbt.mint();
        assertEq(sbt.getTokenIdByAddress(user3), 3);

        // Verify all mappings are correct
        assertEq(sbt.getTokenIdByAddress(user1), 1);
        assertEq(sbt.getTokenIdByAddress(user2), 2);
        assertEq(sbt.getTokenIdByAddress(user3), 3);
    }

    function test_UserTokenId_Mapping_BatchAdminMint() public {
        address[] memory recipients = new address[](3);
        recipients[0] = user1;
        recipients[1] = user2;
        recipients[2] = user3;

        vm.prank(owner);
        sbt.adminMint(recipients);

        // All mappings should be set correctly
        assertEq(sbt.getTokenIdByAddress(user1), 1);
        assertEq(sbt.getTokenIdByAddress(user2), 2);
        assertEq(sbt.getTokenIdByAddress(user3), 3);
    }

    function test_UserTokenId_Mapping_NotSetForNonMinters() public {
        vm.prank(user1);
        sbt.mint();

        // user2 and user3 haven't minted, so mapping should be 0
        assertEq(sbt.getTokenIdByAddress(user1), 1);
        assertEq(sbt.getTokenIdByAddress(user2), 0);
        assertEq(sbt.getTokenIdByAddress(user3), 0);
    }

    function test_UserTokenId_Mapping_PreventsDuplicateMint() public {
        vm.prank(user1);
        sbt.mint();
        assertEq(sbt.getTokenIdByAddress(user1), 1);

        // Try to mint again - should revert
        vm.expectRevert(IGenesisSBT.TokenAlreadyMinted.selector);
        vm.prank(user1);
        sbt.mint();

        // Mapping should still be 1, not changed
        assertEq(sbt.getTokenIdByAddress(user1), 1);
    }

    function test_UserTokenId_Mapping_AdminMintSkipsAlreadyMinted() public {
        // User1 mints via public mint
        vm.prank(user1);
        sbt.mint();
        assertEq(sbt.getTokenIdByAddress(user1), 1);

        // Admin tries to mint to user1 (should skip) and user2 (should mint)
        address[] memory recipients = new address[](2);
        recipients[0] = user1;
        recipients[1] = user2;

        vm.prank(owner);
        sbt.adminMint(recipients);

        // user1's mapping should still be 1, user2 should get token 2
        assertEq(sbt.getTokenIdByAddress(user1), 1);
        assertEq(sbt.getTokenIdByAddress(user2), 2);
    }

    function test_GetTokenIdByAddress() public {
        vm.prank(user1);
        sbt.mint();

        // Should return the correct token ID
        assertEq(sbt.getTokenIdByAddress(user1), 1);
    }

    function test_GetTokenIdByAddress_ReturnsZeroForNonMinters() public {
        // No mints yet
        assertEq(sbt.getTokenIdByAddress(user1), 0);
        assertEq(sbt.getTokenIdByAddress(user2), 0);

        // Mint to user1 only
        vm.prank(user1);
        sbt.mint();

        assertEq(sbt.getTokenIdByAddress(user1), 1);
        assertEq(sbt.getTokenIdByAddress(user2), 0);
    }

    function test_GetTokenIdByAddress_MultipleUsers() public {
        vm.prank(user1);
        sbt.mint();
        vm.prank(user2);
        sbt.mint();
        vm.prank(user3);
        sbt.mint();

        assertEq(sbt.getTokenIdByAddress(user1), 1);
        assertEq(sbt.getTokenIdByAddress(user2), 2);
        assertEq(sbt.getTokenIdByAddress(user3), 3);
    }

    function test_UserTokenId_Mapping_ConsistentWithOwnerOf() public {
        vm.prank(user1);
        sbt.mint();

        uint256 tokenId = sbt.getTokenIdByAddress(user1);
        assertEq(tokenId, 1);
        assertEq(sbt.ownerOf(tokenId), user1);
    }

    function test_UserTokenId_Mapping_MixedMintAndAdminMint() public {
        // User1 mints via public mint
        vm.prank(user1);
        sbt.mint();
        assertEq(sbt.getTokenIdByAddress(user1), 1);

        // User2 mints via public mint
        vm.prank(user2);
        sbt.mint();
        assertEq(sbt.getTokenIdByAddress(user2), 2);

        // Admin mints to user3
        address[] memory recipients = new address[](1);
        recipients[0] = user3;
        vm.prank(owner);
        sbt.adminMint(recipients);
        assertEq(sbt.getTokenIdByAddress(user3), 3);

        // Verify all mappings
        assertEq(sbt.getTokenIdByAddress(user1), 1);
        assertEq(sbt.getTokenIdByAddress(user2), 2);
        assertEq(sbt.getTokenIdByAddress(user3), 3);
        assertEq(sbt.totalSupply(), 3);
    }

    function test_UserTokenId_Mapping_PublicAccess() public {
        vm.prank(user1);
        sbt.mint();

        // Should be accessible via getTokenIdByAddress
        uint256 tokenId = sbt.getTokenIdByAddress(user1);
        assertEq(tokenId, 1);
    }

    // =============================================================
    //                  HELPER FUNCTIONS
    // =============================================================

    function contains(string memory str, string memory substr) internal pure returns (bool) {
        bytes memory strBytes = bytes(str);
        bytes memory substrBytes = bytes(substr);

        if (substrBytes.length > strBytes.length) return false;
        if (substrBytes.length == 0) return true;

        for (uint256 i = 0; i <= strBytes.length - substrBytes.length; i++) {
            bool isMatch = true;
            for (uint256 j = 0; j < substrBytes.length; j++) {
                if (strBytes[i + j] != substrBytes[j]) {
                    isMatch = false;
                    break;
                }
            }
            if (isMatch) return true;
        }
        return false;
    }

    function startsWith(string memory str, string memory prefix) internal pure returns (bool) {
        bytes memory strBytes = bytes(str);
        bytes memory prefixBytes = bytes(prefix);

        if (prefixBytes.length > strBytes.length) return false;

        for (uint256 i = 0; i < prefixBytes.length; i++) {
            if (strBytes[i] != prefixBytes[i]) return false;
        }
        return true;
    }
}
