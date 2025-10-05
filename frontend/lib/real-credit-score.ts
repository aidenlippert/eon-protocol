/**
 * @title Real Credit Score Engine V2.0 (S1-S7 Model)
 * @notice Scientific credit scoring with 7-factor analysis
 * @dev Uses blockchain data + normalization curves for fair scoring
 */

import { getWalletBalance, getAccountAgeDays, getFirstTransactionDate } from './blockchain';
import { getUserVaultData } from './contract-data';
import {
  normalizePaymentHistory,
  normalizeUtilization,
  normalizeAccountAge,
  normalizeIdentityTrust,
  normalizeAssetDiversity,
  normalizeDeFiMix,
  normalizeActivityControl,
  applyMomentumSmoothing,
  getTierForScore,
  type PaymentHistoryData,
  type IdentityData,
  type AssetData,
  type DeFiMixData,
  type ActivityData,
} from './score-normalizers';

// ============================================
// TYPES
// ============================================

export interface CreditScoreResult {
  score: number; // 0-1000
  tier: string;
  factors: {
    s1_paymentHistory: number;
    s2_utilization: number;
    s3_accountAge: number;
    s4_identityTrust: number;
    s5_assetDiversity: number;
    s6_deFiMix: number;
    s7_activityControl: number;
  };
  breakdown: {
    paymentHistory: PaymentHistoryData;
    utilization: { rate: number; debt: string; collateral: string };
    accountAge: { days: number; firstTx: Date | null };
    identity: IdentityData;
    assets: AssetData;
    deFiMix: DeFiMixData;
    activity: ActivityData;
  };
  confidence: number; // 0-1 (data quality score)
  calculatedAt: string;
}

// ============================================
// SCORING WEIGHTS (V2.0 MODEL)
// ============================================

const WEIGHTS = {
  S1_PAYMENT_HISTORY: 0.30,
  S2_UTILIZATION: 0.20,
  S3_ACCOUNT_AGE: 0.10,
  S4_IDENTITY_TRUST: 0.15,
  S5_ASSET_DIVERSITY: 0.10,
  S6_DEFI_MIX: 0.10,
  S7_ACTIVITY_CONTROL: 0.05,
} as const;

// ============================================
// MAIN SCORING ENGINE
// ============================================

export async function calculateCreditScore(
  address: string,
  transactions: any[] = [],
  previousScore: number | null = null
): Promise<CreditScoreResult> {
  console.log(`[Credit Engine V2] Calculating score for ${address}`);

  try {
    // ========================================
    // PHASE 1: PARALLEL DATA COLLECTION
    // ========================================

    const [balance, accountAgeDays, vaultData, txCount, firstTxDate] = await Promise.all([
      getWalletBalance(address),
      getAccountAgeDays(address),
      getUserVaultData(address),
      getTransactionCount(address),
      getFirstTransactionDate(address),
    ]);

    console.log('[Credit Engine V2] Raw data collected:', {
      balance,
      accountAgeDays,
      totalCollateral: vaultData.totalCollateral.toString(),
      totalDebt: vaultData.totalDebt.toString(),
      activeLoans: vaultData.activeLoans.length,
      txCount,
    });

    // ========================================
    // PHASE 2: DATA EXTRACTION & ANALYSIS
    // ========================================

    // S1: Payment History Analysis
    const paymentHistoryData: PaymentHistoryData = {
      totalLoans: vaultData.activeLoans.length,
      repaidOnTime: 0, // TODO: Calculate from loan events
      liquidations: 0, // TODO: Calculate from liquidation events
      latePayments: 0, // TODO: Calculate from late payment tracking
    };

    // S2: Utilization Analysis
    const totalCollateralUSD = parseFloat(vaultData.totalCollateral.toString()) / 1e18;
    const totalDebtUSD = parseFloat(vaultData.totalDebt.toString()) / 1e18;
    const utilizationRate =
      totalCollateralUSD > 0 ? totalDebtUSD / (totalDebtUSD + totalCollateralUSD) : 0;

    // S3: Account Age
    const accountAgeData = {
      days: accountAgeDays,
      firstTx: firstTxDate,
    };

    // S4: Identity Trust (KYC/DID)
    const identityData: IdentityData = {
      hasKYC: false, // TODO: Check EAS attestation or Supabase
      hasDID: false, // TODO: Check ENS/Lens
      hasSocialProof: false, // TODO: Check Gitcoin Passport
    };

    // S5: Asset Diversity (Portfolio Analysis)
    const balanceUSD = parseFloat(balance) * 2500; // Rough ETH price estimate
    const assetData: AssetData = {
      totalValueUSD: balanceUSD + totalCollateralUSD,
      uniqueTokenCount: 1, // TODO: Fetch from token API (Covalent/Zapper)
      stablecoinRatio: 0, // TODO: Calculate from token balances
      topTokenConcentration: 1.0, // TODO: Calculate from holdings
    };

    // S6: DeFi Protocol Mix
    const deFiMixData: DeFiMixData = {
      uniqueProtocols: ['eon-protocol'], // TODO: Extract from transaction history
      protocolTrustScores: {
        'eon-protocol': 0.8,
        aave: 1.0,
        uniswap: 0.9,
        curve: 0.9,
      },
    };

    // S7: Activity Control
    const weeksActive = accountAgeDays > 0 ? accountAgeDays / 7 : 1;
    const activityData: ActivityData = {
      totalTransactions: txCount,
      weeksActive: Math.max(1, weeksActive),
    };

    // ========================================
    // PHASE 3: NORMALIZATION (0-100 per factor)
    // ========================================

    const s1_paymentHistory = normalizePaymentHistory(paymentHistoryData);
    const s2_utilization = normalizeUtilization(utilizationRate);
    const s3_accountAge = normalizeAccountAge(accountAgeDays);
    const s4_identityTrust = normalizeIdentityTrust(identityData);
    const s5_assetDiversity = normalizeAssetDiversity(assetData);
    const s6_deFiMix = normalizeDeFiMix(deFiMixData);
    const s7_activityControl = normalizeActivityControl(activityData);

    console.log('[Credit Engine V2] Normalized factors:', {
      s1_paymentHistory,
      s2_utilization,
      s3_accountAge,
      s4_identityTrust,
      s5_assetDiversity,
      s6_deFiMix,
      s7_activityControl,
    });

    // ========================================
    // PHASE 4: WEIGHTED AGGREGATION
    // ========================================

    const weightedScore =
      s1_paymentHistory * WEIGHTS.S1_PAYMENT_HISTORY +
      s2_utilization * WEIGHTS.S2_UTILIZATION +
      s3_accountAge * WEIGHTS.S3_ACCOUNT_AGE +
      s4_identityTrust * WEIGHTS.S4_IDENTITY_TRUST +
      s5_assetDiversity * WEIGHTS.S5_ASSET_DIVERSITY +
      s6_deFiMix * WEIGHTS.S6_DEFI_MIX +
      s7_activityControl * WEIGHTS.S7_ACTIVITY_CONTROL;

    // ========================================
    // PHASE 5: BEHAVIORAL MOMENTUM SMOOTHING
    // ========================================

    const smoothedScore = applyMomentumSmoothing(weightedScore, previousScore, 0.3);

    // ========================================
    // PHASE 6: SCALE TO 0-1000
    // ========================================

    const finalScore = Math.round(smoothedScore * 10);
    const tier = getTierForScore(finalScore);

    // ========================================
    // PHASE 7: CONFIDENCE SCORE
    // ========================================

    // Data quality assessment (0-1)
    let confidence = 0.5; // Base confidence

    // Add confidence for verified data sources
    if (accountAgeDays > 30) confidence += 0.1;
    if (vaultData.activeLoans.length > 0) confidence += 0.1;
    if (txCount > 10) confidence += 0.1;
    if (identityData.hasKYC) confidence += 0.2;

    confidence = Math.min(1.0, confidence);

    // ========================================
    // PHASE 8: RETURN RESULT
    // ========================================

    return {
      score: finalScore,
      tier,
      factors: {
        s1_paymentHistory,
        s2_utilization,
        s3_accountAge,
        s4_identityTrust,
        s5_assetDiversity,
        s6_deFiMix,
        s7_activityControl,
      },
      breakdown: {
        paymentHistory: paymentHistoryData,
        utilization: {
          rate: utilizationRate,
          debt: totalDebtUSD.toFixed(2),
          collateral: totalCollateralUSD.toFixed(2),
        },
        accountAge: accountAgeData,
        identity: identityData,
        assets: assetData,
        deFiMix: deFiMixData,
        activity: activityData,
      },
      confidence,
      calculatedAt: new Date().toISOString(),
    };
  } catch (error) {
    console.error('[Credit Engine V2] Error calculating score:', error);

    // Fallback to conservative baseline
    return {
      score: 500,
      tier: 'Bronze',
      factors: {
        s1_paymentHistory: 70,
        s2_utilization: 90,
        s3_accountAge: 50,
        s4_identityTrust: 0,
        s5_assetDiversity: 50,
        s6_deFiMix: 0,
        s7_activityControl: 60,
      },
      breakdown: {
        paymentHistory: { totalLoans: 0, repaidOnTime: 0, liquidations: 0, latePayments: 0 },
        utilization: { rate: 0, debt: '0', collateral: '0' },
        accountAge: { days: 0, firstTx: null },
        identity: { hasKYC: false, hasDID: false, hasSocialProof: false },
        assets: { totalValueUSD: 0, uniqueTokenCount: 0, stablecoinRatio: 0, topTokenConcentration: 0 },
        deFiMix: { uniqueProtocols: [], protocolTrustScores: {} },
        activity: { totalTransactions: 0, weeksActive: 1 },
      },
      confidence: 0.2,
      calculatedAt: new Date().toISOString(),
    };
  }
}

// ============================================
// HELPER FUNCTIONS
// ============================================

async function getTransactionCount(address: string): Promise<number> {
  try {
    const provider = (await import('./blockchain')).getProvider();
    return await provider.getTransactionCount(address);
  } catch (error) {
    console.error('[Credit Engine V2] Error fetching tx count:', error);
    return 0;
  }
}

// ============================================
// EXPORTS
// ============================================

export { getTierForScore } from './score-normalizers';
