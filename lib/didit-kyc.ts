/**
 * Didit KYC Integration
 *
 * Free KYC verification to prevent sybil attacks
 * App ID: ad40f592-f0c7-4ee9-829d-4c0882a8640b
 */

const DIDIT_APP_ID = 'ad40f592-f0c7-4ee9-829d-4c0882a8640b';
const DIDIT_API_KEY = 'qcc188jy3-0t_MLRAQ1lfc8QXlBQeVWWEGGnJfosp0A';
const DIDIT_API_BASE = 'https://api.didit.me/v1';

export interface DiditVerification {
  verified: boolean;
  verificationId: string | null;
  verificationDate: Date | null;
  verificationLevel: 'none' | 'basic' | 'full';
  walletAddress: string;
  userId: string | null;
}

export interface DiditVerificationStatus {
  status: 'pending' | 'verified' | 'rejected' | 'expired';
  verifiedAt: Date | null;
  expiresAt: Date | null;
  verificationLevel: 'basic' | 'full';
  userData: {
    firstName?: string;
    lastName?: string;
    country?: string;
    documentType?: string;
  } | null;
}

/**
 * Initialize Didit verification for a wallet
 * Creates a verification session and returns the verification URL
 */
export async function initiateKYCVerification(walletAddress: string): Promise<{
  verificationUrl: string;
  sessionId: string;
}> {
  try {
    const response = await fetch(`${DIDIT_API_BASE}/verification/create`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': DIDIT_API_KEY,
        'X-App-ID': DIDIT_APP_ID,
      },
      body: JSON.stringify({
        walletAddress,
        verificationLevel: 'basic', // basic = ID verification, full = liveness check
        redirectUrl: `${typeof window !== 'undefined' ? window.location.origin : ''}/profile?verification=complete`,
      }),
    });

    if (!response.ok) {
      throw new Error(`Didit API error: ${response.statusText}`);
    }

    const data = await response.json();
    return {
      verificationUrl: data.verificationUrl,
      sessionId: data.sessionId,
    };
  } catch (error) {
    console.error('Failed to initiate KYC:', error);
    throw error;
  }
}

/**
 * Check KYC verification status for a wallet
 */
export async function checkKYCStatus(walletAddress: string): Promise<DiditVerification> {
  try {
    const response = await fetch(
      `${DIDIT_API_BASE}/verification/status?walletAddress=${walletAddress}`,
      {
        headers: {
          'X-API-Key': DIDIT_API_KEY,
          'X-App-ID': DIDIT_APP_ID,
        },
      }
    );

    if (!response.ok) {
      // Wallet not verified yet
      return {
        verified: false,
        verificationId: null,
        verificationDate: null,
        verificationLevel: 'none',
        walletAddress,
        userId: null,
      };
    }

    const data: DiditVerificationStatus = await response.json();

    return {
      verified: data.status === 'verified',
      verificationId: data.status === 'verified' ? walletAddress : null,
      verificationDate: data.verifiedAt ? new Date(data.verifiedAt) : null,
      verificationLevel: data.status === 'verified' ? data.verificationLevel : 'none',
      walletAddress,
      userId: data.userData ? `${data.userData.firstName}_${data.userData.lastName}` : null,
    };
  } catch (error) {
    console.error('Failed to check KYC status:', error);
    return {
      verified: false,
      verificationId: null,
      verificationDate: null,
      verificationLevel: 'none',
      walletAddress,
      userId: null,
    };
  }
}

/**
 * Calculate KYC bonus/penalty for credit score
 *
 * - No KYC: -150 points (MASSIVE penalty)
 * - Basic KYC: +100 points
 * - Full KYC (with liveness): +150 points
 */
export function calculateKYCBonus(verification: DiditVerification): {
  bonus: number;
  penalty: number;
  total: number;
} {
  if (!verification.verified) {
    return {
      bonus: 0,
      penalty: -150,
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
 * Check if wallet can skip KYC based on other factors
 * (High staking + old wallet age can reduce KYC penalty)
 */
export function canReduceKYCPenalty(
  walletAgeInDays: number,
  stakingAmount: bigint
): boolean {
  const hasOldWallet = walletAgeInDays >= 365; // 1+ year old
  const hasHighStake = stakingAmount >= BigInt(10000 * 1e6); // 10,000+ USDC

  // Can reduce penalty (but not eliminate) if both conditions met
  return hasOldWallet && hasHighStake;
}

/**
 * Get reduced KYC penalty for established users
 */
export function getReducedKYCPenalty(
  walletAgeInDays: number,
  stakingAmount: bigint
): number {
  if (!canReduceKYCPenalty(walletAgeInDays, stakingAmount)) {
    return -150; // Full penalty
  }

  // Reduced to -75 for very established users
  return -75;
}
