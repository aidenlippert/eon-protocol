// SPDX-License-Identifier: MIT
pragma solidity 0.8.20;

import "@openzeppelin/contracts/access/Ownable.sol";
import "./CreditRegistryV1_1.sol";

/**
 * @title ScoreOracleSimple
 * @notice Simple oracle that wraps existing CreditRegistry scores
 * @dev Phase 1: Uses existing registry, provides compatibility layer for CreditVault
 */
contract ScoreOracleSimple is Ownable {
    CreditRegistryV1_1 public immutable registry;

    // Score range
    uint16 public constant MIN_SCORE = 300;
    uint16 public constant MAX_SCORE = 850;

    // APR configuration (basis points)
    uint16 public baseAPR = 800;  // 8% base rate
    uint16 public minAPR = 200;   // 2% minimum
    uint16 public maxAPR = 2000;  // 20% maximum

    struct ScoreBreakdown {
        uint8 repayment;      // Placeholder
        uint8 collateral;     // Placeholder
        int16 sybil;          // Placeholder
        uint8 crossChain;     // Placeholder
        uint8 participation;  // Placeholder
        uint16 overall;       // Actual score from registry
    }

    event APRConfigUpdated(uint16 baseAPR, uint16 minAPR, uint16 maxAPR);

    constructor(address payable _registry) Ownable(msg.sender) {
        require(_registry != address(0), "Invalid registry");
        registry = CreditRegistryV1_1(_registry);
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

    // ==================== SCORING ====================

    /**
     * @notice Get score from registry
     * @param subject Address to score
     * @return breakdown Score breakdown (overall is actual score, others are placeholders)
     */
    function computeScore(address subject) external view returns (ScoreBreakdown memory breakdown) {
        CreditRegistryV1_1.CreditScore memory registryScore = registry.getScore(subject);

        // If no score exists, return minimum
        if (registryScore.score == 0) {
            breakdown.overall = MIN_SCORE;
        } else {
            breakdown.overall = registryScore.score;
        }

        // Placeholders for compatibility
        breakdown.repayment = 50;
        breakdown.collateral = 50;
        breakdown.sybil = 0;
        breakdown.crossChain = 0;
        breakdown.participation = 0;
    }

    /**
     * @notice Get APR for a given score
     * @param score Overall credit score (300-850)
     * @return aprBps Annual percentage rate in basis points
     */
    function getAPR(uint16 score) external view returns (uint16 aprBps) {
        require(score >= MIN_SCORE && score <= MAX_SCORE, "Invalid score");

        // Linear scaling: better score = lower APR
        // score 850 → minAPR (2%)
        // score 300 → maxAPR (20%)

        uint256 range = MAX_SCORE - MIN_SCORE; // 550
        uint256 aprRange = maxAPR - minAPR;    // 1800

        // Calculate: maxAPR - ((score - MIN_SCORE) * aprRange / range)
        uint256 adjustment = ((score - MIN_SCORE) * aprRange) / range;
        aprBps = uint16(maxAPR - adjustment);
    }
}
