// SPDX-License-Identifier: MIT
pragma solidity ^0.8.4;

import "@openzeppelin/contracts-upgradeable/token/ERC721/ERC721Upgradeable.sol";
import "@openzeppelin/contracts-upgradeable/access/Ownable2StepUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/PausableUpgradeable.sol";
import "@openzeppelin/contracts/utils/Strings.sol";
import "@openzeppelin/contracts/utils/Base64.sol";
import "@openzeppelin/contracts/utils/Address.sol";
import "./GenesisSBTStorage.sol";
import "./IGenesisSBT.sol";

/**
 * @title GenesisSBT
 * @dev Soul Bound Token contract for managing NFT minting with on-chain metadata.
 */
contract GenesisSBT is Ownable2StepUpgradeable, ERC721Upgradeable, PausableUpgradeable, UUPSUpgradeable, GenesisSBTStorage, IGenesisSBT {

    function initialize(string calldata asset, address owner, uint256 mintPrice) external initializer {
        __Ownable2Step_init();
        __Ownable_init(owner);
        __ERC721_init("Genesis SBT", "GSBT");
        __Pausable_init();
        _assetURI = asset;
        _mintPrice = mintPrice;
        _name = "Fast Protocol Genesis SBT";
        _maxSupplyPerWallet = 1;
    }

    function mint() external payable whenNotPaused {
        address to = msg.sender;
        
        if (balanceOf(msg.sender) > 0) revert TokenAlreadyMinted();
        
         uint256 requiredPayment = _processPayment(to);
         _executeMint(to,from, requiredPayment);
    }

    /**
     * @dev Allows the owner to mint tokens to multiple addresses without requiring payment.
     * @param to Array of addresses to mint tokens to. Skips addresses that already have tokens.
     */
    function adminMint(address[] calldata to) external onlyOwner {
        if (to.length == 0) revert InvalidRecipients();

        for (uint256 i = 0; i < to.length; i++) {
            if (balanceOf(to[i]) > 0) continue;
            _safeMint(to[i], ++_totalTokensMinted);
        }
    }

    function totalSupply() external view returns (uint256) {
        return _totalTokensMinted;
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

    function setMaxMintPerWallet(uint256 qty) external onlyOwner {
        _maxSupplyPerWallet = qty;
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

    /// @dev Processes payment and returns required amount
    function _processPayment(
        address to
    ) private returns (uint256 requiredPayment) {
        if (msg.value < requiredPayment) revert InsufficientFunds(_mintPrice, msg.value);
        if (msg.value > requiredPayment) {
            unchecked {
                Address.sendValue(payable(to), msg.value - requiredPayment);
            }
        }
    }

     /// @dev Executes the mint and updates state
    function _executeMint(
        address to,
        uint256 requiredPayment
    ) private {
        uint256 qty = _maxSupplyPerWallet;

        _safeMint(to, qty);

        // Forward funds to protocol
        Address.sendValue(payable(treasuryReceiver), requiredPayment);

        unchecked {
            // update totalsupply
            _totalTokensMinted = _totalTokensMinted++;
        }

        emit TokensMinted(to, qty);
    }

    function _update(address to, uint256 tokenId, address auth) internal override returns (address) {
        if (from != address(0)) {
            revert SoulBoundToken_TransferNotAllowed();
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
