// SPDX-License-Identifier: MIT
pragma solidity 0.8.20;

import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

import "./CreditRegistryV1_1.sol";
import "./ScoreOracleSimple.sol";
import "./interfaces/IAggregatorV3.sol";

/**
 * @title CreditVault
 * @notice Main lending contract with score-based LTV, grace periods, and liquidation logic
 * @dev Phase 1: Works with ScoreOracle Phase 1, simple interest, tiered grace periods
 */
contract CreditVault is Ownable, ReentrancyGuard, Pausable {
    using SafeERC20 for IERC20;

    // ==================== STATE ====================

    CreditRegistryV1_1 public immutable registry;
    ScoreOracleSimple public oracle;

    // LTV bands (in percentage: 50 = 50%)
    uint16 public constant LTV_BRONZE = 50;    // score 300-579
    uint16 public constant LTV_SILVER = 70;    // score 580-669
    uint16 public constant LTV_GOLD = 80;      // score 670-739
    uint16 public constant LTV_PLATINUM = 90;  // score 740-850

    // Grace periods before liquidation
    uint256 public constant GRACE_BRONZE = 24 hours;
    uint256 public constant GRACE_SILVER = 36 hours;
    uint256 public constant GRACE_GOLD = 48 hours;
    uint256 public constant GRACE_PLATINUM = 72 hours;

    // Liquidation penalty: 10% total (5% to liquidator, 5% to insurance)
    uint16 public constant LIQUIDATION_PENALTY_BPS = 1000; // 10%
    uint16 public constant LIQUIDATOR_SHARE_BPS = 500;     // 5%
    uint16 public constant INSURANCE_SHARE_BPS = 500;      // 5%

    // Health factor minimum for withdrawals
    uint256 public constant MIN_HEALTH_FACTOR = 12e17; // 1.2

    struct Loan {
        address borrower;
        uint256 principal;           // borrowed amount in USD (18 decimals)
        uint256 collateralAmount;    // collateral amount in token decimals
        address collateralToken;     // which token is collateral
        uint256 aprBps;              // annual percentage rate in basis points
        uint256 startTimestamp;      // when loan started
        bool active;                 // is loan currently active
        uint256 graceStart;          // when grace period started (0 if not triggered)
    }

    struct AssetConfig {
        bool allowed;
        address priceFeed; // Chainlink price feed
    }

    mapping(uint256 => Loan) public loans;
    mapping(address => AssetConfig) public assets;
    mapping(address => uint256) public userCollateral; // user => total collateral value (USD 18 decimals)

    address public insurancePool;
    uint256 public nextLoanId;

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

        registry = CreditRegistryV1_1(_registry);
        oracle = ScoreOracleSimple(_oracle);
    }

    // ==================== ADMIN FUNCTIONS ====================

    function setOracle(address _oracle) external onlyOwner {
        require(_oracle != address(0), "Invalid oracle");
        oracle = ScoreOracleSimple(_oracle);
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
     * @param token Collateral token address
     * @param amount Amount to deposit (in token decimals)
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
     * @notice Withdraw collateral (only if health factor remains > 1.2)
     * @param token Collateral token address
     * @param amount Amount to withdraw (in token decimals)
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
     * @param collateralToken Token to use as collateral
     * @param collateralAmount Amount of collateral (in token decimals)
     * @param principalUsd18 Amount to borrow in USD (18 decimals)
     */
    function borrow(
        address collateralToken,
        uint256 collateralAmount,
        uint256 principalUsd18
    ) external nonReentrant whenNotPaused returns (uint256 loanId) {
        require(assets[collateralToken].allowed, "Asset not allowed");
        require(collateralAmount > 0, "Zero collateral");
        require(principalUsd18 > 0, "Zero principal");

        // Get score and determine max LTV
        ScoreOracleSimple.ScoreBreakdown memory sb = oracle.computeScore(msg.sender);
        uint16 maxLtvPercent = _maxLtvForScore(sb.overall);

        // Check LTV
        uint256 collateralUsd18 = _tokenAmountToUsd18(collateralToken, collateralAmount);
        require(principalUsd18 * 100 <= collateralUsd18 * maxLtvPercent, "Exceeds allowed LTV");

        // Get APR based on score
        uint16 apr = oracle.getAPR(sb.overall);

        // Create loan
        loanId = nextLoanId++;
        loans[loanId] = Loan({
            borrower: msg.sender,
            principal: principalUsd18,
            collateralAmount: collateralAmount,
            collateralToken: collateralToken,
            aprBps: apr,
            startTimestamp: block.timestamp,
            active: true,
            graceStart: 0
        });

        // Transfer collateral from user
        IERC20(collateralToken).safeTransferFrom(msg.sender, address(this), collateralAmount);

        // Note: Registry integration will be added in Phase 2 when CreditRegistry is enhanced

        emit LoanCreated(loanId, msg.sender, principalUsd18, collateralAmount, collateralToken);

        // TODO: Transfer borrowed funds to user (needs stablecoin pool implementation)
    }

    /**
     * @notice Repay loan (full or partial)
     * @param loanId Loan identifier
     * @param amountUsd18 Amount to repay in USD (18 decimals)
     */
    function repay(uint256 loanId, uint256 amountUsd18) external nonReentrant whenNotPaused {
        Loan storage loan = loans[loanId];
        require(loan.active, "Loan not active");
        require(amountUsd18 > 0, "Zero amount");

        uint256 debt = _calculateDebt(loanId);
        require(amountUsd18 <= debt, "Amount exceeds debt");

        // Note: Registry integration will be added in Phase 2

        // If full repayment, close loan and return collateral
        if (amountUsd18 >= debt) {
            loan.active = false;
            IERC20(loan.collateralToken).safeTransfer(loan.borrower, loan.collateralAmount);
            emit LoanRepaid(loanId, loan.borrower, amountUsd18, 0);
        } else {
            emit LoanRepaid(loanId, loan.borrower, amountUsd18, debt - amountUsd18);
        }

        // TODO: Transfer repayment funds from user (needs stablecoin integration)
    }

    /**
     * @notice Liquidate unhealthy loan
     * @param loanId Loan identifier
     */
    function liquidate(uint256 loanId) external nonReentrant whenNotPaused {
        Loan storage loan = loans[loanId];
        require(loan.active, "Loan not active");

        uint256 debt = _calculateDebt(loanId);
        uint256 collateralUsd18 = _tokenAmountToUsd18(loan.collateralToken, loan.collateralAmount);

        // Get max LTV for current score
        ScoreOracleSimple.ScoreBreakdown memory sb = oracle.computeScore(loan.borrower);
        uint16 maxLtvPercent = _maxLtvForScore(sb.overall);
        uint256 liquidationThreshold = maxLtvPercent + 10; // LTV + 10%

        // Check if liquidatable
        bool canLiquidate = (debt * 100 > collateralUsd18 * liquidationThreshold);

        // If not immediately liquidatable, check grace period
        if (!canLiquidate) {
            uint256 gracePeriod = _gracePeriodForScore(sb.overall);

            if (loan.graceStart == 0) {
                // Start grace period
                loan.graceStart = block.timestamp;
                emit GracePeriodStarted(loanId, block.timestamp);
                revert("Grace period started");
            } else {
                // Check if grace period expired
                require(block.timestamp >= loan.graceStart + gracePeriod, "Grace period not expired");
            }
        }

        // Liquidate
        loan.active = false;

        // Calculate penalty (10% of collateral)
        uint256 penaltyAmount = (loan.collateralAmount * LIQUIDATION_PENALTY_BPS) / 10000;
        uint256 liquidatorReward = (loan.collateralAmount * LIQUIDATOR_SHARE_BPS) / 10000;
        uint256 insuranceReward = (loan.collateralAmount * INSURANCE_SHARE_BPS) / 10000;
        uint256 remaining = loan.collateralAmount - penaltyAmount;

        // Transfer rewards
        IERC20(loan.collateralToken).safeTransfer(msg.sender, liquidatorReward);
        if (insurancePool != address(0)) {
            IERC20(loan.collateralToken).safeTransfer(insurancePool, insuranceReward);
        }

        // Return remaining collateral to borrower
        if (remaining > 0) {
            IERC20(loan.collateralToken).safeTransfer(loan.borrower, remaining);
        }

        // Note: Registry integration will be added in Phase 2

        emit LoanLiquidated(loanId, loan.borrower, msg.sender, loan.collateralAmount);
    }

    // ==================== VIEW FUNCTIONS ====================

    function getLoan(uint256 loanId) external view returns (Loan memory) {
        return loans[loanId];
    }

    function calculateDebt(uint256 loanId) external view returns (uint256) {
        return _calculateDebt(loanId);
    }

    function getHealthFactor(uint256 loanId) external view returns (uint256) {
        Loan memory loan = loans[loanId];
        if (!loan.active) return 0;

        uint256 debt = _calculateDebt(loanId);
        uint256 collateralUsd18 = _tokenAmountToUsd18(loan.collateralToken, loan.collateralAmount);

        return (collateralUsd18 * 1e18) / debt;
    }

    function getUserHealthFactor(address user) external view returns (uint256) {
        uint256 totalBorrowed = _getTotalBorrowed(user);
        if (totalBorrowed == 0) return type(uint256).max;

        return (userCollateral[user] * 1e18) / totalBorrowed;
    }

    // ==================== INTERNAL FUNCTIONS ====================

    function _calculateDebt(uint256 loanId) internal view returns (uint256) {
        Loan memory loan = loans[loanId];
        if (!loan.active) return 0;

        uint256 timeElapsed = block.timestamp - loan.startTimestamp;
        uint256 interest = (loan.principal * loan.aprBps * timeElapsed) / (10000 * 365 days);

        return loan.principal + interest;
    }

    function _tokenAmountToUsd18(address token, uint256 amount) internal view returns (uint256) {
        AssetConfig memory config = assets[token];
        require(config.allowed, "Asset not allowed");

        IAggregatorV3 feed = IAggregatorV3(config.priceFeed);
        (, int256 price, , , ) = feed.latestRoundData();
        require(price > 0, "Invalid price");

        uint8 decimals = feed.decimals();
        uint8 tokenDecimals = _getTokenDecimals(token);

        // Convert to 18 decimals: (amount * price * 10^18) / (10^tokenDecimals * 10^decimals)
        return (amount * uint256(price) * 1e18) / (10 ** (tokenDecimals + decimals));
    }

    function _getTokenDecimals(address token) internal view returns (uint8) {
        // Try to get decimals, fallback to 18
        try IERC20Metadata(token).decimals() returns (uint8 d) {
            return d;
        } catch {
            return 18;
        }
    }

    function _maxLtvForScore(uint16 score) internal pure returns (uint16) {
        if (score >= 740) return LTV_PLATINUM;
        if (score >= 670) return LTV_GOLD;
        if (score >= 580) return LTV_SILVER;
        return LTV_BRONZE;
    }

    function _gracePeriodForScore(uint16 score) internal pure returns (uint256) {
        if (score >= 740) return GRACE_PLATINUM;
        if (score >= 670) return GRACE_GOLD;
        if (score >= 580) return GRACE_SILVER;
        return GRACE_BRONZE;
    }

    function _getTotalBorrowed(address user) internal view returns (uint256) {
        uint256 total = 0;
        for (uint256 i = 0; i < nextLoanId; i++) {
            Loan memory loan = loans[i];
            if (loan.active && loan.borrower == user) {
                total += _calculateDebt(i);
            }
        }
        return total;
    }
}

interface IERC20Metadata {
    function decimals() external view returns (uint8);
}
