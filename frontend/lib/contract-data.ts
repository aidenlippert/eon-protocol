/**
 * @title Contract Data Fetchers
 * @notice Query deployed contracts for user credit data
 */

import { ethers } from 'ethers';
import { getProvider, DEPLOYED_CONTRACTS } from './blockchain';
import { CREDIT_REGISTRY_ABI, SCORE_ORACLE_ABI, CREDIT_VAULT_ABI } from './contract-abis';

// ============================================
// TYPE DEFINITIONS
// ============================================

export interface LoanData {
  loanId: number;
  borrower: string;
  principal: bigint;
  collateral: bigint;
  collateralToken: string;
  aprBps: bigint;
  startTimestamp: bigint;
  active: boolean;
  graceStart?: bigint;
  debt?: bigint;
}

export interface UserVaultData {
  totalCollateral: bigint;
  activeLoans: LoanData[];
  healthFactor: bigint;
  totalDebt: bigint;
}

export interface OnChainScoreData {
  score: number;
  breakdown?: {
    paymentScore: number;
    utilizationScore: number;
    historyScore: number;
    mixScore: number;
    inquiryScore: number;
  };
  lastUpdated: number;
  hasScore: boolean;
}

// ============================================
// CONTRACT INSTANCES
// ============================================

function getCreditVaultContract() {
  const provider = getProvider();
  return new ethers.Contract(
    DEPLOYED_CONTRACTS.CreditVault,
    CREDIT_VAULT_ABI,
    provider
  );
}

function getScoreOracleContract() {
  const provider = getProvider();
  return new ethers.Contract(
    DEPLOYED_CONTRACTS.ScoreOracle,
    SCORE_ORACLE_ABI,
    provider
  );
}

// ============================================
// CREDIT VAULT DATA FETCHERS
// ============================================

/**
 * Get all vault data for a user
 */
export async function getUserVaultData(address: string): Promise<UserVaultData> {
  const contract = getCreditVaultContract();

  try {
    // Get user's total collateral
    const totalCollateral = await contract.userCollateral(address);

    // Get health factor
    const healthFactor = await contract.getUserHealthFactor(address);

    // Get total number of loans to iterate
    const nextLoanId = await contract.nextLoanId();
    const totalLoans = Number(nextLoanId);

    // Find user's active loans
    const activeLoans: LoanData[] = [];
    let totalDebt = 0n;

    // Iterate through all loans (inefficient but works for testnet)
    // In production, use event indexing (The Graph)
    for (let loanId = 0; loanId < totalLoans; loanId++) {
      try {
        const loan = await contract.loans(loanId);

        // Check if this loan belongs to the user
        if (loan.borrower.toLowerCase() === address.toLowerCase() && loan.active) {
          // Get current debt
          const debt = await contract.calculateDebt(loanId);

          activeLoans.push({
            loanId,
            borrower: loan.borrower,
            principal: loan.principal,
            collateral: loan.collateralAmount,
            collateralToken: loan.collateralToken,
            aprBps: loan.aprBps,
            startTimestamp: loan.startTimestamp,
            active: loan.active,
            graceStart: loan.graceStart,
            debt,
          });

          totalDebt += debt;
        }
      } catch (error) {
        // Loan might not exist, skip
        console.warn(`Skipping loan ${loanId}:`, error);
      }
    }

    return {
      totalCollateral,
      activeLoans,
      healthFactor,
      totalDebt,
    };
  } catch (error) {
    console.error('Error fetching vault data:', error);
    return {
      totalCollateral: 0n,
      activeLoans: [],
      healthFactor: 0n,
      totalDebt: 0n,
    };
  }
}

/**
 * Get loan count for user (approximation via iteration)
 */
export async function getUserLoanCount(address: string): Promise<number> {
  const vaultData = await getUserVaultData(address);
  return vaultData.activeLoans.length;
}

// ============================================
// SCORE ORACLE DATA FETCHERS
// ============================================

/**
 * Get on-chain stored score (if exists)
 */
export async function getOnChainScore(address: string): Promise<OnChainScoreData> {
  const contract = getScoreOracleContract();

  try {
    // Check if user has a score
    const hasScore = await contract.hasScore(address);

    if (!hasScore) {
      return {
        score: 0,
        hasScore: false,
        lastUpdated: 0,
      };
    }

    // Get score
    const score = await contract.getScore(address);

    // Try to get breakdown (may not exist on all oracle versions)
    try {
      const breakdown = await contract.getScoreBreakdown(address);
      return {
        score: Number(score),
        breakdown: {
          paymentScore: Number(breakdown.paymentScore),
          utilizationScore: Number(breakdown.utilizationScore),
          historyScore: Number(breakdown.historyScore),
          mixScore: Number(breakdown.mixScore),
          inquiryScore: Number(breakdown.inquiryScore),
        },
        lastUpdated: Number(breakdown.lastUpdated),
        hasScore: true,
      };
    } catch {
      // Breakdown not available
      return {
        score: Number(score),
        hasScore: true,
        lastUpdated: Date.now() / 1000,
      };
    }
  } catch (error) {
    console.error('Error fetching on-chain score:', error);
    return {
      score: 0,
      hasScore: false,
      lastUpdated: 0,
    };
  }
}

// ============================================
// LOAN HISTORY ANALYSIS
// ============================================

/**
 * Analyze user's loan repayment history
 */
export async function analyzeLoanHistory(address: string): Promise<{
  totalLoans: number;
  repaidOnTime: number;
  liquidations: number;
  avgRepaymentTime: number;
}> {
  const vaultData = await getUserVaultData(address);

  // For now, we can only see active loans
  // Historical data would require event indexing
  const totalLoans = vaultData.activeLoans.length;

  // If all active loans have 0 debt, they're repaid
  const repaidOnTime = vaultData.activeLoans.filter(
    (loan) => loan.debt === 0n
  ).length;

  // Liquidations would be tracked via events
  // For MVP, assume 0 liquidations
  const liquidations = 0;

  // Average repayment time requires historical data
  const avgRepaymentTime = 0;

  return {
    totalLoans,
    repaidOnTime,
    liquidations,
    avgRepaymentTime,
  };
}

/**
 * Calculate credit utilization ratio
 */
export async function calculateUtilization(address: string): Promise<{
  totalCollateral: number;
  utilizedCollateral: number;
  utilizationRate: number;
}> {
  const vaultData = await getUserVaultData(address);

  const totalCollateralBigInt = vaultData.totalCollateral;
  const totalDebtBigInt = vaultData.totalDebt;

  // Convert to numbers (in USD with 18 decimals)
  const totalCollateral = Number(ethers.formatUnits(totalCollateralBigInt, 18));
  const utilizedCollateral = Number(ethers.formatUnits(totalDebtBigInt, 18));

  const utilizationRate =
    totalCollateral > 0 ? (utilizedCollateral / totalCollateral) * 100 : 0;

  return {
    totalCollateral,
    utilizedCollateral,
    utilizationRate,
  };
}
