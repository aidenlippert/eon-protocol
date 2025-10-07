// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";

/**
 * @title InterestRateModelV1
 * @notice Utilization-based interest rate model (Compound/Aave inspired)
 * @dev Calculates borrow and supply APY based on pool utilization
 *
 * Formula (Compound V2 Jump Rate Model):
 * - Base Rate: Minimum interest rate when utilization = 0%
 * - Multiplier: Rate increase per utilization percentage
 * - Kink: Optimal utilization point (e.g., 80%)
 * - Jump Multiplier: Steep rate increase above kink
 *
 * Example:
 * Utilization < 80%: APY = Base + (Utilization * Multiplier)
 * Utilization > 80%: APY = Base + (Kink * Multiplier) + ((Util - Kink) * JumpMult)
 *
 * Real World Example (USDC on Aave):
 * - Base: 0%
 * - Optimal (Kink): 80%
 * - Rate at Optimal: 4%
 * - Max Rate: 60%
 */
contract InterestRateModelV1 is Initializable, OwnableUpgradeable {
    /// @notice Interest rate parameters (in basis points for precision)
    uint256 public constant PRECISION = 1e18;
    uint256 public constant SECONDS_PER_YEAR = 365 days;
    uint256 public constant BASIS_POINTS = 10000;

    /// @notice Base interest rate (when utilization = 0%)
    uint256 public baseRatePerYear;

    /// @notice Multiplier per year (slope before kink)
    uint256 public multiplierPerYear;

    /// @notice Kink utilization point (e.g., 0.8e18 = 80%)
    uint256 public kink;

    /// @notice Jump multiplier per year (steep slope after kink)
    uint256 public jumpMultiplierPerYear;

    /// @notice Events
    event RateModelUpdated(
        uint256 baseRate,
        uint256 multiplier,
        uint256 kink,
        uint256 jumpMultiplier
    );

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    /**
     * @notice Initialize interest rate model
     * @param _baseRatePerYear Base APY when util = 0% (e.g., 0 = 0%)
     * @param _multiplierPerYear Rate slope before kink (e.g., 0.04e18 = 4%)
     * @param _jumpMultiplierPerYear Rate slope after kink (e.g., 0.6e18 = 60%)
     * @param _kink Optimal utilization (e.g., 0.8e18 = 80%)
     */
    function initialize(
        uint256 _baseRatePerYear,
        uint256 _multiplierPerYear,
        uint256 _jumpMultiplierPerYear,
        uint256 _kink
    ) external initializer {
        __Ownable_init(msg.sender);

        baseRatePerYear = _baseRatePerYear;
        multiplierPerYear = _multiplierPerYear;
        jumpMultiplierPerYear = _jumpMultiplierPerYear;
        kink = _kink;

        emit RateModelUpdated(
            _baseRatePerYear,
            _multiplierPerYear,
            _kink,
            _jumpMultiplierPerYear
        );
    }

    /**
     * @notice Calculate borrow APY based on utilization
     * @dev Compound V2 Jump Rate Model formula
     * @param cash Available liquidity in pool
     * @param borrows Total borrowed amount
     * @param reserves Protocol reserves
     * @return borrowRate Borrow APY (scaled by PRECISION)
     */
    function getBorrowRate(
        uint256 cash,
        uint256 borrows,
        uint256 reserves
    ) public view returns (uint256) {
        uint256 utilization = getUtilizationRate(cash, borrows, reserves);

        if (utilization <= kink) {
            // Before kink: baseRate + (utilization * multiplier)
            return baseRatePerYear +
                   (utilization * multiplierPerYear) / PRECISION;
        } else {
            // After kink: baseRate + (kink * multiplier) + ((util - kink) * jumpMult)
            uint256 normalRate = baseRatePerYear +
                                (kink * multiplierPerYear) / PRECISION;
            uint256 excessUtil = utilization - kink;
            uint256 jumpRate = (excessUtil * jumpMultiplierPerYear) / PRECISION;

            return normalRate + jumpRate;
        }
    }

    /**
     * @notice Calculate supply APY (what lenders earn)
     * @dev Supply Rate = Borrow Rate * Utilization * (1 - Reserve Factor)
     * @param cash Available liquidity
     * @param borrows Total borrowed
     * @param reserves Protocol reserves
     * @param reserveFactor Reserve factor (e.g., 0.1e18 = 10%)
     * @return supplyRate Supply APY (scaled by PRECISION)
     */
    function getSupplyRate(
        uint256 cash,
        uint256 borrows,
        uint256 reserves,
        uint256 reserveFactor
    ) public view returns (uint256) {
        uint256 oneMinusReserveFactor = PRECISION - reserveFactor;
        uint256 borrowRate = getBorrowRate(cash, borrows, reserves);
        uint256 utilization = getUtilizationRate(cash, borrows, reserves);

        // Supply rate = borrow rate * utilization * (1 - reserve factor)
        return (borrowRate * utilization * oneMinusReserveFactor) /
               (PRECISION * PRECISION);
    }

    /**
     * @notice Calculate pool utilization rate
     * @dev Utilization = Borrows / (Cash + Borrows - Reserves)
     * @param cash Available liquidity
     * @param borrows Total borrowed
     * @param reserves Protocol reserves
     * @return utilization Utilization rate (scaled by PRECISION)
     */
    function getUtilizationRate(
        uint256 cash,
        uint256 borrows,
        uint256 reserves
    ) public pure returns (uint256) {
        if (borrows == 0) {
            return 0;
        }

        // Total = cash + borrows - reserves
        uint256 total = cash + borrows - reserves;

        if (total == 0) {
            return 0;
        }

        // Utilization = borrows / total
        return (borrows * PRECISION) / total;
    }

    /**
     * @notice Calculate borrow APY in human-readable percentage
     * @dev Converts from per-second rate to APY
     * @param cash Available liquidity
     * @param borrows Total borrowed
     * @param reserves Protocol reserves
     * @return apy Annual Percentage Yield (e.g., 500 = 5%)
     */
    function getBorrowAPY(
        uint256 cash,
        uint256 borrows,
        uint256 reserves
    ) external view returns (uint256 apy) {
        uint256 borrowRate = getBorrowRate(cash, borrows, reserves);
        // Convert to percentage (10000 = 100%)
        apy = (borrowRate * BASIS_POINTS) / PRECISION;
    }

    /**
     * @notice Calculate supply APY in human-readable percentage
     * @param cash Available liquidity
     * @param borrows Total borrowed
     * @param reserves Protocol reserves
     * @param reserveFactor Reserve factor
     * @return apy Annual Percentage Yield
     */
    function getSupplyAPY(
        uint256 cash,
        uint256 borrows,
        uint256 reserves,
        uint256 reserveFactor
    ) external view returns (uint256 apy) {
        uint256 supplyRate = getSupplyRate(cash, borrows, reserves, reserveFactor);
        apy = (supplyRate * BASIS_POINTS) / PRECISION;
    }

    /**
     * @notice Update interest rate model (governance)
     * @param _baseRatePerYear New base rate
     * @param _multiplierPerYear New multiplier
     * @param _jumpMultiplierPerYear New jump multiplier
     * @param _kink New kink point
     */
    function updateRateModel(
        uint256 _baseRatePerYear,
        uint256 _multiplierPerYear,
        uint256 _jumpMultiplierPerYear,
        uint256 _kink
    ) external onlyOwner {
        baseRatePerYear = _baseRatePerYear;
        multiplierPerYear = _multiplierPerYear;
        jumpMultiplierPerYear = _jumpMultiplierPerYear;
        kink = _kink;

        emit RateModelUpdated(
            _baseRatePerYear,
            _multiplierPerYear,
            _kink,
            _jumpMultiplierPerYear
        );
    }

    /**
     * @notice Get current rate model parameters
     */
    function getRateModelParams()
        external
        view
        returns (
            uint256 baseRate,
            uint256 multiplier,
            uint256 kinkPoint,
            uint256 jumpMultiplier
        )
    {
        return (
            baseRatePerYear,
            multiplierPerYear,
            kink,
            jumpMultiplierPerYear
        );
    }
}
