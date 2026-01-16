// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

contract FastSettlementV3Storage {
    address public executor;
    address public treasury;

    // Gap for upgrade safety
    uint256[50] private __gap;
}
