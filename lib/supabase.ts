/**
 * Supabase Client Configuration for Eon Protocol
 * Provides type-safe database access
 */

import { createClient } from '@supabase/supabase-js';

// Environment variables (with fallbacks for build time)
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://placeholder.supabase.co';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'placeholder-key';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

// Check for required environment variables at runtime (not build time)
const isBuildTime = process.env.NODE_ENV === 'production' && !process.env.NEXT_RUNTIME;
if (!isBuildTime && (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)) {
  console.warn('⚠️  Missing Supabase environment variables. Database features will not work. See SETUP.md for configuration.');
}

// Public client (for client-side operations)
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: false, // We use wallet signatures, not sessions
  },
});

// Service role client (for server-side operations with full access)
export const supabaseAdmin = supabaseServiceKey
  ? createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    })
  : null;

// ======================
// TypeScript Types
// ======================

export interface CreditScore {
  id: string;
  wallet_address: string;
  score: number;
  tier: 'Bronze' | 'Silver' | 'Gold' | 'Platinum';
  breakdown: CreditScoreBreakdown;
  sybil_adjustments?: SybilAdjustments;
  merkle_root?: string;
  on_chain_signature?: string;
  on_chain_tx_hash?: string;
  challenge_deadline?: string;
  finalized: boolean;
  calculation_version: string;
  created_at: string;
  updated_at: string;
}

export interface CreditScoreBreakdown {
  paymentHistory: {
    score: number;
    weight: number;
    evidence?: {
      onTimeRepayments?: number;
      liquidationHistory?: number;
      selfRepaymentRatio?: number;
      gracePeriodUsage?: number;
      totalLoans?: number;
      repaidOnTime?: number;
      liquidations?: number;
      avgHealthFactor?: string;
    };
  };
  creditUtilization: {
    score: number;
    weight: number;
    evidence?: {
      utilizationRatio?: number;
      collateralQuality?: number;
      positionDiversification?: number;
      currentUtilization?: number;
      avgUtilization?: number;
      maxUtilization?: number;
    };
  };
  historyLength: {
    score: number;
    weight: number;
    evidence?: {
      walletAge?: number;
      defiActivityLength?: number;
      transactionConsistency?: number;
      walletAgeInDays?: number;
      defiAgeInDays?: number;
      firstDefiInteraction?: string;
    };
  };
  creditMix: {
    score: number;
    weight: number;
    evidence?: {
      protocolQuality?: number;
      assetDiversity?: number;
      categoryDiversity?: number;
      protocolsUsed?: string[];
      assetTypes?: string[];
      diversityScore?: number;
    };
  };
  newCredit: {
    score: number;
    weight: number;
    evidence?: {
      recentLoanFrequency?: number;
      applicationSpacing?: number;
      recentLoans?: number;
      avgTimeBetweenLoans?: string;
      hardInquiries?: number;
    };
  };
  onChainReputation?: {
    score: number;
    weight: number;
    evidence?: {
      daoParticipation?: number;
      protocolContribution?: number;
      addressClustering?: number;
    };
  };
  assetHoldings?: {
    score: number;
    weight: number;
    evidence?: {
      blueChipHoldings?: number;
      nftHoldings?: number;
    };
  };
}

export interface SybilAdjustments {
  walletAgePenalty: number;
  humanityBonus: number;
  stakingBonus: number;
  bundlingBonus: number;
  crossChainBonus: number;
  noVerificationPenalty: number;
  totalAdjustment: number;
}

export interface ScoreHistory {
  id: string;
  wallet_address: string;
  score: number;
  tier: string;
  breakdown: CreditScoreBreakdown;
  change_reason: string;
  previous_score?: number;
  recorded_at: string;
}

export interface LinkedWallet {
  id: string;
  primary_wallet: string;
  linked_wallet: string;
  linked_at: string;
  verified: boolean;
  verification_tx_hash?: string;
  is_primary: boolean;
  signature?: string;
  message?: string;
}

export interface KYCVerification {
  id: string;
  wallet_address: string;
  session_id?: string;
  verification_url?: string;
  status: 'pending' | 'in_progress' | 'verified' | 'failed' | 'expired';
  verified: boolean;
  verification_level?: string;
  initiated_at: string;
  verified_at?: string;
  expires_at?: string;
  provider: string;
  provider_user_id?: string;
}

export interface EonPoints {
  id: string;
  wallet_address: string;
  total_points: number;
  lender_points: number;
  borrower_points: number;
  referral_points: number;
  bonus_points: number;
  current_multiplier: number;
  claimed: boolean;
  claimed_at?: string;
  claimed_amount?: number;
  created_at: string;
  updated_at: string;
}

export interface PointsTransaction {
  id: string;
  wallet_address: string;
  amount: number;
  type: 'earn_lender' | 'earn_borrower' | 'earn_referral' | 'earn_bonus' | 'claim' | 'adjustment';
  description?: string;
  related_tx_hash?: string;
  multiplier: number;
  created_at: string;
}

export interface LendingPosition {
  id: string;
  wallet_address: string;
  collateral_amount: string;
  borrowed_amount: string;
  collateral_asset: string;
  borrow_asset: string;
  interest_rate: number;
  accrued_interest: string;
  last_interest_update: string;
  health_factor?: number;
  ltv_ratio?: number;
  status: 'active' | 'repaid' | 'liquidated' | 'defaulted';
  opened_at: string;
  last_update_at: string;
  closed_at?: string;
  on_chain_tx_hash?: string;
  contract_address?: string;
}

export interface LiquidationEvent {
  id: string;
  position_id: string;
  wallet_address: string;
  liquidated_collateral: string;
  debt_covered: string;
  penalty_amount?: string;
  liquidator_address?: string;
  trigger_reason?: string;
  health_factor_at_liquidation?: number;
  liquidated_at: string;
  grace_period_started?: string;
  liquidation_tx_hash: string;
}

export interface ScoreChallenge {
  id: string;
  challenge_id: string;
  challenged_wallet: string;
  challenger_wallet: string;
  disputed_score: number;
  bond_amount: string;
  merkle_proof?: any;
  challenge_reason?: string;
  status: 'pending' | 'valid' | 'invalid' | 'expired';
  resolved_at?: string;
  resolution_tx_hash?: string;
  created_at: string;
  deadline: string;
}

export interface Referral {
  id: string;
  referrer_wallet: string;
  referee_wallet: string;
  status: 'pending' | 'completed' | 'expired';
  referrer_bonus?: number;
  referee_bonus?: number;
  rewarded: boolean;
  referred_at: string;
  completed_at?: string;
}

// ======================
// Database Helpers
// ======================

/**
 * Get credit score for a wallet
 */
export async function getCreditScore(walletAddress: string): Promise<CreditScore | null> {
  const { data, error } = await supabase
    .from('credit_scores')
    .select('*')
    .eq('wallet_address', walletAddress.toLowerCase())
    .single();

  if (error) {
    console.error('Error fetching credit score:', error);
    return null;
  }

  return data;
}

/**
 * Get score history for a wallet
 */
export async function getScoreHistory(walletAddress: string, limit = 10): Promise<ScoreHistory[]> {
  const { data, error } = await supabase
    .from('score_history')
    .select('*')
    .eq('wallet_address', walletAddress.toLowerCase())
    .order('recorded_at', { ascending: false })
    .limit(limit);

  if (error) {
    console.error('Error fetching score history:', error);
    return [];
  }

  return data || [];
}

/**
 * Get Eon Points balance for a wallet
 */
export async function getEonPoints(walletAddress: string): Promise<EonPoints | null> {
  const { data, error } = await supabase
    .from('eon_points')
    .select('*')
    .eq('wallet_address', walletAddress.toLowerCase())
    .single();

  if (error && error.code !== 'PGRST116') { // PGRST116 = not found
    console.error('Error fetching Eon Points:', error);
    return null;
  }

  return data;
}

/**
 * Get leaderboard (top users by score and points)
 */
export async function getLeaderboard(limit = 100) {
  const { data, error } = await supabase
    .from('leaderboard')
    .select('*')
    .limit(limit);

  if (error) {
    console.error('Error fetching leaderboard:', error);
    return [];
  }

  return data || [];
}

/**
 * Get linked wallets for a primary wallet
 */
export async function getLinkedWallets(primaryWallet: string): Promise<LinkedWallet[]> {
  const { data, error } = await supabase
    .from('linked_wallets')
    .select('*')
    .eq('primary_wallet', primaryWallet.toLowerCase());

  if (error) {
    console.error('Error fetching linked wallets:', error);
    return [];
  }

  return data || [];
}

/**
 * Get KYC verification status
 */
export async function getKYCStatus(walletAddress: string): Promise<KYCVerification | null> {
  const { data, error } = await supabase
    .from('kyc_verifications')
    .select('*')
    .eq('wallet_address', walletAddress.toLowerCase())
    .single();

  if (error && error.code !== 'PGRST116') {
    console.error('Error fetching KYC status:', error);
    return null;
  }

  return data;
}

/**
 * Get lending positions for a wallet
 */
export async function getLendingPositions(
  walletAddress: string,
  status?: LendingPosition['status']
): Promise<LendingPosition[]> {
  let query = supabase
    .from('lending_positions')
    .select('*')
    .eq('wallet_address', walletAddress.toLowerCase());

  if (status) {
    query = query.eq('status', status);
  }

  const { data, error } = await query.order('opened_at', { ascending: false });

  if (error) {
    console.error('Error fetching lending positions:', error);
    return [];
  }

  return data || [];
}

// ======================
// Utility Functions
// ======================

/**
 * Validate Ethereum address format
 */
export function isValidAddress(address: string): boolean {
  return /^0x[a-fA-F0-9]{40}$/.test(address);
}

/**
 * Normalize wallet address (lowercase)
 */
export function normalizeAddress(address: string): string {
  return address.toLowerCase();
}

/**
 * Check if database connection is healthy
 */
export async function checkDatabaseHealth(): Promise<boolean> {
  try {
    const { error } = await supabase.from('protocol_metrics').select('count').limit(1);
    return !error;
  } catch {
    return false;
  }
}
