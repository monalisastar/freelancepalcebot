const hre = require("hardhat");

async function main() {
  const [deployer] = await hre.ethers.getSigners();
  console.log("🚀 Deploying with account:", deployer.address);
  const bal = await deployer.getBalance();
  console.log("💰 Balance:", hre.ethers.utils.formatEther(bal), "ETH");

  // 1️⃣ Deploy FLR reward token
  const Token = await hre.ethers.getContractFactory("FreelancerToken");
  const token = await Token.deploy();
  await token.deployed();
  console.log("✅ FreelancerToken at:", token.address);

  // 2️⃣ Deploy EscrowService, passing in the token address
  const EscrowService = await hre.ethers.getContractFactory("EscrowService");
  const escrowService = await EscrowService.deploy(token.address);
  await escrowService.deployed();
  console.log("✅ EscrowService at:", escrowService.address);

  // 3️⃣ Tell the token which contract can mint rewards
  const setTx = await token.setEscrowService(escrowService.address);
  await setTx.wait();
  console.log("🔑 token.escrowService set to EscrowService");

  console.log("🌐 Explorer:");
  console.log(`   Token:  https://sepolia.etherscan.io/address/${token.address}`);
  console.log(`   Escrow: https://sepolia.etherscan.io/address/${escrowService.address}`);
}

main()
  .then(() => process.exit(0))
  .catch(err => {
    console.error("❌ Deployment error:", err);
    process.exit(1);
  });

