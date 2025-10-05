-- Supabase Database Schema for Eon Protocol
-- Run this in Supabase SQL Editor to create tables

-- ==================== KYC VERIFICATIONS ====================

CREATE TABLE IF NOT EXISTS kyc_verifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  wallet_address TEXT NOT NULL,
  session_id TEXT NOT NULL UNIQUE,
  session_url TEXT NOT NULL,
  workflow_id TEXT NOT NULL,
  vendor_data TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('pending', 'completed', 'failed', 'expired')),
  verified_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ,
  credential_hash TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for faster queries
CREATE INDEX idx_kyc_wallet ON kyc_verifications(wallet_address);
CREATE INDEX idx_kyc_session ON kyc_verifications(session_id);
CREATE INDEX idx_kyc_status ON kyc_verifications(status);
CREATE INDEX idx_kyc_created_at ON kyc_verifications(created_at DESC);

-- Row Level Security (RLS)
ALTER TABLE kyc_verifications ENABLE ROW LEVEL SECURITY;

-- Policy: Users can read their own KYC data
CREATE POLICY "Users can read own KYC data" ON kyc_verifications
  FOR SELECT
  USING (wallet_address = lower(auth.jwt() ->> 'wallet_address'));

-- Policy: Service role can insert/update (for API routes)
CREATE POLICY "Service role can manage KYC data" ON kyc_verifications
  FOR ALL
  USING (auth.role() = 'service_role');

-- ==================== USER PROFILES ====================

CREATE TABLE IF NOT EXISTS user_profiles (
  wallet_address TEXT PRIMARY KEY,
  display_name TEXT,
  email TEXT,
  notification_preferences JSONB NOT NULL DEFAULT '{
    "email": false,
    "browser": true,
    "liquidation_alerts": true,
    "score_updates": false
  }'::jsonb,
  privacy_settings JSONB NOT NULL DEFAULT '{
    "public_profile": false,
    "show_score": false,
    "show_history": false
  }'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_profiles_email ON user_profiles(email) WHERE email IS NOT NULL;
CREATE INDEX idx_profiles_created_at ON user_profiles(created_at DESC);

-- RLS
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;

-- Policy: Users can read/update their own profile
CREATE POLICY "Users can manage own profile" ON user_profiles
  FOR ALL
  USING (wallet_address = lower(auth.jwt() ->> 'wallet_address'));

-- ==================== SCORE HISTORY ====================

CREATE TABLE IF NOT EXISTS score_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  wallet_address TEXT NOT NULL,
  score INTEGER NOT NULL CHECK (score >= 0 AND score <= 100),
  tier TEXT NOT NULL CHECK (tier IN ('Bronze', 'Silver', 'Gold', 'Platinum')),
  breakdown JSONB NOT NULL,
  sybil_data JSONB NOT NULL,
  cross_chain_data JSONB,
  calculated_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_score_wallet ON score_history(wallet_address);
CREATE INDEX idx_score_calculated_at ON score_history(calculated_at DESC);
CREATE INDEX idx_score_wallet_calc ON score_history(wallet_address, calculated_at DESC);
CREATE INDEX idx_score_tier ON score_history(tier);

-- RLS
ALTER TABLE score_history ENABLE ROW LEVEL SECURITY;

-- Policy: Users can read their own score history
CREATE POLICY "Users can read own score history" ON score_history
  FOR SELECT
  USING (
    wallet_address = lower(auth.jwt() ->> 'wallet_address')
    OR
    -- Allow reading if user has public profile enabled
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.wallet_address = score_history.wallet_address
      AND (user_profiles.privacy_settings->>'public_profile')::boolean = true
      AND (user_profiles.privacy_settings->>'show_history')::boolean = true
    )
  );

-- Policy: Service role can insert (for API routes)
CREATE POLICY "Service role can insert score history" ON score_history
  FOR INSERT
  WITH CHECK (auth.role() = 'service_role');

-- ==================== LINKED WALLETS ====================

CREATE TABLE IF NOT EXISTS linked_wallets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  primary_wallet TEXT NOT NULL,
  linked_wallet TEXT NOT NULL,
  proof_signature TEXT NOT NULL,
  proof_message TEXT NOT NULL,
  verified BOOLEAN NOT NULL DEFAULT false,
  linked_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(primary_wallet, linked_wallet)
);

-- Indexes
CREATE INDEX idx_linked_primary ON linked_wallets(primary_wallet);
CREATE INDEX idx_linked_wallet ON linked_wallets(linked_wallet);
CREATE INDEX idx_linked_verified ON linked_wallets(verified);

-- RLS
ALTER TABLE linked_wallets ENABLE ROW LEVEL SECURITY;

-- Policy: Users can read their own linked wallets
CREATE POLICY "Users can read own linked wallets" ON linked_wallets
  FOR SELECT
  USING (
    primary_wallet = lower(auth.jwt() ->> 'wallet_address')
    OR
    linked_wallet = lower(auth.jwt() ->> 'wallet_address')
  );

-- Policy: Users can link wallets (with proof)
CREATE POLICY "Users can link wallets" ON linked_wallets
  FOR INSERT
  WITH CHECK (
    primary_wallet = lower(auth.jwt() ->> 'wallet_address')
    AND verified = true
  );

-- Policy: Users can unlink their wallets
CREATE POLICY "Users can unlink wallets" ON linked_wallets
  FOR DELETE
  USING (primary_wallet = lower(auth.jwt() ->> 'wallet_address'));

-- ==================== FUNCTIONS ====================

-- Function: Get tier distribution
CREATE OR REPLACE FUNCTION get_tier_distribution()
RETURNS TABLE (tier TEXT, count BIGINT) AS $$
BEGIN
  RETURN QUERY
  SELECT
    sh.tier,
    COUNT(DISTINCT sh.wallet_address)
  FROM (
    SELECT DISTINCT ON (wallet_address)
      wallet_address,
      tier
    FROM score_history
    ORDER BY wallet_address, calculated_at DESC
  ) sh
  GROUP BY sh.tier
  ORDER BY
    CASE sh.tier
      WHEN 'Platinum' THEN 1
      WHEN 'Gold' THEN 2
      WHEN 'Silver' THEN 3
      WHEN 'Bronze' THEN 4
    END;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function: Update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Triggers for updated_at
CREATE TRIGGER update_kyc_updated_at
  BEFORE UPDATE ON kyc_verifications
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_profile_updated_at
  BEFORE UPDATE ON user_profiles
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ==================== REALTIME ====================

-- Enable realtime for KYC status updates
ALTER PUBLICATION supabase_realtime ADD TABLE kyc_verifications;

-- Enable realtime for score updates (optional)
ALTER PUBLICATION supabase_realtime ADD TABLE score_history;

-- ==================== GRANTS ====================

-- Grant permissions to authenticated users
GRANT SELECT, INSERT, UPDATE ON kyc_verifications TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON user_profiles TO authenticated;
GRANT SELECT ON score_history TO authenticated;
GRANT SELECT, INSERT, DELETE ON linked_wallets TO authenticated;

-- Grant permissions to service role (for API routes)
GRANT ALL ON ALL TABLES IN SCHEMA public TO service_role;

-- ==================== COMMENTS ====================

COMMENT ON TABLE kyc_verifications IS 'Stores Didit KYC verification sessions and status';
COMMENT ON TABLE user_profiles IS 'User preferences and settings';
COMMENT ON TABLE score_history IS 'Historical credit scores for trend analysis';
COMMENT ON TABLE linked_wallets IS 'Wallet bundling for cross-wallet scoring';

COMMENT ON COLUMN kyc_verifications.credential_hash IS 'Hash of KYC credential from Didit (for on-chain submission)';
COMMENT ON COLUMN score_history.breakdown IS 'JSON breakdown of 5 credit factors';
COMMENT ON COLUMN score_history.sybil_data IS 'JSON sybil resistance data';
COMMENT ON COLUMN score_history.cross_chain_data IS 'JSON cross-chain aggregation data';

-- ==================== INITIAL DATA ====================

-- Insert sample tier distribution (optional, for testing)
-- INSERT INTO score_history (wallet_address, score, tier, breakdown, sybil_data, calculated_at)
-- VALUES
--   ('0x0000000000000000000000000000000000000001', 95, 'Platinum', '{}'::jsonb, '{}'::jsonb, NOW()),
--   ('0x0000000000000000000000000000000000000002', 80, 'Gold', '{}'::jsonb, '{}'::jsonb, NOW()),
--   ('0x0000000000000000000000000000000000000003', 65, 'Silver', '{}'::jsonb, '{}'::jsonb, NOW()),
--   ('0x0000000000000000000000000000000000000004', 50, 'Bronze', '{}'::jsonb, '{}'::jsonb, NOW());

COMMENT ON DATABASE postgres IS 'Eon Protocol - On-Chain Credit Scoring System';
