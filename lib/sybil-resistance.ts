/**
 * Sybil Resistance System
 *
 * Multi-layered approach to prevent score gaming:
 * 1. Didit KYC verification (FREE, real identity verification)
 * 2. Wallet bundling (link wallets to aggregate reputation)
 * 3. Economic penalties for new wallets
 * 4. Staking requirements for score boost
 * 5. Cross-chain reputation tracking
 */

import { type DiditVerification, calculateKYCBonus, getReducedKYCPenalty } from './didit-kyc';

export interface ProofOfHumanity {
  verified: boolean;
  provider: 'didit' | 'gitcoin' | 'worldcoin' | 'holonym' | 'none';
  verificationDate: Date | null;
  humanityScore: number; // 0-100
  kycLevel?: 'basic' | 'full' | 'none';
}

export interface LinkedWallet {
  address: string;
  linkedAt: Date;
  verified: boolean;
  isPrimary: boolean;
}

export interface WalletBundle {
  primaryWallet: string;
  linkedWallets: LinkedWallet[];
  proofOfHumanity: ProofOfHumanity;
  totalReputation: number;
  stakingAmount: bigint;
  createdAt: Date;
}

/**
 * Calculate penalty for wallet age
 *
 * New wallets get MASSIVE penalties to prevent farming
 * - 0-30 days: -300 points (max penalty)
 * - 31-90 days: -200 points
 * - 91-180 days: -100 points
 * - 181-365 days: -50 points
 * - 365+ days: 0 penalty
 */
export function calculateWalletAgePenalty(walletAgeInDays: number): number {
  if (walletAgeInDays < 30) return -300;
  if (walletAgeInDays < 90) return -200;
  if (walletAgeInDays < 180) return -100;
  if (walletAgeInDays < 365) return -50;
  return 0;
}

/**
 * Calculate KYC/Proof of Humanity bonus
 *
 * Verified humans get significant boost:
 * - Didit Basic KYC (ID verification): +100 points
 * - Didit Full KYC (ID + liveness): +150 points
 * - Gitcoin Passport: +100 points
 * - Worldcoin: +100 points
 * - No verification: 0 bonus (penalty applied below)
 */
export function calculateHumanityBonus(poh: ProofOfHumanity): number {
  if (!poh.verified) return 0;

  // Didit KYC gets higher bonuses
  if (poh.provider === 'didit') {
    if (poh.kycLevel === 'full') return 150; // Full KYC with liveness
    if (poh.kycLevel === 'basic') return 100; // Basic KYC (ID only)
  }

  // Other providers get base bonus
  let bonus = 100;

  // Additional bonus based on humanity score (passport stamps, etc)
  bonus += (poh.humanityScore / 100) * 50; // Up to +50 more

  return Math.round(bonus);
}

/**
 * Calculate staking bonus
 *
 * Staking shows commitment and adds cost to sybil attacks:
 * - No stake: 0 bonus
 * - 100+ USDC: +25 points
 * - 500+ USDC: +50 points
 * - 1000+ USDC: +75 points
 * - 5000+ USDC: +100 points
 */
export function calculateStakingBonus(stakingAmount: bigint): number {
  const stakeUSDC = Number(stakingAmount) / 1e6; // Convert from wei

  if (stakeUSDC >= 5000) return 100;
  if (stakeUSDC >= 1000) return 75;
  if (stakeUSDC >= 500) return 50;
  if (stakeUSDC >= 100) return 25;
  return 0;
}

/**
 * Calculate wallet bundling bonus
 *
 * Linking wallets shows transparency and prevents sybil:
 * - 1 wallet (no bundle): 0 bonus
 * - 2-3 wallets: +25 points
 * - 4-5 wallets: +40 points
 * - 6+ wallets: +50 points
 *
 * BUT: All linked wallets inherit negative history too!
 */
export function calculateBundlingBonus(linkedWallets: LinkedWallet[]): number {
  const totalWallets = linkedWallets.length;

  if (totalWallets >= 6) return 50;
  if (totalWallets >= 4) return 40;
  if (totalWallets >= 2) return 25;
  return 0;
}

/**
 * Calculate NO-KYC PENALTY
 *
 * If you don't complete KYC, you get penalized:
 * - This makes sybil attacks economically unviable
 * - Forces legitimate users to verify identity (FREE with Didit!)
 * - Verified users get bonus, unverified get MASSIVE penalty
 *
 * Can be reduced for VERY established users (1+ year old wallet + 10K+ staked)
 */
export function calculateNoVerificationPenalty(
  poh: ProofOfHumanity,
  walletAgeInDays: number = 0,
  stakingAmount: bigint = BigInt(0)
): number {
  if (poh.verified) return 0;

  // Check if user can get reduced penalty (very rare case)
  const hasOldWallet = walletAgeInDays >= 365; // 1+ year
  const hasHighStake = stakingAmount >= BigInt(10000 * 1e6); // 10,000+ USDC

  if (hasOldWallet && hasHighStake) {
    return -75; // Reduced penalty for VERY established users
  }

  return -150; // MASSIVE penalty for no KYC
}

/**
 * Apply all sybil resistance adjustments to base credit score
 */
export function applySybilResistance(
  baseScore: number,
  walletAgeInDays: number,
  poh: ProofOfHumanity,
  stakingAmount: bigint,
  linkedWallets: LinkedWallet[]
): {
  finalScore: number;
  adjustments: {
    walletAgePenalty: number;
    humanityBonus: number;
    stakingBonus: number;
    bundlingBonus: number;
    noVerificationPenalty: number;
    totalAdjustment: number;
  };
} {
  const walletAgePenalty = calculateWalletAgePenalty(walletAgeInDays);
  const humanityBonus = calculateHumanityBonus(poh);
  const stakingBonus = calculateStakingBonus(stakingAmount);
  const bundlingBonus = calculateBundlingBonus(linkedWallets);
  const noVerificationPenalty = calculateNoVerificationPenalty(poh, walletAgeInDays, stakingAmount);

  const totalAdjustment =
    walletAgePenalty +
    humanityBonus +
    stakingBonus +
    bundlingBonus +
    noVerificationPenalty;

  const finalScore = Math.max(300, Math.min(850, baseScore + totalAdjustment));

  return {
    finalScore,
    adjustments: {
      walletAgePenalty,
      humanityBonus,
      stakingBonus,
      bundlingBonus,
      noVerificationPenalty,
      totalAdjustment,
    },
  };
}

/**
 * Check if wallet is likely a sybil attack
 *
 * Red flags:
 * - Brand new wallet (<30 days)
 * - No proof of humanity
 * - No staking
 * - No linked wallets
 * - Low transaction count
 */
export function detectSybilAttack(
  walletAgeInDays: number,
  poh: ProofOfHumanity,
  stakingAmount: bigint,
  linkedWallets: LinkedWallet[],
  totalTransactions: number
): {
  isSuspicious: boolean;
  riskScore: number; // 0-100
  reasons: string[];
} {
  const reasons: string[] = [];
  let riskScore = 0;

  // New wallet
  if (walletAgeInDays < 30) {
    reasons.push('Wallet less than 30 days old');
    riskScore += 40;
  }

  // No proof of humanity
  if (!poh.verified) {
    reasons.push('No Proof of Humanity verification');
    riskScore += 30;
  }

  // No staking
  if (stakingAmount === BigInt(0)) {
    reasons.push('No staking commitment');
    riskScore += 15;
  }

  // No wallet bundling
  if (linkedWallets.length === 0) {
    reasons.push('No linked wallets');
    riskScore += 10;
  }

  // Low activity
  if (totalTransactions < 10) {
    reasons.push('Very low transaction count');
    riskScore += 20;
  }

  const isSuspicious = riskScore >= 60;

  return {
    isSuspicious,
    riskScore,
    reasons,
  };
}

/**
 * Calculate cost to farm sybil wallets
 *
 * Shows economic deterrent:
 * - Staking requirement
 * - Time cost (wallet age penalty)
 * - Gas costs for transactions
 */
export function calculateSybilAttackCost(): {
  stakingCost: number;
  timeCost: string;
  gasCost: number;
  totalCost: string;
} {
  return {
    stakingCost: 100, // Minimum $100 stake to avoid penalty
    timeCost: '6+ months', // Time to age wallet
    gasCost: 50, // Estimated gas for building history
    totalCost: '$150+ AND 6 months per wallet',
  };
}

/**
 * Recommended verification for users
 */
export function getVerificationRecommendations(
  poh: ProofOfHumanity,
  stakingAmount: bigint,
  linkedWallets: LinkedWallet[]
): string[] {
  const recommendations: string[] = [];

  if (!poh.verified) {
    recommendations.push(
      '🔴 CRITICAL: Complete FREE KYC with Didit (+100-150 points, removes -150 penalty)',
      '   Click "Verify Identity" button above to start'
    );
  } else if (poh.provider === 'didit' && poh.kycLevel === 'basic') {
    recommendations.push(
      '🟢 UPGRADE: Complete Full KYC with liveness check for +50 more points (Basic: +100 → Full: +150)'
    );
  }

  if (stakingAmount < BigInt(100 * 1e6)) {
    recommendations.push(
      '🟡 RECOMMENDED: Stake 100+ USDC for bonus (+25 points)'
    );
  }

  if (linkedWallets.length === 0) {
    recommendations.push(
      '🟡 OPTIONAL: Link additional wallets to show transparency (+25-50 points)'
    );
  }

  if (recommendations.length === 0) {
    recommendations.push('✅ You have optimal verification! No improvements needed.');
  }

  return recommendations;
}

/**
 * Convert Didit verification to ProofOfHumanity format
 */
export function diditToProofOfHumanity(didit: DiditVerification): ProofOfHumanity {
  return {
    verified: didit.verified,
    provider: didit.verified ? 'didit' : 'none',
    verificationDate: didit.verificationDate,
    humanityScore: didit.verified ? 100 : 0,
    kycLevel: didit.verificationLevel,
  };
}
