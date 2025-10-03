// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

interface IReputationScorer {
    function scores(address user) external view returns (
        uint256 baseScore,
        uint256 paymentScore,
        uint256 walletAgeScore,
        uint256 protocolScore,
        uint256 totalScore,
        uint256 lastUpdated
    );
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

    function liquidateLoan(uint256 loanId, address liquidator) external;
}

/**
 * @title DutchAuctionLiquidator
 * @notice Dutch auction liquidation system with reputation-based grace periods
 * @dev Discount increases linearly from 0% to 20% over 6 hours
 */
contract DutchAuctionLiquidator is Ownable, ReentrancyGuard {

    // ============ Structs ============

    struct LiquidationAuction {
        uint256 loanId;
        address borrower;
        uint256 debtAmount;
        uint256 collateralAmount;
        uint256 startTime;
        uint256 gracePeriodEnd;
        uint256 auctionDuration;    // 6 hours in seconds
        uint256 maxDiscount;        // 20% (2000 basis points)
        bool executed;
        address executor;
        uint256 executedAt;
    }

    // ============ State Variables ============

    IReputationScorer public reputationScorer;
    ILendingPool public lendingPool;

    mapping(uint256 => LiquidationAuction) public auctions;
    uint256 public auctionCounter;

    // Grace periods based on reputation (in hours)
    uint256 public constant PLATINUM_GRACE_PERIOD = 72 hours;  // 3 days
    uint256 public constant GOLD_GRACE_PERIOD = 24 hours;      // 1 day
    uint256 public constant SILVER_GRACE_PERIOD = 0;           // Immediate
    uint256 public constant BRONZE_GRACE_PERIOD = 0;           // Immediate

    // Auction parameters
    uint256 public constant AUCTION_DURATION = 6 hours;
    uint256 public constant MAX_DISCOUNT_BPS = 2000; // 20%
    uint256 public constant BASIS_POINTS = 10000;

    // ============ Events ============

    event AuctionStarted(
        uint256 indexed auctionId,
        uint256 indexed loanId,
        address indexed borrower,
        uint256 debtAmount,
        uint256 collateralAmount,
        uint256 gracePeriodEnd
    );

    event AuctionExecuted(
        uint256 indexed auctionId,
        uint256 indexed loanId,
        address indexed executor,
        uint256 discountBps,
        uint256 collateralReceived
    );

    event AuctionCancelled(uint256 indexed auctionId, string reason);

    // ============ Constructor ============

    constructor(
        address _reputationScorer,
        address _lendingPool
    ) Ownable(msg.sender) {
        reputationScorer = IReputationScorer(_reputationScorer);
        lendingPool = ILendingPool(_lendingPool);
    }

    // ============ External Functions ============

    /**
     * @notice Start a liquidation auction for an unhealthy loan
     * @param loanId ID of the loan to liquidate
     * @return auctionId The ID of the created auction
     */
    function startLiquidation(uint256 loanId) external returns (uint256) {
        (
            address borrower,
            uint256 collateralAmount,
            uint256 borrowedAmount,
            ,
            ,
            ,
            bool active
        ) = lendingPool.getLoan(loanId);

        require(active, "Loan not active");
        require(borrower != address(0), "Invalid loan");

        // Calculate grace period based on reputation
        uint256 gracePeriod = getGracePeriod(borrower);
        uint256 gracePeriodEnd = block.timestamp + gracePeriod;

        // Create auction
        uint256 auctionId = auctionCounter++;

        auctions[auctionId] = LiquidationAuction({
            loanId: loanId,
            borrower: borrower,
            debtAmount: borrowedAmount,
            collateralAmount: collateralAmount,
            startTime: block.timestamp,
            gracePeriodEnd: gracePeriodEnd,
            auctionDuration: AUCTION_DURATION,
            maxDiscount: MAX_DISCOUNT_BPS,
            executed: false,
            executor: address(0),
            executedAt: 0
        });

        emit AuctionStarted(
            auctionId,
            loanId,
            borrower,
            borrowedAmount,
            collateralAmount,
            gracePeriodEnd
        );

        return auctionId;
    }

    /**
     * @notice Execute a liquidation auction
     * @param auctionId ID of the auction to execute
     */
    function executeLiquidation(uint256 auctionId) external nonReentrant {
        LiquidationAuction storage auction = auctions[auctionId];

        require(!auction.executed, "Auction already executed");
        require(block.timestamp >= auction.gracePeriodEnd, "Grace period active");

        // Calculate current discount
        uint256 discountBps = getCurrentDiscount(auctionId);

        // Calculate collateral to receive
        uint256 collateralValue = auction.collateralAmount;
        uint256 discountAmount = (collateralValue * discountBps) / BASIS_POINTS;
        uint256 collateralAfterDiscount = collateralValue - discountAmount;

        require(
            collateralAfterDiscount >= auction.debtAmount,
            "Insufficient collateral after discount"
        );

        // Mark as executed
        auction.executed = true;
        auction.executor = msg.sender;
        auction.executedAt = block.timestamp;

        // Execute liquidation through lending pool
        lendingPool.liquidateLoan(auction.loanId, msg.sender);

        emit AuctionExecuted(
            auctionId,
            auction.loanId,
            msg.sender,
            discountBps,
            collateralAfterDiscount
        );
    }

    /**
     * @notice Cancel an auction (e.g., if loan was repaid during grace period)
     * @param auctionId ID of the auction to cancel
     */
    function cancelAuction(uint256 auctionId, string calldata reason) external onlyOwner {
        LiquidationAuction storage auction = auctions[auctionId];

        require(!auction.executed, "Auction already executed");

        auction.executed = true;

        emit AuctionCancelled(auctionId, reason);
    }

    // ============ View Functions ============

    /**
     * @notice Get current discount for an auction
     * @param auctionId ID of the auction
     * @return Discount in basis points (0-2000)
     */
    function getCurrentDiscount(uint256 auctionId) public view returns (uint256) {
        LiquidationAuction memory auction = auctions[auctionId];

        if (block.timestamp < auction.gracePeriodEnd) {
            return 0; // No discount during grace period
        }

        uint256 auctionStart = auction.gracePeriodEnd;
        uint256 auctionEnd = auctionStart + auction.auctionDuration;

        if (block.timestamp >= auctionEnd) {
            return auction.maxDiscount; // Max discount after auction ends
        }

        // Linear interpolation: 0% → 20% over 6 hours
        uint256 elapsed = block.timestamp - auctionStart;
        uint256 discountBps = (elapsed * auction.maxDiscount) / auction.auctionDuration;

        return discountBps;
    }

    /**
     * @notice Get grace period for a borrower based on reputation
     * @param borrower Address of the borrower
     * @return Grace period in seconds
     */
    function getGracePeriod(address borrower) public view returns (uint256) {
        (, , , , uint256 totalScore, ) = reputationScorer.scores(borrower);

        if (totalScore >= 800) return PLATINUM_GRACE_PERIOD; // 72 hours
        if (totalScore >= 600) return GOLD_GRACE_PERIOD;     // 24 hours
        if (totalScore >= 400) return SILVER_GRACE_PERIOD;   // 0 hours
        return BRONZE_GRACE_PERIOD;                          // 0 hours
    }

    /**
     * @notice Get auction details
     * @param auctionId ID of the auction
     * @return Auction struct
     */
    function getAuction(uint256 auctionId) external view returns (LiquidationAuction memory) {
        return auctions[auctionId];
    }

    /**
     * @notice Check if auction is executable
     * @param auctionId ID of the auction
     * @return Whether the auction can be executed
     */
    function isExecutable(uint256 auctionId) external view returns (bool) {
        LiquidationAuction memory auction = auctions[auctionId];

        if (auction.executed) return false;
        if (block.timestamp < auction.gracePeriodEnd) return false;

        return true;
    }

    /**
     * @notice Get time remaining in grace period
     * @param auctionId ID of the auction
     * @return Seconds remaining (0 if grace period ended)
     */
    function getGracePeriodRemaining(uint256 auctionId) external view returns (uint256) {
        LiquidationAuction memory auction = auctions[auctionId];

        if (block.timestamp >= auction.gracePeriodEnd) {
            return 0;
        }

        return auction.gracePeriodEnd - block.timestamp;
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
}
