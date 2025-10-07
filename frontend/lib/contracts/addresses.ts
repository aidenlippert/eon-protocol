/**
 * Deployed Contract Addresses
 * Network: Arbitrum Sepolia (ChainID: 421614)
 * Deployed: 2025-10-03
 * Updated: 2025-10-04 (Phase 3 Incremental - Full Feedback Loop)
 */

export const ARBITRUM_SEPOLIA_CHAIN_ID = 421614;

export const CONTRACT_ADDRESSES = {
  // Arbitrum Sepolia
  421614: {
    // Phase 1: Original contracts (deprecated)
    CreditRegistryV1_1: "0xBF69B777Af1ADCcF2814344b06AF028d32c4b1FE",
    LendingPoolV1: "0x19965cACd1893ED591fd20854d95a3Ad923E2712",
    HealthFactorMonitor: "0x47f57c69339d5e0646Ef925FF1A779e968F20E7e",
    InsuranceFund: "0x5dC974Ac454534F28C31BCFe07af7272F326B888",
    ReputationScorer: "0x4e0939A892720C1aBE1b72Ba6cf583D8455Eb33F",
    MockPriceOracle: "0x3b6410d3c6017BFB464636f7bFB830E5bce76a1C",
    MockUSDC_V1: "0x6Aa931F2E3f5F21a9e3CcE86aFd1f4A2F161d13f",

    // Phase 3: Self-updating on-chain credit bureau (ACTIVE)
    CreditRegistryV2: "0x73559C2d5173042164b2c61Faf238Fa79fa326c9",
    ScoreOraclePhase3: "0x05CA68b1957caBDaCfb5A6643e7E0b0c08DD4825",
    CreditVaultV2: "0x813045b85D230f3e7bFA0BE6FdF7D1D12f055247",
    StakingToken: "0x4d039C6ddc2301EC07d84e9426317bfA5eA38B7a",

    // Phase 3B: Complete 5-factor scoring with KYC (DEPLOYED 2025-10-04)
    CreditRegistryV3: "0x425d4DBD32e5B185C15ffAf7076bFc9c8aD04Fa9",
    ScoreOraclePhase3B: "0x3460891EbdDeA80F44c56Cb97a239031C22B2b7e",
    CreditVaultV3: "0x52F65D2A3BacE77F7dee738F439f2F106B0c5a4d",
    StakingTokenV3: "0xf1221c402FD8d45A94AbCC62b60c58197C79baa1",

    // DeFi Infrastructure (Phase 4 - TO BE DEPLOYED)
    EONToken: "0x0000000000000000000000000000000000000000", // Governance token
    EONGovernor: "0x0000000000000000000000000000000000000000", // DAO governance
    Timelock: "0x0000000000000000000000000000000000000000", // Timelock controller
    SafetyModuleV1: "0x0000000000000000000000000000000000000000", // Staking insurance
    FlashLoanVaultV1: "0x0000000000000000000000000000000000000000", // Flash loans
    InterestRateModelV1: "0x0000000000000000000000000000000000000000", // Variable APY
    LiquidationEngineV1: "0x0000000000000000000000000000000000000000", // Liquidation system

    // Mock Assets (Testnet)
    MockUSDC: "0x3aE970e1d73cB7eEFF6D007Ee6C15D79d91325AD",
    MockWETH: "0x5D661e2F392A846f2E4B44D322A6f272106a334e",

    // Price Feeds (Testnet)
    USDCPriceFeed: "0x95a2699e8F28099F659004888F97e0FD0220abB5",
    WETHPriceFeed: "0x46980B0c634E0E0cDbD87BBf98408be551819781",
  },

  // Arbitrum One (Production - not deployed yet)
  42161: {
    CreditRegistryV1_1: "0x0000000000000000000000000000000000000000",
    ScoreOracle: "0x0000000000000000000000000000000000000000",
    CreditVault: "0x0000000000000000000000000000000000000000",
    USDC: "0xaf88d065e77c8cC2239327C5EDb3A432268e5831", // Native USDC
    WETH: "0x82aF49447D8a07e3bd95BD0d56f35241523fBab1",
  },

  // Optimism (Production - not deployed yet)
  10: {
    CreditRegistryV1_1: "0x0000000000000000000000000000000000000000",
    ScoreOracle: "0x0000000000000000000000000000000000000000",
    CreditVault: "0x0000000000000000000000000000000000000000",
    USDC: "0x0b2C639c533813f4Aa9D7837CAf62653d097Ff85", // Native USDC
    WETH: "0x4200000000000000000000000000000000000006",
  },

  // Base (Production - not deployed yet)
  8453: {
    CreditRegistryV1_1: "0x0000000000000000000000000000000000000000",
    ScoreOracle: "0x0000000000000000000000000000000000000000",
    CreditVault: "0x0000000000000000000000000000000000000000",
    USDC: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913", // Native USDC
    WETH: "0x4200000000000000000000000000000000000006",
  },
} as const;

export const EXPLORER_URLS = {
  421614: "https://sepolia.arbiscan.io",
} as const;

export function getContractAddress(
  chainId: number,
  contractName: keyof (typeof CONTRACT_ADDRESSES)[421614]
): string {
  const addresses = CONTRACT_ADDRESSES[chainId as keyof typeof CONTRACT_ADDRESSES];
  if (!addresses) {
    throw new Error(`No addresses for chain ${chainId}`);
  }
  return addresses[contractName];
}

export function getExplorerUrl(chainId: number, address: string): string {
  const baseUrl = EXPLORER_URLS[chainId as keyof typeof EXPLORER_URLS];
  if (!baseUrl) {
    throw new Error(`No explorer for chain ${chainId}`);
  }
  return `${baseUrl}/address/${address}`;
}
