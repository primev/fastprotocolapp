// SPDX-License-Identifier: MIT
pragma solidity ^0.8.4;

import "@openzeppelin/contracts-upgradeable/token/ERC721/ERC721Upgradeable.sol";
import "@openzeppelin/contracts-upgradeable/access/Ownable2StepUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/PausableUpgradeable.sol";
import "@openzeppelin/contracts/interfaces/IERC4906.sol";
import "@openzeppelin/contracts/utils/Strings.sol";
import "@openzeppelin/contracts/utils/Base64.sol";
import "@openzeppelin/contracts/utils/introspection/IERC165.sol";
import "./GenesisSBTStorage.sol";
import "./IGenesisSBT.sol";

/// @title GenesisSBT
contract GenesisSBT is
    Ownable2StepUpgradeable,
    ERC721Upgradeable,
    PausableUpgradeable,
    UUPSUpgradeable,
    GenesisSBTStorage,
    IGenesisSBT
{
    // =============================================================
    //                          INITIALIZATION
    // =============================================================

    /// @notice Initializes the contract
    function initialize(
        string calldata asset,
        address owner
    ) external initializer {
        __Ownable2Step_init();
        __Ownable_init(owner);
        __ERC721_init("Genesis SBT", "GSBT");
        __Pausable_init();
        _assetURI = asset;
        _nftName = "Fast Protocol Genesis SBT";
    }

    // =============================================================
    //                          MINTING
    // =============================================================

    /// @notice Mints a token to the caller
    function mint() external whenNotPaused {
        address to = msg.sender;

        if (_userTokenId[to] != 0) revert TokenAlreadyMinted();
        _executeMint(to);
    }

    /// @notice Owner mints tokens to multiple addresses
    function adminMint(address[] calldata to) external onlyOwner {
        if (to.length == 0) revert InvalidRecipients();

        for (uint256 i = 0; i < to.length; i++) {
            if (_userTokenId[to[i]] != 0) continue;
            _executeMint(to[i]);
        }
    }

    // =============================================================
    //                          VIEW FUNCTIONS
    // =============================================================

    function totalSupply() external view returns (uint256) {
        return _totalTokensMinted;
    }

    /// @notice Returns the token ID for a given user address
    /// @param user The address to query
    /// @return tokenId The token ID owned by the user, or 0 if the user doesn't have a token
    function getTokenIdByAddress(address user) external view returns (uint256 tokenId) {
        return _userTokenId[user];
    }

    /// @notice Returns the metadata URI for a token
    function tokenURI(
        uint256 tokenId
    ) public view override(ERC721Upgradeable, IGenesisSBT) returns (string memory) {
        if (_ownerOf(tokenId) == address(0)) revert TokenNotFound();

        return
            string(
                abi.encodePacked(
                    "data:application/json;base64,",
                    Base64.encode(
                        abi.encodePacked(
                            '{"name":"',
                            _nftName,
                            '","id":"',
                            Strings.toString(tokenId),
                            '","image":"',
                            _assetURI,
                            '","description":"',
                            _nftDescription,
                            '"}'
                        )
                    )
                )
            );
    }

    // =============================================================
    //                          OWNER FUNCTIONS
    // =============================================================

    function setAssetURI(string calldata assetURI) external onlyOwner {
        _assetURI = assetURI;
        _updateMetadata();
    }

    function setNftName(string calldata nftName) external onlyOwner {
        _nftName = nftName;
        _updateMetadata();
    }

    function setNftDescription(string calldata nftDescription) external onlyOwner {
        _nftDescription = nftDescription;
        _updateMetadata();
    }

    // =============================================================
    //                          PAUSABLE
    // =============================================================

    function pause() external onlyOwner {
        _pause();
    }

    function unpause() external onlyOwner {
        _unpause();
    }

    // =============================================================
    //                          OVERRIDES
    // =============================================================

    /// @inheritdoc IERC165
    function supportsInterface(bytes4 interfaceId)
        public
        view
        override(ERC721Upgradeable, IERC165)
        returns (bool)
    {
        return interfaceId == type(IERC4906).interfaceId || super.supportsInterface(interfaceId);
    }

    /// @notice Transfers are disabled for soul-bound tokens
    function transferFrom(
        address from,
        address to,
        uint256 tokenId
    ) public override(ERC721Upgradeable, IERC721) {
        revert SoulBoundToken_TransferNotAllowed();
    }

    /// @notice Transfers are disabled for soul-bound tokens
    function safeTransferFrom(
        address from,
        address to,
        uint256 tokenId,
        bytes memory data
    ) public override(ERC721Upgradeable, IERC721) {
        revert SoulBoundToken_TransferNotAllowed();
    }

    // =============================================================
    //                          UUPS UPGRADE
    // =============================================================

    function _authorizeUpgrade(address) internal override onlyOwner {}

    // =============================================================
    //                          INTERNAL/PRIVATE
    // =============================================================

    /// @dev Executes the mint and updates state
    function _executeMint(address to) private {
        uint256 tokenId = _totalTokensMinted + 1;
        _mint(to, tokenId);
        _userTokenId[to] = tokenId;

        unchecked {
            _totalTokensMinted++;
        }
    }

    /// @dev Updates the metadata for all tokens
    function _updateMetadata() private {
         if (_totalTokensMinted > 0) {
            emit BatchMetadataUpdate(1, _totalTokensMinted);
        }
    }

}
