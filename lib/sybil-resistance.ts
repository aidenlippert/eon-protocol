/**
 * Sybil Resistance System
 * Prevents users from gaming the system by creating new wallets
 */

export interface LinkedWallet {
  address: string;
  linkedAt: Date;
  verified: boolean;
  isPrimary: boolean;
}

export interface ProofOfHumanity {
  verified: boolean;
  verificationId: string | null;
  verificationDate: Date | null;
  verificationLevel: 'none' | 'basic' | 'full';
}

/**
 * Calculate wallet age penalty
 * New wallets get penalized to prevent sybil attacks
 */
export function calculateWalletAgePenalty(walletAgeInDays: number): number {
  if (walletAgeInDays >= 365) return 0;      // 1+ year old - no penalty
  if (walletAgeInDays >= 180) return -50;    // 6+ months - small penalty
  if (walletAgeInDays >= 90) return -100;    // 3+ months - moderate penalty
  if (walletAgeInDays >= 30) return -200;    // 1+ month - large penalty
  return -300;                                // <1 month - maximum penalty
}

/**
 * Calculate KYC/Proof of Humanity bonus
 */
export function calculateKYCBonus(verification: ProofOfHumanity): {
  bonus: number;
  penalty: number;
  total: number;
} {
  if (!verification.verified) {
    return {
      bonus: 0,
      penalty: -150,  // MASSIVE penalty for no verification
      total: -150,
    };
  }

  const bonus = verification.verificationLevel === 'full' ? 150 : 100;

  return {
    bonus,
    penalty: 0,
    total: bonus,
  };
}

/**
 * Calculate staking bonus
 * Users who stake funds get score boost
 */
export function calculateStakingBonus(stakingAmount: bigint): number {
  const amountInUSDC = Number(stakingAmount) / 1e6; // Assuming 6 decimals

  if (amountInUSDC >= 10000) return 50;  // $10k+ staked
  if (amountInUSDC >= 5000) return 40;   // $5k+ staked
  if (amountInUSDC >= 1000) return 30;   // $1k+ staked
  if (amountInUSDC >= 100) return 25;    // $100+ staked
  return 0;                               // No stake
}

/**
 * Calculate wallet bundling bonus
 * Linking wallets shows transparency
 */
export function calculateBundlingBonus(linkedWallets: LinkedWallet[]): number {
  const walletCount = linkedWallets.length + 1; // +1 for primary wallet

  if (walletCount >= 6) return 50;  // 6+ wallets linked
  if (walletCount >= 4) return 40;  // 4-5 wallets linked
  if (walletCount >= 2) return 25;  // 2-3 wallets linked
  return 0;                          // No linked wallets
}

/**
 * Aggregate wallet bundle data
 * Combines history from all linked wallets
 */
export function aggregateWalletBundle(
  primaryWallet: string,
  linkedWallets: LinkedWallet[]
): {
  allAddresses: string[];
  oldestWalletAge: number;
  combinedTransactionCount: number;
} {
  return {
    allAddresses: [primaryWallet, ...linkedWallets.map(w => w.address)],
    oldestWalletAge: 0, // Would need to fetch actual age from chain
    combinedTransactionCount: 0, // Would need to fetch from all wallets
  };
}

/**
 * Get oldest wallet age from bundle
 * Uses the oldest wallet age to reduce penalties
 */
export function getOldestWalletAge(wallets: string[]): number {
  // This would need to fetch actual wallet ages from chain
  // For now, return 0
  return 0;
}

/**
 * Get combined protocols from all wallets
 */
export function getCombinedProtocols(wallets: string[]): string[] {
  // This would need to fetch protocols from all wallets
  // For now, return empty array
  return [];
}

/**
 * Check if wallet bundle has suspicious patterns
 */
export function detectSybilPatterns(
  linkedWallets: LinkedWallet[],
  walletAge: number,
  verificationStatus: ProofOfHumanity
): {
  isSuspicious: boolean;
  riskScore: number;
  reasons: string[];
} {
  const reasons: string[] = [];
  let riskScore = 0;

  // Check wallet age
  if (walletAge < 30) {
    reasons.push('Wallet less than 30 days old');
    riskScore += 30;
  }

  // Check verification status
  if (!verificationStatus.verified) {
    reasons.push('No Proof of Humanity verification');
    riskScore += 50;
  }

  // Check linked wallets
  if (linkedWallets.length === 0) {
    reasons.push('No linked wallets');
    riskScore += 20;
  }

  // Check for rapid linking (sybil indicator)
  const recentLinks = linkedWallets.filter(w => {
    const daysSinceLink = (Date.now() - w.linkedAt.getTime()) / (1000 * 60 * 60 * 24);
    return daysSinceLink < 7; // Linked in last 7 days
  });

  if (recentLinks.length > 3) {
    reasons.push(`${recentLinks.length} wallets linked in last 7 days`);
    riskScore += 40;
  }

  return {
    isSuspicious: riskScore > 70,
    riskScore,
    reasons,
  };
}

/**
 * Get reduced KYC penalty for established users
 * High staking + old wallet can reduce (but not eliminate) KYC penalty
 */
export function getReducedKYCPenalty(
  walletAgeInDays: number,
  stakingAmount: bigint
): number {
  const hasOldWallet = walletAgeInDays >= 365; // 1+ year old
  const hasHighStake = stakingAmount >= BigInt(10000 * 1e6); // 10,000+ USDC

  if (hasOldWallet && hasHighStake) {
    return -75; // Reduced penalty for very established users
  }

  return -150; // Full penalty
}
