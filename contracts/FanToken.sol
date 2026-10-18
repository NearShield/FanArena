// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

/// @title FanToken - Simple ERC20 for creator fan access (DEMO ONLY - not an investment)
/// @notice Holding this token is required to enter the creator's tournament. Tiny amounts only.
contract FanToken is ERC20, Ownable {
    constructor(string memory name, string memory symbol) ERC20(name, symbol) Ownable(msg.sender) {}

    /// @notice Demo mint - anyone can mint a small amount for the demo
    function faucet() external {
        _mint(msg.sender, 100 * 10**18);
    }

    /// @notice Owner mint for larger amounts if needed
    function mint(address to, uint256 amount) external onlyOwner {
        _mint(to, amount);
    }
}
