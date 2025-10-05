// SPDX-License-Identifier: MIT
pragma solidity 0.8.20;

import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import "./CreditRegistryV3Upgradeable.sol";

/**
 * @title ScoreOraclePhase3BUpgradeable
 * @notice UUPS Upgradeable 5-factor credit scoring oracle
 * @dev Phase 3 - Production-ready with upgrade capability
 *
 * UPGRADE PATTERN: UUPS (Universal Upgradeable Proxy Standard)
 * - Allows updating scoring algorithm without data migration
 * - Owner-controlled upgrades via _authorizeUpgrade()
 * - Scoring model can evolve with DeFi ecosystem
 *
 * SCORING SYSTEM:
 * - S1: Repayment History (40% weight) - Range: 0-100
 * - S2: Collateral Utilization (20% weight) - Range: 0-100
 * - S3: Sybil Resistance (20% weight) - Range: -450 to +295, normalized to 0-100
 * - S4: Cross-Chain Reputation (10% weight) - Range: 0-100
 * - S5: Governance Participation (10% weight) - Range: 0-100
 *
 * Overall = (S1 * 0.40) + (S2 * 0.20) + (S3_norm * 0.20) + (S4 * 0.10) + (S5 * 0.10)
 */
contract ScoreOraclePhase3BUpgradeable is Initializable, OwnableUpgradeable, UUPSUpgradeable {
    // ==================== STATE ====================

    CreditRegistryV3Upgradeable public registry;

    // Supported chain selectors for S4 (Chainlink CCIP)
    uint64[] public supportedChainSelectors;
    mapping(uint64 => bool) public isSupportedChain;

    // Tier thresholds
    uint16 public constant TIER_SILVER = 60;
    uint16 public constant TIER_GOLD = 75;
    uint16 public constant TIER_PLATINUM = 90;

    // ==================== STRUCTS ====================

    struct ScoreBreakdown {
        uint16 overall;          // Final weighted score (0-100)
        uint8 s1_repayment;      // 0-100
        uint8 s2_collateral;     // 0-100
        uint8 s3_sybil;          // Normalized 0-100
        uint8 s4_crossChain;     // 0-100
        uint8 s5_governance;     // 0-100
        int16 s3_raw;            // Raw S3 score before normalization
    }

    enum ScoreTier { Bronze, Silver, Gold, Platinum }

    // ==================== EVENTS ====================

    event ChainSelectorAdded(uint64 indexed chainSelector);
    event ChainSelectorRemoved(uint64 indexed chainSelector);

    // ==================== UPGRADEABLE PATTERN ====================

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    /**
     * @notice Initialize the contract (replaces constructor)
     * @dev Called once during proxy deployment
     */
    function initialize(address _owner, address _registry) external initializer {
        __Ownable_init(_owner);
        __UUPSUpgradeable_init();

        registry = CreditRegistryV3Upgradeable(payable(_registry));

        // Initialize with Arbitrum, Optimism, Base chain selectors (testnet)
        _addChainSelector(3478487238524512106); // Arbitrum Sepolia
        _addChainSelector(5224473277236331295); // Optimism Sepolia
        _addChainSelector(10344971235874465080); // Base Sepolia
    }

    /**
     * @notice Authorize contract upgrades (UUPS requirement)
     * @dev Only owner can upgrade the implementation
     */
    function _authorizeUpgrade(address newImplementation) internal override onlyOwner {}

    /**
     * @notice Get current implementation version
     * @dev Useful for verifying upgrades
     */
    function version() external pure returns (string memory) {
        return "3.0.0";
    }

    // ==================== SCORING FUNCTIONS ====================

    /**
     * @notice Compute complete 5-factor credit score
     */
    function computeScore(address subject) external view returns (ScoreBreakdown memory) {
        uint8 s1 = _scoreRepaymentHistory(subject);
        uint8 s2 = _scoreCollateralUtilization(subject);
        int16 s3Raw = _scoreSybilResistance(subject);
        uint8 s3 = _normalizeS3(s3Raw);
        uint8 s4 = _scoreCrossChainReputation(subject);
        uint8 s5 = _scoreGovernanceParticipation(subject);

        // Weighted average
        uint256 weighted = (
            (uint256(s1) * 40) +
            (uint256(s2) * 20) +
            (uint256(s3) * 20) +
            (uint256(s4) * 10) +
            (uint256(s5) * 10)
        ) / 100;

        return ScoreBreakdown({
            overall: uint16(weighted),
            s1_repayment: s1,
            s2_collateral: s2,
            s3_sybil: s3,
            s4_crossChain: s4,
            s5_governance: s5,
            s3_raw: s3Raw
        });
    }

    // ==================== S1: REPAYMENT HISTORY (40%) ====================

    /**
     * @notice GAS OPTIMIZED - O(1) instead of O(n) loops
     * @dev Uses aggregate data from CreditRegistryV3Upgradeable
     */
    function _scoreRepaymentHistory(address subject) internal view returns (uint8) {
        CreditRegistryV3Upgradeable.AggregateCreditData memory agg = registry.getAggregateCreditData(subject);

        if (agg.totalLoans == 0) return 50; // Neutral for no history

        // Formula: (repaid/total * 100) - (liquidations * 20)
        uint256 repaymentRate = (agg.repaidLoans * 100) / agg.totalLoans;
        int256 score = int256(repaymentRate) - int256(agg.liquidatedLoans * 20);

        if (score < 0) return 0;
        if (score > 100) return 100;
        return uint8(uint256(score));
    }

    // ==================== S2: COLLATERAL UTILIZATION (20%) ====================

    /**
     * @notice GAS OPTIMIZED - O(1) instead of O(n) loops
     * @dev Uses aggregate collateral data from CreditRegistryV3Upgradeable
     */
    function _scoreCollateralUtilization(address subject) internal view returns (uint8) {
        CreditRegistryV3Upgradeable.AggregateCreditData memory agg = registry.getAggregateCreditData(subject);

        if (agg.totalLoans == 0) return 50; // Neutral for no history
        if (agg.totalBorrowedUsd18 == 0) return 50; // No active borrows

        // Calculate average collateralization ratio
        uint256 avgRatio = (agg.totalCollateralUsd18 * 100) / agg.totalBorrowedUsd18; // In percentage (200 = 200%)

        // Base score from collateralization ratio
        uint256 baseScore;
        if (avgRatio >= 200) baseScore = 100;      // 200%+
        else if (avgRatio >= 150) baseScore = 75;  // 150-200%
        else if (avgRatio >= 120) baseScore = 50;  // 120-150%
        else if (avgRatio >= 100) baseScore = 25;  // 100-120%
        else baseScore = 0;                        // Underwater

        // Penalty for max LTV borrowing
        uint256 maxLtvPct = (agg.maxLtvBorrowCount * 100) / agg.totalLoans;
        uint256 penalty = 0;
        if (maxLtvPct > 75) penalty = 40;
        else if (maxLtvPct > 50) penalty = 20;

        // Bonus for collateral diversity
        address[] memory uniqueAssets = registry.getUserCollateralAssets(subject);
        uint256 bonus = 0;
        if (uniqueAssets.length >= 3) bonus = 20;
        else if (uniqueAssets.length >= 2) bonus = 10;

        // Final score (clamped 0-100)
        int256 finalScore = int256(baseScore) - int256(penalty) + int256(bonus);
        if (finalScore < 0) return 0;
        if (finalScore > 100) return 100;
        return uint8(uint256(finalScore));
    }

    // ==================== S3: SYBIL RESISTANCE (20%) ====================

    /**
     * @notice GAS OPTIMIZED - O(1) instead of O(n) loops
     * @dev Uses aggregate data from CreditRegistryV3Upgradeable
     */
    function _scoreSybilResistance(address subject) internal view returns (int16) {
        CreditRegistryV3Upgradeable.AggregateCreditData memory agg = registry.getAggregateCreditData(subject);
        int256 score = 0;

        // 1. KYC Verification (+150 or -150)
        if (agg.kyc.verifiedAt > 0 && agg.kyc.expiresAt > block.timestamp) {
            score += 150;
        } else {
            score -= 150;
        }

        // 2. Wallet Age
        if (agg.firstSeen == 0) {
            score -= 300; // New wallet
        } else {
            uint256 age = block.timestamp - agg.firstSeen;
            if (age < 30 days) score -= 300;
            else if (age < 90 days) score -= 200;
            else if (age < 180 days) score -= 100;
            else if (age < 365 days) score -= 50;
            // else no penalty (365+ days)
        }

        // 3. Staking Bonus
        if (agg.stake.amount >= 1000 ether) score += 75;
        else if (agg.stake.amount >= 500 ether) score += 50;
        else if (agg.stake.amount >= 100 ether) score += 25;

        // 4. On-chain Activity (use aggregate loan count)
        if (agg.totalLoans >= 10) score += 50;
        else if (agg.totalLoans >= 5) score += 30;
        else if (agg.totalLoans >= 3) score += 15;

        // Range: -450 to +295 (KYC-150 + WalletAge-300 + Staking75 + Activity50)
        return int16(score);
    }

    function _normalizeS3(int16 s3Raw) internal pure returns (uint8) {
        // S3 range: -450 to +295 (745 point range)
        // Normalize to 0-100
        int256 min = -450;
        int256 max = 295;
        int256 range = max - min; // 745

        int256 normalized = ((int256(s3Raw) - min) * 100) / range;

        if (normalized < 0) return 0;
        if (normalized > 100) return 100;
        return uint8(uint256(normalized));
    }

    // ==================== S4: CROSS-CHAIN REPUTATION (10%) ====================

    function _scoreCrossChainReputation(address subject) internal view returns (uint8) {
        uint256 chainCount = 0;
        uint256 totalCrossChainScore = 0;

        // Aggregate scores from other chains
        for (uint256 i = 0; i < supportedChainSelectors.length; i++) {
            uint64 chainSelector = supportedChainSelectors[i];
            CreditRegistryV3Upgradeable.CrossChainScore memory crossScore = registry.getCrossChainScore(subject, chainSelector);

            if (crossScore.updatedAt > 0) {
                chainCount++;
                totalCrossChainScore += crossScore.overallScore;
            }
        }

        if (chainCount == 0) {
            return 0; // Neutral if no cross-chain history
        }

        // Average cross-chain score
        uint256 avgCrossChainScore = totalCrossChainScore / chainCount;

        // Base score from cross-chain average
        uint256 baseScore;
        if (avgCrossChainScore >= 75) baseScore = 100;
        else if (avgCrossChainScore >= 60) baseScore = 75;
        else if (avgCrossChainScore >= 45) baseScore = 50;
        else if (avgCrossChainScore >= 30) baseScore = 25;
        else baseScore = 0;

        // Bonus for multi-chain presence
        uint256 bonus = 0;
        if (chainCount >= 3) bonus = 20;
        else if (chainCount >= 2) bonus = 10;

        uint256 finalScore = baseScore + bonus;
        if (finalScore > 100) return 100;
        return uint8(finalScore);
    }

    // ==================== S5: GOVERNANCE PARTICIPATION (10%) ====================

    function _scoreGovernanceParticipation(address subject) internal view returns (uint8) {
        CreditRegistryV3Upgradeable.GovernanceActivity memory activity = registry.getGovernanceActivity(subject);

        uint256 score = 0;

        // 1. Voting Activity (max 40 points)
        if (activity.voteCount >= 20) score += 40;
        else if (activity.voteCount >= 10) score += 30;
        else if (activity.voteCount >= 5) score += 20;
        else if (activity.voteCount >= 1) score += 10;

        // 2. Proposal Creation (max 30 points)
        if (activity.proposalCount >= 5) score += 30;
        else if (activity.proposalCount >= 3) score += 20;
        else if (activity.proposalCount >= 1) score += 10;

        // 3. Recent Activity (max 30 points)
        uint256 timeSinceLastVote = block.timestamp - activity.lastVoteTimestamp;
        if (activity.lastVoteTimestamp > 0) {
            if (timeSinceLastVote < 30 days) score += 30;
            else if (timeSinceLastVote < 90 days) score += 20;
            else if (timeSinceLastVote < 180 days) score += 10;
        }

        if (score > 100) return 100;
        return uint8(score);
    }

    // ==================== TIER & TERMS FUNCTIONS ====================

    function getScoreTier(uint16 overall) external pure returns (ScoreTier) {
        if (overall >= TIER_PLATINUM) return ScoreTier.Platinum;
        if (overall >= TIER_GOLD) return ScoreTier.Gold;
        if (overall >= TIER_SILVER) return ScoreTier.Silver;
        return ScoreTier.Bronze;
    }

    function getAPR(uint16 overall) external pure returns (uint16 aprBps) {
        if (overall >= TIER_PLATINUM) return 400;   // 4% APR
        if (overall >= TIER_GOLD) return 600;       // 6% APR
        if (overall >= TIER_SILVER) return 800;     // 8% APR
        if (overall >= 45) return 1000;             // 10% APR
        if (overall >= 30) return 1200;             // 12% APR
        return 1500;                                // 15% APR
    }

    function _maxLtvForScore(uint16 overall) internal pure returns (uint16) {
        if (overall >= TIER_PLATINUM) return 90;
        if (overall >= TIER_GOLD) return 80;
        if (overall >= TIER_SILVER) return 70;
        return 50; // Bronze
    }

    // ==================== ADMIN FUNCTIONS ====================

    function addChainSelector(uint64 chainSelector) external onlyOwner {
        _addChainSelector(chainSelector);
    }

    function _addChainSelector(uint64 chainSelector) private {
        require(!isSupportedChain[chainSelector], "Already supported");
        supportedChainSelectors.push(chainSelector);
        isSupportedChain[chainSelector] = true;
        emit ChainSelectorAdded(chainSelector);
    }

    function removeChainSelector(uint64 chainSelector) external onlyOwner {
        require(isSupportedChain[chainSelector], "Not supported");

        // Remove from array
        for (uint256 i = 0; i < supportedChainSelectors.length; i++) {
            if (supportedChainSelectors[i] == chainSelector) {
                supportedChainSelectors[i] = supportedChainSelectors[supportedChainSelectors.length - 1];
                supportedChainSelectors.pop();
                break;
            }
        }

        isSupportedChain[chainSelector] = false;
        emit ChainSelectorRemoved(chainSelector);
    }

    function getSupportedChainSelectors() external view returns (uint64[] memory) {
        return supportedChainSelectors;
    }
}
