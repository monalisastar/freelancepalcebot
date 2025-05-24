// scripts/testFlow.js
const hre = require("hardhat");

async function main() {
  // 1️⃣ Signer
  const [account] = await hre.ethers.getSigners();
  console.log("Using account:", account.address);

  // 2️⃣ Deployed addresses
  const ESCROW_ADDR = "0x2C721019fAC43655eFE183f6D837289b9190b7C0";
  const TOKEN_ADDR  = "0x8169124844347d9A9d0B6F2eD708F8948eef6242";

  // 3️⃣ Contract instances
  const escrow = await hre.ethers.getContractAt("EscrowService", ESCROW_ADDR, account);
  const token  = await hre.ethers.getContractAt("FreelancerToken", TOKEN_ADDR, account);

  // 4️⃣ Create a 0.001 ETH escrow
  console.log("🔄 Creating escrow…");
  const tx1 = await escrow.createEscrowNative(account.address, {
    value: hre.ethers.utils.parseEther("0.001"),
  });
  const rc1 = await tx1.wait();
  const escrowId = rc1.events.find(e => e.event === "EscrowCreated").args.escrowId;
  console.log("➡️  EscrowCreated id =", escrowId.toString());

  // 5️⃣ Accept & complete
  console.log("🔄 Accepting escrow…");
  await (await escrow.acceptEscrow(escrowId)).wait();
  console.log("✔️  Escrow accepted");

  console.log("🔄 Completing work…");
  await (await escrow.completeWork(escrowId)).wait();
  console.log("✔️  Work completed");

  // 6️⃣ Release funds & mint reward
  console.log("🔄 Releasing funds…");
  await (await escrow.releaseFunds(escrowId)).wait();
  console.log("✔️  Funds released & FLR minted");

  // 7️⃣ Check FLR balance
  const bal = await token.balanceOf(account.address);
  console.log(
    "🎉 Final FLR balance:",
    hre.ethers.utils.formatUnits(bal, 18),
    "FLR"
  );
}

main()
  .then(() => process.exit(0))
  .catch(err => {
    console.error("❌ Test Flow failed:", err);
    process.exit(1);
  });

