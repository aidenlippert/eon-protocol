/**
 * @title Covalent API Integration
 * @notice Multi-chain wallet data aggregation via Covalent GoldRush API
 * @dev Fetches token balances, NFTs, and DeFi positions across 200+ chains
 *
 * **Covalent GoldRush API**:
 * - Free tier: 100,000 credits/month
 * - Covers: Ethereum, Polygon, Arbitrum, Optimism, Base, BSC, Avalanche, etc.
 * - Data: Token balances, NFTs, transactions, DeFi positions
 *
 * **Alternative APIs** (if Covalent fails):
 * - Zapper API: Portfolio aggregation
 * - Moralis API: Multi-chain data
 * - Alchemy API: Token balances
 */

// Covalent API configuration
const COVALENT_API_KEY = process.env.COVALENT_API_KEY || 'cqt_rQkg4KBX8C9WKcWvwhjbkfYJhJVR'; // Free demo key
const COVALENT_BASE_URL = 'https://api.covalenthq.com/v1';

// Supported chains for scoring (ordered by importance)
const SUPPORTED_CHAINS = {
  ETHEREUM: '1',
  POLYGON: '137',
  ARBITRUM: '42161',
  OPTIMISM: '10',
  BASE: '8453',
  BSC: '56',
  AVALANCHE: '43114',
  ARBITRUM_SEPOLIA: '421614', // Testnet
} as const;

// ============================================
// TYPE DEFINITIONS
// ============================================

export interface TokenBalance {
  contractAddress: string;
  symbol: string;
  balance: string;
  quote: number; // USD value
  decimals: number;
  type: 'cryptocurrency' | 'stablecoin' | 'dust';
}

export interface PortfolioData {
  totalValueUSD: number;
  tokens: TokenBalance[];
  uniqueTokenCount: number;
  stablecoinRatio: number; // 0-1
  topTokenConcentration: number; // 0-1 (Herfindahl index)
  chainDistribution: Record<string, number>; // chainId → USD value
}

export interface DeFiPosition {
  protocol: string;
  type: 'lending' | 'liquidity' | 'staking' | 'yield';
  valueUSD: number;
  chain: string;
}

export interface TransactionSummary {
  totalCount: number;
  uniqueProtocols: string[];
  firstTxDate: Date | null;
  lastTxDate: Date | null;
  weeklyAverage: number;
}

// ============================================
// PORTFOLIO & ASSET DATA
// ============================================

/**
 * Get complete portfolio value across all supported chains
 * @param address - Wallet address
 * @returns Aggregated portfolio data for S5 (Asset Diversity) scoring
 */
export async function getPortfolioValue(address: string): Promise<PortfolioData> {
  console.log(`[Covalent] Fetching portfolio for ${address}`);

  try {
    // Fetch balances from all supported chains in parallel
    const balancePromises = Object.values(SUPPORTED_CHAINS).map((chainId) =>
      getTokenBalances(address, chainId)
    );

    const allBalances = await Promise.all(balancePromises);
    const flatBalances = allBalances.flat();

    // Filter out dust (< $1)
    const significantBalances = flatBalances.filter(
      (token) => token.quote >= 1.0
    );

    // Calculate total value
    const totalValueUSD = significantBalances.reduce(
      (sum, token) => sum + token.quote,
      0
    );

    // Calculate stablecoin ratio
    const stablecoins = ['USDC', 'USDT', 'DAI', 'BUSD', 'FRAX', 'TUSD'];
    const stablecoinValue = significantBalances
      .filter((token) => stablecoins.includes(token.symbol.toUpperCase()))
      .reduce((sum, token) => sum + token.quote, 0);
    const stablecoinRatio = totalValueUSD > 0 ? stablecoinValue / totalValueUSD : 0;

    // Calculate Herfindahl concentration index (0 = perfectly diversified, 1 = single asset)
    const concentrationIndex = significantBalances.reduce((sum, token) => {
      const share = token.quote / totalValueUSD;
      return sum + share * share;
    }, 0);

    // Build chain distribution
    const chainDistribution: Record<string, number> = {};
    for (const [chainName, chainId] of Object.entries(SUPPORTED_CHAINS)) {
      const chainValue = significantBalances
        .filter((token) => token.contractAddress.startsWith(chainId))
        .reduce((sum, token) => sum + token.quote, 0);
      if (chainValue > 0) {
        chainDistribution[chainName] = chainValue;
      }
    }

    const result: PortfolioData = {
      totalValueUSD,
      tokens: significantBalances,
      uniqueTokenCount: significantBalances.length,
      stablecoinRatio,
      topTokenConcentration: concentrationIndex,
      chainDistribution,
    };

    console.log('[Covalent] Portfolio aggregated:', {
      totalValueUSD: result.totalValueUSD.toFixed(2),
      tokens: result.uniqueTokenCount,
      stablecoinRatio: (result.stablecoinRatio * 100).toFixed(1) + '%',
      concentration: result.topTokenConcentration.toFixed(2),
    });

    return result;
  } catch (error) {
    console.error('[Covalent] Portfolio fetch error:', error);
    // Return empty portfolio on error (graceful degradation)
    return {
      totalValueUSD: 0,
      tokens: [],
      uniqueTokenCount: 0,
      stablecoinRatio: 0,
      topTokenConcentration: 1.0,
      chainDistribution: {},
    };
  }
}

/**
 * Get token balances for a specific chain
 * @param address - Wallet address
 * @param chainId - Chain ID (e.g., '1' for Ethereum)
 * @returns Array of token balances with USD values
 */
export async function getTokenBalances(
  address: string,
  chainId: string
): Promise<TokenBalance[]> {
  try {
    const url = `${COVALENT_BASE_URL}/${chainId}/address/${address}/balances_v2/`;

    const response = await fetch(url, {
      headers: {
        Authorization: `Bearer ${COVALENT_API_KEY}`,
      },
    });

    if (!response.ok) {
      console.warn(`[Covalent] Chain ${chainId} fetch failed:`, response.status);
      return [];
    }

    const data = await response.json();

    if (!data.data || !data.data.items) {
      return [];
    }

    // Map Covalent response to TokenBalance
    const tokens: TokenBalance[] = data.data.items
      .filter((item: any) => item.balance !== '0')
      .map((item: any) => {
        const balance = (parseInt(item.balance) / 10 ** item.contract_decimals).toString();
        const quote = item.quote || 0;

        // Classify token type
        let type: 'cryptocurrency' | 'stablecoin' | 'dust' = 'cryptocurrency';
        const stablecoins = ['USDC', 'USDT', 'DAI', 'BUSD', 'FRAX'];
        if (stablecoins.includes(item.contract_ticker_symbol?.toUpperCase())) {
          type = 'stablecoin';
        } else if (quote < 1.0) {
          type = 'dust';
        }

        return {
          contractAddress: item.contract_address,
          symbol: item.contract_ticker_symbol || 'UNKNOWN',
          balance,
          quote,
          decimals: item.contract_decimals,
          type,
        };
      });

    return tokens;
  } catch (error) {
    console.error(`[Covalent] Error fetching balances for chain ${chainId}:`, error);
    return [];
  }
}

// ============================================
// DEFI PROTOCOL HISTORY
// ============================================

/**
 * Get DeFi protocols used by wallet across chains
 * @param address - Wallet address
 * @returns List of protocols for S6 (DeFi Mix) scoring
 */
export async function getDeFiProtocols(address: string): Promise<string[]> {
  console.log(`[Covalent] Fetching DeFi protocols for ${address}`);

  try {
    // Fetch recent transactions from major chains
    const txPromises = [
      getTransactionSummary(address, SUPPORTED_CHAINS.ETHEREUM),
      getTransactionSummary(address, SUPPORTED_CHAINS.POLYGON),
      getTransactionSummary(address, SUPPORTED_CHAINS.ARBITRUM),
    ];

    const summaries = await Promise.all(txPromises);

    // Aggregate unique protocols
    const allProtocols = new Set<string>();
    summaries.forEach((summary) => {
      summary.uniqueProtocols.forEach((protocol) => allProtocols.add(protocol));
    });

    const protocols = Array.from(allProtocols);

    console.log('[Covalent] DeFi protocols found:', protocols);

    return protocols;
  } catch (error) {
    console.error('[Covalent] DeFi protocols fetch error:', error);
    return [];
  }
}

/**
 * Get transaction summary for a specific chain
 * @param address - Wallet address
 * @param chainId - Chain ID
 * @returns Transaction summary with protocol interactions
 */
export async function getTransactionSummary(
  address: string,
  chainId: string
): Promise<TransactionSummary> {
  try {
    const url = `${COVALENT_BASE_URL}/${chainId}/address/${address}/transactions_v2/?page-size=100`;

    const response = await fetch(url, {
      headers: {
        Authorization: `Bearer ${COVALENT_API_KEY}`,
      },
    });

    if (!response.ok) {
      return {
        totalCount: 0,
        uniqueProtocols: [],
        firstTxDate: null,
        lastTxDate: null,
        weeklyAverage: 0,
      };
    }

    const data = await response.json();

    if (!data.data || !data.data.items) {
      return {
        totalCount: 0,
        uniqueProtocols: [],
        firstTxDate: null,
        lastTxDate: null,
        weeklyAverage: 0,
      };
    }

    const txs = data.data.items;
    const totalCount = txs.length;

    // Extract unique protocols from transaction logs
    const protocols = new Set<string>();
    txs.forEach((tx: any) => {
      if (tx.log_events) {
        tx.log_events.forEach((log: any) => {
          const protocolName = extractProtocolName(log.sender_address);
          if (protocolName) {
            protocols.add(protocolName);
          }
        });
      }
    });

    // Calculate date range
    const dates = txs
      .map((tx: any) => new Date(tx.block_signed_at))
      .filter((d: Date) => !isNaN(d.getTime()));

    const firstTxDate = dates.length > 0 ? new Date(Math.min(...dates.map((d) => d.getTime()))) : null;
    const lastTxDate = dates.length > 0 ? new Date(Math.max(...dates.map((d) => d.getTime()))) : null;

    // Calculate weekly average
    let weeklyAverage = 0;
    if (firstTxDate && lastTxDate) {
      const daysDiff = (lastTxDate.getTime() - firstTxDate.getTime()) / (1000 * 60 * 60 * 24);
      const weeks = Math.max(1, daysDiff / 7);
      weeklyAverage = totalCount / weeks;
    }

    return {
      totalCount,
      uniqueProtocols: Array.from(protocols),
      firstTxDate,
      lastTxDate,
      weeklyAverage,
    };
  } catch (error) {
    console.error(`[Covalent] Transaction summary error for chain ${chainId}:`, error);
    return {
      totalCount: 0,
      uniqueProtocols: [],
      firstTxDate: null,
      lastTxDate: null,
      weeklyAverage: 0,
    };
  }
}

// ============================================
// HELPER FUNCTIONS
// ============================================

/**
 * Extract protocol name from contract address
 * @param address - Contract address
 * @returns Protocol name or null
 */
function extractProtocolName(address: string): string | null {
  // Known protocol addresses (partial list for common protocols)
  const knownProtocols: Record<string, string> = {
    '0x7d2768de32b0b80b7a3454c06bdac94a69ddc7a9': 'aave',
    '0x7a250d5630b4cf539739df2c5dacb4c659f2488d': 'uniswap',
    '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48': 'usdc', // Not a protocol but useful
    '0x1f9840a85d5af5bf1d1762f925bdaddc4201f984': 'uniswap',
    '0x';
  // Add more as needed
  };

  const lowerAddress = address.toLowerCase();
  return knownProtocols[lowerAddress] || null;
}

/**
 * Health check for Covalent API
 * @returns true if API is accessible
 */
export async function testCovalentConnection(): Promise<boolean> {
  try {
    const testAddress = '0x0000000000000000000000000000000000000000';
    const url = `${COVALENT_BASE_URL}/1/address/${testAddress}/balances_v2/`;

    const response = await fetch(url, {
      headers: {
        Authorization: `Bearer ${COVALENT_API_KEY}`,
      },
    });

    return response.ok;
  } catch (error) {
    console.error('[Covalent] Connection test failed:', error);
    return false;
  }
}
