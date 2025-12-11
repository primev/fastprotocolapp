// SPDX-License-Identifier: MIT
pragma solidity ^0.8.4;

import "@openzeppelin/contracts-upgradeable/token/ERC721/ERC721Upgradeable.sol";
import "@openzeppelin/contracts-upgradeable/access/Ownable2StepUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/PausableUpgradeable.sol";
import "@openzeppelin/contracts/utils/Strings.sol";
import "@openzeppelin/contracts/utils/Base64.sol";

/**
 * @title GenesisSBT
 * @dev Soul Bound Token contract for managing NFT minting with on-chain metadata.
 */
contract GenesisSBT is Ownable2StepUpgradeable, ERC721Upgradeable, PausableUpgradeable, UUPSUpgradeable {
    // Metadata
    string public _name;
    string public _description;
    string private _assetURI;

    // Tracks the total number of minted tokens
    uint256 private _counter;

    // The price to mint a token
    uint256 public _mintPrice;

    /**
     * @dev This empty reserved space is put in place to allow future versions to add new
     * variables without shifting down storage in the inheritance chain.
     * See https://docs.openzeppelin.com/contracts/4.x/upgradeable#storage_gaps
     */
    uint256[50] private __gap;

    error TokenNotFound();
    error TokenAlreadyMinted();
    error SoulBoundToken_TransferNotAllowed();
    error SoulBoundToken_BurnNotAllowed();
    error InvalidRecipients();
    error InsufficientFunds(uint256 required, uint256 provided);

    function initialize(string calldata asset, address owner, uint256 mintPrice) external initializer {
        __Ownable2Step_init();
        __Ownable_init(owner);
        __ERC721_init("Genesis SBT", "GSBT");
        __Pausable_init();
        _assetURI = asset;
        _mintPrice = mintPrice;
        _name = "Fast Protocol Genesis SBT";
    }

    function mint() external payable whenNotPaused {
        if (balanceOf(msg.sender) > 0) revert TokenAlreadyMinted();
        if (msg.value < _mintPrice) revert InsufficientFunds(_mintPrice, msg.value);
        _safeMint(msg.sender, ++_counter);
    }

    /**
     * @dev Allows the owner to mint tokens to multiple addresses without requiring payment.
     * @param to Array of addresses to mint tokens to. Skips addresses that already have tokens.
     */
    function adminMint(address[] calldata to) external onlyOwner {
        if (to.length == 0) revert InvalidRecipients();

        for (uint256 i = 0; i < to.length; i++) {
            if (balanceOf(to[i]) > 0) continue;
            _safeMint(to[i], ++_counter);
        }
    }

    function totalSupply() external view returns (uint256) {
        return _counter;
    }

    function setAssetURI(string calldata assetURI) external onlyOwner {
        _assetURI = assetURI;
    }

    function setMetadataProperties(string calldata nftName, string calldata description) external onlyOwner {
        _name = nftName;
        _description = description;
    }

    function setMintPrice(uint256 mintPrice) external onlyOwner {
        _mintPrice = mintPrice;
    }

    function tokenURI(uint256 tokenId) public view override returns (string memory) {
        if (_ownerOf(tokenId) == address(0)) revert TokenNotFound();

        return string(
            abi.encodePacked(
                "data:application/json;base64,",
                Base64.encode(
                    abi.encodePacked(
                        '{"name":"',
                        _name,
                        '","id":"',
                        Strings.toString(tokenId),
                        '","image":"',
                        _assetURI,
                        '","description":"',
                        _description,
                        '"}'
                    )
                )
            )
        );
    }

    function transferFrom(address from, address to, uint256 tokenId) public virtual override {
        if (to == address(0)) {
            revert SoulBoundToken_BurnNotAllowed();
        }
        super.transferFrom(from, to, tokenId);
    }

    function safeTransferFrom(address from, address to, uint256 tokenId, bytes memory data) public virtual override {
        if (to == address(0)) {
            revert SoulBoundToken_BurnNotAllowed();
        }
        super.safeTransferFrom(from, to, tokenId, data);
    }

    function _update(address to, uint256 tokenId, address auth) internal override returns (address) {
        address from = _ownerOf(tokenId);

        // Allow minting (from == address(0) and to != address(0))
        // Prevent transfers (both from and to are non-zero)
        if (from != address(0) && to != address(0)) {
            revert SoulBoundToken_TransferNotAllowed();
        }

        // Prevent burning (from != address(0) and to == address(0))
        if (from != address(0) && to == address(0)) {
            revert SoulBoundToken_BurnNotAllowed();
        }

        return super._update(to, tokenId, auth);
    }

    function pause() external onlyOwner {
        _pause();
    }

    function unpause() external onlyOwner {
        _unpause();
    }

    function _authorizeUpgrade(address) internal override onlyOwner {}
}
