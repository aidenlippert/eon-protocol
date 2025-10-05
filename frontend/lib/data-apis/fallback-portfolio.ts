/**
 * @title Fallback Portfolio Data Provider
 * @notice Provides basic multi-chain data without requiring paid API keys
 * @dev Uses public RPC endpoints as fallback when Covalent is unavailable
 */

import { createPublicClient, http, formatEther } from 'viem';
import { mainnet, polygon, arbitrum, optimism, base } from 'viem/chains';

export interface FallbackPortfolioData {
  totalValueUSD: number;
  tokens: Array<{
    symbol: string;
    balance: string;
    quote: number;
  }>;
  uniqueTokenCount: number;
  stablecoinRatio: number;
  topTokenConcentration: number;
}

/**
 * Get basic portfolio data using free RPC endpoints
 * This is a fallback when Covalent API is unavailable
 */
export async function getFallbackPortfolio(address: string): Promise<FallbackPortfolioData> {
  console.log('[Fallback] Using public RPC for basic portfolio data');

  try {
    // Fetch ETH balance from multiple chains in parallel
    const [ethBalance, polyBalance, arbBalance, opBalance, baseBalance] = await Promise.all([
      getETHBalance(address, mainnet),
      getETHBalance(address, polygon),
      getETHBalance(address, arbitrum),
      getETHBalance(address, optimism),
      getETHBalance(address, base),
    ]);

    // Rough ETH price estimate
    const ETH_PRICE = 2500;
    const MATIC_PRICE = 0.8;

    const tokens = [];
    let totalValueUSD = 0;

    // Ethereum mainnet ETH
    if (ethBalance > 0) {
      const value = ethBalance * ETH_PRICE;
      tokens.push({ symbol: 'ETH', balance: ethBalance.toFixed(6), quote: value });
      totalValueUSD += value;
    }

    // Polygon MATIC
    if (polyBalance > 0) {
      const value = polyBalance * MATIC_PRICE;
      tokens.push({ symbol: 'MATIC', balance: polyBalance.toFixed(6), quote: value });
      totalValueUSD += value;
    }

    // Arbitrum ETH
    if (arbBalance > 0) {
      const value = arbBalance * ETH_PRICE;
      tokens.push({ symbol: 'ARB-ETH', balance: arbBalance.toFixed(6), quote: value });
      totalValueUSD += value;
    }

    // Optimism ETH
    if (opBalance > 0) {
      const value = opBalance * ETH_PRICE;
      tokens.push({ symbol: 'OP-ETH', balance: opBalance.toFixed(6), quote: value });
      totalValueUSD += value;
    }

    // Base ETH
    if (baseBalance > 0) {
      const value = baseBalance * ETH_PRICE;
      tokens.push({ symbol: 'BASE-ETH', balance: baseBalance.toFixed(6), quote: value });
      totalValueUSD += value;
    }

    // Calculate concentration (simplified)
    const concentration =
      tokens.length > 0
        ? tokens.reduce((sum, t) => {
            const share = t.quote / totalValueUSD;
            return sum + share * share;
          }, 0)
        : 1.0;

    return {
      totalValueUSD,
      tokens,
      uniqueTokenCount: tokens.length,
      stablecoinRatio: 0, // Can't detect stablecoins without token API
      topTokenConcentration: concentration,
    };
  } catch (error) {
    console.error('[Fallback] Error fetching portfolio:', error);
    return {
      totalValueUSD: 0,
      tokens: [],
      uniqueTokenCount: 0,
      stablecoinRatio: 0,
      topTokenConcentration: 1.0,
    };
  }
}

/**
 * Get ETH balance for an address on a specific chain
 */
async function getETHBalance(address: string, chain: any): Promise<number> {
  try {
    const client = createPublicClient({
      chain,
      transport: http(),
    });

    const balance = await client.getBalance({ address: address as `0x${string}` });
    return parseFloat(formatEther(balance));
  } catch (error) {
    console.warn(`[Fallback] Failed to fetch balance on ${chain.name}`);
    return 0;
  }
}

/**
 * Get basic DeFi protocol list (fallback)
 */
export function getFallbackProtocols(): string[] {
  // Return empty array - can't detect protocols without transaction history API
  return [];
}
