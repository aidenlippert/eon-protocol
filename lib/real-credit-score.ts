/**
 * Real Credit Score utilities
 * FICO-based scoring adapted for on-chain data
 */

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
  score: number;
  factors: {
    paymentHistory: number;
    creditUtilization: number;
    creditHistoryLength: number;
    creditMix: number;
    newCredit: number;
  };
  walletAge: number;
  totalTransactions: number;
  defiInteractions: number;
  liquidationCount: number;
}

/**
 * Calculate credit score from wallet data
 * Based on FICO methodology adapted for DeFi
 */
export function calculateCreditScore(
  transactions: number,
  defiInteractions: number,
  liquidations: number,
  walletAgeInDays: number,
  lendingPositions: LendingPosition[]
): CreditScoreData {
  const factors = {
    paymentHistory: Math.min(200, 200 - (liquidations * 50)), // Max 200, -50 per liquidation
    creditUtilization: 150, // Placeholder
    creditHistoryLength: Math.min(150, (walletAgeInDays / 365) * 150), // Max 150
    creditMix: Math.min(100, defiInteractions * 10), // Max 100
    newCredit: Math.max(50, 100 - (transactions < 50 ? 50 : 0)), // Max 100
  };

  const score = Math.min(850, Math.max(300,
    factors.paymentHistory +
    factors.creditUtilization +
    factors.creditHistoryLength +
    factors.creditMix +
    factors.newCredit
  ));

  return {
    score,
    factors,
    walletAge: walletAgeInDays,
    totalTransactions: transactions,
    defiInteractions,
    liquidationCount: liquidations,
  };
}

/**
 * Get recommended Loan-to-Value ratio based on credit score
 * Higher scores = higher LTV allowed
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
 * Lower scores = higher rates (higher multiplier)
 */
export function getInterestRateMultiplier(score: number): number {
  if (score >= 800) return 1.0;   // Exceptional - base rate
  if (score >= 740) return 1.1;   // Very Good - 10% premium
  if (score >= 670) return 1.25;  // Good - 25% premium
  if (score >= 580) return 1.4;   // Fair - 40% premium
  return 1.5;                      // Subprime - 50% premium
}

/**
 * Get grace period in hours based on credit score
 */
export function getGracePeriod(score: number): number {
  if (score >= 800) return 72;  // 3 days
  if (score >= 740) return 48;  // 2 days
  if (score >= 670) return 36;  // 1.5 days
  if (score >= 580) return 24;  // 1 day
  return 12;                     // 12 hours
}

/**
 * Get score tier name
 */
export function getScoreTier(score: number): string {
  if (score >= 800) return 'Exceptional';
  if (score >= 740) return 'Very Good';
  if (score >= 670) return 'Good';
  if (score >= 580) return 'Fair';
  return 'Subprime';
}
