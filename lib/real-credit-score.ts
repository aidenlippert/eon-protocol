/**
 * REAL On-Chain Credit Scoring System
 * Based on FICO methodology + DeFi-specific metrics
 *
 * Score Range: 300-850 (like FICO)
 *
 * Factors (mirroring FICO):
 * 1. Payment History (35%) - Loan repayments, liquidations avoided
 * 2. Credit Utilization (30%) - Borrow/collateral ratios
 * 3. Credit History Length (15%) - Wallet age + DeFi activity duration
 * 4. Credit Mix (10%) - Protocol diversity, asset types
 * 5. New Credit (10%) - Recent borrowing behavior
 */

import { createPublicClient, http, formatEther, formatUnits } from 'viem';
import { arbitrumSepolia } from 'viem/chains';

const client = createPublicClient({
  chain: arbitrumSepolia,
  transport: http(),
});

export interface LendingPosition {
  protocol: string;
  borrowed: bigint;
  collateral: bigint;
  healthFactor: number;
  timestamp: number;
  repaid: boolean;
  liquidated: boolean;
}

export interface CreditScoreData {
  score: number; // 300-850
  tier: 'Subprime' | 'Fair' | 'Good' | 'Very Good' | 'Exceptional';
  breakdown: {
    paymentHistory: {
      score: number;
      weight: number;
      evidence: {
        totalLoans: number;
        repaidOnTime: number;
        liquidations: number;
        avgHealthFactor: number;
      };
    };
    creditUtilization: {
      score: number;
      weight: number;
      evidence: {
        avgUtilization: number;
        currentUtilization: number;
        maxUtilization: number;
      };
    };
    creditHistoryLength: {
      score: number;
      weight: number;
      evidence: {
        walletAgeInDays: number;
        firstDefiInteraction: Date | null;
        defiAgeInDays: number;
      };
    };
    creditMix: {
      score: number;
      weight: number;
      evidence: {
        protocolsUsed: string[];
        assetTypes: string[];
        diversityScore: number;
      };
    };
    newCredit: {
      score: number;
      weight: number;
      evidence: {
        recentLoans: number;
        hardInquiries: number;
        avgTimeBetweenLoans: number;
      };
    };
  };
}

/**
 * Calculate Payment History Score (35% weight)
 *
 * Perfect score: No liquidations, all loans repaid on time, high health factors
 *
 * Metrics:
 * - Loan repayment rate (50%)
 * - Liquidation history (30%)
 * - Average health factor maintenance (20%)
 */
function calculatePaymentHistory(positions: LendingPosition[]): {
  score: number;
  evidence: CreditScoreData['breakdown']['paymentHistory']['evidence'];
} {
  if (positions.length === 0) {
    return {
      score: 0,
      evidence: {
        totalLoans: 0,
        repaidOnTime: 0,
        liquidations: 0,
        avgHealthFactor: 0,
      },
    };
  }

  const totalLoans = positions.length;
  const repaidOnTime = positions.filter(p => p.repaid && !p.liquidated).length;
  const liquidations = positions.filter(p => p.liquidated).length;
  const avgHealthFactor = positions.reduce((acc, p) => acc + p.healthFactor, 0) / totalLoans;

  // Repayment rate (0-50 points)
  const repaymentScore = (repaidOnTime / totalLoans) * 50;

  // Liquidation penalty (0-30 points, lose points for liquidations)
  const liquidationScore = Math.max(30 - (liquidations * 10), 0);

  // Health factor score (0-20 points)
  // Health factor > 2.0 is excellent, 1.5-2.0 is good, 1.0-1.5 is risky
  let healthScore = 0;
  if (avgHealthFactor >= 2.0) healthScore = 20;
  else if (avgHealthFactor >= 1.5) healthScore = 15;
  else if (avgHealthFactor >= 1.2) healthScore = 10;
  else if (avgHealthFactor >= 1.0) healthScore = 5;

  const totalScore = repaymentScore + liquidationScore + healthScore;

  return {
    score: Math.round(totalScore),
    evidence: {
      totalLoans,
      repaidOnTime,
      liquidations,
      avgHealthFactor: Math.round(avgHealthFactor * 100) / 100,
    },
  };
}

/**
 * Calculate Credit Utilization Score (30% weight)
 *
 * Perfect score: Low utilization (<30%), never maxed out
 *
 * Metrics:
 * - Current utilization (40%)
 * - Average utilization (40%)
 * - Peak utilization (20%)
 */
function calculateCreditUtilization(
  currentBorrowed: bigint,
  currentCollateral: bigint,
  avgUtilization: number,
  maxUtilization: number
): {
  score: number;
  evidence: CreditScoreData['breakdown']['creditUtilization']['evidence'];
} {
  // Calculate current utilization (borrowed / collateral * 100)
  const currentUtil = currentCollateral > BigInt(0)
    ? (Number(currentBorrowed) / Number(currentCollateral)) * 100
    : 0;

  // Current utilization score (0-12 points)
  let currentScore = 0;
  if (currentUtil === 0) currentScore = 12;
  else if (currentUtil < 20) currentScore = 12;
  else if (currentUtil < 30) currentScore = 10;
  else if (currentUtil < 50) currentScore = 7;
  else if (currentUtil < 70) currentScore = 4;
  else currentScore = 0;

  // Average utilization score (0-12 points)
  let avgScore = 0;
  if (avgUtilization === 0) avgScore = 12;
  else if (avgUtilization < 20) avgScore = 12;
  else if (avgUtilization < 30) avgScore = 10;
  else if (avgUtilization < 50) avgScore = 7;
  else if (avgUtilization < 70) avgScore = 4;
  else avgScore = 0;

  // Max utilization score (0-6 points)
  let maxScore = 0;
  if (maxUtilization < 30) maxScore = 6;
  else if (maxUtilization < 50) maxScore = 5;
  else if (maxUtilization < 70) maxScore = 3;
  else if (maxUtilization < 90) maxScore = 1;

  const totalScore = currentScore + avgScore + maxScore;

  return {
    score: Math.round(totalScore),
    evidence: {
      avgUtilization: Math.round(avgUtilization * 10) / 10,
      currentUtilization: Math.round(currentUtil * 10) / 10,
      maxUtilization: Math.round(maxUtilization * 10) / 10,
    },
  };
}

/**
 * Calculate Credit History Length Score (15% weight)
 *
 * Metrics:
 * - Wallet age (50%)
 * - Time since first DeFi interaction (50%)
 */
function calculateCreditHistoryLength(
  walletAgeInDays: number,
  firstDefiInteraction: Date | null
): {
  score: number;
  evidence: CreditScoreData['breakdown']['creditHistoryLength']['evidence'];
} {
  const now = new Date();
  const defiAgeInDays = firstDefiInteraction
    ? Math.floor((now.getTime() - firstDefiInteraction.getTime()) / (1000 * 60 * 60 * 24))
    : 0;

  // Wallet age score (0-7.5 points)
  // Excellent: >2 years, Good: >1 year, Fair: >6 months
  let walletScore = 0;
  if (walletAgeInDays >= 730) walletScore = 7.5;
  else if (walletAgeInDays >= 365) walletScore = 6;
  else if (walletAgeInDays >= 180) walletScore = 4;
  else if (walletAgeInDays >= 90) walletScore = 2;
  else walletScore = (walletAgeInDays / 90) * 2;

  // DeFi age score (0-7.5 points)
  let defiScore = 0;
  if (defiAgeInDays >= 365) defiScore = 7.5;
  else if (defiAgeInDays >= 180) defiScore = 6;
  else if (defiAgeInDays >= 90) defiScore = 4;
  else if (defiAgeInDays >= 30) defiScore = 2;
  else defiScore = (defiAgeInDays / 30) * 2;

  const totalScore = walletScore + defiScore;

  return {
    score: Math.round(totalScore * 10) / 10,
    evidence: {
      walletAgeInDays,
      firstDefiInteraction,
      defiAgeInDays,
    },
  };
}

/**
 * Calculate Credit Mix Score (10% weight)
 *
 * Metrics:
 * - Protocol diversity (50%)
 * - Asset diversity (50%)
 */
function calculateCreditMix(
  protocolsUsed: string[],
  assetTypes: string[]
): {
  score: number;
  evidence: CreditScoreData['breakdown']['creditMix']['evidence'];
} {
  // Protocol diversity (0-5 points)
  const protocolCount = new Set(protocolsUsed).size;
  let protocolScore = 0;
  if (protocolCount >= 5) protocolScore = 5;
  else if (protocolCount >= 3) protocolScore = 4;
  else if (protocolCount >= 2) protocolScore = 3;
  else if (protocolCount >= 1) protocolScore = 1.5;

  // Asset diversity (0-5 points)
  const assetCount = new Set(assetTypes).size;
  let assetScore = 0;
  if (assetCount >= 5) assetScore = 5;
  else if (assetCount >= 3) assetScore = 4;
  else if (assetCount >= 2) assetScore = 3;
  else if (assetCount >= 1) assetScore = 1.5;

  const totalScore = protocolScore + assetScore;
  const diversityScore = Math.round(((protocolCount + assetCount) / 10) * 100);

  return {
    score: Math.round(totalScore * 10) / 10,
    evidence: {
      protocolsUsed: Array.from(new Set(protocolsUsed)),
      assetTypes: Array.from(new Set(assetTypes)),
      diversityScore,
    },
  };
}

/**
 * Calculate New Credit Score (10% weight)
 *
 * Metrics:
 * - Recent loan activity (60%)
 * - Time between loans (40%)
 */
function calculateNewCredit(
  recentLoans: number,
  avgTimeBetweenLoans: number
): {
  score: number;
  evidence: CreditScoreData['breakdown']['newCredit']['evidence'];
} {
  // Recent loan activity (0-6 points)
  // Penalize too many recent loans (looks desperate)
  let recentScore = 0;
  if (recentLoans === 0) recentScore = 6;
  else if (recentLoans === 1) recentScore = 6;
  else if (recentLoans === 2) recentScore = 5;
  else if (recentLoans === 3) recentScore = 3;
  else recentScore = 1;

  // Time between loans (0-4 points)
  // Longer time between loans is better
  let timeScore = 0;
  if (avgTimeBetweenLoans >= 90) timeScore = 4;
  else if (avgTimeBetweenLoans >= 30) timeScore = 3;
  else if (avgTimeBetweenLoans >= 14) timeScore = 2;
  else if (avgTimeBetweenLoans >= 7) timeScore = 1;

  const totalScore = recentScore + timeScore;

  return {
    score: Math.round(totalScore),
    evidence: {
      recentLoans,
      hardInquiries: 0, // Placeholder
      avgTimeBetweenLoans: Math.round(avgTimeBetweenLoans),
    },
  };
}

/**
 * Calculate overall credit score (300-850 scale like FICO)
 */
export function calculateCreditScore(data: {
  lendingPositions: LendingPosition[];
  currentBorrowed: bigint;
  currentCollateral: bigint;
  avgUtilization: number;
  maxUtilization: number;
  walletAgeInDays: number;
  firstDefiInteraction: Date | null;
  protocolsUsed: string[];
  assetTypes: string[];
  recentLoans: number;
  avgTimeBetweenLoans: number;
}): CreditScoreData {
  // Calculate each component
  const paymentHistory = calculatePaymentHistory(data.lendingPositions);
  const creditUtilization = calculateCreditUtilization(
    data.currentBorrowed,
    data.currentCollateral,
    data.avgUtilization,
    data.maxUtilization
  );
  const creditHistoryLength = calculateCreditHistoryLength(
    data.walletAgeInDays,
    data.firstDefiInteraction
  );
  const creditMix = calculateCreditMix(data.protocolsUsed, data.assetTypes);
  const newCredit = calculateNewCredit(data.recentLoans, data.avgTimeBetweenLoans);

  // Calculate weighted total (out of 100 points)
  const totalPoints =
    paymentHistory.score * 0.35 +
    creditUtilization.score * 0.30 +
    creditHistoryLength.score * 0.15 +
    creditMix.score * 0.10 +
    newCredit.score * 0.10;

  // Convert to 300-850 scale
  // 0 points = 300, 100 points = 850
  const score = Math.round(300 + (totalPoints / 100) * 550);

  // Determine tier
  let tier: CreditScoreData['tier'];
  if (score >= 800) tier = 'Exceptional';
  else if (score >= 740) tier = 'Very Good';
  else if (score >= 670) tier = 'Good';
  else if (score >= 580) tier = 'Fair';
  else tier = 'Subprime';

  return {
    score,
    tier,
    breakdown: {
      paymentHistory: {
        score: paymentHistory.score,
        weight: 35,
        evidence: paymentHistory.evidence,
      },
      creditUtilization: {
        score: creditUtilization.score,
        weight: 30,
        evidence: creditUtilization.evidence,
      },
      creditHistoryLength: {
        score: creditHistoryLength.score,
        weight: 15,
        evidence: creditHistoryLength.evidence,
      },
      creditMix: {
        score: creditMix.score,
        weight: 10,
        evidence: creditMix.evidence,
      },
      newCredit: {
        score: newCredit.score,
        weight: 10,
        evidence: newCredit.evidence,
      },
    },
  };
}

/**
 * Get recommended LTV based on credit score
 */
export function getRecommendedLTV(score: number): number {
  if (score >= 800) return 90; // Exceptional
  if (score >= 740) return 80; // Very Good
  if (score >= 670) return 70; // Good
  if (score >= 580) return 60; // Fair
  return 50; // Subprime
}

/**
 * Get interest rate multiplier based on credit score
 */
export function getInterestRateMultiplier(score: number): number {
  if (score >= 800) return 0.8; // 20% discount
  if (score >= 740) return 0.9; // 10% discount
  if (score >= 670) return 1.0; // Base rate
  if (score >= 580) return 1.2; // 20% premium
  return 1.5; // 50% premium
}
