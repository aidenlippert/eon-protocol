// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "./CreditRegistryV1_1.sol";

/**
 * @title LendingPoolV1
 * @notice Dynamic interest rate lending pool with credit-based LTV
 * @dev Implements utilization-based interest rates + credit-tier risk premiums
 *
 * INTEREST RATE MODEL:
 * - Base rate: 2% APY
 * - Utilization-based slope (0-80% optimal)
 * - Punitive slope above 80% (prevents bank runs)
 * - Credit-tier risk premiums (0% for Platinum, +3% for Bronze)
 *
 * EXAMPLE RATES:
 * - 20% utilization, Platinum user: 2.5% APY * 0.8 = 2% APY
 * - 80% utilization, Gold user: 6% APY * 0.9 = 5.4% APY
 * - 95% utilization, Bronze user: 66% APY * 1.2 = 79.2% APY (force repayment!)
 */
contract LendingPoolV1 is Ownable, ReentrancyGuard {
    using SafeERC20 for IERC20;

    // ============ Structs ============

    struct UserPosition {
        uint256 collateralAmount;      // Amount of collateral deposited
        uint256 borrowedAmount;        // Amount currently borrowed
        address collateralAsset;       // Collateral token address
        uint256 lastAccrualTimestamp;  // Last time interest was accrued
        uint256 healthFactor;          // Current health factor (1e18 = 1.0)
        uint8 creditTier;              // Credit tier at time of borrow
    }

    struct AssetConfig {
        bool enabled;                  // Whether asset is enabled
        uint256 totalDeposited;        // Total amount deposited by LPs
        uint256 totalBorrowed;         // Total amount currently borrowed
        uint256 utilizationRate;       // Current utilization (1e18 = 100%)
        uint256 borrowRate;            // Current borrow APY (1e18 = 100%)
        uint256 supplyRate;            // Current supply APY (1e18 = 100%)
    }

    // ============ State Variables ============

    /// @notice Credit registry contract
    CreditRegistryV1_1 public creditRegistry;

    /// @notice User positions (user => asset => position)
    mapping(address => mapping(address => UserPosition)) public positions;

    /// @notice Asset configurations
    mapping(address => AssetConfig) public assetConfigs;

    /// @notice LP deposits (user => asset => amount)
    mapping(address => mapping(address => uint256)) public lpDeposits;

    /// @notice Supported collateral assets
    address[] public supportedCollateral;

    /// @notice Supported borrowable assets
    address[] public supportedBorrowable;

    // Interest rate model parameters
    uint256 public constant BASE_RATE = 2e16;           // 2% base APY
    uint256 public constant OPTIMAL_UTILIZATION = 80e16; // 80% optimal
    uint256 public constant SLOPE_1 = 4e16;             // 4% slope below optimal
    uint256 public constant SLOPE_2 = 60e16;            // 60% slope above optimal

    // Credit tier risk premiums (basis points)
    uint256 public constant PLATINUM_PREMIUM = 0;       // 0% premium
    uint256 public constant GOLD_PREMIUM = 50;          // +0.5%
    uint256 public constant SILVER_PREMIUM = 150;       // +1.5%
    uint256 public constant BRONZE_PREMIUM = 300;       // +3.0%

    // LTV limits by tier
    uint256 public constant PLATINUM_LTV = 90e16;       // 90%
    uint256 public constant GOLD_LTV = 75e16;           // 75%
    uint256 public constant SILVER_LTV = 65e16;         // 65%
    uint256 public constant BRONZE_LTV = 50e16;         // 50%

    // Protocol parameters
    uint256 public protocolFeePercentage = 10e16;       // 10% of interest goes to protocol
    address public treasury;

    // Minimum health factor before liquidation
    uint256 public constant MIN_HEALTH_FACTOR = 1e18;   // 1.0

    // ============ Events ============

    event Deposit(address indexed lp, address indexed asset, uint256 amount);
    event Withdraw(address indexed lp, address indexed asset, uint256 amount);
    event Borrow(address indexed user, address borrowAsset, address collateralAsset, uint256 borrowAmount, uint256 collateralAmount);
    event Repay(address indexed user, address indexed asset, uint256 amount);
    event Liquidate(address indexed user, address indexed liquidator, uint256 debtRepaid, uint256 collateralSeized);
    event InterestAccrued(address indexed user, address indexed asset, uint256 interestAmount);
    event AssetEnabled(address indexed asset, bool collateral, bool borrowable);

    // ============ Errors ============

    error AssetNotEnabled();
    error InsufficientLiquidity();
    error InvalidCreditScore();
    error ExceedsMaxLTV();
    error HealthFactorTooLow();
    error NoDebtToRepay();
    error PositionHealthy();
    error InvalidAmount();

    // ============ Constructor ============

    constructor(address _creditRegistry, address _treasury) Ownable(msg.sender) {
        require(_creditRegistry != address(0), "Invalid registry");
        require(_treasury != address(0), "Invalid treasury");

        creditRegistry = CreditRegistryV1_1(payable(_creditRegistry));
        treasury = _treasury;
    }

    // ============ LP Functions ============

    /**
     * @notice Deposit assets to earn yield
     * @param asset Asset to deposit
     * @param amount Amount to deposit
     */
    function deposit(address asset, uint256 amount) external nonReentrant {
        if (!assetConfigs[asset].enabled) revert AssetNotEnabled();
        if (amount == 0) revert InvalidAmount();

        // Transfer tokens
        IERC20(asset).safeTransferFrom(msg.sender, address(this), amount);

        // Update state
        lpDeposits[msg.sender][asset] += amount;
        assetConfigs[asset].totalDeposited += amount;

        // Update rates
        _updateRates(asset);

        emit Deposit(msg.sender, asset, amount);
    }

    /**
     * @notice Withdraw deposited assets
     * @param asset Asset to withdraw
     * @param amount Amount to withdraw
     */
    function withdraw(address asset, uint256 amount) external nonReentrant {
        if (lpDeposits[msg.sender][asset] < amount) revert InsufficientLiquidity();

        // Check available liquidity
        uint256 available = assetConfigs[asset].totalDeposited - assetConfigs[asset].totalBorrowed;
        if (available < amount) revert InsufficientLiquidity();

        // Update state
        lpDeposits[msg.sender][asset] -= amount;
        assetConfigs[asset].totalDeposited -= amount;

        // Update rates
        _updateRates(asset);

        // Transfer tokens
        IERC20(asset).safeTransfer(msg.sender, amount);

        emit Withdraw(msg.sender, asset, amount);
    }

    // ============ Borrower Functions ============

    /**
     * @notice Borrow assets with collateral
     * @param borrowAsset Asset to borrow
     * @param collateralAsset Asset to use as collateral
     * @param borrowAmount Amount to borrow
     * @param collateralAmount Amount of collateral to deposit
     */
    function borrow(
        address borrowAsset,
        address collateralAsset,
        uint256 borrowAmount,
        uint256 collateralAmount
    ) external nonReentrant {
        if (!assetConfigs[borrowAsset].enabled) revert AssetNotEnabled();
        if (borrowAmount == 0 || collateralAmount == 0) revert InvalidAmount();

        // Get user's credit score
        CreditRegistryV1_1.CreditScore memory score = creditRegistry.getScore(msg.sender);
        if (score.score == 0) revert InvalidCreditScore();

        // Get max LTV for user's tier
        uint256 maxLTV = _getMaxLTV(score.tier);

        // Calculate LTV
        // Simplified: Assume 1:1 price for MVP (in production, use Chainlink price feeds)
        uint256 ltv = (borrowAmount * 1e18) / collateralAmount;
        if (ltv > maxLTV) revert ExceedsMaxLTV();

        // Check liquidity
        uint256 available = assetConfigs[borrowAsset].totalDeposited - assetConfigs[borrowAsset].totalBorrowed;
        if (available < borrowAmount) revert InsufficientLiquidity();

        // Transfer collateral
        IERC20(collateralAsset).safeTransferFrom(msg.sender, address(this), collateralAmount);

        // Update position
        UserPosition storage position = positions[msg.sender][borrowAsset];
        position.collateralAmount += collateralAmount;
        position.borrowedAmount += borrowAmount;
        position.collateralAsset = collateralAsset;
        position.lastAccrualTimestamp = block.timestamp;
        position.creditTier = score.tier;

        // Calculate health factor
        position.healthFactor = _calculateHealthFactor(collateralAmount, borrowAmount, maxLTV);
        if (position.healthFactor < MIN_HEALTH_FACTOR) revert HealthFactorTooLow();

        // Update pool state
        assetConfigs[borrowAsset].totalBorrowed += borrowAmount;
        _updateRates(borrowAsset);

        // Transfer borrowed assets
        IERC20(borrowAsset).safeTransfer(msg.sender, borrowAmount);

        emit Borrow(msg.sender, borrowAsset, collateralAsset, borrowAmount, collateralAmount);
    }

    /**
     * @notice Repay borrowed assets
     * @param asset Asset to repay
     * @param amount Amount to repay
     */
    function repay(address asset, uint256 amount) external nonReentrant {
        UserPosition storage position = positions[msg.sender][asset];
        if (position.borrowedAmount == 0) revert NoDebtToRepay();

        // Accrue interest
        uint256 interest = _accrueInterest(msg.sender, asset);

        // Calculate total debt
        uint256 totalDebt = position.borrowedAmount + interest;
        uint256 repayAmount = amount > totalDebt ? totalDebt : amount;

        // Transfer repayment
        IERC20(asset).safeTransferFrom(msg.sender, address(this), repayAmount);

        // Update position
        position.borrowedAmount = totalDebt - repayAmount;
        position.lastAccrualTimestamp = block.timestamp;

        // If fully repaid, return collateral
        if (position.borrowedAmount == 0) {
            uint256 collateralToReturn = position.collateralAmount;
            address collateralAsset = position.collateralAsset;

            position.collateralAmount = 0;
            position.healthFactor = 0;

            IERC20(collateralAsset).safeTransfer(msg.sender, collateralToReturn);
        } else {
            // Recalculate health factor
            uint256 maxLTV = _getMaxLTV(position.creditTier);
            position.healthFactor = _calculateHealthFactor(
                position.collateralAmount,
                position.borrowedAmount,
                maxLTV
            );
        }

        // Update pool state
        assetConfigs[asset].totalBorrowed -= repayAmount;
        _updateRates(asset);

        emit Repay(msg.sender, asset, repayAmount);
    }

    /**
     * @notice Liquidate an unhealthy position
     * @param user User to liquidate
     * @param asset Asset to repay
     * @param debtAmount Amount of debt to repay
     */
    function liquidate(address user, address asset, uint256 debtAmount) external nonReentrant {
        UserPosition storage position = positions[user][asset];

        // Accrue interest
        _accrueInterest(user, asset);

        // Check if position is unhealthy
        uint256 maxLTV = _getMaxLTV(position.creditTier);
        uint256 currentHealthFactor = _calculateHealthFactor(
            position.collateralAmount,
            position.borrowedAmount,
            maxLTV
        );

        if (currentHealthFactor >= MIN_HEALTH_FACTOR) revert PositionHealthy();

        // Calculate collateral to seize (with 5% liquidation bonus)
        uint256 collateralToSeize = (debtAmount * 105) / 100; // 1:1 price assumption
        if (collateralToSeize > position.collateralAmount) {
            collateralToSeize = position.collateralAmount;
        }

        // Transfer debt repayment from liquidator
        IERC20(asset).safeTransferFrom(msg.sender, address(this), debtAmount);

        // Update position
        position.borrowedAmount -= debtAmount;
        position.collateralAmount -= collateralToSeize;

        // Update pool state
        assetConfigs[asset].totalBorrowed -= debtAmount;
        _updateRates(asset);

        // Transfer collateral to liquidator
        IERC20(position.collateralAsset).safeTransfer(msg.sender, collateralToSeize);

        emit Liquidate(user, msg.sender, debtAmount, collateralToSeize);
    }

    // ============ View Functions ============

    /**
     * @notice Get current borrow rate for a user
     * @param user User address
     * @param asset Asset address
     * @return APY in 1e18 format
     */
    function getBorrowRate(address user, address asset) external view returns (uint256) {
        CreditRegistryV1_1.CreditScore memory score = creditRegistry.getScore(user);
        uint256 baseRate = _calculateBaseRate(assetConfigs[asset].utilizationRate);
        uint256 riskPremium = _getRiskPremium(score.tier);

        return baseRate + riskPremium;
    }

    /**
     * @notice Get user's current position
     * @param user User address
     * @param asset Asset address
     * @return UserPosition struct
     */
    function getPosition(address user, address asset) external view returns (UserPosition memory) {
        return positions[user][asset];
    }

    /**
     * @notice Get asset configuration
     * @param asset Asset address
     * @return AssetConfig struct
     */
    function getAssetConfig(address asset) external view returns (AssetConfig memory) {
        return assetConfigs[asset];
    }

    // ============ Admin Functions ============

    /**
     * @notice Enable an asset for lending/borrowing
     * @param asset Asset address
     * @param collateral Whether it can be used as collateral
     * @param borrowable Whether it can be borrowed
     */
    function enableAsset(address asset, bool collateral, bool borrowable) external onlyOwner {
        require(asset != address(0), "Invalid asset");

        if (!assetConfigs[asset].enabled) {
            assetConfigs[asset].enabled = true;

            if (collateral) {
                supportedCollateral.push(asset);
            }
            if (borrowable) {
                supportedBorrowable.push(asset);
            }
        }

        emit AssetEnabled(asset, collateral, borrowable);
    }

    /**
     * @notice Update treasury address
     * @param newTreasury New treasury address
     */
    function setTreasury(address newTreasury) external onlyOwner {
        require(newTreasury != address(0), "Invalid treasury");
        treasury = newTreasury;
    }

    /**
     * @notice Update protocol fee percentage
     * @param newFee New fee percentage (1e18 = 100%)
     */
    function setProtocolFee(uint256 newFee) external onlyOwner {
        require(newFee <= 20e16, "Fee too high"); // Max 20%
        protocolFeePercentage = newFee;
    }

    // ============ Internal Functions ============

    /**
     * @notice Calculate base borrow rate from utilization
     */
    function _calculateBaseRate(uint256 utilization) internal pure returns (uint256) {
        if (utilization < OPTIMAL_UTILIZATION) {
            // Below optimal: gradual increase
            return BASE_RATE + (utilization * SLOPE_1) / OPTIMAL_UTILIZATION;
        } else {
            // Above optimal: steep increase (punitive)
            uint256 excessUtilization = utilization - OPTIMAL_UTILIZATION;
            uint256 maxExcess = 1e18 - OPTIMAL_UTILIZATION;
            return BASE_RATE + SLOPE_1 + (excessUtilization * SLOPE_2) / maxExcess;
        }
    }

    /**
     * @notice Get risk premium for credit tier
     */
    function _getRiskPremium(uint8 tier) internal pure returns (uint256) {
        if (tier == 4) return PLATINUM_PREMIUM;      // Exceptional
        if (tier == 3) return GOLD_PREMIUM;          // Very Good
        if (tier == 2) return SILVER_PREMIUM;        // Good
        if (tier == 1) return BRONZE_PREMIUM;        // Fair
        return BRONZE_PREMIUM * 2;                   // Subprime (double premium)
    }

    /**
     * @notice Get max LTV for credit tier
     */
    function _getMaxLTV(uint8 tier) internal pure returns (uint256) {
        if (tier == 4) return PLATINUM_LTV;          // 90%
        if (tier == 3) return GOLD_LTV;              // 75%
        if (tier == 2) return SILVER_LTV;            // 65%
        if (tier == 1) return BRONZE_LTV;            // 50%
        return 0;                                    // Subprime (not allowed)
    }

    /**
     * @notice Calculate health factor
     */
    function _calculateHealthFactor(
        uint256 collateral,
        uint256 debt,
        uint256 maxLTV
    ) internal pure returns (uint256) {
        if (debt == 0) return type(uint256).max;

        // Health factor = (collateral * maxLTV) / debt
        return (collateral * maxLTV) / debt;
    }

    /**
     * @notice Accrue interest for a position
     */
    function _accrueInterest(address user, address asset) internal returns (uint256) {
        UserPosition storage position = positions[user][asset];

        uint256 timeElapsed = block.timestamp - position.lastAccrualTimestamp;
        if (timeElapsed == 0) return 0;

        // Get borrow rate
        CreditRegistryV1_1.CreditScore memory score = creditRegistry.getScore(user);
        uint256 baseRate = _calculateBaseRate(assetConfigs[asset].utilizationRate);
        uint256 riskPremium = _getRiskPremium(score.tier);
        uint256 borrowRate = baseRate + riskPremium;

        // Calculate interest (simple interest for MVP)
        uint256 interest = (position.borrowedAmount * borrowRate * timeElapsed) / (365 days * 1e18);

        // Add interest to borrowed amount
        position.borrowedAmount += interest;
        position.lastAccrualTimestamp = block.timestamp;

        emit InterestAccrued(user, asset, interest);

        return interest;
    }

    /**
     * @notice Update utilization and interest rates
     */
    function _updateRates(address asset) internal {
        AssetConfig storage config = assetConfigs[asset];

        // Calculate utilization
        if (config.totalDeposited == 0) {
            config.utilizationRate = 0;
        } else {
            config.utilizationRate = (config.totalBorrowed * 1e18) / config.totalDeposited;
        }

        // Calculate borrow rate
        config.borrowRate = _calculateBaseRate(config.utilizationRate);

        // Calculate supply rate (borrow rate * utilization * (1 - protocol fee))
        config.supplyRate = (config.borrowRate * config.utilizationRate * (1e18 - protocolFeePercentage)) / 1e36;
    }
}
