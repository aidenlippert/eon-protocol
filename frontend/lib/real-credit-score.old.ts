/**
 * @title Real Credit Score Calculator
 * @notice Modular scoring engine with 5 factors (S1-S5)
 * @dev Production-ready on-chain credit bureau intelligence
 */

import { getWalletBalance, getAccountAgeDays } from './blockchain';
import {
  getUserVaultData,
  analyzeLoanHistory,
  calculateUtilization,
  getOnChainScore,
} from './contract-data';

// ============================================
// SCORING FRAMEWORK
// ============================================

/**
 * Credit Score Factors (0-1000 scale)
 *
 * S1: Payment History (35%) - Most important
 * S2: Credit Utilization (30%) - Debt-to-collateral ratio
 * S3: Account Maturity (15%) - Wallet age
 * S4: DeFi Mix (10%) - Protocol diversity
 * S5: Network Reputation (10%) - Sybil resistance
 */

const WEIGHTS = {
  paymentHistory: 0.35,
  creditUtilization: 0.30,
  creditHistoryLength: 0.15,
  creditMix: 0.10,
  newCredit: 0.10,
};

// ============================================
// NORMALIZATION FUNCTIONS (0-100 scale)
// ============================================

/**
 * S1: Payment History Score
 * Perfect repayment = 100, liquidations heavily penalize
 */
function normalizePaymentHistory(data: {
  totalLoans: number;
  repaidOnTime: number;
  liquidations: number;
}): number {
  if (data.totalLoans === 0) return 50; // Neutral baseline

  // Calculate repayment rate
  const repaymentRate = data.repaidOnTime / data.totalLoans;

  // Base score from repayment rate (0-100)
  let score = repaymentRate * 100;

  // Penalize liquidations heavily (-20 points per liquidation)
  score -= data.liquidations * 20;

  // Clamp to 0-100
  return Math.max(0, Math.min(100, score));
}

/**
 * S2: Credit Utilization Score
 * Lower utilization = higher score (inverse relationship)
 * Optimal: <30% utilization
 */
function normalizeUtilization(utilizationRate: number): number {
  if (utilizationRate === 0) return 100; // No debt = perfect

  // Inverse scoring: 0% = 100, 100% = 0
  // Bonus for keeping under 30%
  if (utilizationRate <= 30) {
    return 100 - utilizationRate * 0.5; // Slow decay
  } else if (utilizationRate <= 70) {
    return 85 - (utilizationRate - 30) * 1.5; // Moderate decay
  } else {
    return Math.max(0, 25 - (utilizationRate - 70) * 0.8); // Fast decay
  }
}

/**
 * S3: Account Maturity Score
 * Older accounts = more trustworthy
 * Max score at 3 years (1095 days)
 */
function normalizeAccountAge(ageDays: number): number {
  if (ageDays === 0) return 0; // Brand new wallet

  // Logarithmic growth (early gains, then plateaus)
  const maxDays = 1095; // 3 years
  const normalizedAge = Math.min(ageDays / maxDays, 1);

  // Apply logarithmic curve: log(1 + x) / log(2)
  const score = (Math.log(1 + normalizedAge * 9) / Math.log(10)) * 100;

  return Math.min(100, Math.round(score));
}

/**
 * S4: DeFi Mix Score
 * More protocols = more sophisticated user
 * Diminishing returns after 5 protocols
 */
function normalizeDeFiMix(uniqueProtocols: number): number {
  if (uniqueProtocols === 0) return 20; // Baseline for no activity

  // Logarithmic scaling: 1 protocol = 40, 5 protocols = 80, 10+ = 100
  const score = 40 + Math.log(uniqueProtocols) * 30;

  return Math.min(100, Math.round(score));
}

/**
 * S5: New Credit Inquiries Score
 * Too many recent loans = risky behavior
 * Optimal: 1-2 recent loans
 */
function normalizeNewCredit(recentLoans: number): number {
  if (recentLoans === 0) return 80; // No recent activity = neutral

  // Optimal: 1-2 loans = 100
  // Penalize heavily for >3 loans (desperation signal)
  if (recentLoans <= 2) {
    return 100;
  } else if (recentLoans <= 5) {
    return 100 - (recentLoans - 2) * 15; // -15 per extra loan
  } else {
    return Math.max(0, 55 - (recentLoans - 5) * 10); // Heavy penalty
  }
}

// ============================================
// MAIN SCORING ENGINE
// ============================================

export async function calculateCreditScore(address: string, transactions: any[]) {
  try {
    // ========================================
    // DATA COLLECTION PHASE
    // ========================================

    console.log(`[Credit Engine] Calculating score for ${address}`);

    // 1. Fetch wallet-level data
    const balancePromise = getWalletBalance(address);
    const accountAgePromise = getAccountAgeDays(address);

    // 2. Fetch contract data
    const vaultDataPromise = getUserVaultData(address);
    const loanHistoryPromise = analyzeLoanHistory(address);
    const utilizationPromise = calculateUtilization(address);

    // 3. Check for existing on-chain score
    const onChainScorePromise = getOnChainScore(address);

    // Parallel execution for performance
    const [
      balance,
      accountAgeDays,
      vaultData,
      loanHistory,
      utilization,
      onChainScore,
    ] = await Promise.all([
      balancePromise,
      accountAgePromise,
      vaultDataPromise,
      loanHistoryPromise,
      utilizationPromise,
      onChainScorePromise,
    ]);

    console.log('[Credit Engine] Data collected:', {
      balance,
      accountAgeDays,
      totalCollateral: vaultData.totalCollateral.toString(),
      activeLoans: vaultData.activeLoans.length,
      loanHistory,
      utilization,
      onChainScore: onChainScore.score,
    });

    // ========================================
    // FACTOR CALCULATION PHASE (S1-S5)
    // ========================================

    // S1: Payment History (35%)
    const paymentScore = normalizePaymentHistory({
      totalLoans: loanHistory.totalLoans,
      repaidOnTime: loanHistory.repaidOnTime,
      liquidations: loanHistory.liquidations,
    });

    // S2: Credit Utilization (30%)
    const utilizationScore = normalizeUtilization(utilization.utilizationRate);

    // S3: Account Maturity (15%)
    const historyScore = normalizeAccountAge(accountAgeDays);

    // S4: DeFi Mix (10%)
    // For MVP: count active loans as proxy for protocol diversity
    const uniqueProtocols = Math.max(1, vaultData.activeLoans.length);
    const mixScore = normalizeDeFiMix(uniqueProtocols);

    // S5: New Credit (10%)
    // Count loans started in last 30 days
    const thirtyDaysAgo = Math.floor(Date.now() / 1000) - 30 * 24 * 60 * 60;
    const recentLoans = vaultData.activeLoans.filter(
      (loan) => Number(loan.startTimestamp) > thirtyDaysAgo
    ).length;
    const newCreditScore = normalizeNewCredit(recentLoans);

    // ========================================
    // WEIGHTED SCORE AGGREGATION
    // ========================================

    const weightedScore =
      paymentScore * WEIGHTS.paymentHistory +
      utilizationScore * WEIGHTS.creditUtilization +
      historyScore * WEIGHTS.creditHistoryLength +
      mixScore * WEIGHTS.creditMix +
      newCreditScore * WEIGHTS.newCredit;

    // Scale to 0-1000
    const finalScore = Math.round(weightedScore * 10);

    // ========================================
    // FALLBACK: Use on-chain score if available and higher
    // ========================================

    const computedScore = onChainScore.hasScore
      ? Math.max(finalScore, onChainScore.score * 10) // On-chain is 0-100 scale
      : finalScore;

    console.log('[Credit Engine] Score calculation complete:', {
      paymentScore,
      utilizationScore,
      historyScore,
      mixScore,
      newCreditScore,
      weightedScore,
      finalScore,
      computedScore,
    });

    // ========================================
    // RETURN DETAILED BREAKDOWN
    // ========================================

    return {
      score: computedScore,
      breakdown: {
        paymentHistory: {
          score: paymentScore,
          weight: 35,
          details:
            loanHistory.totalLoans > 0
              ? `${loanHistory.repaidOnTime}/${loanHistory.totalLoans} loans repaid on time`
              : 'No loan history found on-chain',
          evidence: {
            totalLoans: loanHistory.totalLoans,
            repaidOnTime: loanHistory.repaidOnTime,
            liquidations: loanHistory.liquidations,
            avgRepaymentTime: loanHistory.avgRepaymentTime,
          },
        },
        creditUtilization: {
          score: utilizationScore,
          weight: 30,
          details:
            utilization.totalCollateral > 0
              ? `${utilization.utilizationRate.toFixed(1)}% of collateral utilized`
              : 'No collateral deposited',
          evidence: {
            totalCollateral: utilization.totalCollateral,
            utilizedCollateral: utilization.utilizedCollateral,
            utilizationRate: utilization.utilizationRate,
          },
        },
        creditHistoryLength: {
          score: historyScore,
          weight: 15,
          details:
            accountAgeDays > 0
              ? `Wallet active for ${accountAgeDays} days`
              : 'New wallet (no on-chain history)',
          evidence: {
            accountAgeDays,
            firstTransactionDate: accountAgeDays > 0 ? new Date(Date.now() - accountAgeDays * 24 * 60 * 60 * 1000).toISOString() : null,
          },
        },
        creditMix: {
          score: mixScore,
          weight: 10,
          details: `Active across ${uniqueProtocols} protocol${uniqueProtocols !== 1 ? 's' : ''}`,
          evidence: {
            uniqueProtocols,
            protocolTypes: ['CreditVault'], // MVP: only our protocol
            protocolsUsed: ['EON Protocol'],
            assetTypes: vaultData.activeLoans.map((l) => l.collateralToken),
          },
        },
        newCredit: {
          score: newCreditScore,
          weight: 10,
          details: `${recentLoans} loan${recentLoans !== 1 ? 's' : ''} in last 30 days`,
          evidence: {
            recentLoans,
            lastLoanDate:
              vaultData.activeLoans.length > 0
                ? new Date(
                    Number(vaultData.activeLoans[0].startTimestamp) * 1000
                  ).toISOString()
                : null,
          },
        },
      },
    };
  } catch (error) {
    console.error('[Credit Engine] Error calculating score:', error);

    // Graceful fallback
    return {
      score: 0,
      breakdown: {
        paymentHistory: {
          score: 50,
          weight: 35,
          details: 'Error fetching data - using baseline',
          evidence: { totalLoans: 0, repaidOnTime: 0, liquidations: 0, avgRepaymentTime: 0 },
        },
        creditUtilization: {
          score: 50,
          weight: 30,
          details: 'Error fetching data - using baseline',
          evidence: { totalCollateral: 0, utilizedCollateral: 0, utilizationRate: 0 },
        },
        creditHistoryLength: {
          score: 50,
          weight: 15,
          details: 'Error fetching data - using baseline',
          evidence: { accountAgeDays: 0, firstTransactionDate: null },
        },
        creditMix: {
          score: 50,
          weight: 10,
          details: 'Error fetching data - using baseline',
          evidence: { uniqueProtocols: 0, protocolTypes: [], protocolsUsed: [], assetTypes: [] },
        },
        newCredit: {
          score: 50,
          weight: 10,
          details: 'Error fetching data - using baseline',
          evidence: { recentLoans: 0, lastLoanDate: null },
        },
      },
    };
  }
}
