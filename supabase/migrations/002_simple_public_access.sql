-- Simplified schema with public read access
-- This allows the frontend to work without authentication
-- Run this AFTER running 001_initial_schema.sql

-- ==================== PUBLIC READ POLICIES ====================

-- Drop existing restrictive policies
DROP POLICY IF EXISTS "Users can read own KYC data" ON kyc_verifications;
DROP POLICY IF EXISTS "Service role can manage KYC data" ON kyc_verifications;
DROP POLICY IF EXISTS "Users can manage own profile" ON user_profiles;
DROP POLICY IF EXISTS "Users can read own score history" ON score_history;
DROP POLICY IF EXISTS "Service role can insert score history" ON score_history;
DROP POLICY IF EXISTS "Users can read own linked wallets" ON linked_wallets;
DROP POLICY IF EXISTS "Users can link wallets" ON linked_wallets;
DROP POLICY IF EXISTS "Users can unlink wallets" ON linked_wallets;

-- Create public read policies (for development)
-- TODO: Restrict these in production

-- KYC Verifications - Public read
CREATE POLICY "Public read KYC" ON kyc_verifications
  FOR SELECT
  USING (true);

CREATE POLICY "Public insert KYC" ON kyc_verifications
  FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Public update KYC" ON kyc_verifications
  FOR UPDATE
  USING (true);

-- User Profiles - Public read/write
CREATE POLICY "Public read profiles" ON user_profiles
  FOR SELECT
  USING (true);

CREATE POLICY "Public upsert profiles" ON user_profiles
  FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Public update profiles" ON user_profiles
  FOR UPDATE
  USING (true);

-- Score History - Public read
CREATE POLICY "Public read score history" ON score_history
  FOR SELECT
  USING (true);

CREATE POLICY "Public insert score history" ON score_history
  FOR INSERT
  WITH CHECK (true);

-- Linked Wallets - Public read
CREATE POLICY "Public read linked wallets" ON linked_wallets
  FOR SELECT
  USING (true);

CREATE POLICY "Public insert linked wallets" ON linked_wallets
  FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Public delete linked wallets" ON linked_wallets
  FOR DELETE
  USING (true);

-- ==================== COMMENTS ====================

COMMENT ON POLICY "Public read KYC" ON kyc_verifications IS 'Temporary public access for development - restrict in production';
COMMENT ON POLICY "Public read score history" ON score_history IS 'Temporary public access for development - restrict in production';
