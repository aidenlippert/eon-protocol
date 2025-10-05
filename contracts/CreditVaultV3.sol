// SPDX-License-Identifier: MIT
pragma solidity 0.8.20;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "./CreditRegistryV3.sol";
import "./ScoreOraclePhase3B.sol";
import "./ChainlinkPriceOracle.sol";

/**
 * @title CreditVaultV3
 * @notice Lending vault with complete Phase 3B integration
 * @dev Integrates with 5-factor credit scoring system and Chainlink price feeds
 */
contract CreditVaultV3 is Ownable, ReentrancyGuard, Pausable {
    using SafeERC20 for IERC20;

    // ==================== STRUCTS ====================

    struct VaultLoanData {
        address collateralToken;
        uint256 collateralAmount;
        uint16 aprBps;
        uint256 startTimestamp;
        uint256 graceStart;
        bool exists;
    }

    struct Asset {
        bool allowed;
        address priceFeed;
    }

    // ==================== STATE ====================

    CreditRegistryV3 public registry;
    ScoreOraclePhase3B public oracle;
    ChainlinkPriceOracle public priceOracle;

    mapping(address => Asset) public assets;
    mapping(uint256 => VaultLoanData) public vaultLoans;
    address public insurancePool;

    // Constants
    uint256 public constant MIN_HEALTH_FACTOR = 1.2e18;
    uint256 public constant LIQUIDATOR_SHARE_BPS = 500; // 5%
    uint256 public constant INSURANCE_SHARE_BPS = 500; // 5%
    uint256 public constant GRACE_BRONZE = 24 hours;
    uint256 public constant GRACE_SILVER = 36 hours;
    uint256 public constant GRACE_GOLD = 48 hours;
    uint256 public constant GRACE_PLATINUM = 72 hours;

    // ==================== EVENTS ====================

    event LoanCreated(uint256 indexed loanId, address indexed borrower, uint256 principalUsd18, uint256 collateralAmount);
    event LoanRepaid(uint256 indexed loanId, address indexed borrower, uint256 amountUsd18);
    event LoanLiquidated(uint256 indexed loanId, address indexed borrower, address indexed liquidator, uint256 collateralAmount);
    event GracePeriodStarted(uint256 indexed loanId, uint256 timestamp);

    // ==================== CONSTRUCTOR ====================

    constructor(
        address payable _registry,
        address _oracle,
        address _priceOracle
    ) Ownable(msg.sender) {
        registry = CreditRegistryV3(_registry);
        oracle = ScoreOraclePhase3B(_oracle);
        priceOracle = ChainlinkPriceOracle(_priceOracle);
    }

    // ==================== BORROW FUNCTION ====================

    function borrow(
        address collateralToken,
        uint256 collateralAmount,
        uint256 principalUsd18
    ) external nonReentrant whenNotPaused returns (uint256 loanId) {
        require(assets[collateralToken].allowed, "Asset not allowed");
        require(collateralAmount > 0, "Zero collateral");
        require(principalUsd18 > 0, "Zero principal");

        // Get score and max LTV
        ScoreOraclePhase3B.ScoreBreakdown memory score = oracle.computeScore(msg.sender);
        uint16 maxLtvPercent = _maxLtvForScore(score.overall);

        // Check LTV
        uint256 collateralUsd18 = _tokenAmountToUsd18(collateralToken, collateralAmount);
        require(principalUsd18 * 100 <= collateralUsd18 * maxLtvPercent, "Exceeds allowed LTV");

        // Transfer collateral
        IERC20(collateralToken).safeTransferFrom(msg.sender, address(this), collateralAmount);

        // Register loan in registry (get canonical loanId)
        loanId = registry.registerLoan(msg.sender, principalUsd18);

        // Record collateral data in registry (for S2 scoring)
        registry.recordCollateralData(loanId, collateralToken, collateralUsd18, score.overall);

        // Store vault-specific data
        vaultLoans[loanId] = VaultLoanData({
            collateralToken: collateralToken,
            collateralAmount: collateralAmount,
            aprBps: oracle.getAPR(score.overall),
            startTimestamp: block.timestamp,
            graceStart: 0,
            exists: true
        });

        emit LoanCreated(loanId, msg.sender, principalUsd18, collateralAmount);
    }

    // ==================== REPAY FUNCTION ====================

    function repay(uint256 loanId, uint256 amountUsd18) external nonReentrant whenNotPaused {
        VaultLoanData storage vaultData = vaultLoans[loanId];
        require(vaultData.exists, "Loan not found");

        CreditRegistryV3.LoanRecord memory loan = registry.getLoan(loanId);
        require(loan.status == CreditRegistryV3.LoanStatus.Active, "Loan not active");
        require(loan.borrower == msg.sender, "Not borrower");

        // Calculate total debt
        uint256 debt = _calculateDebt(loanId);
        require(amountUsd18 <= debt, "Amount exceeds debt");

        // Register repayment in registry
        registry.registerRepayment(loanId, amountUsd18);

        // If fully repaid, return collateral
        if (amountUsd18 >= debt) {
            IERC20(vaultData.collateralToken).safeTransfer(msg.sender, vaultData.collateralAmount);
        }

        emit LoanRepaid(loanId, msg.sender, amountUsd18);

        // TODO: Accept repayment funds from user
    }

    // ==================== LIQUIDATION FUNCTION ====================

    function liquidate(uint256 loanId) external nonReentrant whenNotPaused {
        VaultLoanData storage vaultData = vaultLoans[loanId];
        require(vaultData.exists, "Loan not found");

        CreditRegistryV3.LoanRecord memory loan = registry.getLoan(loanId);
        require(loan.status == CreditRegistryV3.LoanStatus.Active, "Loan not active");

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

        ScoreOraclePhase3B.ScoreBreakdown memory score = oracle.computeScore(borrower);
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

    function calculateDebt(uint256 loanId) external view returns (uint256) {
        return _calculateDebt(loanId);
    }

    function _calculateDebt(uint256 loanId) internal view returns (uint256) {
        CreditRegistryV3.LoanRecord memory loan = registry.getLoan(loanId);
        VaultLoanData memory vaultData = vaultLoans[loanId];

        if (loan.status != CreditRegistryV3.LoanStatus.Active) {
            return 0;
        }

        uint256 timeElapsed = block.timestamp - vaultData.startTimestamp;
        uint256 interest = (loan.principalUsd18 * vaultData.aprBps * timeElapsed) / (10000 * 365 days);

        return loan.principalUsd18 + interest - loan.repaidUsd18;
    }

    // ==================== INTERNAL HELPERS ====================

    /**
     * @notice SECURITY UPGRADE - Uses Chainlink price oracle with stale price detection
     * @dev Replaces old unsafe price feed implementation
     */
    function _tokenAmountToUsd18(address token, uint256 amount) internal view returns (uint256) {
        // Use Chainlink oracle with built-in staleness checks and fallback support
        return priceOracle.tokenToUsd(token, amount);
    }

    function _maxLtvForScore(uint16 overall) internal pure returns (uint16) {
        if (overall >= 90) return 90; // Platinum
        if (overall >= 75) return 80; // Gold
        if (overall >= 60) return 70; // Silver
        return 50; // Bronze
    }

    function _gracePeriodForScore(uint16 score) internal pure returns (uint256) {
        if (score >= 90) return GRACE_PLATINUM;
        if (score >= 75) return GRACE_GOLD;
        if (score >= 60) return GRACE_SILVER;
        return GRACE_BRONZE;
    }

    // ==================== ADMIN FUNCTIONS ====================

    function setAsset(address token, address priceFeed, bool allowed) external onlyOwner {
        assets[token] = Asset({
            allowed: allowed,
            priceFeed: priceFeed
        });
    }

    function setInsurancePool(address _insurancePool) external onlyOwner {
        insurancePool = _insurancePool;
    }

    function pause() external onlyOwner {
        _pause();
    }

    function unpause() external onlyOwner {
        _unpause();
    }
}
