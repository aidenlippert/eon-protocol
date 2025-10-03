// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/Ownable.sol";

interface IReputationScorer {
    function getDynamicLTV(address user) external view returns (uint256);
}

interface ILendingPool {
    function getLoan(uint256 loanId) external view returns (
        address borrower,
        uint256 collateralAmount,
        uint256 borrowedAmount,
        uint256 interestRate,
        uint256 startTime,
        uint256 duration,
        bool active
    );
}

interface IPriceOracle {
    function getPrice(address token) external view returns (uint256);
}

/**
 * @title HealthFactorMonitor
 * @notice Real-time health factor monitoring for all active loans
 * @dev Health Factor = (Collateral Value × Dynamic LTV) / Debt Value
 *      Liquidation threshold: HF < 0.95
 */
contract HealthFactorMonitor is Ownable {

    // ============ Structs ============

    struct HealthStatus {
        uint256 collateralValue;    // In USD (18 decimals)
        uint256 debtValue;          // In USD (18 decimals)
        uint256 dynamicLTV;         // Percentage (50-90)
        uint256 healthFactor;       // Scaled by 1e18
        bool liquidatable;          // True if HF <= 0.95
        uint256 lastUpdate;         // Timestamp of last update
    }

    // ============ State Variables ============

    IReputationScorer public reputationScorer;
    ILendingPool public lendingPool;
    IPriceOracle public priceOracle;

    // borrower => loanId => HealthStatus
    mapping(address => mapping(uint256 => HealthStatus)) public healthStatuses;

    // Liquidation threshold (95% = 0.95e18)
    uint256 public LIQUIDATION_THRESHOLD = 0.95e18;
    uint256 public constant PRECISION = 1e18;

    // ============ Events ============

    event HealthFactorUpdated(
        address indexed borrower,
        uint256 indexed loanId,
        uint256 healthFactor,
        bool liquidatable
    );

    event HealthFactorCritical(
        address indexed borrower,
        uint256 indexed loanId,
        uint256 healthFactor
    );

    event OracleUpdated(address indexed newOracle);
    event ThresholdUpdated(uint256 newThreshold);

    // ============ Constructor ============

    constructor(
        address _reputationScorer,
        address _lendingPool,
        address _priceOracle
    ) Ownable(msg.sender) {
        reputationScorer = IReputationScorer(_reputationScorer);
        lendingPool = ILendingPool(_lendingPool);
        priceOracle = IPriceOracle(_priceOracle);
    }

    // ============ External Functions ============

    /**
     * @notice Calculate health factor for a loan
     * @param borrower Address of the borrower
     * @param loanId ID of the loan
     * @return Health factor scaled by 1e18
     */
    function calculateHealthFactor(
        address borrower,
        uint256 loanId
    ) external returns (uint256) {
        (
            ,
            uint256 collateralAmount,
            uint256 borrowedAmount,
            ,
            ,
            ,
            bool active
        ) = lendingPool.getLoan(loanId);

        require(active, "Loan not active");

        // Get dynamic LTV based on reputation
        uint256 dynamicLTV = reputationScorer.getDynamicLTV(borrower);

        // Get collateral value from price oracle
        // For now, assuming ETH collateral - will need token address parameter
        uint256 collateralValue = collateralAmount; // TODO: Multiply by price

        // Calculate debt value (borrowed amount + accrued interest)
        uint256 debtValue = borrowedAmount; // TODO: Add accrued interest

        // Calculate health factor
        // HF = (collateralValue × LTV%) / debtValue
        uint256 healthFactor;
        if (debtValue == 0) {
            healthFactor = type(uint256).max; // Infinite HF when no debt
        } else if (collateralAmount == 0) {
            healthFactor = 0; // Zero HF when no collateral
        } else {
            healthFactor = (collateralValue * dynamicLTV * PRECISION) / (debtValue * 100);
        }

        // Check if liquidatable (HF <= threshold, not <)
        bool liquidatable = healthFactor <= LIQUIDATION_THRESHOLD;

        // Store health status
        healthStatuses[borrower][loanId] = HealthStatus({
            collateralValue: collateralValue,
            debtValue: debtValue,
            dynamicLTV: dynamicLTV,
            healthFactor: healthFactor,
            liquidatable: liquidatable,
            lastUpdate: block.timestamp
        });

        emit HealthFactorUpdated(borrower, loanId, healthFactor, liquidatable);

        if (liquidatable) {
            emit HealthFactorCritical(borrower, loanId, healthFactor);
        }

        return healthFactor;
    }

    /**
     * @notice Check if a loan is liquidatable
     * @param borrower Address of the borrower
     * @param loanId ID of the loan
     * @return Whether the loan can be liquidated
     */
    function isLiquidatable(
        address borrower,
        uint256 loanId
    ) external view returns (bool) {
        HealthStatus memory status = healthStatuses[borrower][loanId];

        // If never calculated, return false
        if (status.lastUpdate == 0) {
            return false;
        }

        return status.healthFactor <= LIQUIDATION_THRESHOLD;
    }

    /**
     * @notice Get health status for a loan
     * @param borrower Address of the borrower
     * @param loanId ID of the loan
     * @return HealthStatus struct
     */
    function getHealthStatus(
        address borrower,
        uint256 loanId
    ) external view returns (HealthStatus memory) {
        return healthStatuses[borrower][loanId];
    }

    /**
     * @notice Batch calculate health factors for multiple loans
     * @param borrowers Array of borrower addresses
     * @param loanIds Array of loan IDs
     */
    function batchCalculateHealthFactors(
        address[] calldata borrowers,
        uint256[] calldata loanIds
    ) external {
        require(borrowers.length == loanIds.length, "Array length mismatch");

        for (uint256 i = 0; i < borrowers.length; i++) {
            try this.calculateHealthFactor(borrowers[i], loanIds[i]) {
                // Success
            } catch {
                // Skip failed calculations
                continue;
            }
        }
    }

    /**
     * @notice Get liquidation risk level
     * @param borrower Address of the borrower
     * @param loanId ID of the loan
     * @return Risk level: 0 (Safe), 1 (Warning), 2 (Danger), 3 (Critical)
     */
    function getRiskLevel(
        address borrower,
        uint256 loanId
    ) external view returns (uint8) {
        HealthStatus memory status = healthStatuses[borrower][loanId];

        if (status.healthFactor >= 1.2e18) {
            return 0; // Safe (HF >= 1.2)
        } else if (status.healthFactor >= 1.05e18) {
            return 1; // Warning (1.05 <= HF < 1.2)
        } else if (status.healthFactor > LIQUIDATION_THRESHOLD) {
            return 2; // Danger (0.95 < HF < 1.05)
        } else {
            return 3; // Critical (HF <= 0.95 - Liquidatable)
        }
    }

    /**
     * @notice Calculate required collateral to reach target health factor
     * @param borrower Address of the borrower
     * @param loanId ID of the loan
     * @param targetHF Target health factor (e.g., 1.5e18 for 1.5)
     * @return Additional collateral needed
     */
    function getRequiredCollateral(
        address borrower,
        uint256 loanId,
        uint256 targetHF
    ) external view returns (uint256) {
        HealthStatus memory status = healthStatuses[borrower][loanId];

        if (status.healthFactor >= targetHF) {
            return 0; // Already above target
        }

        // Required collateral = (targetHF × debtValue × 100) / (LTV × PRECISION)
        uint256 requiredCollateral = (targetHF * status.debtValue * 100) / (status.dynamicLTV * PRECISION);
        uint256 additionalCollateral = requiredCollateral > status.collateralValue
            ? requiredCollateral - status.collateralValue
            : 0;

        return additionalCollateral;
    }

    // ============ Admin Functions ============

    /**
     * @notice Update reputation scorer address
     * @param _reputationScorer New reputation scorer address
     */
    function setReputationScorer(address _reputationScorer) external onlyOwner {
        reputationScorer = IReputationScorer(_reputationScorer);
    }

    /**
     * @notice Update lending pool address
     * @param _lendingPool New lending pool address
     */
    function setLendingPool(address _lendingPool) external onlyOwner {
        lendingPool = ILendingPool(_lendingPool);
    }

    /**
     * @notice Update price oracle address
     * @param _priceOracle New price oracle address
     */
    function setPriceOracle(address _priceOracle) external onlyOwner {
        priceOracle = IPriceOracle(_priceOracle);
    }

    /**
     * @notice Update oracle address (alias for setPriceOracle)
     * @param newOracle New oracle address
     */
    function updateOracle(address newOracle) external onlyOwner {
        priceOracle = IPriceOracle(newOracle);
        emit OracleUpdated(newOracle);
    }

    /**
     * @notice Update liquidation threshold
     * @param newThreshold New threshold (e.g., 0.9e18 for 90%)
     */
    function updateLiquidationThreshold(uint256 newThreshold) external onlyOwner {
        require(newThreshold > 0 && newThreshold <= 1e18, "Invalid threshold");
        LIQUIDATION_THRESHOLD = newThreshold;
        emit ThresholdUpdated(newThreshold);
    }
}
