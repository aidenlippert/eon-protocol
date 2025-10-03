/**
 * Deployed Contract Addresses
 * Network: Arbitrum Sepolia (ChainID: 421614)
 * Deployed: 2025-10-03
 */

export const ARBITRUM_SEPOLIA_CHAIN_ID = 421614;

export const CONTRACT_ADDRESSES = {
  // Arbitrum Sepolia
  421614: {
    CreditRegistryV1_1: "0xBF69B777Af1ADCcF2814344b06AF028d32c4b1FE",
    LendingPoolV1: "0x19965cACd1893ED591fd20854d95a3Ad923E2712",
    HealthFactorMonitor: "0x47f57c69339d5e0646Ef925FF1A779e968F20E7e",
    InsuranceFund: "0x5dC974Ac454534F28C31BCFe07af7272F326B888",
    ReputationScorer: "0x4e0939A892720C1aBE1b72Ba6cf583D8455Eb33F",
    MockPriceOracle: "0x3b6410d3c6017BFB464636f7bFB830E5bce76a1C",
    MockUSDC: "0x6Aa931F2E3f5F21a9e3CcE86aFd1f4A2F161d13f",
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
