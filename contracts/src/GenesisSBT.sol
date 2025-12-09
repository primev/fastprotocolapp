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
        address owner,
        uint256 mintPrice
    ) external initializer {
        __Ownable2Step_init();
        __Ownable_init(owner);
        __ERC721_init("Genesis SBT", "GSBT");
        __Pausable_init();
        _assetURI = asset;
        _mintPrice = mintPrice;
        _name = "Fast Protocol Genesis SBT";
        _maxSupplyPerWallet = 1;
    }

    // =============================================================
    //                          MINTING
    // =============================================================

    /// @notice Mints a token to the caller
    function mint() external payable whenNotPaused {
        address to = msg.sender;

        if (balanceOf(msg.sender) > 0) revert TokenAlreadyMinted();

        uint256 requiredPayment = _processPayment(to);
        _executeMint(to, requiredPayment);
    }

    /// @notice Owner mints tokens to multiple addresses
    function adminMint(address[] calldata to) external onlyOwner {
        if (to.length == 0) revert InvalidRecipients();
    

        for (uint256 i = 0; i < to.length; i++) {
            if (balanceOf(to[i]) > 0) continue;
            _safeMint(to[i], _totalTokensMinted + 1);

            unchecked {
                _totalTokensMinted++;
            }
        }
    }

    // =============================================================
    //                          VIEW FUNCTIONS
    // =============================================================

    function totalSupply() external view returns (uint256) {
        return _totalTokensMinted;
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

    // =============================================================
    //                          OWNER FUNCTIONS
    // =============================================================

    function setAssetURI(string calldata assetURI) external onlyOwner {
        _assetURI = assetURI;
    }

    function setMetadataProperties(
        string calldata nftName,
        string calldata description
    ) external onlyOwner {
        _name = nftName;
        _description = description;
    }

    function setMintPrice(uint256 mintPrice) external onlyOwner {
        _mintPrice = mintPrice;
    }

    function setMaxMintPerWallet(uint256 qty) external onlyOwner {
        _maxSupplyPerWallet = qty;
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

    /// @dev Processes payment and returns required amount
    function _processPayment(
        address to
    ) private returns (uint256 requiredPayment) {
        requiredPayment = _mintPrice;
        if (msg.value < requiredPayment)
            revert InsufficientFunds(_mintPrice, msg.value);
        if (msg.value > requiredPayment) {
            unchecked {
                Address.sendValue(payable(to), msg.value - requiredPayment);
            }
        }
    }

    /// @dev Executes the mint and updates state
    function _executeMint(address to, uint256 requiredPayment) private {
        _safeMint(to, _totalTokensMinted + 1);
        
        // Forward funds to protocol
        Address.sendValue(payable(treasuryReceiver), requiredPayment);

        unchecked {
            _totalTokensMinted++;
        }

        emit TokensMinted(to, _maxSupplyPerWallet);
    }

}
