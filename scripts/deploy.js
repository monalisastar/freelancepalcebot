const hre = require("hardhat");

async function main() {
  const [deployer] = await hre.ethers.getSigners();

  console.log("🚀 Deploying TicketRegistry with account:", deployer.address);
  const balance = await deployer.getBalance();
  console.log("💰 Account balance:", hre.ethers.utils.formatEther(balance), "ETH");

  const TicketRegistry = await hre.ethers.getContractFactory("TicketRegistry");
  const ticketRegistry = await TicketRegistry.deploy();

  await ticketRegistry.deployed();

  console.log("✅ TicketRegistry deployed to:", ticketRegistry.address);
  console.log("🌐 Explorer URL (Sepolia): https://sepolia.etherscan.io/address/" + ticketRegistry.address);
}

main().then(() => process.exit(0)).catch((error) => {
  console.error("❌ Deployment failed:", error);
  process.exit(1);
});

