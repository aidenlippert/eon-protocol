// SPDX-License-Identifier: MIT
pragma solidity 0.8.20;

import "@openzeppelin/contracts/access/Ownable.sol";
import "./CreditRegistryV3.sol";
import "./UserRegistry.sol";

/**
 * @title ScoreOracleMultiWallet
 * @notice 5-factor credit scoring with multi-wallet aggregation
 * @dev Extends Phase 3B scoring with UserRegistry integration
 *
 * NEW FEATURES:
 * - Aggregate scoring across multiple wallets owned by same user
 * - KYC-linked identity (one person = one account)
 * - Backward compatible: single wallet scoring still works
 * - Weighted average across all user's wallets
 *
 * SCORING SYSTEM:
 * - S1: Repayment History (40% weight)
 * - S2: Collateral Utilization (20% weight)
 * - S3: Sybil Resistance (20% weight)
 * - S4: Cross-Chain Reputation (10% weight)
 * - S5: Governance Participation (10% weight)
 */
contract ScoreOracleMultiWallet is Ownable {
    // ==================== STATE ====================

    CreditRegistryV3 public registry;
    UserRegistry public userRegistry;

    // Supported chain selectors for S4
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
        int16 s3_raw;            // Raw S3 score
        bool isAggregate;        // True if aggregated
        uint8 walletCount;       // Number of wallets
    }

    enum ScoreTier { Bronze, Silver, Gold, Platinum }

    // ==================== EVENTS ====================

    event UserRegistryUpdated(address indexed oldRegistry, address indexed newRegistry);

    // ==================== CONSTRUCTOR ====================

    constructor(address payable _registry, address _userRegistry) Ownable(msg.sender) {
        registry = CreditRegistryV3(_registry);
        userRegistry = UserRegistry(_userRegistry);

        // Initialize supported chains
        _addChainSelector(3478487238524512106); // Arbitrum Sepolia
        _addChainSelector(5224473277236331295); // Optimism Sepolia
        _addChainSelector(10344971235874465080); // Base Sepolia
    }

    // ==================== SCORING FUNCTIONS ====================

    /**
     * @notice Compute credit score (aggregate if user has multiple wallets)
     */
    function computeScore(address wallet) external view returns (ScoreBreakdown memory) {
        bytes32 kycHash = userRegistry.walletToKycHash(wallet);

        if (kycHash == bytes32(0)) {
            // No registered user, single wallet score
            return _computeSingleWalletScore(wallet, false, 1);
        }

        (address primary, address[] memory linked) = userRegistry.getUserWallets(kycHash);
        uint8 walletCount = uint8(1 + linked.length);

        if (walletCount == 1) {
            return _computeSingleWalletScore(primary, false, 1);
        }

        // Aggregate across all wallets
        return _computeAggregateScore(primary, linked, walletCount);
    }

    /**
     * @notice Aggregate score across all user's wallets
     */
    function _computeAggregateScore(
        address primary,
        address[] memory linked,
        uint8 walletCount
    ) internal view returns (ScoreBreakdown memory) {
        uint256 totalS1 = 0;
        uint256 totalS2 = 0;
        int256 totalS3Raw = 0;
        uint256 totalS4 = 0;
        uint256 totalS5 = 0;

        // Score primary
        (uint8 s1, uint8 s2, int16 s3Raw, uint8 s4, uint8 s5) = _scoreWallet(primary);
        totalS1 += s1;
        totalS2 += s2;
        totalS3Raw += s3Raw;
        totalS4 += s4;
        totalS5 += s5;

        // Score linked wallets
        for (uint256 i = 0; i < linked.length; i++) {
            (s1, s2, s3Raw, s4, s5) = _scoreWallet(linked[i]);
            totalS1 += s1;
            totalS2 += s2;
            totalS3Raw += s3Raw;
            totalS4 += s4;
            totalS5 += s5;
        }

        // Calculate averages
        uint8 avgS1 = uint8(totalS1 / walletCount);
        uint8 avgS2 = uint8(totalS2 / walletCount);
        int16 avgS3Raw = int16(totalS3Raw / int256(uint256(walletCount)));
        uint8 avgS3 = _normalizeS3(avgS3Raw);
        uint8 avgS4 = uint8(totalS4 / walletCount);
        uint8 avgS5 = uint8(totalS5 / walletCount);

        // Weighted average
        uint256 weighted = (
            (uint256(avgS1) * 40) +
            (uint256(avgS2) * 20) +
            (uint256(avgS3) * 20) +
            (uint256(avgS4) * 10) +
            (uint256(avgS5) * 10)
        ) / 100;

        return ScoreBreakdown({
            overall: uint16(weighted),
            s1_repayment: avgS1,
            s2_collateral: avgS2,
            s3_sybil: avgS3,
            s4_crossChain: avgS4,
            s5_governance: avgS5,
            s3_raw: avgS3Raw,
            isAggregate: true,
            walletCount: walletCount
        });
    }

    function _scoreWallet(address wallet) internal view returns (
        uint8 s1,
        uint8 s2,
        int16 s3Raw,
        uint8 s4,
        uint8 s5
    ) {
        return (
            _scoreRepaymentHistory(wallet),
            _scoreCollateralUtilization(wallet),
            _scoreSybilResistance(wallet),
            _scoreCrossChainReputation(wallet),
            _scoreGovernanceParticipation(wallet)
        );
    }

    function _computeSingleWalletScore(
        address wallet,
        bool isAggregate,
        uint8 walletCount
    ) internal view returns (ScoreBreakdown memory) {
        (uint8 s1, uint8 s2, int16 s3Raw, uint8 s4, uint8 s5) = _scoreWallet(wallet);
        uint8 s3 = _normalizeS3(s3Raw);

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
            s3_raw: s3Raw,
            isAggregate: isAggregate,
            walletCount: walletCount
        });
    }

    // ==================== S1-S5 SCORING (same as Phase 3B) ====================

    function _scoreRepaymentHistory(address subject) internal view returns (uint8) {
        CreditRegistryV3.AggregateCreditData memory agg = registry.getAggregateCreditData(subject);
        if (agg.totalLoans == 0) return 50;
        uint256 repaymentRate = (agg.repaidLoans * 100) / agg.totalLoans;
        int256 score = int256(repaymentRate) - int256(agg.liquidatedLoans * 20);
        if (score < 0) return 0;
        if (score > 100) return 100;
        return uint8(uint256(score));
    }

    function _scoreCollateralUtilization(address subject) internal view returns (uint8) {
        CreditRegistryV3.AggregateCreditData memory agg = registry.getAggregateCreditData(subject);
        if (agg.totalLoans == 0 || agg.totalBorrowedUsd18 == 0) return 50;

        uint256 avgRatio = (agg.totalCollateralUsd18 * 100) / agg.totalBorrowedUsd18;
        uint256 baseScore;
        if (avgRatio >= 200) baseScore = 100;
        else if (avgRatio >= 150) baseScore = 75;
        else if (avgRatio >= 120) baseScore = 50;
        else if (avgRatio >= 100) baseScore = 25;
        else baseScore = 0;

        uint256 maxLtvPct = (agg.maxLtvBorrowCount * 100) / agg.totalLoans;
        uint256 penalty = maxLtvPct > 75 ? 40 : maxLtvPct > 50 ? 20 : 0;

        address[] memory uniqueAssets = registry.getUserCollateralAssets(subject);
        uint256 bonus = uniqueAssets.length >= 3 ? 20 : uniqueAssets.length >= 2 ? 10 : 0;

        int256 finalScore = int256(baseScore) - int256(penalty) + int256(bonus);
        if (finalScore < 0) return 0;
        if (finalScore > 100) return 100;
        return uint8(uint256(finalScore));
    }

    function _scoreSybilResistance(address subject) internal view returns (int16) {
        CreditRegistryV3.AggregateCreditData memory agg = registry.getAggregateCreditData(subject);
        int256 score = 0;

        // KYC
        if (agg.kyc.verifiedAt > 0 && agg.kyc.expiresAt > block.timestamp) {
            score += 150;
        } else {
            score -= 150;
        }

        // Wallet Age
        if (agg.firstSeen == 0) {
            score -= 300;
        } else {
            uint256 age = block.timestamp - agg.firstSeen;
            if (age < 30 days) score -= 300;
            else if (age < 90 days) score -= 200;
            else if (age < 180 days) score -= 100;
            else if (age < 365 days) score -= 50;
        }

        // Staking
        if (agg.stake.amount >= 1000 ether) score += 75;
        else if (agg.stake.amount >= 500 ether) score += 50;
        else if (agg.stake.amount >= 100 ether) score += 25;

        // Activity
        if (agg.totalLoans >= 10) score += 50;
        else if (agg.totalLoans >= 5) score += 30;
        else if (agg.totalLoans >= 3) score += 15;

        return int16(score);
    }

    function _normalizeS3(int16 s3Raw) internal pure returns (uint8) {
        int256 min = -450;
        int256 max = 295;
        int256 range = max - min;
        int256 normalized = ((int256(s3Raw) - min) * 100) / range;
        if (normalized < 0) return 0;
        if (normalized > 100) return 100;
        return uint8(uint256(normalized));
    }

    function _scoreCrossChainReputation(address subject) internal view returns (uint8) {
        uint256 chainCount = 0;
        uint256 totalCrossChainScore = 0;

        for (uint256 i = 0; i < supportedChainSelectors.length; i++) {
            CreditRegistryV3.CrossChainScore memory crossScore = registry.getCrossChainScore(
                subject,
                supportedChainSelectors[i]
            );
            if (crossScore.updatedAt > 0) {
                chainCount++;
                totalCrossChainScore += crossScore.overallScore;
            }
        }

        if (chainCount == 0) return 0;
        uint256 avgCrossChainScore = totalCrossChainScore / chainCount;
        uint256 baseScore = avgCrossChainScore >= 75 ? 100 : avgCrossChainScore >= 60 ? 75 : avgCrossChainScore >= 45 ? 50 : avgCrossChainScore >= 30 ? 25 : 0;
        uint256 bonus = chainCount >= 3 ? 20 : chainCount >= 2 ? 10 : 0;
        uint256 finalScore = baseScore + bonus;
        return finalScore > 100 ? 100 : uint8(finalScore);
    }

    function _scoreGovernanceParticipation(address subject) internal view returns (uint8) {
        CreditRegistryV3.GovernanceActivity memory activity = registry.getGovernanceActivity(subject);
        uint256 score = 0;

        if (activity.voteCount >= 20) score += 40;
        else if (activity.voteCount >= 10) score += 30;
        else if (activity.voteCount >= 5) score += 20;
        else if (activity.voteCount >= 1) score += 10;

        if (activity.proposalCount >= 5) score += 30;
        else if (activity.proposalCount >= 3) score += 20;
        else if (activity.proposalCount >= 1) score += 10;

        uint256 timeSinceLastVote = block.timestamp - activity.lastVoteTimestamp;
        if (activity.lastVoteTimestamp > 0) {
            if (timeSinceLastVote < 30 days) score += 30;
            else if (timeSinceLastVote < 90 days) score += 20;
            else if (timeSinceLastVote < 180 days) score += 10;
        }

        return score > 100 ? 100 : uint8(score);
    }

    // ==================== TIER FUNCTIONS ====================

    function getScoreTier(uint16 overall) external pure returns (ScoreTier) {
        if (overall >= TIER_PLATINUM) return ScoreTier.Platinum;
        if (overall >= TIER_GOLD) return ScoreTier.Gold;
        if (overall >= TIER_SILVER) return ScoreTier.Silver;
        return ScoreTier.Bronze;
    }

    function getAPR(uint16 overall) external pure returns (uint16 aprBps) {
        if (overall >= TIER_PLATINUM) return 400;
        if (overall >= TIER_GOLD) return 600;
        if (overall >= TIER_SILVER) return 800;
        if (overall >= 45) return 1000;
        if (overall >= 30) return 1200;
        return 1500;
    }

    // ==================== ADMIN ====================

    function setUserRegistry(address _userRegistry) external onlyOwner {
        address old = address(userRegistry);
        userRegistry = UserRegistry(_userRegistry);
        emit UserRegistryUpdated(old, _userRegistry);
    }

    function _addChainSelector(uint64 chainSelector) private {
        supportedChainSelectors.push(chainSelector);
        isSupportedChain[chainSelector] = true;
    }
}
