// SPDX-License-Identifier: MIT
pragma solidity ^0.8.4;

import {IGenesisSBT} from "./IGenesisSBT.sol";

/**
 * @title GenesisSBTStorage
 * @dev Storage contract for GenesisSBT
 */
abstract contract GenesisSBTStorage {
    // Metadata
    string public _name;
    string public _description;
    string internal _assetURI;

    // Tracks the total number of minted tokens
    uint256 internal _totalTokensMinted;

    // The price to mint a token
    uint256 public _mintPrice;

    // Treasury Recipient
    address public treasuryReceiver;

    /// @dev See https://docs.openzeppelin.com/contracts/4.x/upgradeable#storage_gaps
    uint256[50] private __gap;
}

