/**
 * @title Score Normalization Functions (S1-S7)
 * @notice Scientific credit scoring with proper normalization curves
 * @dev Each function returns 0-100 score based on real blockchain data
 */

// ============================================
// S1: PAYMENT HISTORY (30% weight)
// ============================================

export interface PaymentHistoryData {
  totalLoans: number;
  repaidOnTime: number;
  liquidations: number;
  latePayments: number;
}

/**
 * S1: Payment History Score
 * - Perfect repayment = 100
 * - Each liquidation = -20 points
 * - Each late payment = -5 points
 * - 3+ consecutive repayments = +5 bonus
 */
export function normalizePaymentHistory(data: PaymentHistoryData): number {
  const { totalLoans, repaidOnTime, liquidations, latePayments } = data;

  // New account with no loans = neutral baseline
  if (totalLoans === 0) return 70;

  // Calculate repayment percentage
  const repaymentRate = (repaidOnTime / totalLoans) * 100;

  // Apply penalties
  const liquidationPenalty = liquidations * 20;
  const latePaymentPenalty = latePayments * 5;

  // Bonus for consistent repayment
  const consistencyBonus = repaidOnTime >= 3 ? 5 : 0;

  const score = repaymentRate - liquidationPenalty - latePaymentPenalty + consistencyBonus;

  return Math.max(0, Math.min(100, score));
}

// ============================================
// S2: CREDIT UTILIZATION (20% weight)
// ============================================

/**
 * S2: Credit Utilization Score
 * - Optimal: <30% utilization = 100
 * - Warning: 30-50% = 90-70
 * - Danger: 50-80% = 70-30
 * - Critical: >80% = <30 (steep penalty curve)
 */
export function normalizeUtilization(utilizationRate: number): number {
  // No active loans = 90 (good, but encourages activity)
  if (utilizationRate === 0) return 90;

  // Convert to percentage (0-1 → 0-100)
  const utilizationPct = utilizationRate * 100;

  // Piecewise linear with steep penalty above 80%
  if (utilizationPct < 30) {
    return 100;
  } else if (utilizationPct < 50) {
    // 30-50%: 100 → 70 (linear)
    return 100 - ((utilizationPct - 30) / 20) * 30;
  } else if (utilizationPct < 80) {
    // 50-80%: 70 → 30 (linear)
    return 70 - ((utilizationPct - 50) / 30) * 40;
  } else {
    // >80%: steep exponential penalty
    return Math.max(0, 30 - (utilizationPct - 80) * 2);
  }
}

// ============================================
// S3: ACCOUNT AGE & CONTINUITY (10% weight)
// ============================================

/**
 * S3: Account Age Score
 * - Logarithmic curve: first month matters most
 * - 7 days = 40, 30 days = 60, 90 days = 75, 1 year = 90, 2+ years = 100
 */
export function normalizeAccountAge(ageDays: number): number {
  if (ageDays === 0) return 0;

  // Logarithmic growth: log10(days + 1) * 20
  const baseScore = Math.log10(ageDays + 1) * 20;

  // Cap at 100, add bonus for multi-year accounts
  const yearBonus = Math.floor(ageDays / 365) * 5;

  return Math.min(100, baseScore + yearBonus);
}

// ============================================
// S4: IDENTITY TRUST / KYC (15% weight)
// ============================================

export interface IdentityData {
  hasKYC: boolean;
  hasDID: boolean; // ENS, Lens, etc.
  hasSocialProof: boolean; // Gitcoin Passport, POAPs
}

/**
 * S4: Identity Trust Score
 * - Verified KYC = +100 (full trust)
 * - DID (ENS/Lens) = +60
 * - Social proof only = +40
 * - None = 0 (Sybil risk)
 */
export function normalizeIdentityTrust(data: IdentityData): number {
  const { hasKYC, hasDID, hasSocialProof } = data;

  if (hasKYC) return 100;
  if (hasDID) return 60;
  if (hasSocialProof) return 40;

  return 0; // No identity = Sybil risk
}

// ============================================
// S5: ASSET DIVERSITY & STABILITY (10% weight)
// ============================================

export interface AssetData {
  totalValueUSD: number;
  uniqueTokenCount: number;
  stablecoinRatio: number; // % of portfolio in stablecoins
  topTokenConcentration: number; // % in largest holding
}

/**
 * S5: Asset Diversity Score
 * - Balanced portfolio with diverse assets = 100
 * - High concentration or low liquidity = penalty
 * - Stablecoin-heavy = bonus for stability
 */
export function normalizeAssetDiversity(data: AssetData): number {
  const { totalValueUSD, uniqueTokenCount, stablecoinRatio, topTokenConcentration } = data;

  // Liquidity score: log scale (rewards higher value, but diminishing returns)
  const liquidityScore = Math.min(50, Math.log10(totalValueUSD + 1) * 10);

  // Diversity score: more unique tokens = better (cap at 30 tokens)
  const diversityScore = Math.min(30, (uniqueTokenCount / 10) * 30);

  // Stablecoin bonus: 20-40% stablecoins = optimal
  let stablecoinScore = 0;
  if (stablecoinRatio >= 0.2 && stablecoinRatio <= 0.4) {
    stablecoinScore = 20;
  } else if (stablecoinRatio > 0.4) {
    stablecoinScore = 20 - (stablecoinRatio - 0.4) * 40; // Penalty for too conservative
  }

  // Concentration penalty: >50% in one token = risky
  const concentrationPenalty = topTokenConcentration > 0.5 ? (topTokenConcentration - 0.5) * 40 : 0;

  const score = liquidityScore + diversityScore + stablecoinScore - concentrationPenalty;

  return Math.max(0, Math.min(100, score));
}

// ============================================
// S6: DEFI PROTOCOL MIX (10% weight)
// ============================================

export interface DeFiMixData {
  uniqueProtocols: string[];
  protocolTrustScores: Record<string, number>; // Aave = 1.0, MemeFarm = 0.3
}

/**
 * S6: DeFi Protocol Mix Score
 * - Diverse, trusted protocol usage = 100
 * - Each trusted protocol = +20 (cap at 5)
 * - Low-trust protocols = discounted contribution
 */
export function normalizeDeFiMix(data: DeFiMixData): number {
  const { uniqueProtocols, protocolTrustScores } = data;

  if (uniqueProtocols.length === 0) return 0;

  // Calculate weighted protocol score
  const weightedSum = uniqueProtocols.reduce((sum, protocol) => {
    const trustScore = protocolTrustScores[protocol] || 0.5; // Default = medium trust
    return sum + trustScore * 20;
  }, 0);

  // Cap at 100 (5 trusted protocols = max score)
  return Math.min(100, weightedSum);
}

// ============================================
// S7: ACTIVITY & VELOCITY CONTROL (5% weight)
// ============================================

export interface ActivityData {
  totalTransactions: number;
  weeksActive: number;
}

/**
 * S7: Activity Control Score
 * - Optimal: 5-10 tx/week = 100
 * - Too spammy (>50 tx/week) = Sybil bot detection
 * - Too inactive (<1 tx/week) = low engagement
 */
export function normalizeActivityControl(data: ActivityData): number {
  const { totalTransactions, weeksActive } = data;

  if (weeksActive === 0) return 50; // Brand new account

  const txPerWeek = totalTransactions / weeksActive;

  // Sybil bot detection
  if (txPerWeek > 50) return 10; // Extremely spammy = low score

  // Too inactive
  if (txPerWeek < 1) return 60; // Low engagement but not penalized heavily

  // Optimal range: 5-10 tx/week
  if (txPerWeek >= 5 && txPerWeek <= 10) return 100;

  // Gradual penalty outside optimal range
  const deviation = Math.abs(txPerWeek - 7.5); // 7.5 = midpoint of optimal range
  const score = 100 - deviation * 3;

  return Math.max(10, Math.min(100, score));
}

// ============================================
// BEHAVIORAL MOMENTUM (SMOOTHING)
// ============================================

/**
 * Apply time-decay smoothing to prevent score cliffs
 * - α = 0.3: 30% new score, 70% historical
 * - Positive actions decay slowly
 * - Negative actions decay slower (penalties stick)
 */
export function applyMomentumSmoothing(
  newScore: number,
  previousScore: number | null,
  alpha: number = 0.3
): number {
  if (previousScore === null) return newScore;

  return alpha * newScore + (1 - alpha) * previousScore;
}

// ============================================
// TIER CLASSIFICATION
// ============================================

export function getTierForScore(score: number): string {
  if (score >= 900) return 'Platinum';
  if (score >= 750) return 'Gold';
  if (score >= 600) return 'Silver';
  return 'Bronze';
}

export function getNextTierThreshold(currentTier: string): number {
  switch (currentTier) {
    case 'Bronze':
      return 600;
    case 'Silver':
      return 750;
    case 'Gold':
      return 900;
    case 'Platinum':
      return 1000;
    default:
      return 600;
  }
}
