// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import "./ChronosCore.sol";
import "./ChronosNFT.sol";
import "./ReputationOracle.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";

/**
 * @title LendingPool
 * @notice Modular lending pools with dynamic LTV based on reputation
 * @dev Implements undercollateralized lending with risk-based pricing
 *
 * Pool Types:
 * - Conservative: 60-70% LTV, 8% APR base, low risk
 * - Growth: 70-80% LTV, 12% APR base, medium risk
 * - Degen: 80-90% LTV, 20% APR base, high risk
 *
 * Security:
 * - Dynamic LTV based on temporal reputation (50-90%)
 * - Flash loan protection via circuit breakers
 * - Automatic slashing on default
 * - Risk-isolated pools (no cross-contamination)
 */
contract LendingPool is ChronosCore, ReentrancyGuard {
    using SafeERC20 for IERC20;

    /*//////////////////////////////////////////////////////////////
                            STATE
    //////////////////////////////////////////////////////////////*/

    /// @notice Supported pool types
    enum PoolType {
        CONSERVATIVE,
        GROWTH,
        DEGEN
    }

    /// @notice Pool configuration
    struct Pool {
        uint256 totalLiquidity;
        uint256 totalBorrowed;
        uint256 baseAPR;           // in basis points (e.g., 800 = 8%)
        uint256 minLTV;            // minimum LTV for pool (e.g., 6000 = 60%)
        uint256 maxLTV;            // maximum LTV for pool (e.g., 7000 = 70%)
        uint256 utilizationTarget; // target utilization rate (e.g., 8000 = 80%)
        bool active;
    }

    /// @notice Loan details
    struct Loan {
        address borrower;
        uint256 principal;
        uint256 collateral;
        uint256 startTime;
        uint256 apr;
        PoolType poolType;
        bool active;
        uint256 lastAccrualTime;
    }

    /// @notice Liquidity provider position
    struct LPPosition {
        uint256 shares;
        uint256 depositTime;
    }

    /// @notice Pool configurations
    mapping(PoolType => Pool) public pools;

    /// @notice Active loans
    mapping(uint256 => Loan) public loans;
    uint256 public loanIdCounter;

    /// @notice LP positions by pool
    mapping(PoolType => mapping(address => LPPosition)) public lpPositions;

    /// @notice Total shares per pool
    mapping(PoolType => uint256) public totalShares;

    /// @notice ChronosNFT contract
    ChronosNFT public immutable chronosNFT;

    /// @notice ReputationOracle contract
    ReputationOracle public immutable reputationOracle;

    /// @notice Supported collateral token (e.g., WETH)
    IERC20 public immutable collateralToken;

    /// @notice Supported borrow token (e.g., USDC)
    IERC20 public immutable borrowToken;

    /*//////////////////////////////////////////////////////////////
                            CONSTANTS
    //////////////////////////////////////////////////////////////*/

    uint256 public constant BASIS_POINTS = 10000;
    uint256 public constant SECONDS_PER_YEAR = 365 days;

    /// @notice Liquidation threshold (85% of LTV)
    uint256 public constant LIQUIDATION_RATIO = 8500;

    /// @notice Liquidation penalty (10%)
    uint256 public constant LIQUIDATION_PENALTY = 1000;

    /*//////////////////////////////////////////////////////////////
                            EVENTS
    //////////////////////////////////////////////////////////////*/

    event PoolCreated(PoolType indexed poolType, uint256 baseAPR, uint256 minLTV, uint256 maxLTV);
    event LiquidityDeposited(address indexed lp, PoolType indexed poolType, uint256 amount, uint256 shares);
    event LiquidityWithdrawn(address indexed lp, PoolType indexed poolType, uint256 amount, uint256 shares);
    event LoanOriginated(uint256 indexed loanId, address indexed borrower, uint256 principal, uint256 collateral);
    event LoanRepaid(uint256 indexed loanId, address indexed borrower, uint256 principal, uint256 interest);
    event LoanLiquidated(uint256 indexed loanId, address indexed liquidator, uint256 collateralSeized);
    event DefaultSlashed(uint256 indexed loanId, address indexed borrower, uint256 severity);

    /*//////////////////////////////////////////////////////////////
                            ERRORS
    //////////////////////////////////////////////////////////////*/

    error PoolNotActive();
    error InsufficientLiquidity();
    error InsufficientCollateral();
    error InsufficientReputation();
    error LoanNotActive();
    error NotLoanOwner();
    error NotInDefault();
    error Blacklisted();
    error ExceedsUtilization();

    /*//////////////////////////////////////////////////////////////
                            CONSTRUCTOR
    //////////////////////////////////////////////////////////////*/

    constructor(
        address _chronosNFT,
        address _reputationOracle,
        address _collateralToken,
        address _borrowToken
    ) {
        chronosNFT = ChronosNFT(_chronosNFT);
        reputationOracle = ReputationOracle(_reputationOracle);
        collateralToken = IERC20(_collateralToken);
        borrowToken = IERC20(_borrowToken);

        // Initialize pools
        pools[PoolType.CONSERVATIVE] = Pool({
            totalLiquidity: 0,
            totalBorrowed: 0,
            baseAPR: 800,        // 8%
            minLTV: 5000,        // 50%
            maxLTV: 7000,        // 70%
            utilizationTarget: 8000, // 80%
            active: true
        });

        pools[PoolType.GROWTH] = Pool({
            totalLiquidity: 0,
            totalBorrowed: 0,
            baseAPR: 1200,       // 12%
            minLTV: 6000,        // 60%
            maxLTV: 8000,        // 80%
            utilizationTarget: 8000,
            active: true
        });

        pools[PoolType.DEGEN] = Pool({
            totalLiquidity: 0,
            totalBorrowed: 0,
            baseAPR: 2000,       // 20%
            minLTV: 7000,        // 70%
            maxLTV: 9000,        // 90%
            utilizationTarget: 8000,
            active: true
        });
    }

    /*//////////////////////////////////////////////////////////////
                        LIQUIDITY PROVIDER FUNCTIONS
    //////////////////////////////////////////////////////////////*/

    /**
     * @notice Deposit liquidity to earn yield
     * @param poolType Pool to deposit into
     * @param amount Amount of borrow token to deposit
     */
    function depositLiquidity(
        PoolType poolType,
        uint256 amount
    ) external nonReentrant whenNotPaused {
        Pool storage pool = pools[poolType];
        if (!pool.active) revert PoolNotActive();

        // Calculate shares
        uint256 shares;
        if (totalShares[poolType] == 0) {
            shares = amount; // Initial deposit
        } else {
            // shares = (amount * totalShares) / totalLiquidity
            shares = (amount * totalShares[poolType]) / pool.totalLiquidity;
        }

        // Update state
        pool.totalLiquidity += amount;
        totalShares[poolType] += shares;
        lpPositions[poolType][msg.sender].shares += shares;
        lpPositions[poolType][msg.sender].depositTime = block.timestamp;

        // Transfer tokens
        borrowToken.safeTransferFrom(msg.sender, address(this), amount);

        emit LiquidityDeposited(msg.sender, poolType, amount, shares);
    }

    /**
     * @notice Withdraw liquidity
     * @param poolType Pool to withdraw from
     * @param shares Amount of shares to redeem
     */
    function withdrawLiquidity(
        PoolType poolType,
        uint256 shares
    ) external nonReentrant {
        Pool storage pool = pools[poolType];
        LPPosition storage position = lpPositions[poolType][msg.sender];

        require(position.shares >= shares, "Insufficient shares");

        // Calculate amount: amount = (shares * totalLiquidity) / totalShares
        uint256 amount = (shares * pool.totalLiquidity) / totalShares[poolType];

        // Check available liquidity
        uint256 available = pool.totalLiquidity - pool.totalBorrowed;
        if (amount > available) revert InsufficientLiquidity();

        // Update state
        pool.totalLiquidity -= amount;
        totalShares[poolType] -= shares;
        position.shares -= shares;

        // Transfer tokens
        borrowToken.safeTransfer(msg.sender, amount);

        emit LiquidityWithdrawn(msg.sender, poolType, amount, shares);
    }

    /*//////////////////////////////////////////////////////////////
                        BORROWER FUNCTIONS
    //////////////////////////////////////////////////////////////*/

    /**
     * @notice Borrow against collateral with dynamic LTV
     * @param poolType Pool to borrow from
     * @param collateralAmount Amount of collateral to deposit
     * @param borrowAmount Amount to borrow
     */
    function borrow(
        PoolType poolType,
        uint256 collateralAmount,
        uint256 borrowAmount
    ) external nonReentrant whenNotPaused returns (uint256 loanId) {
        Pool storage pool = pools[poolType];
        if (!pool.active) revert PoolNotActive();

        // Check blacklist
        if (reputationOracle.blacklisted(msg.sender)) revert Blacklisted();

        // Get user's reputation
        uint256 reputationScore = chronosNFT.getDecayedScore(msg.sender);
        if (reputationScore < 500) revert InsufficientReputation();

        // Calculate dynamic LTV based on reputation
        uint256 userLTV = _calculateDynamicLTV(poolType, reputationScore);

        // Verify LTV
        uint256 maxBorrow = (collateralAmount * userLTV) / BASIS_POINTS;
        if (borrowAmount > maxBorrow) revert InsufficientCollateral();

        // Check liquidity
        uint256 available = pool.totalLiquidity - pool.totalBorrowed;
        if (borrowAmount > available) revert InsufficientLiquidity();

        // Check utilization doesn't exceed 95%
        uint256 newUtilization = ((pool.totalBorrowed + borrowAmount) * BASIS_POINTS) / pool.totalLiquidity;
        if (newUtilization > 9500) revert ExceedsUtilization();

        // Circuit breaker check
        checkCircuitBreaker(pool.totalBorrowed + borrowAmount);

        // Calculate APR (increases with utilization)
        uint256 apr = _calculateAPR(poolType, newUtilization);

        // Create loan
        loanId = ++loanIdCounter;
        loans[loanId] = Loan({
            borrower: msg.sender,
            principal: borrowAmount,
            collateral: collateralAmount,
            startTime: block.timestamp,
            apr: apr,
            poolType: poolType,
            active: true,
            lastAccrualTime: block.timestamp
        });

        // Update pool state
        pool.totalBorrowed += borrowAmount;

        // Transfer tokens
        collateralToken.safeTransferFrom(msg.sender, address(this), collateralAmount);
        borrowToken.safeTransfer(msg.sender, borrowAmount);

        emit LoanOriginated(loanId, msg.sender, borrowAmount, collateralAmount);
    }

    /**
     * @notice Repay loan
     * @param loanId Loan to repay
     */
    function repay(uint256 loanId) external nonReentrant {
        Loan storage loan = loans[loanId];
        if (!loan.active) revert LoanNotActive();
        if (loan.borrower != msg.sender) revert NotLoanOwner();

        // Calculate interest
        uint256 interest = _calculateInterest(loanId);
        uint256 totalRepayment = loan.principal + interest;

        // Update state
        loan.active = false;
        Pool storage pool = pools[loan.poolType];
        pool.totalBorrowed -= loan.principal;

        // Interest goes to liquidity providers
        pool.totalLiquidity += interest;

        // Transfer tokens
        borrowToken.safeTransferFrom(msg.sender, address(this), totalRepayment);
        collateralToken.safeTransfer(msg.sender, loan.collateral);

        emit LoanRepaid(loanId, msg.sender, loan.principal, interest);
    }

    /**
     * @notice Liquidate undercollateralized loan
     * @param loanId Loan to liquidate
     */
    function liquidate(uint256 loanId) external nonReentrant {
        Loan storage loan = loans[loanId];
        if (!loan.active) revert LoanNotActive();

        // Calculate debt with interest
        uint256 interest = _calculateInterest(loanId);
        uint256 totalDebt = loan.principal + interest;

        // Check if underwater (debt > 85% of collateral value)
        uint256 collateralValue = loan.collateral; // Assume 1:1 for simplicity
        uint256 liquidationThreshold = (collateralValue * LIQUIDATION_RATIO) / BASIS_POINTS;

        if (totalDebt <= liquidationThreshold) revert NotInDefault();

        // Calculate default severity for slashing
        uint256 defaultPercentage = ((totalDebt - collateralValue) * 100) / loan.principal;
        uint256 slashSeverity;
        if (defaultPercentage < 10) {
            slashSeverity = 20; // Small default
        } else if (defaultPercentage < 50) {
            slashSeverity = 50; // Medium default
        } else {
            slashSeverity = 100; // Rug pull
        }

        // Slash reputation
        // Note: This requires SLASHER_ROLE to be granted to this contract
        try reputationOracle.slashReputation(loan.borrower, slashSeverity) {
            emit DefaultSlashed(loanId, loan.borrower, slashSeverity);
        } catch {
            // Continue with liquidation even if slashing fails
        }

        // Update state
        loan.active = false;
        Pool storage pool = pools[loan.poolType];
        pool.totalBorrowed -= loan.principal;

        // Liquidator gets collateral minus penalty
        uint256 penalty = (loan.collateral * LIQUIDATION_PENALTY) / BASIS_POINTS;
        uint256 liquidatorReward = loan.collateral - penalty;

        // Penalty goes to liquidity providers
        pool.totalLiquidity += penalty;

        // Transfer collateral to liquidator
        collateralToken.safeTransfer(msg.sender, liquidatorReward);

        emit LoanLiquidated(loanId, msg.sender, liquidatorReward);
    }

    /*//////////////////////////////////////////////////////////////
                        INTERNAL FUNCTIONS
    //////////////////////////////////////////////////////////////*/

    /**
     * @notice Calculate dynamic LTV based on reputation
     * @param poolType Pool type
     * @param reputationScore User's reputation score (0-1000)
     * @return LTV in basis points
     */
    function _calculateDynamicLTV(
        PoolType poolType,
        uint256 reputationScore
    ) internal view returns (uint256) {
        Pool memory pool = pools[poolType];

        // Linear interpolation between minLTV and maxLTV
        // Score 500 → minLTV, Score 1000 → maxLTV
        if (reputationScore <= 500) {
            return pool.minLTV;
        }

        uint256 scoreRange = reputationScore - 500; // 0-500
        uint256 ltvRange = pool.maxLTV - pool.minLTV;
        uint256 ltvIncrease = (scoreRange * ltvRange) / 500;

        return pool.minLTV + ltvIncrease;
    }

    /**
     * @notice Calculate APR based on utilization
     * @param poolType Pool type
     * @param utilization Current utilization in basis points
     * @return APR in basis points
     */
    function _calculateAPR(
        PoolType poolType,
        uint256 utilization
    ) internal view returns (uint256) {
        Pool memory pool = pools[poolType];

        // Simple linear model:
        // APR = baseAPR * (1 + utilization/100)
        // At 80% utilization: APR = baseAPR * 1.8
        uint256 multiplier = BASIS_POINTS + (utilization * 100) / BASIS_POINTS;
        return (pool.baseAPR * multiplier) / BASIS_POINTS;
    }

    /**
     * @notice Calculate accrued interest
     * @param loanId Loan ID
     * @return interest Accrued interest
     */
    function _calculateInterest(uint256 loanId) internal view returns (uint256) {
        Loan memory loan = loans[loanId];

        uint256 timeElapsed = block.timestamp - loan.lastAccrualTime;
        uint256 interest = (loan.principal * loan.apr * timeElapsed) / (BASIS_POINTS * SECONDS_PER_YEAR);

        return interest;
    }

    /*//////////////////////////////////////////////////////////////
                        VIEW FUNCTIONS
    //////////////////////////////////////////////////////////////*/

    function getPool(PoolType poolType) external view returns (Pool memory) {
        return pools[poolType];
    }

    function getLoan(uint256 loanId) external view returns (Loan memory) {
        return loans[loanId];
    }

    function getUserLTV(
        address user,
        PoolType poolType
    ) external view returns (uint256) {
        uint256 reputationScore = chronosNFT.getDecayedScore(user);
        return _calculateDynamicLTV(poolType, reputationScore);
    }

    function getPoolUtilization(PoolType poolType) external view returns (uint256) {
        Pool memory pool = pools[poolType];
        if (pool.totalLiquidity == 0) return 0;
        return (pool.totalBorrowed * BASIS_POINTS) / pool.totalLiquidity;
    }

    function getLPValue(
        address lp,
        PoolType poolType
    ) external view returns (uint256) {
        LPPosition memory position = lpPositions[poolType][lp];
        if (position.shares == 0) return 0;

        Pool memory pool = pools[poolType];
        return (position.shares * pool.totalLiquidity) / totalShares[poolType];
    }
}
