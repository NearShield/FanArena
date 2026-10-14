# FanArena

**Creator fan-token tournaments on Monad: buy a creator’s token to enter their games, predict winners with USDC, earn tournament NFTs that unlock eligibility for a future project token airdrop.**

Demo platform on **Monad Testnet**. Everything is labeled as demo. Fan tokens are access tickets (not investments). Tournament NFTs are achievement badges that grant eligibility for a *future* project token airdrop (airdrop is **not live** — only the on-chain eligibility check exists).

## Loop

1. Connect any EVM wallet (MetaMask etc.) to Monad Testnet.
2. Admin (owner) unlocks with security key and adds creators (name, bio, description, Remix profile, fan token address).
3. Users get/mint demo Fan Token → hold it to enter the creator’s tournament.
4. After tournament, owner mints Tournament NFT to winner.
5. Holding the NFT shows “Eligible for future project airdrop”.
6. Users can place tiny bets with mock USDC on prediction markets (settlement on Monad).
7. Owner can add token contracts to the swap/trade section.

## Setup & Deploy (Monad Testnet)

### Prerequisites
- Node.js 18+
- Monad Testnet MON from [faucet.monad.xyz](https://faucet.monad.xyz)
- Wallet private key (for deployment)

### Install & Compile
```bash
cd fanarena
npm install
npx hardhat compile
```

### Deploy
```bash
export PRIVATE_KEY=0xYourPrivateKeyHere
npx hardhat run scripts/deploy.js --network monadTestnet
```

Copy the printed addresses into `frontend/index.html` → `CONTRACTS` object.

### Run Frontend
The frontend is a single static HTML file (ethers.js via CDN).

- Local: open `frontend/index.html` in browser, or serve with any static server (`npx serve frontend`).
- Vercel: push the repo to GitHub and import the project (set root to `fanarena` or move `frontend` contents). Or deploy the `frontend` folder as static.

### GitHub + Vercel
1. Create a new GitHub repo and push the `fanarena` folder.
2. On Vercel, New Project → Import from GitHub.
3. Framework: Other / Static. Root directory: `frontend` (or adjust).
4. Deploy. Update the CONTRACTS addresses if you redeploy.

## Demo Flow (under 2 minutes)

1. Connect wallet (auto-attempts if previously connected; switches/adds Monad Testnet).
2. Enter security key `fanarena-owner-2026` → Unlock Admin.
3. (Optional) Add a creator or swap token.
4. On Example Creator: click **Get Demo Fan Token** → **Enter Tournament**.
5. Check Tournament NFT section (mint one via contract if testing eligibility).
6. Get mock USDC → place a 10 mUSDC bet on the sample market “Who wins Creator Tournament #1?”.
7. Observe market state. Settlement is owner-only on-chain.

## Important Notes

- **Demo only.** Tiny amounts. No real returns, investments, or live airdrop.
- Fan Token = access ticket.
- Tournament NFT = achievement badge for future airdrop eligibility.
- Mock USDC has 6 decimals; mint function is owner-only (or public in this demo for ease — adjust if desired).
- Swap section is a demo UI; real trading would use Uniswap V2/V3 (factories exist on Monad Testnet) or a custom AMM.
- Owner actions require the connected wallet to be the contract owner (deployer).
- Security key is a simple client-side gate for the demo UI.

## Contracts

- `FanToken.sol` — ERC-20 fan token with owner mint.
- `TournamentNFT.sol` — ERC-721 achievement badge.
- `PredictionMarket.sol` — Simple two-option market using MockUSDC.
- `CreatorRegistry.sol` — Admin adds creators + swappable token list.
- `MockUSDC.sol` — Demo USDC (6 decimals).

All use OpenZeppelin. Compiled with Solidity 0.8.20.

Enjoy building on Monad!
