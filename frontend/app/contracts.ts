// Contract addresses - UPDATE AFTER DEPLOYMENT
export const CONTRACTS = {
  arbitrumSepolia: {
    claimManager: '0x0000000000000000000000000000000000000000', // UPDATE THIS
    chronosNFT: '0x0000000000000000000000000000000000000000',   // UPDATE THIS
    lendingPool: '0x0000000000000000000000000000000000000000', // UPDATE THIS
  },
  arbitrum: {
    claimManager: '0x0000000000000000000000000000000000000000',
    chronosNFT: '0x0000000000000000000000000000000000000000',
    lendingPool: '0x0000000000000000000000000000000000000000',
  }
};

// ClaimManager ABI (minimal for frontend)
export const CLAIM_MANAGER_ABI = [
  {
    "inputs": [
      {"name": "minBalance", "type": "uint256"},
      {"name": "startBlock", "type": "uint256"},
      {"name": "endBlock", "type": "uint256"},
      {"name": "merkleRoot", "type": "bytes32"}
    ],
    "name": "submitClaim",
    "outputs": [],
    "stateMutability": "payable",
    "type": "function"
  },
  {
    "inputs": [{"name": "claimId", "type": "uint256"}],
    "name": "finalizeClaim",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "USER_STAKE",
    "outputs": [{"name": "", "type": "uint256"}],
    "stateMutability": "view",
    "type": "function"
  }
] as const;

// LendingPool ABI
export const LENDING_POOL_ABI = [
  {
    "inputs": [
      {"name": "poolType", "type": "uint8"},
      {"name": "amount", "type": "uint256"}
    ],
    "name": "borrow",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [{"name": "poolType", "type": "uint8"}],
    "name": "pools",
    "outputs": [
      {"name": "totalDeposits", "type": "uint256"},
      {"name": "totalBorrowed", "type": "uint256"},
      {"name": "minLTV", "type": "uint256"},
      {"name": "maxLTV", "type": "uint256"}
    ],
    "stateMutability": "view",
    "type": "function"
  }
] as const;

// ChronosNFT ABI
export const CHRONOS_NFT_ABI = [
  {
    "inputs": [{"name": "owner", "type": "address"}],
    "name": "balanceOf",
    "outputs": [{"name": "", "type": "uint256"}],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [{"name": "tokenId", "type": "uint256"}],
    "name": "getReputation",
    "outputs": [{"name": "score", "type": "uint256"}],
    "stateMutability": "view",
    "type": "function"
  }
] as const;
