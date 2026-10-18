// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/Ownable.sol";

/// @title CreatorRegistry - Admin manages creators and their fan tokens
contract CreatorRegistry is Ownable {
    struct Creator {
        string name;
        string bio;
        string description;
        string remixProfile; // URL or ID
        address fanToken;
        bool active;
    }

    mapping(uint256 => Creator) public creators;
    uint256 public creatorCount;
    address[] public swappableTokens; // Tokens owner adds for the swap section

    event CreatorAdded(uint256 indexed id, string name, address fanToken);
    event TokenAddedToSwap(address token);

    constructor() Ownable(msg.sender) {}

    function addCreator(
        string memory name,
        string memory bio,
        string memory description,
        string memory remixProfile,
        address fanToken
    ) external onlyOwner returns (uint256) {
        uint256 id = creatorCount++;
        creators[id] = Creator(name, bio, description, remixProfile, fanToken, true);
        emit CreatorAdded(id, name, fanToken);
        return id;
    }

    function addSwappableToken(address token) external onlyOwner {
        swappableTokens.push(token);
        emit TokenAddedToSwap(token);
    }

    function getSwappableTokens() external view returns (address[] memory) {
        return swappableTokens;
    }

    function getCreator(uint256 id) external view returns (Creator memory) {
        return creators[id];
    }
}
