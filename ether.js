// ether.js
const { ethers } = require('ethers');
require('dotenv').config();

// — Provider (Infura, Alchemy, or local)
const provider = new ethers.providers.JsonRpcProvider(
  process.env.INFURA_URL || process.env.ALCHEMY_URL || "http://localhost:8545"
);

// — Signer: wallet with private key
const signer = new ethers.Wallet(process.env.PRIVATE_KEY, provider);

// — ABIs — extend if needed
const escrowAbi = [
  "function createEscrowNative(address _freelancer) external payable returns (uint256)",
  "function createEscrowToken(address _freelancer, address _tokenAddress, uint256 _amount) external returns (uint256)",
  "function acceptEscrow(uint256 _escrowId) external",
  "function completeWork(uint256 _escrowId) external",
  "function releaseFunds(uint256 _escrowId) external"
];

const tokenAbi = [
  "function balanceOf(address account) external view returns (uint256)"
];

const ticketRegistryAbi = [
  "function logTicket(string metadataHash, string txHash) external",
  "function getTicket(uint256 ticketId) external view returns (tuple(address client,string metadataHash,string txHash,uint256 createdAt))",
  "function getTotalTickets() external view returns (uint256)",
  "event TicketLogged(uint indexed ticketId,address indexed client,string metadataHash,string txHash,uint256 createdAt)"
];

// — Addresses from .env
const ESCROW_ADDRESS = process.env.ESCROW_ADDRESS || process.env.ESCROW_SERVICE_ADDRESS;
const TOKEN_ADDRESS = process.env.TOKEN_ADDRESS;
const TICKET_REGISTRY_ADDRESS = process.env.TICKET_REGISTRY_ADDRESS;

// — Debug logs
console.log("🔗 Using EscrowService at:    ", ESCROW_ADDRESS);
console.log("🔗 Using FreelancerToken at:  ", TOKEN_ADDRESS);
console.log("🔗 Using TicketRegistry at:   ", TICKET_REGISTRY_ADDRESS);

// — Contract instances
const escrowContract = new ethers.Contract(ESCROW_ADDRESS, escrowAbi, signer);
const tokenContract = new ethers.Contract(TOKEN_ADDRESS, tokenAbi, provider); // read-only
const ticketRegistryContract = new ethers.Contract(TICKET_REGISTRY_ADDRESS, ticketRegistryAbi, signer);

module.exports = {
  ethers,
  provider,
  signer,
  escrowContract,
  tokenContract,
  ticketRegistryContract
};














