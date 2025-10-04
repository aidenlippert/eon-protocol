// SPDX-License-Identifier: MIT
pragma solidity 0.8.20;

import "@openzeppelin/contracts/access/Ownable.sol";
import "./CreditRegistryV2.sol";

/**
 * @title ScoreOraclePhase3
 * @notice Incremental Phase 3: Real S1 scoring from registry loan data
 * @dev S1 implemented with real repayment history, S2-S5 are placeholders
 *
 * SCORING FACTORS (0-100 scale):
 * - S1 (Repayment History): 40% weight - IMPLEMENTED from registry loans
 * - S2 (Collateral Utilization): 25% weight - Placeholder (50)
 * - S3 (Sybil Resistance): 20% weight - Partial (wallet age + staking, no KYC)
 * - S4 (Cross-Chain): 10% weight - Placeholder (0)
 * - S5 (Participation): 5% weight - Placeholder (0)
 *
 * OVERALL SCORE: Weighted average of all factors (0-100)
 *
 * Phase 3B TODO:
 * - S2: Implement collateral utilization tracking
 * - S3: Add KYC attestation lookup
 * - S4: Add cross-chain reputation aggregation
 * - S5: Add governance participation tracking
 */
contract ScoreOraclePhase3 is Ownable {
    CreditRegistryV2 public registry;

    // ==================== CONSTANTS ====================

    // Scoring weights (must sum to 100)
    uint8 public constant WEIGHT_REPAYMENT = 40;
    uint8 public constant WEIGHT_COLLATERAL = 25;
    uint8 public constant WEIGHT_SYBIL = 20;
    uint8 public constant WEIGHT_CROSSCHAIN = 10;
    uint8 public constant WEIGHT_PARTICIPATION = 5;

    // Score range
    uint8 public constant MIN_SCORE = 0;
    uint8 public constant MAX_SCORE = 100;

    // APR configuration (basis points)
    uint16 public baseAPR = 800;   // 8% base
    uint16 public minAPR = 400;    // 4% for excellent scores
    uint16 public maxAPR = 1500;   // 15% for poor scores

    // ==================== STRUCTS ====================

    struct ScoreBreakdown {
        uint8 s1_repayment;      // 0-100 (REAL from registry)
        uint8 s2_collateral;     // 0-100 (placeholder: 50)
        int16 s3_sybil;          // -300 to +100 (partial: wallet age + stake)
        uint8 s4_crosschain;     // 0-100 (placeholder: 0)
        uint8 s5_participation;  // 0-100 (placeholder: 0)
        uint16 overall;          // 0-100 (weighted average)
    }

    // ==================== EVENTS ====================

    event ScoreComputed(
        address indexed subject,
        uint8 s1,
        uint8 s2,
        int16 s3,
        uint8 s4,
        uint8 s5,
        uint16 overall
    );

    event APRConfigUpdated(uint16 baseAPR, uint16 minAPR, uint16 maxAPR);

    // ==================== CONSTRUCTOR ====================

    constructor(address payable _registry) Ownable(msg.sender) {
        require(_registry != address(0), "Invalid registry");
        registry = CreditRegistryV2(_registry);
    }

    // ==================== ADMIN ====================

    function setAPRConfig(uint16 _baseAPR, uint16 _minAPR, uint16 _maxAPR) external onlyOwner {
        require(_minAPR < _baseAPR, "Invalid min APR");
        require(_baseAPR < _maxAPR, "Invalid max APR");
        baseAPR = _baseAPR;
        minAPR = _minAPR;
        maxAPR = _maxAPR;
        emit APRConfigUpdated(_baseAPR, _minAPR, _maxAPR);
    }

    function setRegistry(address payable _registry) external onlyOwner {
        require(_registry != address(0), "Invalid registry");
        registry = CreditRegistryV2(_registry);
    }

    // ==================== SCORING ====================

    /**
     * @notice Compute full credit score for address
     * @param subject Address to score
     * @return breakdown Complete score breakdown
     */
    function computeScore(address subject) external view returns (ScoreBreakdown memory breakdown) {
        breakdown.s1_repayment = _scoreRepaymentHistory(subject);
        breakdown.s2_collateral = _scoreCollateralUtilization(subject);
        breakdown.s3_sybil = _scoreSybilResistance(subject);
        breakdown.s4_crosschain = _scoreCrossChain(subject);
        breakdown.s5_participation = _scoreParticipation(subject);

        breakdown.overall = _computeOverall(breakdown);

        return breakdown;
    }

    /**
     * @notice Get APR in basis points for a given score
     * @param overall Overall score (0-100)
     * @return aprBps Annual percentage rate in basis points
     */
    function getAPR(uint16 overall) external view returns (uint16 aprBps) {
        require(overall <= MAX_SCORE, "Invalid score");

        // Tiered APR mapping
        if (overall >= 90) return 400;   // 4% for excellent (90-100)
        if (overall >= 75) return 600;   // 6% for very good (75-89)
        if (overall >= 60) return 800;   // 8% for good (60-74)
        if (overall >= 45) return 1000;  // 10% for fair (45-59)
        if (overall >= 30) return 1200;  // 12% for poor (30-44)
        return 1500;                     // 15% for very poor (<30)
    }

    // ==================== INTERNAL SCORING ====================

    /**
     * @dev S1: Repayment History (REAL IMPLEMENTATION)
     * Formula: (repaid_loans / total_loans) * 100 - (liquidations * 20)
     *
     * Logic:
     * - No loans: Return 50 (neutral)
     * - Calculate repayment rate: (# repaid loans / total loans) * 100
     * - Penalize liquidations: -20 points per liquidation
     * - Clamp to [0, 100]
     */
    function _scoreRepaymentHistory(address subject) internal view returns (uint8) {
        uint256[] memory loanIds = registry.getLoanIdsByBorrower(subject);

        if (loanIds.length == 0) {
            return 50; // Neutral for no history
        }

        uint256 totalLoans = loanIds.length;
        uint256 repaidCount = 0;
        uint256 liquidatedCount = 0;

        for (uint256 i = 0; i < loanIds.length; i++) {
            CreditRegistryV2.LoanRecord memory loan = registry.getLoan(loanIds[i]);

            if (loan.status == CreditRegistryV2.LoanStatus.Repaid) {
                repaidCount++;
            } else if (loan.status == CreditRegistryV2.LoanStatus.Liquidated) {
                liquidatedCount++;
            }
        }

        // Calculate repayment percentage
        uint256 repaymentRate = (repaidCount * 100) / totalLoans;

        // Apply liquidation penalty
        int256 score = int256(repaymentRate) - int256(liquidatedCount * 20);

        // Clamp to [0, 100]
        if (score < 0) return 0;
        if (score > 100) return 100;

        return uint8(uint256(score));
    }

    /**
     * @dev S2: Collateral Utilization (PLACEHOLDER)
     * TODO Phase 3B: Implement real collateral tracking
     * - Track deposits and borrows from CreditVault
     * - Calculate utilization = borrowed / deposited
     * - Lower utilization = better score
     */
    function _scoreCollateralUtilization(address /* subject */) internal pure returns (uint8) {
        return 50; // Neutral placeholder
    }

    /**
     * @dev S3: Sybil Resistance (PARTIAL IMPLEMENTATION)
     * Components:
     * - Wallet age: Older = better (currently implemented)
     * - Staking: More stake = better (currently implemented)
     * - KYC: Has KYC = +150 points (TODO Phase 3B)
     *
     * Current scoring:
     * - No KYC: -150 (placeholder penalty)
     * - Wallet age penalties: 0-30d (-300), 30-90d (-200), 90-180d (-100), 180-365d (-50), 365d+ (0)
     * - Staking bonuses: 1000+ ETH (+75), 500+ ETH (+50), 100+ ETH (+25)
     *
     * Range: -300 to +100 (can be negative!)
     */
    function _scoreSybilResistance(address subject) internal view returns (int16) {
        int256 score = -150; // No KYC penalty (placeholder)

        // Wallet age scoring
        uint256 firstSeen = registry.getFirstSeen(subject);

        if (firstSeen == 0) {
            score -= 300; // New wallet, never seen
        } else {
            uint256 age = block.timestamp - firstSeen;

            if (age < 30 days) {
                score -= 300;
            } else if (age < 90 days) {
                score -= 200;
            } else if (age < 180 days) {
                score -= 100;
            } else if (age < 365 days) {
                score -= 50;
            }
            // else: 365+ days, no penalty
        }

        // Staking bonuses
        CreditRegistryV2.StakeInfo memory stake = registry.getStakeInfo(subject);

        if (stake.amount >= 1000 ether) {
            score += 75;
        } else if (stake.amount >= 500 ether) {
            score += 50;
        } else if (stake.amount >= 100 ether) {
            score += 25;
        }

        // Clamp to valid range
        if (score < -300) score = -300;
        if (score > 100) score = 100;

        return int16(score);
    }

    /**
     * @dev S4: Cross-Chain Reputation (PLACEHOLDER)
     * TODO Phase 3B: Implement cross-chain aggregation via Chainlink CCIP
     * - Aggregate scores from Arbitrum, Optimism, Base
     * - Weight by chain activity
     * - Return normalized 0-100 score
     */
    function _scoreCrossChain(address /* subject */) internal pure returns (uint8) {
        return 0; // Not implemented in Phase 3 Incremental
    }

    /**
     * @dev S5: Protocol Participation (PLACEHOLDER)
     * TODO Phase 3B: Implement governance participation tracking
     * - Track DAO votes
     * - Track proposal creation
     * - Track active participation duration
     * - Return 0-100 score
     */
    function _scoreParticipation(address /* subject */) internal pure returns (uint8) {
        return 0; // Not implemented in Phase 3 Incremental
    }

    /**
     * @dev Compute overall score from breakdown
     * Formula: Weighted average of all factors
     *
     * Note: S3 (sybil) can be negative, affecting overall score
     * For weighting, we clamp S3 to [0, 100] range
     */
    function _computeOverall(ScoreBreakdown memory b) internal pure returns (uint16) {
        // Clamp S3 to [0, 100] for weighting
        int256 s3_clamped = int256(b.s3_sybil);
        if (s3_clamped < 0) s3_clamped = 0;
        if (s3_clamped > 100) s3_clamped = 100;

        // Calculate weighted sum
        int256 weighted = (
            int256(uint256(b.s1_repayment)) * int256(uint256(WEIGHT_REPAYMENT)) +
            int256(uint256(b.s2_collateral)) * int256(uint256(WEIGHT_COLLATERAL)) +
            s3_clamped * int256(uint256(WEIGHT_SYBIL)) +
            int256(uint256(b.s4_crosschain)) * int256(uint256(WEIGHT_CROSSCHAIN)) +
            int256(uint256(b.s5_participation)) * int256(uint256(WEIGHT_PARTICIPATION))
        ) / 100;

        // Clamp to [0, 100]
        if (weighted < 0) weighted = 0;
        if (weighted > 100) weighted = 100;

        return uint16(uint256(weighted));
    }

    // ==================== VIEW HELPERS ====================

    /**
     * @notice Get score tier name
     * @param overall Overall score (0-100)
     * @return tier Tier name (Bronze, Silver, Gold, Platinum)
     */
    function getScoreTier(uint16 overall) external pure returns (string memory) {
        if (overall >= 90) return "Platinum";
        if (overall >= 75) return "Gold";
        if (overall >= 60) return "Silver";
        return "Bronze";
    }

    /**
     * @notice Check if score is recent (within maxAge)
     * @param subject Address to check
     * @param maxAge Maximum age in seconds
     * @return valid True if wallet has recent activity
     */
    function hasRecentActivity(address subject, uint256 maxAge) external view returns (bool) {
        uint256 firstSeen = registry.getFirstSeen(subject);
        if (firstSeen == 0) return false;

        uint256[] memory loanIds = registry.getLoanIdsByBorrower(subject);
        if (loanIds.length == 0) return false;

        // Get most recent loan
        CreditRegistryV2.LoanRecord memory mostRecent = registry.getLoan(loanIds[loanIds.length - 1]);

        return (block.timestamp - mostRecent.timestamp) <= maxAge;
    }
}
