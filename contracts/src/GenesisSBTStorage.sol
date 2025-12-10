// SPDX-License-Identifier: MIT
pragma solidity ^0.8.4;

import {IGenesisSBT} from "./IGenesisSBT.sol";

/**
 * @title GenesisSBTStorage
 * @dev Storage contract for GenesisSBT
 */
abstract contract GenesisSBTStorage {
    // Mapping from user address to token ID
    mapping(address => uint256) internal _userTokenId;

    // Metadata
    string public _nftName;
    string public _nftDescription;
    string public _assetURI;

    // Tracks the total number of minted tokens
    uint256 internal _totalTokensMinted;

    // The price to mint a token
    uint256 public _mintPrice;

    // Treasury Recipient
    address public _treasuryReceiver;

    /// @dev See https://docs.openzeppelin.com/contracts/4.x/upgradeable#storage_gaps
    uint256[50] private __gap;
}

