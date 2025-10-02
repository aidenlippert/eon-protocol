-- ============================================
-- EON PROTOCOL DATABASE SCHEMA
-- Supabase PostgreSQL Setup
-- ============================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================
-- CLAIMS TABLE
-- Stores all temporal ownership claims
-- ============================================
CREATE TABLE claims (
    id TEXT PRIMARY KEY,
    user_address TEXT NOT NULL,
    min_balance TEXT NOT NULL,
    start_block INTEGER NOT NULL,
    end_block INTEGER NOT NULL,
    merkle_root TEXT NOT NULL,
    stake TEXT NOT NULL,
    challenge_deadline BIGINT NOT NULL,
    status TEXT NOT NULL CHECK (status IN ('PENDING', 'CHALLENGED', 'ACCEPTED', 'REJECTED', 'INVALIDATED')),

    -- Validation data
    validated BOOLEAN DEFAULT FALSE,
    validation_result BOOLEAN,
    reputation_score INTEGER,

    -- Challenge data
    challenged_by TEXT,
    challenged_at TIMESTAMP,

    -- Timestamps
    block_number INTEGER NOT NULL,
    transaction_hash TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    finalized_at TIMESTAMP
);

-- Indexes for fast queries
CREATE INDEX idx_claims_user ON claims(user_address);
CREATE INDEX idx_claims_status ON claims(status);
CREATE INDEX idx_claims_created ON claims(created_at DESC);
CREATE INDEX idx_claims_deadline ON claims(challenge_deadline);
CREATE INDEX idx_claims_validation ON claims(validated, validation_result);

-- ============================================
-- REPUTATION TABLE
-- User credit scores and reputation data
-- ============================================
CREATE TABLE reputation (
    user_address TEXT PRIMARY KEY,
    score INTEGER NOT NULL CHECK (score >= 0 AND score <= 1000),
    age_months INTEGER NOT NULL,
    last_claim_id TEXT,
    total_claims INTEGER DEFAULT 0,
    accepted_claims INTEGER DEFAULT 0,
    rejected_claims INTEGER DEFAULT 0,
    total_volume TEXT DEFAULT '0',
    risk_tier TEXT CHECK (risk_tier IN ('A', 'B', 'C', 'D', 'E', 'F')),
    is_slashed BOOLEAN DEFAULT FALSE,
    slashed_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),

    FOREIGN KEY (last_claim_id) REFERENCES claims(id)
);

-- Indexes
CREATE INDEX idx_reputation_score ON reputation(score DESC);
CREATE INDEX idx_reputation_tier ON reputation(risk_tier);
CREATE INDEX idx_reputation_updated ON reputation(updated_at DESC);

-- ============================================
-- LOANS TABLE
-- Active and historical loans
-- ============================================
CREATE TABLE loans (
    id TEXT PRIMARY KEY,
    user_address TEXT NOT NULL,
    pool_type INTEGER NOT NULL CHECK (pool_type IN (0, 1, 2)),
    collateral_amount TEXT NOT NULL,
    borrow_amount TEXT NOT NULL,
    ltv INTEGER NOT NULL,
    apr INTEGER NOT NULL,
    reputation_score INTEGER NOT NULL,
    status TEXT NOT NULL CHECK (status IN ('ACTIVE', 'REPAID', 'DEFAULTED', 'LIQUIDATED')),

    -- Repayment tracking
    repaid_amount TEXT DEFAULT '0',
    interest_accrued TEXT DEFAULT '0',

    -- Timestamps
    block_number INTEGER NOT NULL,
    transaction_hash TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT NOW(),
    repaid_at TIMESTAMP,
    defaulted_at TIMESTAMP
);

-- Indexes
CREATE INDEX idx_loans_user ON loans(user_address);
CREATE INDEX idx_loans_status ON loans(status);
CREATE INDEX idx_loans_created ON loans(created_at DESC);
CREATE INDEX idx_loans_pool ON loans(pool_type, status);

-- ============================================
-- CHALLENGES TABLE
-- Challenge activity and outcomes
-- ============================================
CREATE TABLE challenges (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    claim_id TEXT NOT NULL,
    challenger_address TEXT NOT NULL,
    stake TEXT NOT NULL,
    outcome TEXT CHECK (outcome IN ('PENDING', 'CHALLENGER_WON', 'USER_WON')),

    -- Evidence
    zk_proof TEXT,
    validation_data JSONB,

    -- Timestamps
    block_number INTEGER NOT NULL,
    transaction_hash TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT NOW(),
    resolved_at TIMESTAMP,

    FOREIGN KEY (claim_id) REFERENCES claims(id)
);

-- Indexes
CREATE INDEX idx_challenges_claim ON challenges(claim_id);
CREATE INDEX idx_challenges_challenger ON challenges(challenger_address);
CREATE INDEX idx_challenges_outcome ON challenges(outcome);

-- ============================================
-- INDEXER CHECKPOINTS
-- Track blockchain sync progress
-- ============================================
CREATE TABLE checkpoints (
    id TEXT PRIMARY KEY,
    block_number INTEGER NOT NULL,
    timestamp TIMESTAMP DEFAULT NOW()
);

-- ============================================
-- CREDIT PROFILES VIEW
-- Computed view for credit scoring
-- ============================================
CREATE OR REPLACE VIEW credit_profiles AS
SELECT
    r.user_address,
    r.score,
    r.age_months,
    r.risk_tier,
    r.total_claims,
    r.accepted_claims,
    r.rejected_claims,

    -- Calculate LTV based on score
    CASE
        WHEN r.score <= 500 THEN 50
        ELSE 50 + ((r.score - 500) * 40 / 500)
    END as ltv,

    -- Active loan count
    (SELECT COUNT(*) FROM loans WHERE user_address = r.user_address AND status = 'ACTIVE') as active_loans,

    -- Total borrowed (active loans)
    COALESCE((SELECT SUM(CAST(borrow_amount AS NUMERIC)) FROM loans WHERE user_address = r.user_address AND status = 'ACTIVE'), 0) as total_borrowed,

    -- Last activity
    GREATEST(r.updated_at, (SELECT MAX(created_at) FROM loans WHERE user_address = r.user_address)) as last_activity

FROM reputation r;

-- ============================================
-- FUNCTIONS
-- ============================================

-- Update reputation score
CREATE OR REPLACE FUNCTION update_reputation_score(
    p_user_address TEXT,
    p_claim_id TEXT,
    p_score INTEGER,
    p_age_months INTEGER
) RETURNS VOID AS $$
BEGIN
    INSERT INTO reputation (user_address, score, age_months, last_claim_id, total_claims, accepted_claims, updated_at)
    VALUES (p_user_address, p_score, p_age_months, p_claim_id, 1, 1, NOW())
    ON CONFLICT (user_address)
    DO UPDATE SET
        score = EXCLUDED.score,
        age_months = EXCLUDED.age_months,
        last_claim_id = EXCLUDED.last_claim_id,
        total_claims = reputation.total_claims + 1,
        accepted_claims = reputation.accepted_claims + 1,
        updated_at = NOW();
END;
$$ LANGUAGE plpgsql;

-- Calculate decayed score
CREATE OR REPLACE FUNCTION get_decayed_score(
    p_user_address TEXT
) RETURNS INTEGER AS $$
DECLARE
    v_score INTEGER;
    v_updated_at TIMESTAMP;
    v_months_elapsed INTEGER;
    v_decay INTEGER;
BEGIN
    SELECT score, updated_at INTO v_score, v_updated_at
    FROM reputation
    WHERE user_address = p_user_address;

    IF v_score IS NULL THEN
        RETURN 0;
    END IF;

    -- Calculate decay (10 points per month)
    v_months_elapsed := EXTRACT(EPOCH FROM (NOW() - v_updated_at)) / (30 * 24 * 60 * 60);
    v_decay := v_months_elapsed * 10;

    -- Return decayed score (minimum 0)
    RETURN GREATEST(0, v_score - v_decay);
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- TRIGGERS
-- ============================================

-- Auto-update updated_at timestamps
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_claims_updated_at BEFORE UPDATE ON claims
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_reputation_updated_at BEFORE UPDATE ON reputation
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- INITIAL DATA
-- ============================================

-- Insert scanner checkpoint
INSERT INTO checkpoints (id, block_number)
VALUES ('scanner', 0)
ON CONFLICT (id) DO NOTHING;

-- ============================================
-- ROW LEVEL SECURITY (RLS)
-- Enable for production, disable for indexer
-- ============================================

-- Enable RLS on tables
ALTER TABLE claims ENABLE ROW LEVEL SECURITY;
ALTER TABLE reputation ENABLE ROW LEVEL SECURITY;
ALTER TABLE loans ENABLE ROW LEVEL SECURITY;

-- Policy: Anyone can read
CREATE POLICY "Public read access" ON claims FOR SELECT USING (true);
CREATE POLICY "Public read access" ON reputation FOR SELECT USING (true);
CREATE POLICY "Public read access" ON loans FOR SELECT USING (true);

-- Policy: Only service role can write (indexer)
CREATE POLICY "Service role write access" ON claims FOR INSERT
    WITH CHECK (auth.role() = 'service_role');
CREATE POLICY "Service role update access" ON claims FOR UPDATE
    USING (auth.role() = 'service_role');

CREATE POLICY "Service role write access" ON reputation FOR INSERT
    WITH CHECK (auth.role() = 'service_role');
CREATE POLICY "Service role update access" ON reputation FOR UPDATE
    USING (auth.role() = 'service_role');

CREATE POLICY "Service role write access" ON loans FOR INSERT
    WITH CHECK (auth.role() = 'service_role');
CREATE POLICY "Service role update access" ON loans FOR UPDATE
    USING (auth.role() = 'service_role');

-- ============================================
-- ANALYTICS VIEWS
-- ============================================

-- Protocol stats
CREATE OR REPLACE VIEW protocol_stats AS
SELECT
    (SELECT COUNT(*) FROM claims WHERE status = 'ACCEPTED') as total_claims_accepted,
    (SELECT COUNT(*) FROM claims WHERE status = 'REJECTED') as total_claims_rejected,
    (SELECT COUNT(*) FROM claims WHERE status = 'PENDING') as total_claims_pending,
    (SELECT COUNT(*) FROM loans WHERE status = 'ACTIVE') as total_active_loans,
    (SELECT COUNT(DISTINCT user_address) FROM reputation) as total_users,
    (SELECT AVG(score) FROM reputation) as avg_reputation_score,
    (SELECT COALESCE(SUM(CAST(borrow_amount AS NUMERIC)), 0) FROM loans WHERE status = 'ACTIVE') as total_tvl,
    (SELECT COALESCE(SUM(CAST(borrow_amount AS NUMERIC)), 0) FROM loans WHERE status = 'DEFAULTED') as total_bad_debt;

-- ============================================
-- COMMENTS
-- ============================================

COMMENT ON TABLE claims IS 'Temporal ownership claims submitted by users';
COMMENT ON TABLE reputation IS 'User reputation scores and credit history';
COMMENT ON TABLE loans IS 'Active and historical undercollateralized loans';
COMMENT ON TABLE challenges IS 'Challenge activity on claims';
COMMENT ON TABLE checkpoints IS 'Blockchain indexer sync checkpoints';

COMMENT ON FUNCTION update_reputation_score IS 'Update or create user reputation after claim acceptance';
COMMENT ON FUNCTION get_decayed_score IS 'Calculate reputation score with time-based decay (10 pts/month)';
