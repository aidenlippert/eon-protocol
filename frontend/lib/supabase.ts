/**
 * @title Supabase Client & Database Integration
 * @notice Persistent storage for KYC data, user preferences, and score history
 * @dev Replaces localStorage with production-grade database
 *
 * **TABLES**:
 * - kyc_verifications: Didit KYC session data
 * - user_profiles: User preferences and settings
 * - score_history: Historical credit scores for trend analysis
 * - linked_wallets: Wallet bundling for cross-wallet scoring
 */

import { createClient } from '@supabase/supabase-js';

// Initialize Supabase client
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// ==================== DATABASE TYPES ====================

export interface KYCVerification {
  id: string;
  wallet_address: string;
  session_id: string;
  session_url: string;
  workflow_id: string;
  vendor_data: string;
  status: 'pending' | 'completed' | 'failed' | 'expired';
  verified_at: string | null;
  expires_at: string | null;
  credential_hash: string | null;
  created_at: string;
  updated_at: string;
}

export interface UserProfile {
  wallet_address: string;
  display_name: string | null;
  email: string | null;
  notification_preferences: {
    email: boolean;
    browser: boolean;
    liquidation_alerts: boolean;
    score_updates: boolean;
  };
  privacy_settings: {
    public_profile: boolean;
    show_score: boolean;
    show_history: boolean;
  };
  created_at: string;
  updated_at: string;
}

export interface ScoreHistory {
  id: string;
  wallet_address: string;
  score: number;
  tier: string;
  breakdown: any; // JSON
  sybil_data: any; // JSON
  cross_chain_data: any | null; // JSON
  calculated_at: string;
  created_at: string;
}

export interface LinkedWallet {
  id: string;
  primary_wallet: string;
  linked_wallet: string;
  proof_signature: string;
  proof_message: string;
  verified: boolean;
  linked_at: string;
  created_at: string;
}

// ==================== KYC FUNCTIONS ====================

/**
 * Store KYC verification session
 */
export async function createKYCSession(data: {
  walletAddress: string;
  sessionId: string;
  sessionUrl: string;
  workflowId: string;
  vendorData: string;
}) {
  const { data: session, error } = await supabase
    .from('kyc_verifications')
    .insert([
      {
        wallet_address: data.walletAddress.toLowerCase(),
        session_id: data.sessionId,
        session_url: data.sessionUrl,
        workflow_id: data.workflowId,
        vendor_data: data.vendorData,
        status: 'pending',
      },
    ])
    .select()
    .single();

  if (error) throw error;
  return session;
}

/**
 * Update KYC verification status
 */
export async function updateKYCStatus(
  sessionId: string,
  status: 'completed' | 'failed' | 'expired',
  data?: {
    credentialHash?: string;
    verifiedAt?: string;
    expiresAt?: string;
  }
) {
  const updateData: any = {
    status,
    updated_at: new Date().toISOString(),
  };

  if (data?.credentialHash) updateData.credential_hash = data.credentialHash;
  if (data?.verifiedAt) updateData.verified_at = data.verifiedAt;
  if (data?.expiresAt) updateData.expires_at = data.expiresAt;

  const { data: updated, error } = await supabase
    .from('kyc_verifications')
    .update(updateData)
    .eq('session_id', sessionId)
    .select()
    .single();

  if (error) throw error;
  return updated;
}

/**
 * Get KYC verification for wallet
 */
export async function getKYCVerification(walletAddress: string): Promise<KYCVerification | null> {
  const { data, error } = await supabase
    .from('kyc_verifications')
    .select('*')
    .eq('wallet_address', walletAddress.toLowerCase())
    .order('created_at', { ascending: false })
    .limit(1)
    .single();

  if (error && error.code !== 'PGRST116') throw error; // Ignore "no rows" error
  return data;
}

/**
 * Check if wallet is KYC verified
 */
export async function isKYCVerified(walletAddress: string): Promise<boolean> {
  const kyc = await getKYCVerification(walletAddress);

  if (!kyc || kyc.status !== 'completed') return false;

  // Check if expired
  if (kyc.expires_at && new Date(kyc.expires_at) < new Date()) {
    return false;
  }

  return true;
}

// ==================== USER PROFILE FUNCTIONS ====================

/**
 * Create or update user profile
 */
export async function upsertUserProfile(
  walletAddress: string,
  updates: Partial<Omit<UserProfile, 'wallet_address' | 'created_at' | 'updated_at'>>
) {
  const { data, error } = await supabase
    .from('user_profiles')
    .upsert(
      {
        wallet_address: walletAddress.toLowerCase(),
        ...updates,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'wallet_address' }
    )
    .select()
    .single();

  if (error) throw error;
  return data;
}

/**
 * Get user profile
 */
export async function getUserProfile(walletAddress: string): Promise<UserProfile | null> {
  const { data, error } = await supabase
    .from('user_profiles')
    .select('*')
    .eq('wallet_address', walletAddress.toLowerCase())
    .single();

  if (error && error.code !== 'PGRST116') throw error;
  return data;
}

// ==================== SCORE HISTORY FUNCTIONS ====================

/**
 * Save score to history
 */
export async function saveScoreHistory(scoreData: {
  walletAddress: string;
  score: number;
  tier: string;
  breakdown: any;
  sybilData: any;
  crossChainData?: any;
  calculatedAt: string;
}) {
  const { data, error } = await supabase
    .from('score_history')
    .insert([
      {
        wallet_address: scoreData.walletAddress.toLowerCase(),
        score: scoreData.score,
        tier: scoreData.tier,
        breakdown: scoreData.breakdown,
        sybil_data: scoreData.sybilData,
        cross_chain_data: scoreData.crossChainData || null,
        calculated_at: scoreData.calculatedAt,
      },
    ])
    .select()
    .single();

  if (error) throw error;
  return data;
}

/**
 * Get score history for wallet
 */
export async function getScoreHistory(
  walletAddress: string,
  limit: number = 30
): Promise<ScoreHistory[]> {
  const { data, error } = await supabase
    .from('score_history')
    .select('*')
    .eq('wallet_address', walletAddress.toLowerCase())
    .order('calculated_at', { ascending: false })
    .limit(limit);

  if (error) throw error;
  return data || [];
}

/**
 * Get latest score from history
 */
export async function getLatestScore(walletAddress: string): Promise<ScoreHistory | null> {
  const { data, error } = await supabase
    .from('score_history')
    .select('*')
    .eq('wallet_address', walletAddress.toLowerCase())
    .order('calculated_at', { ascending: false })
    .limit(1)
    .single();

  if (error && error.code !== 'PGRST116') throw error;
  return data;
}

// ==================== LINKED WALLETS FUNCTIONS ====================

/**
 * Link a wallet to primary wallet
 */
export async function linkWallet(data: {
  primaryWallet: string;
  linkedWallet: string;
  proofSignature: string;
  proofMessage: string;
}) {
  const { data: linked, error } = await supabase
    .from('linked_wallets')
    .insert([
      {
        primary_wallet: data.primaryWallet.toLowerCase(),
        linked_wallet: data.linkedWallet.toLowerCase(),
        proof_signature: data.proofSignature,
        proof_message: data.proofMessage,
        verified: true, // Verified by signature
        linked_at: new Date().toISOString(),
      },
    ])
    .select()
    .single();

  if (error) throw error;
  return linked;
}

/**
 * Get linked wallets for primary wallet
 */
export async function getLinkedWallets(primaryWallet: string): Promise<LinkedWallet[]> {
  const { data, error } = await supabase
    .from('linked_wallets')
    .select('*')
    .eq('primary_wallet', primaryWallet.toLowerCase())
    .eq('verified', true)
    .order('linked_at', { ascending: false });

  if (error) throw error;
  return data || [];
}

/**
 * Unlink a wallet
 */
export async function unlinkWallet(linkedWalletId: string) {
  const { error } = await supabase
    .from('linked_wallets')
    .delete()
    .eq('id', linkedWalletId);

  if (error) throw error;
}

// ==================== ANALYTICS FUNCTIONS ====================

/**
 * Get score trend (last N entries)
 */
export async function getScoreTrend(
  walletAddress: string,
  days: number = 30
): Promise<{ date: string; score: number }[]> {
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - days);

  const { data, error } = await supabase
    .from('score_history')
    .select('calculated_at, score')
    .eq('wallet_address', walletAddress.toLowerCase())
    .gte('calculated_at', cutoffDate.toISOString())
    .order('calculated_at', { ascending: true });

  if (error) throw error;

  return (data || []).map((entry) => ({
    date: entry.calculated_at,
    score: entry.score,
  }));
}

/**
 * Get tier distribution (for leaderboard)
 */
export async function getTierDistribution(): Promise<{ tier: string; count: number }[]> {
  const { data, error } = await supabase.rpc('get_tier_distribution');

  if (error) throw error;
  return data || [];
}

// ==================== UTILITIES ====================

/**
 * Clean up old score history (keep last 90 days)
 */
export async function cleanupOldScores(walletAddress?: string) {
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - 90);

  let query = supabase
    .from('score_history')
    .delete()
    .lt('calculated_at', cutoffDate.toISOString());

  if (walletAddress) {
    query = query.eq('wallet_address', walletAddress.toLowerCase());
  }

  const { error } = await query;
  if (error) throw error;
}
