// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

contract FastSettlementV3Storage {
    address public executor;
    address public treasury;
    mapping(address => bool) public allowedSwapTargets;

    // Gap for upgrade safety (reduced by 1 for new mapping)
    uint256[49] private __gap;
}
