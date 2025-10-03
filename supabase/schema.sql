-- Eon Protocol Database Schema
-- PostgreSQL with Supabase
-- Version 1.0

-- Enable necessary extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm"; -- For fuzzy text search

-- ======================
-- CREDIT SCORES TABLE
-- ======================
CREATE TABLE credit_scores (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    wallet_address TEXT NOT NULL UNIQUE,

    -- Score components
    score INTEGER NOT NULL CHECK (score >= 300 AND score <= 850),
    tier TEXT NOT NULL CHECK (tier IN ('Bronze', 'Silver', 'Gold', 'Platinum')),

    -- Detailed breakdown (JSONB for flexibility)
    breakdown JSONB NOT NULL,
    -- Structure:
    -- {
    --   paymentHistory: { score: 85, weight: 30, evidence: {...} },
    --   creditUtilization: { score: 75, weight: 25, evidence: {...} },
    --   ...
    -- }

    -- Sybil resistance adjustments
    sybil_adjustments JSONB,
    -- Structure:
    -- {
    --   walletAgePenalty: -50,
    --   humanityBonus: 100,
    --   stakingBonus: 50,
    --   ...
    -- }

    -- Verification
    merkle_root TEXT,
    on_chain_signature TEXT,
    on_chain_tx_hash TEXT,
    challenge_deadline TIMESTAMP,
    finalized BOOLEAN DEFAULT FALSE,

    -- Metadata
    calculation_version TEXT DEFAULT 'v1.1',
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),

    -- Indexes
    CONSTRAINT valid_wallet CHECK (wallet_address ~* '^0x[a-fA-F0-9]{40}$')
);

-- Indexes for performance
CREATE INDEX idx_scores_wallet ON credit_scores(wallet_address);
CREATE INDEX idx_scores_score ON credit_scores(score DESC);
CREATE INDEX idx_scores_tier ON credit_scores(tier);
CREATE INDEX idx_scores_updated ON credit_scores(updated_at DESC);

-- ======================
-- SCORE HISTORY TABLE
-- ======================
CREATE TABLE score_history (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    wallet_address TEXT NOT NULL,

    -- Historical score data
    score INTEGER NOT NULL,
    tier TEXT NOT NULL,
    breakdown JSONB NOT NULL,

    -- Context
    change_reason TEXT, -- 'initial', 'recalculation', 'challenge', 'kyc_verified', etc.
    previous_score INTEGER,

    -- Timestamp
    recorded_at TIMESTAMP DEFAULT NOW(),

    FOREIGN KEY (wallet_address) REFERENCES credit_scores(wallet_address) ON DELETE CASCADE
);

CREATE INDEX idx_history_wallet ON score_history(wallet_address);
CREATE INDEX idx_history_timestamp ON score_history(recorded_at DESC);

-- ======================
-- LINKED WALLETS TABLE
-- ======================
CREATE TABLE linked_wallets (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    primary_wallet TEXT NOT NULL,
    linked_wallet TEXT NOT NULL,

    -- Verification
    linked_at TIMESTAMP DEFAULT NOW(),
    verified BOOLEAN DEFAULT FALSE,
    verification_tx_hash TEXT,
    is_primary BOOLEAN DEFAULT FALSE,

    -- Signature proof
    signature TEXT,
    message TEXT,

    UNIQUE(primary_wallet, linked_wallet),
    FOREIGN KEY (primary_wallet) REFERENCES credit_scores(wallet_address) ON DELETE CASCADE,
    CONSTRAINT different_wallets CHECK (primary_wallet != linked_wallet)
);

CREATE INDEX idx_linked_primary ON linked_wallets(primary_wallet);
CREATE INDEX idx_linked_wallet ON linked_wallets(linked_wallet);

-- ======================
-- KYC VERIFICATIONS TABLE
-- ======================
CREATE TABLE kyc_verifications (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    wallet_address TEXT NOT NULL UNIQUE,

    -- Didit KYC data
    session_id TEXT,
    verification_url TEXT,

    -- Status
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'verified', 'failed', 'expired')),
    verified BOOLEAN DEFAULT FALSE,
    verification_level TEXT, -- 'basic', 'enhanced', etc.

    -- Timestamps
    initiated_at TIMESTAMP DEFAULT NOW(),
    verified_at TIMESTAMP,
    expires_at TIMESTAMP,

    -- Metadata
    provider TEXT DEFAULT 'didit',
    provider_user_id TEXT,

    FOREIGN KEY (wallet_address) REFERENCES credit_scores(wallet_address) ON DELETE CASCADE
);

CREATE INDEX idx_kyc_wallet ON kyc_verifications(wallet_address);
CREATE INDEX idx_kyc_status ON kyc_verifications(status);

-- ======================
-- EON POINTS TABLE
-- ======================
CREATE TABLE eon_points (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    wallet_address TEXT NOT NULL,

    -- Points breakdown
    total_points DECIMAL(20, 2) NOT NULL DEFAULT 0,
    lender_points DECIMAL(20, 2) DEFAULT 0,
    borrower_points DECIMAL(20, 2) DEFAULT 0,
    referral_points DECIMAL(20, 2) DEFAULT 0,
    bonus_points DECIMAL(20, 2) DEFAULT 0,

    -- Multipliers
    current_multiplier DECIMAL(5, 2) DEFAULT 1.00,

    -- Status
    claimed BOOLEAN DEFAULT FALSE,
    claimed_at TIMESTAMP,
    claimed_amount DECIMAL(20, 2),

    -- Metadata
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),

    FOREIGN KEY (wallet_address) REFERENCES credit_scores(wallet_address) ON DELETE CASCADE
);

CREATE INDEX idx_points_wallet ON eon_points(wallet_address);
CREATE INDEX idx_points_total ON eon_points(total_points DESC);
CREATE INDEX idx_points_claimed ON eon_points(claimed);

-- ======================
-- POINTS TRANSACTIONS TABLE
-- ======================
CREATE TABLE points_transactions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    wallet_address TEXT NOT NULL,

    -- Transaction details
    amount DECIMAL(20, 2) NOT NULL,
    type TEXT NOT NULL CHECK (type IN ('earn_lender', 'earn_borrower', 'earn_referral', 'earn_bonus', 'claim', 'adjustment')),
    description TEXT,

    -- Context
    related_tx_hash TEXT, -- On-chain transaction that triggered points
    multiplier DECIMAL(5, 2) DEFAULT 1.00,

    -- Timestamp
    created_at TIMESTAMP DEFAULT NOW(),

    FOREIGN KEY (wallet_address) REFERENCES credit_scores(wallet_address) ON DELETE CASCADE
);

CREATE INDEX idx_ptx_wallet ON points_transactions(wallet_address);
CREATE INDEX idx_ptx_type ON points_transactions(type);
CREATE INDEX idx_ptx_timestamp ON points_transactions(created_at DESC);

-- ======================
-- LENDING POSITIONS TABLE
-- ======================
CREATE TABLE lending_positions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    wallet_address TEXT NOT NULL,

    -- Position details
    collateral_amount DECIMAL(30, 18) NOT NULL,
    borrowed_amount DECIMAL(30, 18) NOT NULL,
    collateral_asset TEXT NOT NULL, -- 'USDC', 'ETH', etc.
    borrow_asset TEXT NOT NULL,

    -- Interest
    interest_rate DECIMAL(10, 6) NOT NULL, -- e.g., 8.5 = 8.5% APY
    accrued_interest DECIMAL(30, 18) DEFAULT 0,
    last_interest_update TIMESTAMP DEFAULT NOW(),

    -- Health
    health_factor DECIMAL(10, 4), -- e.g., 1.5000
    ltv_ratio DECIMAL(5, 4), -- e.g., 0.6500 = 65%

    -- Status
    status TEXT DEFAULT 'active' CHECK (status IN ('active', 'repaid', 'liquidated', 'defaulted')),

    -- Timestamps
    opened_at TIMESTAMP DEFAULT NOW(),
    last_update_at TIMESTAMP DEFAULT NOW(),
    closed_at TIMESTAMP,

    -- On-chain data
    on_chain_tx_hash TEXT,
    contract_address TEXT,

    FOREIGN KEY (wallet_address) REFERENCES credit_scores(wallet_address) ON DELETE CASCADE
);

CREATE INDEX idx_positions_wallet ON lending_positions(wallet_address);
CREATE INDEX idx_positions_status ON lending_positions(status);
CREATE INDEX idx_positions_health ON lending_positions(health_factor);

-- ======================
-- LIQUIDATION EVENTS TABLE
-- ======================
CREATE TABLE liquidation_events (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    position_id UUID NOT NULL,
    wallet_address TEXT NOT NULL,

    -- Liquidation details
    liquidated_collateral DECIMAL(30, 18) NOT NULL,
    debt_covered DECIMAL(30, 18) NOT NULL,
    penalty_amount DECIMAL(30, 18),
    liquidator_address TEXT,

    -- Reason
    trigger_reason TEXT, -- 'health_factor', 'grace_period_expired', etc.
    health_factor_at_liquidation DECIMAL(10, 4),

    -- Timestamps
    liquidated_at TIMESTAMP DEFAULT NOW(),
    grace_period_started TIMESTAMP,

    -- On-chain
    liquidation_tx_hash TEXT NOT NULL,

    FOREIGN KEY (position_id) REFERENCES lending_positions(id) ON DELETE CASCADE,
    FOREIGN KEY (wallet_address) REFERENCES credit_scores(wallet_address) ON DELETE CASCADE
);

CREATE INDEX idx_liquidations_wallet ON liquidation_events(wallet_address);
CREATE INDEX idx_liquidations_position ON liquidation_events(position_id);
CREATE INDEX idx_liquidations_timestamp ON liquidation_events(liquidated_at DESC);

-- ======================
-- PROTOCOL METRICS TABLE
-- ======================
CREATE TABLE protocol_metrics (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

    -- TVL metrics
    total_deposits DECIMAL(30, 18) DEFAULT 0,
    total_borrowed DECIMAL(30, 18) DEFAULT 0,
    utilization_rate DECIMAL(5, 4),

    -- User metrics
    total_users INTEGER DEFAULT 0,
    active_lenders INTEGER DEFAULT 0,
    active_borrowers INTEGER DEFAULT 0,

    -- Financial metrics
    total_interest_paid DECIMAL(30, 18) DEFAULT 0,
    total_liquidations INTEGER DEFAULT 0,
    total_liquidation_value DECIMAL(30, 18) DEFAULT 0,
    default_rate DECIMAL(5, 4) DEFAULT 0,

    -- Timestamp
    snapshot_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_metrics_timestamp ON protocol_metrics(snapshot_at DESC);

-- ======================
-- CHALLENGES TABLE (Optimistic Oracle)
-- ======================
CREATE TABLE score_challenges (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    challenge_id TEXT UNIQUE NOT NULL, -- On-chain challenge ID

    -- Challenge details
    challenged_wallet TEXT NOT NULL,
    challenger_wallet TEXT NOT NULL,
    disputed_score INTEGER NOT NULL,

    -- Bond
    bond_amount DECIMAL(30, 18) NOT NULL,

    -- Evidence
    merkle_proof JSONB,
    challenge_reason TEXT,

    -- Resolution
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'valid', 'invalid', 'expired')),
    resolved_at TIMESTAMP,
    resolution_tx_hash TEXT,

    -- Timestamps
    created_at TIMESTAMP DEFAULT NOW(),
    deadline TIMESTAMP NOT NULL,

    FOREIGN KEY (challenged_wallet) REFERENCES credit_scores(wallet_address) ON DELETE CASCADE
);

CREATE INDEX idx_challenges_wallet ON score_challenges(challenged_wallet);
CREATE INDEX idx_challenges_status ON score_challenges(status);

-- ======================
-- REFERRALS TABLE
-- ======================
CREATE TABLE referrals (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

    -- Referral relationship
    referrer_wallet TEXT NOT NULL,
    referee_wallet TEXT NOT NULL UNIQUE,

    -- Status
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'completed', 'expired')),

    -- Rewards
    referrer_bonus DECIMAL(20, 2),
    referee_bonus DECIMAL(20, 2),
    rewarded BOOLEAN DEFAULT FALSE,

    -- Timestamps
    referred_at TIMESTAMP DEFAULT NOW(),
    completed_at TIMESTAMP,

    FOREIGN KEY (referrer_wallet) REFERENCES credit_scores(wallet_address) ON DELETE CASCADE,
    FOREIGN KEY (referee_wallet) REFERENCES credit_scores(wallet_address) ON DELETE CASCADE
);

CREATE INDEX idx_referrals_referrer ON referrals(referrer_wallet);
CREATE INDEX idx_referrals_referee ON referrals(referee_wallet);

-- ======================
-- TRIGGERS FOR AUTO-UPDATE
-- ======================

-- Auto-update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_credit_scores_updated_at BEFORE UPDATE ON credit_scores
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_eon_points_updated_at BEFORE UPDATE ON eon_points
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_lending_positions_updated_at BEFORE UPDATE ON lending_positions
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Auto-create points entry when new score is created
CREATE OR REPLACE FUNCTION create_points_entry()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO eon_points (wallet_address, total_points)
    VALUES (NEW.wallet_address, 0)
    ON CONFLICT (wallet_address) DO NOTHING;
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER auto_create_points AFTER INSERT ON credit_scores
    FOR EACH ROW EXECUTE FUNCTION create_points_entry();

-- ======================
-- VIEWS FOR ANALYTICS
-- ======================

-- Leaderboard view
CREATE VIEW leaderboard AS
SELECT
    cs.wallet_address,
    cs.score,
    cs.tier,
    ep.total_points,
    COUNT(DISTINCT lp.id) as total_loans,
    COUNT(DISTINCT CASE WHEN lp.status = 'repaid' THEN lp.id END) as repaid_loans,
    cs.updated_at
FROM credit_scores cs
LEFT JOIN eon_points ep ON cs.wallet_address = ep.wallet_address
LEFT JOIN lending_positions lp ON cs.wallet_address = lp.wallet_address
GROUP BY cs.wallet_address, cs.score, cs.tier, ep.total_points, cs.updated_at
ORDER BY cs.score DESC, ep.total_points DESC;

-- Protocol health view
CREATE VIEW protocol_health AS
SELECT
    COUNT(DISTINCT cs.wallet_address) as total_users,
    COUNT(DISTINCT CASE WHEN lp.status = 'active' THEN lp.wallet_address END) as active_borrowers,
    SUM(CASE WHEN lp.status = 'active' THEN lp.collateral_amount ELSE 0 END) as total_collateral,
    SUM(CASE WHEN lp.status = 'active' THEN lp.borrowed_amount ELSE 0 END) as total_borrowed,
    AVG(CASE WHEN lp.status = 'active' THEN lp.health_factor END) as avg_health_factor,
    COUNT(DISTINCT le.id) as total_liquidations,
    SUM(ep.total_points) as total_points_distributed
FROM credit_scores cs
LEFT JOIN lending_positions lp ON cs.wallet_address = lp.wallet_address
LEFT JOIN liquidation_events le ON cs.wallet_address = le.wallet_address
LEFT JOIN eon_points ep ON cs.wallet_address = ep.wallet_address;

-- ======================
-- ROW LEVEL SECURITY (RLS)
-- ======================

-- Enable RLS on sensitive tables
ALTER TABLE credit_scores ENABLE ROW LEVEL SECURITY;
ALTER TABLE eon_points ENABLE ROW LEVEL SECURITY;
ALTER TABLE lending_positions ENABLE ROW LEVEL SECURITY;

-- Policy: Users can read their own data
CREATE POLICY "Users can view own credit score" ON credit_scores
    FOR SELECT
    USING (wallet_address = current_setting('app.user_wallet', true));

CREATE POLICY "Users can view own points" ON eon_points
    FOR SELECT
    USING (wallet_address = current_setting('app.user_wallet', true));

CREATE POLICY "Users can view own positions" ON lending_positions
    FOR SELECT
    USING (wallet_address = current_setting('app.user_wallet', true));

-- Policy: Service role can do everything (for API)
CREATE POLICY "Service role can manage scores" ON credit_scores
    FOR ALL
    USING (current_setting('role', true) = 'service_role');

-- ======================
-- COMMENTS FOR DOCUMENTATION
-- ======================

COMMENT ON TABLE credit_scores IS 'Main table storing calculated credit scores and their breakdowns';
COMMENT ON TABLE score_history IS 'Historical record of all score changes for audit trail';
COMMENT ON TABLE linked_wallets IS 'Wallet bundling for sybil resistance - users can link multiple wallets';
COMMENT ON TABLE kyc_verifications IS 'KYC verification status from Didit integration';
COMMENT ON TABLE eon_points IS 'Eon Points balances - precursor to $EON token';
COMMENT ON TABLE points_transactions IS 'Detailed log of all points earnings and claims';
COMMENT ON TABLE lending_positions IS 'Active and historical lending positions';
COMMENT ON TABLE liquidation_events IS 'Record of all liquidation events';
COMMENT ON TABLE score_challenges IS 'Optimistic oracle challenges to credit scores';
COMMENT ON TABLE referrals IS 'User referral relationships and rewards';

-- ======================
-- SEED DATA FOR DEVELOPMENT
-- ======================

-- Insert test credit score
INSERT INTO credit_scores (wallet_address, score, tier, breakdown, sybil_adjustments, finalized)
VALUES (
    '0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb3',
    725,
    'Gold',
    '{
        "paymentHistory": {"score": 85, "weight": 30},
        "creditUtilization": {"score": 75, "weight": 25},
        "historyLength": {"score": 80, "weight": 15},
        "creditMix": {"score": 70, "weight": 12},
        "newCredit": {"score": 90, "weight": 8},
        "onChainReputation": {"score": 60, "weight": 10}
    }',
    '{
        "walletAgePenalty": -50,
        "humanityBonus": 0,
        "stakingBonus": 0,
        "bundlingBonus": 0,
        "crossChainBonus": 0,
        "noVerificationPenalty": -150,
        "totalAdjustment": -200
    }',
    true
) ON CONFLICT (wallet_address) DO NOTHING;

-- ======================
-- END OF SCHEMA
-- ======================
