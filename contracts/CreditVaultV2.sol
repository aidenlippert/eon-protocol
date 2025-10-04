// SPDX-License-Identifier: MIT
pragma solidity 0.8.20;

import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

import "./CreditRegistryV2.sol";
import "./ScoreOraclePhase3.sol";
import "./interfaces/IAggregatorV3.sol";

/**
 * @title CreditVaultV2
 * @notice Phase 3 lending vault with full registry integration and feedback loop
 * @dev Registry-first architecture: canonical loan IDs from registry, vault stores implementation details
 *
 * KEY FEATURES:
 * - Score-based LTV (50%, 70%, 80%, 90%)
 * - Tiered grace periods (24h, 36h, 48h, 72h)
 * - 10% liquidation penalty (5% liquidator, 5% insurance)
 * - Simple interest accrual
 * - Health factor checks (minimum 1.2)
 * - Full registry integration (loans, repayments, liquidations)
 *
 * FEEDBACK LOOP:
 * Borrow → Registry → Score Updates → Better/Worse LTV Next Time
 */
contract CreditVaultV2 is Ownable, ReentrancyGuard, Pausable {
    using SafeERC20 for IERC20;

    // ==================== STATE ====================

    CreditRegistryV2 public immutable registry;
    ScoreOraclePhase3 public oracle;

    // LTV bands based on 0-100 score
    uint16 public constant LTV_BRONZE = 50;    // <60
    uint16 public constant LTV_SILVER = 70;    // 60-74
    uint16 public constant LTV_GOLD = 80;      // 75-89
    uint16 public constant LTV_PLATINUM = 90;  // 90-100

    // Grace periods
    uint256 public constant GRACE_BRONZE = 24 hours;
    uint256 public constant GRACE_SILVER = 36 hours;
    uint256 public constant GRACE_GOLD = 48 hours;
    uint256 public constant GRACE_PLATINUM = 72 hours;

    // Liquidation penalty
    uint16 public constant LIQUIDATION_PENALTY_BPS = 1000; // 10%
    uint16 public constant LIQUIDATOR_SHARE_BPS = 500;     // 5%
    uint16 public constant INSURANCE_SHARE_BPS = 500;      // 5%

    // Health factor minimum for withdrawals
    uint256 public constant MIN_HEALTH_FACTOR = 12e17; // 1.2

    /**
     * @dev Vault-specific loan data (keyed by registry loanId)
     * Registry stores canonical data, vault stores implementation details
     */
    struct VaultLoanData {
        address collateralToken;
        uint256 collateralAmount;
        uint256 aprBps;
        uint256 startTimestamp;
        uint256 graceStart;          // When grace period started (0 if not triggered)
        bool exists;                 // Track if loan exists in vault
    }

    struct AssetConfig {
        bool allowed;
        address priceFeed;
    }

    // Registry loanId => vault-specific data
    mapping(uint256 => VaultLoanData) public vaultLoans;

    // Asset configuration
    mapping(address => AssetConfig) public assets;

    // User collateral tracking (for withdrawals)
    mapping(address => uint256) public userCollateral;

    address public insurancePool;

    // ==================== EVENTS ====================

    event LoanCreated(uint256 indexed loanId, address indexed borrower, uint256 principal, uint256 collateral, address collateralToken);
    event LoanRepaid(uint256 indexed loanId, address indexed borrower, uint256 amount, uint256 remaining);
    event LoanLiquidated(uint256 indexed loanId, address indexed borrower, address indexed liquidator, uint256 collateralSeized);
    event CollateralDeposited(address indexed user, address indexed token, uint256 amount, uint256 usdValue);
    event CollateralWithdrawn(address indexed user, address indexed token, uint256 amount, uint256 usdValue);
    event AssetConfigured(address indexed token, address priceFeed, bool allowed);
    event InsurancePoolSet(address indexed pool);
    event OracleUpdated(address indexed newOracle);
    event GracePeriodStarted(uint256 indexed loanId, uint256 timestamp);

    // ==================== CONSTRUCTOR ====================

    constructor(
        address payable _registry,
        address _oracle
    ) Ownable(msg.sender) {
        require(_registry != address(0), "Invalid registry");
        require(_oracle != address(0), "Invalid oracle");

        registry = CreditRegistryV2(_registry);
        oracle = ScoreOraclePhase3(_oracle);
    }

    // ==================== ADMIN ====================

    function setOracle(address _oracle) external onlyOwner {
        require(_oracle != address(0), "Invalid oracle");
        oracle = ScoreOraclePhase3(_oracle);
        emit OracleUpdated(_oracle);
    }

    function setAsset(address token, address priceFeed, bool allowed) external onlyOwner {
        require(token != address(0), "Invalid token");
        require(priceFeed != address(0), "Invalid price feed");
        assets[token] = AssetConfig(allowed, priceFeed);
        emit AssetConfigured(token, priceFeed, allowed);
    }

    function setInsurancePool(address _pool) external onlyOwner {
        require(_pool != address(0), "Invalid pool");
        insurancePool = _pool;
        emit InsurancePoolSet(_pool);
    }

    function pause() external onlyOwner {
        _pause();
    }

    function unpause() external onlyOwner {
        _unpause();
    }

    // ==================== USER FUNCTIONS ====================

    /**
     * @notice Deposit collateral
     */
    function depositCollateral(address token, uint256 amount) external nonReentrant whenNotPaused {
        require(assets[token].allowed, "Asset not allowed");
        require(amount > 0, "Zero amount");

        IERC20(token).safeTransferFrom(msg.sender, address(this), amount);

        uint256 usdValue = _tokenAmountToUsd18(token, amount);
        userCollateral[msg.sender] += usdValue;

        emit CollateralDeposited(msg.sender, token, amount, usdValue);
    }

    /**
     * @notice Withdraw collateral (health factor check)
     */
    function withdrawCollateral(address token, uint256 amount) external nonReentrant whenNotPaused {
        require(assets[token].allowed, "Asset not allowed");
        require(amount > 0, "Zero amount");

        uint256 usdValue = _tokenAmountToUsd18(token, amount);
        require(userCollateral[msg.sender] >= usdValue, "Insufficient collateral");

        userCollateral[msg.sender] -= usdValue;

        // Check health factor after withdrawal
        uint256 totalBorrowed = _getTotalBorrowed(msg.sender);
        if (totalBorrowed > 0) {
            uint256 healthFactor = (userCollateral[msg.sender] * 1e18) / totalBorrowed;
            require(healthFactor >= MIN_HEALTH_FACTOR, "Health factor too low");
        }

        IERC20(token).safeTransfer(msg.sender, amount);
        emit CollateralWithdrawn(msg.sender, token, amount, usdValue);
    }

    /**
     * @notice Borrow against collateral
     * @dev Registry-first: get loanId from registry, then store vault data
     */
    function borrow(
        address collateralToken,
        uint256 collateralAmount,
        uint256 principalUsd18
    ) external nonReentrant whenNotPaused returns (uint256 loanId) {
        require(assets[collateralToken].allowed, "Asset not allowed");
        require(collateralAmount > 0, "Zero collateral");
        require(principalUsd18 > 0, "Zero principal");

        // Get score and max LTV
        ScoreOraclePhase3.ScoreBreakdown memory score = oracle.computeScore(msg.sender);
        uint16 maxLtvPercent = _maxLtvForScore(score.overall);

        // Check LTV
        uint256 collateralUsd18 = _tokenAmountToUsd18(collateralToken, collateralAmount);
        require(principalUsd18 * 100 <= collateralUsd18 * maxLtvPercent, "Exceeds allowed LTV");

        // Get APR
        uint16 apr = oracle.getAPR(score.overall);

        // Transfer collateral
        IERC20(collateralToken).safeTransferFrom(msg.sender, address(this), collateralAmount);

        // Register loan in registry (get canonical loanId)
        loanId = registry.registerLoan(msg.sender, principalUsd18);

        // Store vault-specific data
        vaultLoans[loanId] = VaultLoanData({
            collateralToken: collateralToken,
            collateralAmount: collateralAmount,
            aprBps: apr,
            startTimestamp: block.timestamp,
            graceStart: 0,
            exists: true
        });

        emit LoanCreated(loanId, msg.sender, principalUsd18, collateralAmount, collateralToken);

        // TODO: Transfer borrowed funds to user (requires liquidity pool)
    }

    /**
     * @notice Repay loan
     */
    function repay(uint256 loanId, uint256 amountUsd18) external nonReentrant whenNotPaused {
        VaultLoanData storage vaultData = vaultLoans[loanId];
        require(vaultData.exists, "Loan not found");

        CreditRegistryV2.LoanRecord memory loan = registry.getLoan(loanId);
        require(loan.status == CreditRegistryV2.LoanStatus.Active, "Loan not active");
        require(amountUsd18 > 0, "Zero amount");

        uint256 debt = _calculateDebt(loanId);
        require(amountUsd18 <= debt, "Amount exceeds debt");

        // Register repayment in registry
        registry.registerRepayment(loanId, amountUsd18);

        // If full repayment, return collateral
        if (amountUsd18 >= debt) {
            IERC20(vaultData.collateralToken).safeTransfer(loan.borrower, vaultData.collateralAmount);
            emit LoanRepaid(loanId, loan.borrower, amountUsd18, 0);
        } else {
            emit LoanRepaid(loanId, loan.borrower, amountUsd18, debt - amountUsd18);
        }

        // TODO: Accept repayment funds from user
    }

    /**
     * @notice Liquidate unhealthy loan
     * @dev First call may start grace period, second call (after grace) executes liquidation
     */
    function liquidate(uint256 loanId) external nonReentrant whenNotPaused {
        VaultLoanData storage vaultData = vaultLoans[loanId];
        require(vaultData.exists, "Loan not found");

        CreditRegistryV2.LoanRecord memory loan = registry.getLoan(loanId);
        require(loan.status == CreditRegistryV2.LoanStatus.Active, "Loan not active");

        bool canLiquidate = _checkLiquidationEligibility(loanId, vaultData, loan.borrower);

        if (!canLiquidate) {
            // Grace period started or still active - don't execute liquidation
            return;
        }

        _executeLiquidation(loanId, vaultData, loan.borrower);
    }

    function _checkLiquidationEligibility(
        uint256 loanId,
        VaultLoanData storage vaultData,
        address borrower
    ) private returns (bool) {
        uint256 debt = _calculateDebt(loanId);
        uint256 collateralUsd18 = _tokenAmountToUsd18(vaultData.collateralToken, vaultData.collateralAmount);

        ScoreOraclePhase3.ScoreBreakdown memory score = oracle.computeScore(borrower);
        uint16 maxLtvPercent = _maxLtvForScore(score.overall);
        uint256 liquidationThreshold = maxLtvPercent + 10;

        bool thresholdExceeded = (debt * 100 > collateralUsd18 * liquidationThreshold);

        if (thresholdExceeded) {
            // Liquidation threshold exceeded - can liquidate immediately
            return true;
        }

        // Below liquidation threshold - check grace period
        uint256 gracePeriod = _gracePeriodForScore(score.overall);

        if (vaultData.graceStart == 0) {
            // Start grace period (transaction succeeds, but liquidation doesn't happen)
            vaultData.graceStart = block.timestamp;
            emit GracePeriodStarted(loanId, block.timestamp);
            return false;
        }

        // Grace period already started - check if expired
        if (block.timestamp >= vaultData.graceStart + gracePeriod) {
            return true; // Grace expired, can liquidate
        }

        return false; // Still in grace period
    }

    function _executeLiquidation(
        uint256 loanId,
        VaultLoanData storage vaultData,
        address borrower
    ) private {
        uint256 collateralAmt = vaultData.collateralAmount;
        address collateralTkn = vaultData.collateralToken;

        uint256 liquidatorReward = (collateralAmt * LIQUIDATOR_SHARE_BPS) / 10000;
        uint256 insuranceReward = (collateralAmt * INSURANCE_SHARE_BPS) / 10000;
        uint256 penaltyAmount = liquidatorReward + insuranceReward;
        uint256 remaining = collateralAmt - penaltyAmount;

        IERC20(collateralTkn).safeTransfer(msg.sender, liquidatorReward);
        if (insurancePool != address(0)) {
            IERC20(collateralTkn).safeTransfer(insurancePool, insuranceReward);
        }

        if (remaining > 0) {
            IERC20(collateralTkn).safeTransfer(borrower, remaining);
        }

        uint256 recoveredUsd18 = _tokenAmountToUsd18(collateralTkn, penaltyAmount);
        registry.registerLiquidation(loanId, recoveredUsd18);

        emit LoanLiquidated(loanId, borrower, msg.sender, collateralAmt);
    }

    // ==================== VIEW FUNCTIONS ====================

    function getVaultLoanData(uint256 loanId) external view returns (VaultLoanData memory) {
        return vaultLoans[loanId];
    }

    function calculateDebt(uint256 loanId) external view returns (uint256) {
        return _calculateDebt(loanId);
    }

    function getHealthFactor(uint256 loanId) external view returns (uint256) {
        VaultLoanData memory vaultData = vaultLoans[loanId];
        if (!vaultData.exists) return 0;

        CreditRegistryV2.LoanRecord memory loan = registry.getLoan(loanId);
        if (loan.status != CreditRegistryV2.LoanStatus.Active) return 0;

        uint256 debt = _calculateDebt(loanId);
        uint256 collateralUsd18 = _tokenAmountToUsd18(vaultData.collateralToken, vaultData.collateralAmount);

        return (collateralUsd18 * 1e18) / debt;
    }

    function getUserHealthFactor(address user) external view returns (uint256) {
        uint256 totalBorrowed = _getTotalBorrowed(user);
        if (totalBorrowed == 0) return type(uint256).max;

        return (userCollateral[user] * 1e18) / totalBorrowed;
    }

    // ==================== INTERNAL ====================

    function _calculateDebt(uint256 loanId) internal view returns (uint256) {
        VaultLoanData memory vaultData = vaultLoans[loanId];
        if (!vaultData.exists) return 0;

        CreditRegistryV2.LoanRecord memory loan = registry.getLoan(loanId);
        if (loan.status != CreditRegistryV2.LoanStatus.Active) return 0;

        uint256 timeElapsed = block.timestamp - vaultData.startTimestamp;
        uint256 interest = (loan.principalUsd18 * vaultData.aprBps * timeElapsed) / (10000 * 365 days);

        return loan.principalUsd18 + interest;
    }

    function _tokenAmountToUsd18(address token, uint256 amount) internal view returns (uint256) {
        AssetConfig memory config = assets[token];
        require(config.allowed, "Asset not allowed");

        IAggregatorV3 feed = IAggregatorV3(config.priceFeed);
        (, int256 price, , , ) = feed.latestRoundData();
        require(price > 0, "Invalid price");

        uint8 decimals = feed.decimals();
        uint8 tokenDecimals = _getTokenDecimals(token);

        // Convert to 18 decimals
        return (amount * uint256(price) * 1e18) / (10 ** (tokenDecimals + decimals));
    }

    function _getTokenDecimals(address token) internal view returns (uint8) {
        try IERC20Metadata(token).decimals() returns (uint8 d) {
            return d;
        } catch {
            return 18;
        }
    }

    function _maxLtvForScore(uint16 score) internal pure returns (uint16) {
        if (score >= 90) return LTV_PLATINUM;  // 90-100: 90%
        if (score >= 75) return LTV_GOLD;      // 75-89: 80%
        if (score >= 60) return LTV_SILVER;    // 60-74: 70%
        return LTV_BRONZE;                     // <60: 50%
    }

    function _gracePeriodForScore(uint16 score) internal pure returns (uint256) {
        if (score >= 90) return GRACE_PLATINUM;
        if (score >= 75) return GRACE_GOLD;
        if (score >= 60) return GRACE_SILVER;
        return GRACE_BRONZE;
    }

    function _getTotalBorrowed(address user) internal view returns (uint256) {
        uint256[] memory loanIds = registry.getLoanIdsByBorrower(user);
        uint256 total = 0;

        for (uint256 i = 0; i < loanIds.length; i++) {
            CreditRegistryV2.LoanRecord memory loan = registry.getLoan(loanIds[i]);
            if (loan.status == CreditRegistryV2.LoanStatus.Active) {
                total += _calculateDebt(loanIds[i]);
            }
        }

        return total;
    }
}

interface IERC20Metadata {
    function decimals() external view returns (uint8);
}
