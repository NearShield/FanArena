// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

/// @title PredictionMarket - Simple prediction market for tournament winners (DEMO)
/// @notice Users bet tiny amounts of mock USDC. Settlement by owner. All demo only.
contract PredictionMarket is Ownable {
    IERC20 public immutable usdc;
    string public question;
    string public optionA;
    string public optionB;
    bool public settled;
    uint8 public winningOption; // 1 = A, 2 = B
    uint256 public totalA;
    uint256 public totalB;
    mapping(address => uint256) public betsA;
    mapping(address => uint256) public betsB;
    mapping(address => bool) public claimed;

    event BetPlaced(address indexed user, uint8 option, uint256 amount);
    event Settled(uint8 winningOption);

    constructor(address _usdc, string memory _question, string memory _optionA, string memory _optionB) Ownable(msg.sender) {
        usdc = IERC20(_usdc);
        question = _question;
        optionA = _optionA;
        optionB = _optionB;
    }

    function placeBet(uint8 option, uint256 amount) external {
        require(!settled, "Market settled");
        require(option == 1 || option == 2, "Invalid option");
        require(amount > 0, "Amount > 0");
        require(usdc.transferFrom(msg.sender, address(this), amount), "Transfer failed");

        if (option == 1) {
            betsA[msg.sender] += amount;
            totalA += amount;
        } else {
            betsB[msg.sender] += amount;
            totalB += amount;
        }
        emit BetPlaced(msg.sender, option, amount);
    }

    function settle(uint8 _winningOption) external onlyOwner {
        require(!settled, "Already settled");
        require(_winningOption == 1 || _winningOption == 2, "Invalid");
        settled = true;
        winningOption = _winningOption;
        emit Settled(_winningOption);
    }

    function claim() external {
        require(settled, "Not settled");
        require(!claimed[msg.sender], "Already claimed");
        uint256 userBet = (winningOption == 1) ? betsA[msg.sender] : betsB[msg.sender];
        require(userBet > 0, "No winning bet");
        claimed[msg.sender] = true;
        uint256 totalWinning = (winningOption == 1) ? totalA : totalB;
        uint256 totalPool = totalA + totalB;
        // Simple pro-rata of the pool (demo: losers lose all)
        uint256 payout = (userBet * totalPool) / totalWinning;
        require(usdc.transfer(msg.sender, payout), "Payout failed");
    }

    function getMarketInfo() external view returns (string memory, string memory, string memory, bool, uint8, uint256, uint256) {
        return (question, optionA, optionB, settled, winningOption, totalA, totalB);
    }
}
