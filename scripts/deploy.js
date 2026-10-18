const { ethers } = require("hardhat");

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("Deploying with:", deployer.address);

  // Deploy MockUSDC
  const MockUSDC = await ethers.getContractFactory("MockUSDC");
  const usdc = await MockUSDC.deploy();
  await usdc.waitForDeployment();
  console.log("MockUSDC:", await usdc.getAddress());

  // Deploy FanToken (example)
  const FanToken = await ethers.getContractFactory("FanToken");
  const fan = await FanToken.deploy("DemoCreator Fan Token", "DCFAN");
  await fan.waitForDeployment();
  console.log("FanToken:", await fan.getAddress());

  // Deploy TournamentNFT
  const TournamentNFT = await ethers.getContractFactory("TournamentNFT");
  const nft = await TournamentNFT.deploy("Tournament Badge", "TNFT", "https://fanarena.demo/nft/");
  await nft.waitForDeployment();
  console.log("TournamentNFT:", await nft.getAddress());

  // Deploy PredictionMarket
  const PredictionMarket = await ethers.getContractFactory("PredictionMarket");
  const market = await PredictionMarket.deploy(
    await usdc.getAddress(),
    "Who wins Creator Tournament #1?",
    "DemoCreator",
    "Challenger"
  );
  await market.waitForDeployment();
  console.log("PredictionMarket:", await market.getAddress());

  // Deploy CreatorRegistry
  const CreatorRegistry = await ethers.getContractFactory("CreatorRegistry");
  const registry = await CreatorRegistry.deploy();
  await registry.waitForDeployment();
  console.log("CreatorRegistry:", await registry.getAddress());

  // Optionally add the example creator
  const tx = await registry.addCreator(
    "DemoCreator",
    "Monad-native creator testing FanArena",
    "This is a demo creator for the hackathon. Fan token is an access ticket only.",
    "https://remix.ethereum.org",
    await fan.getAddress()
  );
  await tx.wait();
  console.log("Example creator added.");

  console.log("\n=== UPDATE frontend/index.html CONTRACTS object with these addresses ===");
  console.log({
    registry: await registry.getAddress(),
    fanToken: await fan.getAddress(),
    tournamentNFT: await nft.getAddress(),
    predictionMarket: await market.getAddress(),
    mockUSDC: await usdc.getAddress()
  });
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
