// loader.js
const fs = require('fs');
const path = require('path');
const { ethers, signer } = require('../ether');
require('dotenv').config();

const CONTRACTS_DIR = path.join(__dirname, '../artifacts/contracts');
const loadedContracts = {};

// Function to load a contract by its name and address environment variable
function loadContract(contractName, addressEnvVar) {
  const artifactPath = path.join(CONTRACTS_DIR, `${contractName}.sol/${contractName}.json`);
  if (!fs.existsSync(artifactPath)) {
    console.error(`❌ ABI file not found for contract: ${contractName}`);
    return null;
  }

  const { abi } = require(artifactPath);
  const address = process.env[addressEnvVar];
  if (!address) {
    console.error(`❌ Address for ${contractName} not found in .env (expected: ${addressEnvVar})`);
    return null;
  }

  const contract = new ethers.Contract(address, abi, signer);
  loadedContracts[contractName] = contract;
  console.log(`✅ Loaded contract: ${contractName}`);
  return contract;
}

// Load all your deployed contracts
const contractMappings = {
  FreelancerToken:    'TOKEN_ADDRESS',
  EscrowService:      'ESCROW_SERVICE_ADDRESS',
  TicketRegistry:     'TICKET_REGISTRY_ADDRESS'
};

for (const [name, envVar] of Object.entries(contractMappings)) {
  loadContract(name, envVar);
}

module.exports = { loadedContracts };

