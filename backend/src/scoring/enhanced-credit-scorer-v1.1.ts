/**
 * Enhanced Credit Scoring Engine v1.1
 * Comprehensive on-chain credit scoring with crypto-native metrics
 *
 * SCORE RANGE: 300-850 (FICO-inspired)
 *
 * ENHANCED MODEL (125 points total):
 * 1. Payment History (30%) - 37.5 points max
 *    ├── On-time repayments (15%)
 *    ├── Liquidation history (8%)
 *    ├── Self-repayment ratio (4%)
 *    └── Grace period usage (3%)
 *
 * 2. Credit Utilization (25%) - 31.25 points max
 *    ├── Utilization ratio (15%)
 *    ├── Collateral quality (7%)
 *    └── Position diversification (3%)
 *
 * 3. Credit History Length (15%) - 18.75 points max
 *    ├── Wallet age (8%)
 *    ├── DeFi activity length (4%)
 *    └── Transaction consistency (3%)
 *
 * 4. Credit Mix (12%) - 15 points max
 *    ├── Protocol quality (6%)
 *    ├── Asset diversity (4%)
 *    └── DeFi category diversity (2%)
 *
 * 5. New Credit (8%) - 10 points max
 *    ├── Recent loan frequency (5%)
 *    └── Application spacing (3%)
 *
 * 6. On-Chain Reputation (10%) - 12.5 points max
 *    ├── DAO governance participation (4%)
 *    ├── Protocol contributions (3%)
 *    └── Anti-sybil score (3%)
 *
 * TOTAL: 125 points → mapped to 300-850 scale
 */

import type { Address } from 'viem';
import {
  fetchLiquidationHistory,
  calculateLiquidationScore,
  type LiquidationEvent,
} from './liquidation-tracker';
import {
  calculateProtocolScore,
  calculateCategoryDiversity,
  type ProtocolInfo,
  getProtocolByAddress,
} from './protocol-registry';
import {
  calculateAssetQualityScore,
  calculateAssetDiversity,
  getAssetByAddress,
  type AssetInfo,
} from './asset-quality';
import {
  fetchDAOParticipation,
  calculateDAOScore,
  type DAOParticipation,
} from './dao-participation';

export interface LendingPosition {
  protocol: string;
  chainId: number;
  borrowed: bigint;
  collateral: bigint;
  collateralAsset: Address;
  healthFactor: number;
  timestamp: number;
  repaid: boolean;
  liquidated: boolean;
}

export interface CreditScoreV1_1 {
  score: number; // 300-850
  tier: 'Subprime' | 'Fair' | 'Good' | 'Very Good' | 'Exceptional';
  recommendedLTV: number; // 50-90%
  interestRateMultiplier: number; // 0.8-1.5x
  breakdown: {
    paymentHistory: PaymentHistoryScore;
    creditUtilization: CreditUtilizationScore;
    creditHistoryLength: CreditHistoryLengthScore;
    creditMix: CreditMixScore;
    newCredit: NewCreditScore;
    onChainReputation: OnChainReputationScore;
  };
  metadata: {
    calculatedAt: Date;
    version: '1.1';
    dataQuality: 'high' | 'medium' | 'low';
  };
}

export interface PaymentHistoryScore {
  score: number;
  weight: number;
  maxScore: number;
  evidence: {
    totalLoans: number;
    repaidOnTime: number;
    liquidations: LiquidationEvent[];
    avgHealthFactor: number;
    selfRepaymentRatio: number;
  };
}

export interface CreditUtilizationScore {
  score: number;
  weight: number;
  maxScore: number;
  evidence: {
    avgUtilization: number;
    currentUtilization: number;
    maxUtilization: number;
    collateralQuality: number; // 0-100
    positionDiversity: number;
  };
}

export interface CreditHistoryLengthScore {
  score: number;
  weight: number;
  maxScore: number;
  evidence: {
    walletAgeInDays: number;
    firstDefiInteraction: Date | null;
    defiAgeInDays: number;
    transactionCount: number;
    avgTxPerMonth: number;
  };
}

export interface CreditMixScore {
  score: number;
  weight: number;
  maxScore: number;
  evidence: {
    protocolQuality: number;
    protocolsUsed: string[];
    assetTypes: string[];
    assetDiversity: number;
    categoryDiversity: number;
  };
}

export interface NewCreditScore {
  score: number;
  weight: number;
  maxScore: number;
  evidence: {
    recentLoans: number;
    avgTimeBetweenLoans: number;
    hardInquiries: number;
  };
}

export interface OnChainReputationScore {
  score: number;
  weight: number;
  maxScore: number;
  evidence: {
    daoVotes: number;
    daoParticipation: DAOParticipation;
    protocolContributions: number;
    sybilScore: number;
  };
}

/**
 * Calculate enhanced credit score v1.1
 */
export async function calculateEnhancedCreditScore(data: {
  userAddress: Address;
  lendingPositions: LendingPosition[];
  currentBorrowed: bigint;
  currentCollateral: bigint;
  currentCollateralAsset: Address;
  avgUtilization: number;
  maxUtilization: number;
  walletAgeInDays: number;
  firstDefiInteraction: Date | null;
  transactionCount: number;
  protocolInteractions: { address: string; chainId: number; count: number }[];
  assetHoldings: { address: string; chainId: number; valueUSD: number }[];
  recentLoans: number;
  avgTimeBetweenLoans: number;
}): Promise<CreditScoreV1_1> {
  console.log(`🔍 Calculating enhanced credit score for ${data.userAddress}...`);

  // ====================
  // 1. PAYMENT HISTORY (30% = 37.5 points)
  // ====================
  const paymentHistory = await calculatePaymentHistoryV1_1(
    data.userAddress,
    data.lendingPositions
  );

  // ====================
  // 2. CREDIT UTILIZATION (25% = 31.25 points)
  // ====================
  const creditUtilization = calculateCreditUtilizationV1_1(
    data.currentBorrowed,
    data.currentCollateral,
    data.currentCollateralAsset,
    data.avgUtilization,
    data.maxUtilization,
    data.lendingPositions
  );

  // ====================
  // 3. CREDIT HISTORY LENGTH (15% = 18.75 points)
  // ====================
  const creditHistoryLength = calculateCreditHistoryLengthV1_1(
    data.walletAgeInDays,
    data.firstDefiInteraction,
    data.transactionCount
  );

  // ====================
  // 4. CREDIT MIX (12% = 15 points)
  // ====================
  const creditMix = calculateCreditMixV1_1(
    data.protocolInteractions,
    data.assetHoldings
  );

  // ====================
  // 5. NEW CREDIT (8% = 10 points)
  // ====================
  const newCredit = calculateNewCreditV1_1(
    data.recentLoans,
    data.avgTimeBetweenLoans
  );

  // ====================
  // 6. ON-CHAIN REPUTATION (10% = 12.5 points)
  // ====================
  const onChainReputation = await calculateOnChainReputationV1_1(
    data.userAddress,
    data.protocolInteractions
  );

  // ====================
  // CALCULATE TOTAL SCORE
  // ====================
  const totalPoints =
    paymentHistory.score +
    creditUtilization.score +
    creditHistoryLength.score +
    creditMix.score +
    newCredit.score +
    onChainReputation.score;

  const maxPoints = 125; // Total possible points

  // Map to 300-850 scale (0 points = 300, 125 points = 850)
  const score = Math.round(300 + (totalPoints / maxPoints) * 550);

  // Determine tier
  let tier: CreditScoreV1_1['tier'];
  if (score >= 800) tier = 'Exceptional';
  else if (score >= 740) tier = 'Very Good';
  else if (score >= 670) tier = 'Good';
  else if (score >= 580) tier = 'Fair';
  else tier = 'Subprime';

  // Calculate recommended LTV
  const recommendedLTV = getRecommendedLTV(score);

  // Calculate interest rate multiplier
  const interestRateMultiplier = getInterestRateMultiplier(score);

  // Assess data quality
  const dataQuality = assessDataQuality(data);

  console.log(`✅ Score calculated: ${score} (${tier}) - LTV: ${recommendedLTV}%`);

  return {
    score,
    tier,
    recommendedLTV,
    interestRateMultiplier,
    breakdown: {
      paymentHistory,
      creditUtilization,
      creditHistoryLength,
      creditMix,
      newCredit,
      onChainReputation,
    },
    metadata: {
      calculatedAt: new Date(),
      version: '1.1',
      dataQuality,
    },
  };
}

/**
 * Calculate Payment History Score (30% = 37.5 points max)
 */
async function calculatePaymentHistoryV1_1(
  userAddress: Address,
  positions: LendingPosition[]
): Promise<PaymentHistoryScore> {
  const maxScore = 37.5;

  if (positions.length === 0) {
    return {
      score: 0,
      weight: 30,
      maxScore,
      evidence: {
        totalLoans: 0,
        repaidOnTime: 0,
        liquidations: [],
        avgHealthFactor: 0,
        selfRepaymentRatio: 0,
      },
    };
  }

  // Fetch liquidation history across all protocols
  const liquidations = await fetchLiquidationHistory(userAddress);
  const liquidationScore = calculateLiquidationScore(liquidations);

  const totalLoans = positions.length;
  const repaidOnTime = positions.filter((p) => p.repaid && !p.liquidated).length;
  const avgHealthFactor =
    positions.reduce((acc, p) => acc + p.healthFactor, 0) / totalLoans;

  // Self-repayment ratio (repaid before liquidation vs liquidated)
  const selfRepaid = positions.filter((p) => p.repaid && !p.liquidated).length;
  const totalClosed = positions.filter((p) => p.repaid || p.liquidated).length;
  const selfRepaymentRatio = totalClosed > 0 ? (selfRepaid / totalClosed) * 100 : 100;

  // On-time repayment score (0-18.75 points = 15% of total)
  const repaymentScore = (repaidOnTime / totalLoans) * 18.75;

  // Liquidation score (0-10 points = 8% of total)
  // Map liquidation score (-5 to 8) to our scale (0-10)
  const mappedLiquidationScore = ((liquidationScore.score + 5) / 13) * 10;

  // Self-repayment ratio score (0-5 points = 4% of total)
  const selfRepayRatioScore = (selfRepaymentRatio / 100) * 5;

  // Health factor score (0-3.75 points = 3% of total)
  let healthScore = 0;
  if (avgHealthFactor >= 2.5) healthScore = 3.75;
  else if (avgHealthFactor >= 2.0) healthScore = 3;
  else if (avgHealthFactor >= 1.5) healthScore = 2;
  else if (avgHealthFactor >= 1.2) healthScore = 1;

  const totalScore =
    repaymentScore + mappedLiquidationScore + selfRepayRatioScore + healthScore;

  return {
    score: Math.min(maxScore, Math.round(totalScore * 10) / 10),
    weight: 30,
    maxScore,
    evidence: {
      totalLoans,
      repaidOnTime,
      liquidations,
      avgHealthFactor: Math.round(avgHealthFactor * 100) / 100,
      selfRepaymentRatio: Math.round(selfRepaymentRatio * 10) / 10,
    },
  };
}

/**
 * Calculate Credit Utilization Score (25% = 31.25 points max)
 */
function calculateCreditUtilizationV1_1(
  currentBorrowed: bigint,
  currentCollateral: bigint,
  currentCollateralAsset: Address,
  avgUtilization: number,
  maxUtilization: number,
  positions: LendingPosition[]
): CreditUtilizationScore {
  const maxScore = 31.25;

  // Current utilization (borrowed / collateral * 100)
  const currentUtil =
    currentCollateral > 0n
      ? (Number(currentBorrowed) / Number(currentCollateral)) * 100
      : 0;

  // Current utilization score (0-18.75 points = 15% of total)
  let currentScore = 0;
  if (currentUtil === 0) currentScore = 18.75;
  else if (currentUtil < 20) currentScore = 18.75;
  else if (currentUtil < 30) currentScore = 15;
  else if (currentUtil < 50) currentScore = 10;
  else if (currentUtil < 70) currentScore = 5;

  // Collateral quality score (0-8.75 points = 7% of total)
  const collateralQualityData = calculateAssetQualityScore([
    {
      address: currentCollateralAsset,
      chainId: 42161, // Assume Arbitrum for now
      valueUSD: Number(currentCollateral),
    },
  ]);
  const collateralQualityScore = (collateralQualityData.weightedScore / 100) * 8.75;

  // Position diversity score (0-3.75 points = 3% of total)
  const uniqueCollaterals = new Set(positions.map((p) => p.collateralAsset.toLowerCase()));
  let diversityScore = 0;
  if (uniqueCollaterals.size >= 4) diversityScore = 3.75;
  else if (uniqueCollaterals.size === 3) diversityScore = 2.5;
  else if (uniqueCollaterals.size === 2) diversityScore = 1.5;

  const totalScore = currentScore + collateralQualityScore + diversityScore;

  return {
    score: Math.min(maxScore, Math.round(totalScore * 10) / 10),
    weight: 25,
    maxScore,
    evidence: {
      avgUtilization: Math.round(avgUtilization * 10) / 10,
      currentUtilization: Math.round(currentUtil * 10) / 10,
      maxUtilization: Math.round(maxUtilization * 10) / 10,
      collateralQuality: Math.round(collateralQualityData.weightedScore),
      positionDiversity: uniqueCollaterals.size,
    },
  };
}

/**
 * Calculate Credit History Length Score (15% = 18.75 points max)
 */
function calculateCreditHistoryLengthV1_1(
  walletAgeInDays: number,
  firstDefiInteraction: Date | null,
  transactionCount: number
): CreditHistoryLengthScore {
  const maxScore = 18.75;

  const now = new Date();
  const defiAgeInDays = firstDefiInteraction
    ? Math.floor((now.getTime() - firstDefiInteraction.getTime()) / (1000 * 60 * 60 * 24))
    : 0;

  // Wallet age score (0-10 points = 8% of total)
  let walletScore = 0;
  if (walletAgeInDays >= 730) walletScore = 10;
  else if (walletAgeInDays >= 365) walletScore = 8;
  else if (walletAgeInDays >= 180) walletScore = 5;
  else if (walletAgeInDays >= 90) walletScore = 2.5;
  else walletScore = (walletAgeInDays / 90) * 2.5;

  // DeFi age score (0-5 points = 4% of total)
  let defiScore = 0;
  if (defiAgeInDays >= 365) defiScore = 5;
  else if (defiAgeInDays >= 180) defiScore = 4;
  else if (defiAgeInDays >= 90) defiScore = 2.5;
  else defiScore = (defiAgeInDays / 90) * 2.5;

  // Transaction consistency score (0-3.75 points = 3% of total)
  const avgTxPerMonth = walletAgeInDays > 0 ? (transactionCount / walletAgeInDays) * 30 : 0;
  let consistencyScore = 0;
  if (avgTxPerMonth >= 10) consistencyScore = 3.75;
  else if (avgTxPerMonth >= 5) consistencyScore = 2.5;
  else if (avgTxPerMonth >= 2) consistencyScore = 1.5;

  const totalScore = walletScore + defiScore + consistencyScore;

  return {
    score: Math.min(maxScore, Math.round(totalScore * 10) / 10),
    weight: 15,
    maxScore,
    evidence: {
      walletAgeInDays,
      firstDefiInteraction,
      defiAgeInDays,
      transactionCount,
      avgTxPerMonth: Math.round(avgTxPerMonth * 10) / 10,
    },
  };
}

/**
 * Calculate Credit Mix Score (12% = 15 points max)
 */
function calculateCreditMixV1_1(
  protocolInteractions: { address: string; chainId: number; count: number }[],
  assetHoldings: { address: string; chainId: number; valueUSD: number }[]
): CreditMixScore {
  const maxScore = 15;

  // Protocol quality score (0-7.5 points = 6% of total)
  const protocolScore = calculateProtocolScore(protocolInteractions);
  const normalizedProtocolScore = (protocolScore.score / 30) * 7.5;

  // Protocol category diversity (0-2.5 points = 2% of total)
  const protocols = protocolInteractions
    .map((p) => getProtocolByAddress(p.address, p.chainId))
    .filter((p) => p !== null) as ProtocolInfo[];
  const categoryDiversityScore = (calculateCategoryDiversity(protocols) / 10) * 2.5;

  // Asset diversity score (0-5 points = 4% of total)
  const assets = assetHoldings
    .map((h) => getAssetByAddress(h.address, h.chainId))
    .filter((a) => a !== null) as AssetInfo[];
  const assetDiversityScore = (calculateAssetDiversity(assets) / 10) * 5;

  const totalScore =
    normalizedProtocolScore + categoryDiversityScore + assetDiversityScore;

  const protocolsUsed = [...new Set(protocols.map((p) => p.name))];
  const assetTypes = [...new Set(assets.map((a) => a.symbol))];

  return {
    score: Math.min(maxScore, Math.round(totalScore * 10) / 10),
    weight: 12,
    maxScore,
    evidence: {
      protocolQuality: Math.round(protocolScore.score),
      protocolsUsed,
      assetTypes,
      assetDiversity: assets.length,
      categoryDiversity: protocols.length,
    },
  };
}

/**
 * Calculate New Credit Score (8% = 10 points max)
 */
function calculateNewCreditV1_1(
  recentLoans: number,
  avgTimeBetweenLoans: number
): NewCreditScore {
  const maxScore = 10;

  // Recent loan activity (0-6.25 points = 5% of total)
  let recentScore = 0;
  if (recentLoans === 0) recentScore = 6.25;
  else if (recentLoans === 1) recentScore = 6.25;
  else if (recentLoans === 2) recentScore = 5;
  else if (recentLoans === 3) recentScore = 3;
  else recentScore = 1;

  // Time between loans (0-3.75 points = 3% of total)
  let timeScore = 0;
  if (avgTimeBetweenLoans >= 90) timeScore = 3.75;
  else if (avgTimeBetweenLoans >= 30) timeScore = 2.5;
  else if (avgTimeBetweenLoans >= 14) timeScore = 1.5;

  const totalScore = recentScore + timeScore;

  return {
    score: Math.min(maxScore, Math.round(totalScore * 10) / 10),
    weight: 8,
    maxScore,
    evidence: {
      recentLoans,
      avgTimeBetweenLoans: Math.round(avgTimeBetweenLoans),
      hardInquiries: 0, // Placeholder
    },
  };
}

/**
 * Calculate On-Chain Reputation Score (10% = 12.5 points max)
 */
async function calculateOnChainReputationV1_1(
  userAddress: Address,
  protocolInteractions: { address: string; chainId: number; count: number }[]
): Promise<OnChainReputationScore> {
  const maxScore = 12.5;

  // DAO participation score (0-5 points = 4% of total)
  const daoParticipation = await fetchDAOParticipation(userAddress);
  const daoScore = calculateDAOScore(daoParticipation);
  const normalizedDAOScore = (daoScore.score / 4) * 5;

  // Protocol contributions score (0-3.75 points = 3% of total)
  // Based on number of unique protocols interacted with
  const uniqueProtocols = new Set(
    protocolInteractions.map((p) => `${p.chainId}:${p.address.toLowerCase()}`)
  );
  let contributionScore = 0;
  if (uniqueProtocols.size >= 10) contributionScore = 3.75;
  else if (uniqueProtocols.size >= 7) contributionScore = 3;
  else if (uniqueProtocols.size >= 5) contributionScore = 2;
  else if (uniqueProtocols.size >= 3) contributionScore = 1;

  // Anti-sybil score (0-3.75 points = 3% of total)
  // For now, simple heuristic: wallet age + transaction count
  // TODO: More sophisticated sybil detection in v2.0
  const sybilScore = 3.75; // Placeholder (assume not sybil)

  const totalScore = normalizedDAOScore + contributionScore + sybilScore;

  return {
    score: Math.min(maxScore, Math.round(totalScore * 10) / 10),
    weight: 10,
    maxScore,
    evidence: {
      daoVotes: daoParticipation.totalVotes,
      daoParticipation,
      protocolContributions: uniqueProtocols.size,
      sybilScore: Math.round(sybilScore * 10) / 10,
    },
  };
}

/**
 * Get recommended LTV based on credit score
 */
function getRecommendedLTV(score: number): number {
  if (score >= 820) return 90; // Exceptional (Platinum)
  if (score >= 750) return 75; // Very Good (Gold)
  if (score >= 600) return 65; // Good (Silver)
  if (score >= 450) return 50; // Fair (Bronze)
  return 0; // Too risky
}

/**
 * Get interest rate multiplier based on credit score
 */
function getInterestRateMultiplier(score: number): number {
  if (score >= 820) return 0.8; // 20% discount (Platinum)
  if (score >= 750) return 0.9; // 10% discount (Gold)
  if (score >= 670) return 1.0; // Base rate
  if (score >= 580) return 1.2; // 20% premium
  return 1.5; // 50% premium
}

/**
 * Assess data quality
 */
function assessDataQuality(data: {
  lendingPositions: LendingPosition[];
  transactionCount: number;
  protocolInteractions: { address: string; chainId: number; count: number }[];
}): 'high' | 'medium' | 'low' {
  let qualityScore = 0;

  // At least 5 lending positions
  if (data.lendingPositions.length >= 5) qualityScore += 3;
  else if (data.lendingPositions.length >= 2) qualityScore += 2;
  else if (data.lendingPositions.length >= 1) qualityScore += 1;

  // At least 100 transactions
  if (data.transactionCount >= 100) qualityScore += 3;
  else if (data.transactionCount >= 50) qualityScore += 2;
  else if (data.transactionCount >= 10) qualityScore += 1;

  // At least 5 protocol interactions
  if (data.protocolInteractions.length >= 5) qualityScore += 3;
  else if (data.protocolInteractions.length >= 3) qualityScore += 2;
  else if (data.protocolInteractions.length >= 1) qualityScore += 1;

  if (qualityScore >= 7) return 'high';
  if (qualityScore >= 4) return 'medium';
  return 'low';
}
