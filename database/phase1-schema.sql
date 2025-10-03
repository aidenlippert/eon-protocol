-- ==================================================
-- EON PROTOCOL - PHASE 1 DATABASE SCHEMA
-- ==================================================

-- ============ Payment History ============
CREATE TABLE IF NOT EXISTS payment_history (
    id SERIAL PRIMARY KEY,
    borrower TEXT NOT NULL,
    loan_id INTEGER NOT NULL,
    amount TEXT NOT NULL,
    due_date TIMESTAMP NOT NULL,
    paid_date TIMESTAMP,
    on_time BOOLEAN NOT NULL,
    late_days INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT NOW(),

    INDEX idx_borrower (borrower),
    INDEX idx_loan_id (loan_id),
    INDEX idx_created_at (created_at DESC)
);

-- ============ Credit Scores ============
CREATE TABLE IF NOT EXISTS credit_scores (
    borrower TEXT PRIMARY KEY,
    base_score INTEGER NOT NULL CHECK (base_score >= 0 AND base_score <= 1000),
    payment_score INTEGER NOT NULL CHECK (payment_score >= 0 AND payment_score <= 200),
    wallet_age_score INTEGER NOT NULL CHECK (wallet_age_score >= 0 AND wallet_age_score <= 100),
    protocol_score INTEGER NOT NULL CHECK (protocol_score >= 0 AND protocol_score <= 100),
    total_score INTEGER NOT NULL CHECK (total_score >= 0 AND total_score <= 1000),
    ltv_percentage INTEGER NOT NULL CHECK (ltv_percentage >= 50 AND ltv_percentage <= 90),
    tier TEXT NOT NULL CHECK (tier IN ('Bronze', 'Silver', 'Gold', 'Platinum')),
    last_updated TIMESTAMP DEFAULT NOW(),

    INDEX idx_total_score (total_score DESC),
    INDEX idx_tier (tier)
);

-- ============ Health Factors ============
CREATE TABLE IF NOT EXISTS health_factors (
    borrower TEXT NOT NULL,
    loan_id INTEGER NOT NULL,
    collateral_value TEXT NOT NULL,
    debt_value TEXT NOT NULL,
    health_factor TEXT NOT NULL,
    liquidatable BOOLEAN NOT NULL,
    last_checked TIMESTAMP DEFAULT NOW(),

    PRIMARY KEY (borrower, loan_id),
    INDEX idx_liquidatable (liquidatable),
    INDEX idx_last_checked (last_checked DESC)
);

-- ============ Liquidation Auctions ============
CREATE TABLE IF NOT EXISTS liquidation_auctions (
    id SERIAL PRIMARY KEY,
    loan_id INTEGER NOT NULL,
    borrower TEXT NOT NULL,
    debt_amount TEXT NOT NULL,
    collateral_amount TEXT NOT NULL,
    start_time TIMESTAMP NOT NULL,
    grace_period_end TIMESTAMP NOT NULL,
    grace_period_hours INTEGER NOT NULL,
    current_discount INTEGER NOT NULL DEFAULT 0,
    executed BOOLEAN DEFAULT FALSE,
    executor TEXT,
    executed_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT NOW(),

    INDEX idx_borrower (borrower),
    INDEX idx_loan_id (loan_id),
    INDEX idx_executed (executed),
    INDEX idx_grace_period_end (grace_period_end)
);

-- ============ Insurance Fund ============
CREATE TABLE IF NOT EXISTS insurance_fund_transactions (
    id SERIAL PRIMARY KEY,
    transaction_type TEXT NOT NULL CHECK (transaction_type IN ('DEPOSIT', 'ALLOCATION', 'PAYOUT')),
    amount TEXT NOT NULL,
    from_address TEXT,
    to_address TEXT,
    loan_id INTEGER,
    balance_after TEXT NOT NULL,
    timestamp TIMESTAMP DEFAULT NOW(),

    INDEX idx_transaction_type (transaction_type),
    INDEX idx_timestamp (timestamp DESC)
);

-- ============ Wallet Metadata ============
CREATE TABLE IF NOT EXISTS wallet_metadata (
    address TEXT PRIMARY KEY,
    first_transaction TIMESTAMP,
    total_transactions INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- ============ Protocol Interactions ============
CREATE TABLE IF NOT EXISTS protocol_interactions (
    id SERIAL PRIMARY KEY,
    user_address TEXT NOT NULL,
    interaction_type TEXT NOT NULL CHECK (interaction_type IN (
        'CLAIM_SUBMIT',
        'CLAIM_CHALLENGE',
        'LOAN_BORROW',
        'LOAN_REPAY',
        'COLLATERAL_ADD',
        'COLLATERAL_WITHDRAW'
    )),
    timestamp TIMESTAMP DEFAULT NOW(),

    INDEX idx_user_address (user_address),
    INDEX idx_interaction_type (interaction_type),
    INDEX idx_timestamp (timestamp DESC)
);

-- ============ Users ============
CREATE TABLE IF NOT EXISTS users (
    address TEXT PRIMARY KEY,
    email TEXT,
    phone TEXT,
    telegram_id TEXT,
    notifications_enabled BOOLEAN DEFAULT TRUE,
    email_notifications BOOLEAN DEFAULT TRUE,
    sms_notifications BOOLEAN DEFAULT FALSE,
    telegram_notifications BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),

    INDEX idx_email (email),
    UNIQUE (email)
);

-- ============ Alert History ============
CREATE TABLE IF NOT EXISTS alert_history (
    id SERIAL PRIMARY KEY,
    recipient TEXT NOT NULL,
    alert_type TEXT NOT NULL,
    channel TEXT NOT NULL CHECK (channel IN ('EMAIL', 'SMS', 'TELEGRAM')),
    data JSONB,
    sent_at TIMESTAMP DEFAULT NOW(),
    delivered BOOLEAN DEFAULT FALSE,

    INDEX idx_recipient (recipient),
    INDEX idx_alert_type (alert_type),
    INDEX idx_sent_at (sent_at DESC)
);

-- ==================================================
-- VIEWS
-- ==================================================

-- ============ Active Loans with Health Status ============
CREATE OR REPLACE VIEW active_loans_health AS
SELECT
    l.id AS loan_id,
    l.borrower,
    l.collateral_amount,
    l.borrowed_amount,
    l.interest_rate,
    l.start_time,
    l.duration,
    hf.health_factor,
    hf.liquidatable,
    hf.last_checked,
    cs.total_score,
    cs.tier,
    cs.ltv_percentage,
    CASE
        WHEN hf.health_factor::numeric >= 1.2 THEN 'SAFE'
        WHEN hf.health_factor::numeric >= 1.0 THEN 'WARNING'
        WHEN hf.health_factor::numeric >= 0.95 THEN 'DANGER'
        ELSE 'CRITICAL'
    END AS risk_level
FROM loans l
LEFT JOIN health_factors hf ON hf.borrower = l.borrower AND hf.loan_id = l.id
LEFT JOIN credit_scores cs ON cs.borrower = l.borrower
WHERE l.status = 'ACTIVE';

-- ============ Liquidation Queue ============
CREATE OR REPLACE VIEW liquidation_queue AS
SELECT
    la.id AS auction_id,
    la.loan_id,
    la.borrower,
    la.debt_amount,
    la.collateral_amount,
    la.grace_period_end,
    la.current_discount,
    la.executed,
    cs.total_score,
    cs.tier,
    hf.health_factor,
    CASE
        WHEN NOW() < la.grace_period_end THEN 'GRACE_PERIOD'
        WHEN la.executed THEN 'EXECUTED'
        ELSE 'ACTIVE'
    END AS status,
    CASE
        WHEN NOW() >= la.grace_period_end THEN
            LEAST(2000, ((EXTRACT(EPOCH FROM (NOW() - la.grace_period_end)) / 21600) * 2000)::integer)
        ELSE 0
    END AS calculated_discount
FROM liquidation_auctions la
LEFT JOIN credit_scores cs ON cs.borrower = la.borrower
LEFT JOIN health_factors hf ON hf.borrower = la.borrower AND hf.loan_id = la.loan_id
WHERE la.executed = FALSE
ORDER BY la.grace_period_end ASC;

-- ============ Credit Score Leaderboard ============
CREATE OR REPLACE VIEW credit_leaderboard AS
SELECT
    borrower,
    total_score,
    tier,
    ltv_percentage,
    base_score,
    payment_score,
    wallet_age_score,
    protocol_score,
    last_updated,
    ROW_NUMBER() OVER (ORDER BY total_score DESC) AS rank
FROM credit_scores
ORDER BY total_score DESC;

-- ==================================================
-- FUNCTIONS
-- ==================================================

-- ============ Update Credit Score Tier ============
CREATE OR REPLACE FUNCTION update_credit_tier()
RETURNS TRIGGER AS $$
BEGIN
    NEW.tier := CASE
        WHEN NEW.total_score >= 800 THEN 'Platinum'
        WHEN NEW.total_score >= 600 THEN 'Gold'
        WHEN NEW.total_score >= 400 THEN 'Silver'
        ELSE 'Bronze'
    END;

    NEW.ltv_percentage := CASE
        WHEN NEW.total_score >= 800 THEN 90
        WHEN NEW.total_score >= 600 THEN 75
        WHEN NEW.total_score >= 400 THEN 65
        ELSE 50
    END;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_tier_on_score_change
BEFORE INSERT OR UPDATE ON credit_scores
FOR EACH ROW
EXECUTE FUNCTION update_credit_tier();

-- ============ Record Protocol Interaction ============
CREATE OR REPLACE FUNCTION record_interaction()
RETURNS TRIGGER AS $$
BEGIN
    -- Auto-record interaction when certain tables are updated
    -- This would be customized based on specific tables
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ==================================================
-- INDEXES FOR PERFORMANCE
-- ==================================================

-- Payment history queries
CREATE INDEX IF NOT EXISTS idx_payment_history_borrower_created ON payment_history(borrower, created_at DESC);

-- Health factor monitoring
CREATE INDEX IF NOT EXISTS idx_health_factors_liquidatable_checked ON health_factors(liquidatable, last_checked DESC);

-- Credit score lookups
CREATE INDEX IF NOT EXISTS idx_credit_scores_tier_score ON credit_scores(tier, total_score DESC);

-- ==================================================
-- ROW LEVEL SECURITY (Optional)
-- ==================================================

-- Enable RLS on sensitive tables
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE payment_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE health_factors ENABLE ROW LEVEL SECURITY;

-- Policy: Users can only see their own data
CREATE POLICY user_own_data ON users
    FOR ALL
    USING (address = current_setting('app.current_user_address', TRUE));

CREATE POLICY user_own_payments ON payment_history
    FOR SELECT
    USING (borrower = current_setting('app.current_user_address', TRUE));

CREATE POLICY user_own_health ON health_factors
    FOR SELECT
    USING (borrower = current_setting('app.current_user_address', TRUE));

-- ==================================================
-- COMMENTS
-- ==================================================

COMMENT ON TABLE payment_history IS 'Tracks loan payment history for credit scoring';
COMMENT ON TABLE credit_scores IS 'Multi-signal credit scores with subscores and tiers';
COMMENT ON TABLE health_factors IS 'Real-time health factor monitoring for active loans';
COMMENT ON TABLE liquidation_auctions IS 'Dutch auction liquidation system with grace periods';
COMMENT ON TABLE insurance_fund_transactions IS 'Insurance fund transaction history';
COMMENT ON TABLE wallet_metadata IS 'Wallet creation time and transaction count';
COMMENT ON TABLE protocol_interactions IS 'User interactions with Eon Protocol for scoring';
COMMENT ON TABLE users IS 'User profiles with notification preferences';
COMMENT ON TABLE alert_history IS 'Alert delivery history for monitoring';
