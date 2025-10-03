// ReputationScorer ABI (only functions we need)
export const REPUTATION_SCORER_ABI = [
  {
    inputs: [{ name: "user", type: "address" }],
    name: "scores",
    outputs: [
      { name: "baseScore", type: "uint256" },
      { name: "paymentScore", type: "uint256" },
      { name: "walletAgeScore", type: "uint256" },
      { name: "protocolScore", type: "uint256" },
      { name: "totalScore", type: "uint256" },
      { name: "tier", type: "string" },
      { name: "ltv", type: "uint256" },
      { name: "lastUpdated", type: "uint256" }
    ],
    stateMutability: "view",
    type: "function"
  },
  {
    inputs: [
      { name: "user", type: "address" },
      { name: "baseScore", type: "uint256" }
    ],
    name: "calculateScore",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function"
  },
  {
    inputs: [{ name: "user", type: "address" }],
    name: "getCreditTier",
    outputs: [{ name: "", type: "string" }],
    stateMutability: "view",
    type: "function"
  },
  {
    inputs: [{ name: "user", type: "address" }],
    name: "getDynamicLTV",
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
    type: "function"
  }
] as const;

// InsuranceFund ABI
export const INSURANCE_FUND_ABI = [
  {
    inputs: [],
    name: "getStatistics",
    outputs: [
      { name: "_totalFunds", type: "uint256" },
      { name: "_totalCovered", type: "uint256" },
      { name: "_totalDefaults", type: "uint256" }
    ],
    stateMutability: "view",
    type: "function"
  }
] as const;
