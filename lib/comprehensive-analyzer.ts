/**
 * Comprehensive On-Chain Data Analyzer
 * Fetches and analyzes ALL relevant on-chain data for credit scoring
 */

import { createPublicClient, http, parseAbiItem } from 'viem';
import { arbitrumSepolia } from 'viem/chains';
import { fetchTransactionHistory, type Transaction } from './transaction-analyzer';
import { calculateCreditScore, type LendingPosition, type CreditScoreData } from './real-credit-score';
import {
  applySybilResistance,
  detectSybilAttack,
  getVerificationRecommendations,
  type ProofOfHumanity,
  type LinkedWallet,
} from './sybil-resistance';

export interface EnhancedCreditScoreData extends CreditScoreData {
  sybilResistance: {
    finalScore: number;
    baseScore: number;
    adjustments: {
      walletAgePenalty: number;
      humanityBonus: number;
      stakingBonus: number;
      bundlingBonus: number;
      noVerificationPenalty: number;
      totalAdjustment: number;
    };
    sybilCheck: {
      isSuspicious: boolean;
      riskScore: number;
      reasons: string[];
    };
    recommendations: string[];
  };
}

const client = createPublicClient({
  chain: arbitrumSepolia,
  transport: http(),
});

// Known DeFi lending protocols on Arbitrum
const LENDING_PROTOCOLS = {
  // Aave V3
  '0x794a61358d6845594f94dc1db02a252b5b4814ad': 'Aave V3',
  // Our protocol
  '0xdfc6659b8ca357aae62d5e272b7670d1d036c631': 'Eon Protocol',
};

const SWAP_PROTOCOLS = {
  '0x68b3465833fb72a70ecdf485e0e4c7bd8665fc45': 'Uniswap V3',
  '0x1111111254eeb25477b68fb85ed929f73a960582': '1inch',
};

const ASSET_TYPES = {
  USDC: 'Stablecoin',
  USDT: 'Stablecoin',
  DAI: 'Stablecoin',
  WETH: 'Volatile',
  WBTC: 'Volatile',
  ARB: 'Volatile',
};

/**
 * Analyze lending positions from transaction history
 */
async function analyzeLendingPositions(
  address: string,
  transactions: Transaction[]
): Promise<LendingPosition[]> {
  const positions: LendingPosition[] = [];

  // Look for lending protocol interactions
  for (const tx of transactions) {
    const txTo = tx.to?.toLowerCase() || '';
    const protocol = LENDING_PROTOCOLS[txTo as keyof typeof LENDING_PROTOCOLS];
    if (!protocol) continue;

    // Parse function name to determine action
    const functionName = tx.functionName?.toLowerCase() || '';

    if (functionName.includes('borrow')) {
      // Found a borrow event
      positions.push({
        protocol,
        borrowed: BigInt(tx.value || '0'),
        collateral: BigInt(0), // Would need to query contract state
        healthFactor: 1.5, // Default safe value
        timestamp: Number(tx.timeStamp),
        repaid: false, // Would need to check for repay events
        liquidated: false,
      });
    }
  }

  return positions;
}

/**
 * Calculate utilization metrics from lending positions
 */
function calculateUtilizationMetrics(positions: LendingPosition[]): {
  avgUtilization: number;
  maxUtilization: number;
} {
  if (positions.length === 0) {
    return { avgUtilization: 0, maxUtilization: 0 };
  }

  const utilizations = positions.map(p => {
    if (p.collateral === BigInt(0)) return 0;
    return (Number(p.borrowed) / Number(p.collateral)) * 100;
  });

  const avgUtilization = utilizations.reduce((a, b) => a + b, 0) / utilizations.length;
  const maxUtilization = Math.max(...utilizations);

  return { avgUtilization, maxUtilization };
}

/**
 * Analyze protocol and asset diversity
 */
function analyzeProtocolDiversity(transactions: Transaction[]): {
  protocolsUsed: string[];
  assetTypes: string[];
} {
  const protocols = new Set<string>();
  const assets = new Set<string>();

  for (const tx of transactions) {
    const address = tx.to?.toLowerCase() || '';

    // Check lending protocols
    const lendingProtocol = LENDING_PROTOCOLS[address as keyof typeof LENDING_PROTOCOLS];
    if (lendingProtocol) {
      protocols.add(lendingProtocol);
      assets.add('Stablecoin'); // Assume USDC for now
    }

    // Check swap protocols
    const swapProtocol = SWAP_PROTOCOLS[address as keyof typeof SWAP_PROTOCOLS];
    if (swapProtocol) {
      protocols.add(swapProtocol);
      assets.add('Volatile'); // Assume trading volatile assets
    }
  }

  return {
    protocolsUsed: Array.from(protocols),
    assetTypes: Array.from(assets),
  };
}

/**
 * Calculate recent loan activity
 */
function calculateRecentActivity(positions: LendingPosition[]): {
  recentLoans: number;
  avgTimeBetweenLoans: number;
} {
  if (positions.length === 0) {
    return { recentLoans: 0, avgTimeBetweenLoans: 0 };
  }

  const now = Date.now() / 1000;
  const thirtyDaysAgo = now - (30 * 24 * 60 * 60);

  // Count loans in last 30 days
  const recentLoans = positions.filter(p => p.timestamp >= thirtyDaysAgo).length;

  // Calculate average time between loans
  if (positions.length < 2) {
    return { recentLoans, avgTimeBetweenLoans: 0 };
  }

  const sortedPositions = [...positions].sort((a, b) => a.timestamp - b.timestamp);
  const timeDiffs: number[] = [];

  for (let i = 1; i < sortedPositions.length; i++) {
    const diff = sortedPositions[i].timestamp - sortedPositions[i - 1].timestamp;
    timeDiffs.push(diff / (24 * 60 * 60)); // Convert to days
  }

  const avgTimeBetweenLoans = timeDiffs.reduce((a, b) => a + b, 0) / timeDiffs.length;

  return { recentLoans, avgTimeBetweenLoans };
}

/**
 * Main function to analyze wallet and calculate comprehensive credit score
 * WITH SYBIL RESISTANCE
 */
export async function analyzeWalletComprehensive(
  address: `0x${string}`,
  proofOfHumanity?: ProofOfHumanity,
  linkedWallets?: LinkedWallet[],
  stakingAmount?: bigint
): Promise<EnhancedCreditScoreData> {
  // Default values for sybil resistance
  const poh: ProofOfHumanity = proofOfHumanity || {
    verified: false,
    provider: 'none',
    verificationDate: null,
    humanityScore: 0,
  };
  const wallets: LinkedWallet[] = linkedWallets || [];
  const staking: bigint = stakingAmount || BigInt(0);
  // 1. Fetch transaction history
  const transactions = await fetchTransactionHistory(address);

  if (transactions.length === 0) {
    // New wallet with no history - return minimum score with sybil resistance
    const baseScoreData = calculateCreditScore({
      lendingPositions: [],
      currentBorrowed: BigInt(0),
      currentCollateral: BigInt(0),
      avgUtilization: 0,
      maxUtilization: 0,
      walletAgeInDays: 0,
      firstDefiInteraction: null,
      protocolsUsed: [],
      assetTypes: [],
      recentLoans: 0,
      avgTimeBetweenLoans: 0,
    });

    const sybilResult = applySybilResistance(
      baseScoreData.score,
      0,
      poh,
      staking,
      wallets
    );

    const sybilCheck = detectSybilAttack(0, poh, staking, wallets, 0);
    const recommendations = getVerificationRecommendations(poh, staking, wallets);

    return {
      ...baseScoreData,
      score: sybilResult.finalScore,
      sybilResistance: {
        finalScore: sybilResult.finalScore,
        baseScore: baseScoreData.score,
        adjustments: sybilResult.adjustments,
        sybilCheck,
        recommendations,
      },
    };
  }

  // 2. Calculate wallet age
  const firstTx = transactions[0];
  const firstTxDate = new Date(Number(firstTx.timeStamp) * 1000);
  const now = new Date();
  const walletAgeInDays = Math.floor((now.getTime() - firstTxDate.getTime()) / (1000 * 60 * 60 * 24));

  // 3. Analyze lending positions
  const lendingPositions = await analyzeLendingPositions(address, transactions);

  // 4. Find first DeFi interaction
  let firstDefiInteraction: Date | null = null;
  for (const tx of transactions) {
    const addr = tx.to?.toLowerCase() || '';
    if (LENDING_PROTOCOLS[addr as keyof typeof LENDING_PROTOCOLS] || SWAP_PROTOCOLS[addr as keyof typeof SWAP_PROTOCOLS]) {
      firstDefiInteraction = new Date(Number(tx.timeStamp) * 1000);
      break;
    }
  }

  // 5. Calculate utilization metrics
  const { avgUtilization, maxUtilization } = calculateUtilizationMetrics(lendingPositions);

  // 6. Analyze protocol diversity
  const { protocolsUsed, assetTypes } = analyzeProtocolDiversity(transactions);

  // 7. Calculate recent activity
  const { recentLoans, avgTimeBetweenLoans } = calculateRecentActivity(lendingPositions);

  // 8. Get current positions (would query contracts in production)
  const currentBorrowed = BigInt(0);
  const currentCollateral = BigInt(0);

  // 9. Check for DeFi interactions in transactions
  for (const tx of transactions) {
    const addr = tx.to?.toLowerCase() || '';
    const lendingProto = LENDING_PROTOCOLS[addr as keyof typeof LENDING_PROTOCOLS];
    const swapProto = SWAP_PROTOCOLS[addr as keyof typeof SWAP_PROTOCOLS];
    if (lendingProto || swapProto) {
      if (!firstDefiInteraction) {
        firstDefiInteraction = new Date(Number(tx.timeStamp) * 1000);
      }
      break;
    }
  }

  // 10. Calculate BASE credit score (without sybil resistance)
  const baseScoreData = calculateCreditScore({
    lendingPositions,
    currentBorrowed,
    currentCollateral,
    avgUtilization,
    maxUtilization,
    walletAgeInDays,
    firstDefiInteraction,
    protocolsUsed,
    assetTypes,
    recentLoans,
    avgTimeBetweenLoans,
  });

  // 11. Apply Sybil Resistance Adjustments
  const sybilResult = applySybilResistance(
    baseScoreData.score,
    walletAgeInDays,
    poh,
    staking,
    wallets
  );

  // 12. Check for sybil attack indicators
  const sybilCheck = detectSybilAttack(
    walletAgeInDays,
    poh,
    staking,
    wallets,
    transactions.length
  );

  // 13. Get verification recommendations
  const recommendations = getVerificationRecommendations(poh, staking, wallets);

  // 14. Return enhanced score with sybil resistance
  return {
    ...baseScoreData,
    score: sybilResult.finalScore, // OVERRIDE WITH SYBIL-ADJUSTED SCORE
    sybilResistance: {
      finalScore: sybilResult.finalScore,
      baseScore: baseScoreData.score,
      adjustments: sybilResult.adjustments,
      sybilCheck,
      recommendations,
    },
  };
}
