/**
 * Cross-Chain Wallet Aggregation System
 *
 * Collects transaction history and DeFi activity across multiple chains:
 * - Ethereum Mainnet
 * - Arbitrum
 * - Optimism
 * - Base
 * - Polygon
 * - BSC
 *
 * Also supports wallet bundling - linking multiple wallets to one identity
 */

import { type LinkedWallet } from './sybil-resistance';

export type ChainId = 1 | 42161 | 10 | 8453 | 137 | 56;

export interface ChainConfig {
  chainId: ChainId;
  name: string;
  rpcUrl: string;
  explorerUrl: string;
  explorerApiUrl: string;
  explorerApiKey: string;
  nativeCurrency: string;
}

// Chain configurations with API endpoints
export const SUPPORTED_CHAINS: Record<ChainId, ChainConfig> = {
  1: {
    chainId: 1,
    name: 'Ethereum',
    rpcUrl: 'https://eth.public-rpc.com',
    explorerUrl: 'https://etherscan.io',
    explorerApiUrl: 'https://api.etherscan.io/api',
    explorerApiKey: 'YourApiKeyToken', // Free tier
    nativeCurrency: 'ETH',
  },
  42161: {
    chainId: 42161,
    name: 'Arbitrum',
    rpcUrl: 'https://arb1.arbitrum.io/rpc',
    explorerUrl: 'https://arbiscan.io',
    explorerApiUrl: 'https://api.arbiscan.io/api',
    explorerApiKey: 'YourApiKeyToken',
    nativeCurrency: 'ETH',
  },
  10: {
    chainId: 10,
    name: 'Optimism',
    rpcUrl: 'https://mainnet.optimism.io',
    explorerUrl: 'https://optimistic.etherscan.io',
    explorerApiUrl: 'https://api-optimistic.etherscan.io/api',
    explorerApiKey: 'YourApiKeyToken',
    nativeCurrency: 'ETH',
  },
  8453: {
    chainId: 8453,
    name: 'Base',
    rpcUrl: 'https://mainnet.base.org',
    explorerUrl: 'https://basescan.org',
    explorerApiUrl: 'https://api.basescan.org/api',
    explorerApiKey: 'YourApiKeyToken',
    nativeCurrency: 'ETH',
  },
  137: {
    chainId: 137,
    name: 'Polygon',
    rpcUrl: 'https://polygon-rpc.com',
    explorerUrl: 'https://polygonscan.com',
    explorerApiUrl: 'https://api.polygonscan.com/api',
    explorerApiKey: 'YourApiKeyToken',
    nativeCurrency: 'MATIC',
  },
  56: {
    chainId: 56,
    name: 'BSC',
    rpcUrl: 'https://bsc-dataseed.binance.org',
    explorerUrl: 'https://bscscan.com',
    explorerApiUrl: 'https://api.bscscan.com/api',
    explorerApiKey: 'YourApiKeyToken',
    nativeCurrency: 'BNB',
  },
};

export interface ChainActivity {
  chainId: ChainId;
  chainName: string;
  transactionCount: number;
  firstTransaction: Date | null;
  lastTransaction: Date | null;
  totalVolume: bigint;
  defiInteractions: number;
  protocolsUsed: string[];
  walletAge: number; // Days since first tx on this chain
}

export interface CrossChainWalletData {
  address: string;
  chains: ChainActivity[];
  totalTransactions: number;
  oldestWalletAge: number; // Oldest chain age
  totalProtocols: string[];
  totalVolume: bigint;
  crossChainScore: number; // 0-100 bonus for multi-chain activity
}

export interface WalletBundle {
  primaryWallet: string;
  linkedWallets: LinkedWallet[];
  aggregatedData: CrossChainWalletData[];
  totalCrossChainScore: number;
  bundleBonus: number;
}

interface ChainTransaction {
  timeStamp: string;
  value: string;
  to?: string;
}

/**
 * Fetch transaction history for a wallet on a specific chain
 */
async function fetchChainTransactions(
  address: string,
  chain: ChainConfig
): Promise<ChainTransaction[]> {
  try {
    const url = `${chain.explorerApiUrl}?module=account&action=txlist&address=${address}&startblock=0&endblock=99999999&page=1&offset=1000&sort=asc&apikey=${chain.explorerApiKey}`;

    const response = await fetch(url);
    const data = await response.json();

    if (data.status === '1' && Array.isArray(data.result)) {
      return data.result;
    }

    return [];
  } catch (error) {
    console.error(`Failed to fetch ${chain.name} transactions:`, error);
    return [];
  }
}

/**
 * Analyze DeFi protocols used on a chain
 */
function analyzeProtocols(transactions: ChainTransaction[]): string[] {
  const protocols = new Set<string>();

  // Common DeFi protocol addresses across chains
  const PROTOCOL_PATTERNS: Record<string, string[]> = {
    'Uniswap': ['0x7a250d5630', '0x68b3465833', '0xe592427a'],
    'Aave': ['0x7d2768de32', '0x87870bca54', '0xa97684ead0'],
    'Compound': ['0x3d9819210a', '0xc00e94cb66'],
    'Curve': ['0xbebc44782c7db0a1a60cb6fe97d0b483032ff1c7'],
    'Balancer': ['0xba12222222'],
    'GMX': ['0x489ee077994b6658eafa855c308275ead8097c4a'],
    'SushiSwap': ['0xd9e1ce17f2641f24ae83637ab66a2cca9c378b9f'],
  };

  for (const tx of transactions) {
    const to = tx.to?.toLowerCase() || '';

    for (const [protocol, patterns] of Object.entries(PROTOCOL_PATTERNS)) {
      if (patterns.some(pattern => to.includes(pattern.toLowerCase()))) {
        protocols.add(protocol);
      }
    }
  }

  return Array.from(protocols);
}

/**
 * Analyze activity on a single chain
 */
export async function analyzeChainActivity(
  address: string,
  chainId: ChainId
): Promise<ChainActivity> {
  const chain = SUPPORTED_CHAINS[chainId];
  const transactions = await fetchChainTransactions(address, chain);

  if (transactions.length === 0) {
    return {
      chainId,
      chainName: chain.name,
      transactionCount: 0,
      firstTransaction: null,
      lastTransaction: null,
      totalVolume: BigInt(0),
      defiInteractions: 0,
      protocolsUsed: [],
      walletAge: 0,
    };
  }

  const firstTx = transactions[0];
  const lastTx = transactions[transactions.length - 1];
  const firstTxDate = new Date(Number(firstTx.timeStamp) * 1000);
  const lastTxDate = new Date(Number(lastTx.timeStamp) * 1000);
  const walletAge = Math.floor((Date.now() - firstTxDate.getTime()) / (1000 * 60 * 60 * 24));

  // Calculate total volume
  let totalVolume = BigInt(0);
  for (const tx of transactions) {
    totalVolume += BigInt(tx.value || 0);
  }

  // Analyze protocols
  const protocolsUsed = analyzeProtocols(transactions);
  const defiInteractions = transactions.filter(tx => {
    const to = tx.to?.toLowerCase() || '';
    return protocolsUsed.some(protocol =>
      Object.values(SUPPORTED_CHAINS).some(c =>
        to.includes(protocol.toLowerCase())
      )
    );
  }).length;

  return {
    chainId,
    chainName: chain.name,
    transactionCount: transactions.length,
    firstTransaction: firstTxDate,
    lastTransaction: lastTxDate,
    totalVolume,
    defiInteractions,
    protocolsUsed,
    walletAge,
  };
}

/**
 * Aggregate data across all supported chains for a single wallet
 */
export async function aggregateCrossChainData(
  address: string,
  chainsToCheck: ChainId[] = [1, 42161, 10, 8453, 137, 56]
): Promise<CrossChainWalletData> {
  // Fetch activity from all chains in parallel
  const chainActivities = await Promise.all(
    chainsToCheck.map(chainId => analyzeChainActivity(address, chainId))
  );

  // Filter out chains with no activity
  const activeChains = chainActivities.filter(chain => chain.transactionCount > 0);

  // Calculate aggregated metrics
  const totalTransactions = activeChains.reduce((sum, chain) => sum + chain.transactionCount, 0);
  const oldestWalletAge = Math.max(...activeChains.map(chain => chain.walletAge), 0);

  const allProtocols = new Set<string>();
  activeChains.forEach(chain => {
    chain.protocolsUsed.forEach(protocol => allProtocols.add(protocol));
  });

  const totalVolume = activeChains.reduce(
    (sum, chain) => sum + chain.totalVolume,
    BigInt(0)
  );

  // Calculate cross-chain bonus (0-100 points)
  const crossChainScore = calculateCrossChainBonus(activeChains);

  return {
    address,
    chains: chainActivities,
    totalTransactions,
    oldestWalletAge,
    totalProtocols: Array.from(allProtocols),
    totalVolume,
    crossChainScore,
  };
}

/**
 * Calculate bonus for multi-chain activity
 *
 * Rewards:
 * - 1 chain: 0 bonus
 * - 2 chains: +20 points
 * - 3 chains: +40 points
 * - 4 chains: +60 points
 * - 5+ chains: +80 points
 * - Extra +5 per unique protocol (max +20)
 */
function calculateCrossChainBonus(chains: ChainActivity[]): number {
  const activeChains = chains.filter(c => c.transactionCount > 0);
  const chainCount = activeChains.length;

  let bonus = 0;

  // Base bonus for number of chains
  if (chainCount >= 5) bonus += 80;
  else if (chainCount >= 4) bonus += 60;
  else if (chainCount >= 3) bonus += 40;
  else if (chainCount >= 2) bonus += 20;

  // Protocol diversity bonus
  const allProtocols = new Set<string>();
  activeChains.forEach(chain => {
    chain.protocolsUsed.forEach(p => allProtocols.add(p));
  });

  const protocolBonus = Math.min(allProtocols.size * 5, 20);
  bonus += protocolBonus;

  return Math.min(bonus, 100);
}

/**
 * Link multiple wallets and aggregate their cross-chain data
 */
export async function aggregateWalletBundle(
  primaryWallet: string,
  linkedWallets: LinkedWallet[],
  chainsToCheck: ChainId[] = [1, 42161, 10, 8453, 137, 56]
): Promise<WalletBundle> {
  // Get all wallet addresses
  const allWallets = [primaryWallet, ...linkedWallets.map(w => w.address)];

  // Aggregate data for each wallet
  const aggregatedData = await Promise.all(
    allWallets.map(wallet => aggregateCrossChainData(wallet, chainsToCheck))
  );

  // Calculate total cross-chain score (average across wallets)
  const totalCrossChainScore = Math.round(
    aggregatedData.reduce((sum, data) => sum + data.crossChainScore, 0) / aggregatedData.length
  );

  // Calculate bundling bonus (from sybil-resistance.ts)
  const bundleBonus = linkedWallets.length >= 6 ? 50 :
                      linkedWallets.length >= 4 ? 40 :
                      linkedWallets.length >= 2 ? 25 : 0;

  return {
    primaryWallet,
    linkedWallets,
    aggregatedData,
    totalCrossChainScore,
    bundleBonus,
  };
}

/**
 * Get the oldest wallet age across all chains and wallets
 * This is used for wallet age penalty calculation
 */
export function getOldestWalletAge(data: CrossChainWalletData[]): number {
  return Math.max(...data.map(d => d.oldestWalletAge), 0);
}

/**
 * Get combined protocol list across all chains and wallets
 */
export function getCombinedProtocols(data: CrossChainWalletData[]): string[] {
  const allProtocols = new Set<string>();
  data.forEach(wallet => {
    wallet.totalProtocols.forEach(p => allProtocols.add(p));
  });
  return Array.from(allProtocols);
}

/**
 * Check if wallet has been linked to detect potential sybil bundling
 */
export async function detectLinkedWallets(
  address: string
): Promise<LinkedWallet[]> {
  // TODO: Implement on-chain registry of linked wallets
  // For now, return empty array - wallets must be manually linked via UI

  // In production, this would:
  // 1. Check smart contract for linked wallets
  // 2. Query subgraph for wallet relationships
  // 3. Use ML to detect common ownership patterns

  return [];
}

/**
 * Format cross-chain data for display
 */
export function formatCrossChainSummary(data: CrossChainWalletData): string {
  const activeChains = data.chains.filter(c => c.transactionCount > 0);

  if (activeChains.length === 0) {
    return 'No cross-chain activity detected';
  }

  const chainNames = activeChains.map(c => c.chainName).join(', ');
  return `Active on ${activeChains.length} chain${activeChains.length > 1 ? 's' : ''}: ${chainNames}`;
}
