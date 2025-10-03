/**
 * Liquidation History Tracker
 * Monitors past liquidations across major lending protocols
 *
 * Data Sources:
 * - Aave V2/V3: LiquidationCall events
 * - Compound V2/V3: LiquidateBorrow events
 * - On-chain event logs via viem
 *
 * Scoring Impact:
 * - 0 liquidations: +8 points (perfect record)
 * - 1 liquidation: +4 points (one mistake)
 * - 2 liquidations: 0 points (concerning pattern)
 * - 3+ liquidations: -5 points (high risk borrower)
 */

import { createPublicClient, http, parseAbiItem, type Address } from 'viem';
import { arbitrum, mainnet, optimism, base, polygon } from 'viem/chains';

// Chain clients
const clients = {
  1: createPublicClient({ chain: mainnet, transport: http() }),
  42161: createPublicClient({ chain: arbitrum, transport: http() }),
  10: createPublicClient({ chain: optimism, transport: http() }),
  8453: createPublicClient({ chain: base, transport: http() }),
  137: createPublicClient({ chain: polygon, transport: http() }),
};

export interface LiquidationEvent {
  protocol: string;
  chainId: number;
  blockNumber: bigint;
  timestamp: Date;
  user: Address;
  collateralAsset: Address;
  debtAsset: Address;
  debtToCover: bigint;
  liquidatedCollateral: bigint;
  liquidator: Address;
  txHash: string;
}

/**
 * Protocol contract addresses for liquidation tracking
 */
const LENDING_POOLS = {
  // Aave V3
  aaveV3: {
    1: '0x87870Bca3F3fD6335C3F4ce8392D69350B4fA4E2', // Ethereum
    42161: '0x794a61358D6845594F94dc1DB02A252b5b4814aD', // Arbitrum
    10: '0x794a61358D6845594F94dc1DB02A252b5b4814aD', // Optimism
    8453: '0xA238Dd80C259a72e81d7e4664a9801593F98d1c5', // Base
    137: '0x794a61358D6845594F94dc1DB02A252b5b4814aD', // Polygon
  },
  // Aave V2
  aaveV2: {
    1: '0x7d2768dE32b0b80b7a3454c06BdAc94A69DDc7A9', // Ethereum
    137: '0x8dFf5E27EA6b7AC08EbFdf9eB090F32ee9a30fcf', // Polygon
  },
  // Compound V3 (different per asset)
  compoundV3USDC: {
    1: '0xc3d688B66703497DAA19211EEdff47f25384cdc3', // Ethereum
    42161: '0xA5EDBDD9646f8dFF606d7448e414884C7d905dCA', // Arbitrum
    8453: '0x46e6b214b524310239732D51387075E0e70970bf', // Base
    137: '0xF25212E676D1F7F89Cd72fFEe66158f541246445', // Polygon
  },
};

/**
 * Event signatures for liquidation detection
 */
const LIQUIDATION_EVENTS = {
  // Aave V2/V3: LiquidationCall(address collateralAsset, address debtAsset, address user, ...)
  aave: parseAbiItem(
    'event LiquidationCall(address indexed collateralAsset, address indexed debtAsset, address indexed user, uint256 debtToCover, uint256 liquidatedCollateralAmount, address liquidator, bool receiveAToken)'
  ),

  // Compound V3: AbsorbDebt(address indexed absorber, address indexed borrower, uint256 basePaidOut, uint256 usdValue)
  compoundV3: parseAbiItem(
    'event AbsorbDebt(address indexed absorber, address indexed borrower, uint256 basePaidOut, uint256 usdValue)'
  ),
};

/**
 * Fetch liquidation history for a user across all protocols
 */
export async function fetchLiquidationHistory(
  userAddress: Address,
  options: {
    fromBlock?: bigint;
    toBlock?: 'latest' | bigint;
    chainIds?: number[];
  } = {}
): Promise<LiquidationEvent[]> {
  const {
    fromBlock = BigInt(0),
    toBlock = 'latest',
    chainIds = [1, 42161, 10, 8453, 137],
  } = options;

  const liquidations: LiquidationEvent[] = [];

  // Fetch from each chain in parallel
  const promises = chainIds.map(async (chainId) => {
    const chainLiquidations: LiquidationEvent[] = [];

    try {
      // Aave V3
      if (LENDING_POOLS.aaveV3[chainId as keyof typeof LENDING_POOLS.aaveV3]) {
        const aaveV3Liquidations = await fetchAaveLiquidations(
          userAddress,
          chainId,
          LENDING_POOLS.aaveV3[chainId as keyof typeof LENDING_POOLS.aaveV3] as Address,
          'Aave V3',
          fromBlock,
          toBlock
        );
        chainLiquidations.push(...aaveV3Liquidations);
      }

      // Aave V2
      if (LENDING_POOLS.aaveV2[chainId as keyof typeof LENDING_POOLS.aaveV2]) {
        const aaveV2Liquidations = await fetchAaveLiquidations(
          userAddress,
          chainId,
          LENDING_POOLS.aaveV2[chainId as keyof typeof LENDING_POOLS.aaveV2] as Address,
          'Aave V2',
          fromBlock,
          toBlock
        );
        chainLiquidations.push(...aaveV2Liquidations);
      }

      // Compound V3
      if (LENDING_POOLS.compoundV3USDC[chainId as keyof typeof LENDING_POOLS.compoundV3USDC]) {
        const compoundLiquidations = await fetchCompoundV3Liquidations(
          userAddress,
          chainId,
          LENDING_POOLS.compoundV3USDC[chainId as keyof typeof LENDING_POOLS.compoundV3USDC] as Address,
          fromBlock,
          toBlock
        );
        chainLiquidations.push(...compoundLiquidations);
      }
    } catch (error) {
      console.error(`Error fetching liquidations on chain ${chainId}:`, error);
    }

    return chainLiquidations;
  });

  const results = await Promise.all(promises);
  liquidations.push(...results.flat());

  // Sort by timestamp (most recent first)
  return liquidations.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
}

/**
 * Fetch Aave liquidations
 */
async function fetchAaveLiquidations(
  userAddress: Address,
  chainId: number,
  poolAddress: Address,
  protocol: string,
  fromBlock: bigint,
  toBlock: 'latest' | bigint
): Promise<LiquidationEvent[]> {
  const client = clients[chainId as keyof typeof clients];
  if (!client) return [];

  const logs = await client.getLogs({
    address: poolAddress,
    event: LIQUIDATION_EVENTS.aave,
    args: {
      user: userAddress,
    },
    fromBlock,
    toBlock,
  });

  const liquidations: LiquidationEvent[] = [];

  for (const log of logs) {
    const block = await client.getBlock({ blockNumber: log.blockNumber });

    liquidations.push({
      protocol,
      chainId,
      blockNumber: log.blockNumber,
      timestamp: new Date(Number(block.timestamp) * 1000),
      user: log.args.user!,
      collateralAsset: log.args.collateralAsset!,
      debtAsset: log.args.debtAsset!,
      debtToCover: log.args.debtToCover!,
      liquidatedCollateral: log.args.liquidatedCollateralAmount!,
      liquidator: log.args.liquidator!,
      txHash: log.transactionHash!,
    });
  }

  return liquidations;
}

/**
 * Fetch Compound V3 liquidations (absorptions)
 */
async function fetchCompoundV3Liquidations(
  userAddress: Address,
  chainId: number,
  cometAddress: Address,
  fromBlock: bigint,
  toBlock: 'latest' | bigint
): Promise<LiquidationEvent[]> {
  const client = clients[chainId as keyof typeof clients];
  if (!client) return [];

  const logs = await client.getLogs({
    address: cometAddress,
    event: LIQUIDATION_EVENTS.compoundV3,
    args: {
      borrower: userAddress,
    },
    fromBlock,
    toBlock,
  });

  const liquidations: LiquidationEvent[] = [];

  for (const log of logs) {
    const block = await client.getBlock({ blockNumber: log.blockNumber });

    liquidations.push({
      protocol: 'Compound V3',
      chainId,
      blockNumber: log.blockNumber,
      timestamp: new Date(Number(block.timestamp) * 1000),
      user: log.args.borrower!,
      collateralAsset: cometAddress, // Compound V3 uses single collateral
      debtAsset: cometAddress, // Base asset (USDC)
      debtToCover: log.args.basePaidOut!,
      liquidatedCollateral: log.args.usdValue!,
      liquidator: log.args.absorber!,
      txHash: log.transactionHash!,
    });
  }

  return liquidations;
}

/**
 * Calculate liquidation score (0-8 points max)
 */
export function calculateLiquidationScore(
  liquidations: LiquidationEvent[]
): {
  score: number;
  maxScore: number;
  evidence: {
    totalLiquidations: number;
    recentLiquidations: number; // Last 6 months
    protocols: string[];
    lastLiquidation: Date | null;
  };
} {
  const maxScore = 8;
  const totalLiquidations = liquidations.length;

  // Count recent liquidations (last 6 months)
  const sixMonthsAgo = new Date();
  sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
  const recentLiquidations = liquidations.filter(
    (l) => l.timestamp >= sixMonthsAgo
  ).length;

  // Get unique protocols
  const protocols = [...new Set(liquidations.map((l) => l.protocol))];

  // Calculate score
  let score = maxScore;

  if (totalLiquidations === 0) {
    score = 8; // Perfect record
  } else if (totalLiquidations === 1 && recentLiquidations === 0) {
    score = 6; // One old liquidation (forgivable)
  } else if (totalLiquidations === 1) {
    score = 4; // One recent liquidation (concerning)
  } else if (totalLiquidations === 2 && recentLiquidations === 0) {
    score = 2; // Two old liquidations
  } else if (totalLiquidations === 2) {
    score = 0; // Two recent liquidations (pattern)
  } else if (recentLiquidations > 0) {
    score = -5; // Multiple recent liquidations (very risky)
  } else {
    score = -3; // Multiple old liquidations (risky history)
  }

  return {
    score: Math.max(-5, Math.min(maxScore, score)),
    maxScore,
    evidence: {
      totalLiquidations,
      recentLiquidations,
      protocols,
      lastLiquidation: liquidations.length > 0 ? liquidations[0].timestamp : null,
    },
  };
}

/**
 * Get liquidation details for display
 */
export function formatLiquidationEvent(event: LiquidationEvent): string {
  const date = event.timestamp.toLocaleDateString();
  const chain = getChainName(event.chainId);

  return `${event.protocol} on ${chain} (${date})`;
}

/**
 * Get chain name from ID
 */
function getChainName(chainId: number): string {
  const names: Record<number, string> = {
    1: 'Ethereum',
    42161: 'Arbitrum',
    10: 'Optimism',
    8453: 'Base',
    137: 'Polygon',
  };

  return names[chainId] || `Chain ${chainId}`;
}

/**
 * Check if user has been liquidated in last N days
 */
export function hasRecentLiquidation(
  liquidations: LiquidationEvent[],
  days: number
): boolean {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - days);

  return liquidations.some((l) => l.timestamp >= cutoff);
}

/**
 * Get liquidation frequency (liquidations per year)
 */
export function getLiquidationFrequency(
  liquidations: LiquidationEvent[]
): number {
  if (liquidations.length === 0) return 0;

  const oldestLiquidation = liquidations[liquidations.length - 1];
  const now = new Date();
  const daysSinceFirst =
    (now.getTime() - oldestLiquidation.timestamp.getTime()) / (1000 * 60 * 60 * 24);

  if (daysSinceFirst < 1) return 0;

  const yearsActive = daysSinceFirst / 365;
  return liquidations.length / yearsActive;
}
