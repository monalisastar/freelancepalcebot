const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("EscrowService + FLR Rewards", function () {
  let Token, Escrow, token, escrow;
  let owner, client, freelancer, other;
  const REWARD = ethers.utils.parseUnits("100", 18);

  beforeEach(async () => {
    [owner, client, freelancer, other] = await ethers.getSigners();

    // Deploy the token and escrow contracts
    Token  = await ethers.getContractFactory("FreelancerToken");
    token  = await Token.connect(owner).deploy();
    await token.deployed();

    Escrow = await ethers.getContractFactory("EscrowService");
    escrow = await Escrow.connect(owner).deploy(token.address);
    await escrow.deployed();

    // Wire up the minter
    await token.connect(owner).setEscrowService(escrow.address);
  });

  it("lets client create and freelancer accept/complete + mints FLR on release", async () => {
    // 1. Client funds escrow
    const fund = ethers.utils.parseEther("0.005");
    const tx1 = await escrow.connect(client)
      .createEscrowNative(freelancer.address, { value: fund });
    const rc1 = await tx1.wait();
    const id  = rc1.events.find(e => e.event === "EscrowCreated").args.escrowId;

    // 2. Freelancer accepts & completes
    await escrow.connect(freelancer).acceptEscrow(id);
    expect((await escrow.escrows(id)).status).to.equal(1); // Accepted
    await escrow.connect(freelancer).completeWork(id);
    expect((await escrow.escrows(id)).status).to.equal(2); // Completed

    // 3. Client releases funds → pays out and mints reward
    const balBefore = await token.balanceOf(freelancer.address);
    await escrow.connect(client).releaseFunds(id);
    const balAfter  = await token.balanceOf(freelancer.address);

    expect(balAfter.sub(balBefore)).to.equal(REWARD);
    expect((await escrow.escrows(id)).status).to.equal(3); // Released
  });

  it("rejects release if not client or wrong status", async () => {
    // create but don't complete
    const fund = ethers.utils.parseEther("0.001");
    const tx1 = await escrow.connect(client)
      .createEscrowNative(freelancer.address, { value: fund });
    const id = (await tx1.wait())
      .events.find(e => e.event === "EscrowCreated").args.escrowId;

    // Attempt release before completion
    await expect(
      escrow.connect(client).releaseFunds(id)
    ).to.be.revertedWith("Work must be completed");

    // Attempt release by someone else
    await escrow.connect(freelancer).acceptEscrow(id);
    await escrow.connect(freelancer).completeWork(id);
    await expect(
      escrow.connect(other).releaseFunds(id)
    ).to.be.revertedWith("Only client can release");
  });

  it("enforces FLR supply cap", async () => {
    // For this test, let the owner mint directly:
    await token.connect(owner).setEscrowService(owner.address);

    // Mint up to the cap
    const cap = await token.MAX_SUPPLY();
    await token.connect(owner).mint(freelancer.address, cap);

    // Now one more should exceed the cap
    await expect(
      token.connect(owner).mint(freelancer.address, 1)
    ).to.be.revertedWith("FT: cap exceeded");
  });
});


