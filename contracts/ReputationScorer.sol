// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/**
 * @title ReputationScorer
 * @notice Enhanced multi-signal credit scoring system for Eon Protocol
 * @dev Aggregates temporal reputation, payment history, wallet age, and protocol activity
 */
contract ReputationScorer is Ownable, ReentrancyGuard {

    // ============ Structs ============

    struct CreditScore {
        uint256 baseScore;          // Temporal ownership score (0-1000)
        uint256 paymentScore;       // Payment history score (0-200)
        uint256 walletAgeScore;     // Wallet longevity score (0-100)
        uint256 protocolScore;      // Cross-protocol activity score (0-100)
        uint256 totalScore;         // Normalized total (0-1000)
        string tier;                // Credit tier (Bronze/Silver/Gold/Platinum)
        uint256 ltv;                // Dynamic LTV percentage (50-90)
        uint256 lastUpdated;        // Timestamp of last update
    }

    struct PaymentRecord {
        uint256 loanId;
        uint256 amount;
        uint256 dueDate;
        uint256 paidDate;
        bool onTime;
        uint8 lateDays;
    }

    // ============ State Variables ============

    mapping(address => CreditScore) public scores;
    mapping(address => PaymentRecord[]) public paymentHistory;
    mapping(address => uint256) public walletCreationTime;
    mapping(address => uint256) public protocolInteractions;

    // Authorized contracts that can update scores
    mapping(address => bool) public authorizedUpdaters;

    // Score weights (total = 100)
    uint8 public constant BASE_WEIGHT = 50;       // 50% temporal
    uint8 public constant PAYMENT_WEIGHT = 30;    // 30% payment history
    uint8 public constant WALLET_AGE_WEIGHT = 10; // 10% wallet age
    uint8 public constant PROTOCOL_WEIGHT = 10;   // 10% protocol activity

    // ============ Events ============

    event ScoreUpdated(
        address indexed user,
        uint256 totalScore,
        uint256 baseScore,
        uint256 paymentScore,
        uint256 walletAgeScore,
        uint256 protocolScore
    );

    event PaymentRecorded(
        address indexed borrower,
        uint256 indexed loanId,
        bool onTime,
        uint8 lateDays
    );

    event AuthorizedUpdaterSet(address indexed updater, bool authorized);

    // ============ Constructor ============

    constructor() Ownable(msg.sender) {}

    // ============ External Functions ============

    /**
     * @notice Calculate and update comprehensive credit score for a user
     * @param user Address of the user
     * @param baseScore Temporal ownership score from ClaimManager (0-1000)
     * @return totalScore The calculated total credit score
     */
    function calculateScore(
        address user,
        uint256 baseScore
    ) external onlyAuthorized returns (uint256) {
        require(user != address(0), "Invalid user address");
        require(baseScore <= 1000, "Base score exceeds maximum");

        // Calculate individual subscores
        uint256 paymentScore = _calculatePaymentScore(user);
        uint256 walletAgeScore = _calculateWalletAgeScore(user);
        uint256 protocolScore = _calculateProtocolScore(user);

        // For Phase 1 MVP: totalScore = baseScore directly for simplicity
        // Future versions can implement full weighted scoring
        uint256 totalScore = baseScore;

        // Store subscores for future use but don't weight them yet
        // uint256 totalScore = (
        //     (baseScore * BASE_WEIGHT) +
        //     (paymentScore * PAYMENT_WEIGHT) +
        //     (walletAgeScore * WALLET_AGE_WEIGHT) +
        //     (protocolScore * PROTOCOL_WEIGHT)
        // ) / 100;

        // Calculate tier and LTV
        string memory tier;
        uint256 ltv;
        if (totalScore >= 800) {
            tier = "Platinum";
            ltv = 90;
        } else if (totalScore >= 600) {
            tier = "Gold";
            ltv = 75;
        } else if (totalScore >= 400) {
            tier = "Silver";
            ltv = 65;
        } else {
            tier = "Bronze";
            ltv = 50;
        }

        // Update stored score
        scores[user] = CreditScore({
            baseScore: baseScore,
            paymentScore: paymentScore,
            walletAgeScore: walletAgeScore,
            protocolScore: protocolScore,
            totalScore: totalScore,
            tier: tier,
            ltv: ltv,
            lastUpdated: block.timestamp
        });

        emit ScoreUpdated(
            user,
            totalScore,
            baseScore,
            paymentScore,
            walletAgeScore,
            protocolScore
        );

        return totalScore;
    }

    /**
     * @notice Record a loan payment for credit history
     * @param borrower Address of the borrower
     * @param loanId ID of the loan
     * @param amount Payment amount
     * @param dueDate Original due date
     * @param onTime Whether payment was on time
     */
    function recordPayment(
        address borrower,
        uint256 loanId,
        uint256 amount,
        uint256 dueDate,
        bool onTime
    ) external onlyAuthorized {
        uint8 lateDays = 0;

        if (!onTime && block.timestamp > dueDate) {
            lateDays = uint8((block.timestamp - dueDate) / 1 days);
        }

        PaymentRecord memory record = PaymentRecord({
            loanId: loanId,
            amount: amount,
            dueDate: dueDate,
            paidDate: block.timestamp,
            onTime: onTime,
            lateDays: lateDays
        });

        paymentHistory[borrower].push(record);

        emit PaymentRecorded(borrower, loanId, onTime, lateDays);
    }

    /**
     * @notice Record wallet creation time (first interaction)
     * @param user Address of the user
     */
    function recordWalletCreation(address user) external onlyAuthorized {
        if (walletCreationTime[user] == 0) {
            walletCreationTime[user] = block.timestamp;
        }
    }

    /**
     * @notice Increment protocol interaction count
     * @param user Address of the user
     */
    function incrementProtocolInteractions(address user) external onlyAuthorized {
        protocolInteractions[user]++;
    }

    /**
     * @notice Get detailed score breakdown for a user
     * @param user Address of the user
     * @return CreditScore struct with all subscores
     */
    function getScoreBreakdown(address user) external view returns (CreditScore memory) {
        return scores[user];
    }

    /**
     * @notice Get payment history for a user
     * @param user Address of the user
     * @return Array of payment records
     */
    function getPaymentHistory(address user) external view returns (PaymentRecord[] memory) {
        return paymentHistory[user];
    }

    /**
     * @notice Get dynamic LTV based on total credit score
     * @param user Address of the user
     * @return LTV percentage (50-90)
     */
    function getDynamicLTV(address user) external view returns (uint256) {
        uint256 totalScore = scores[user].totalScore;

        if (totalScore >= 800) return 90;      // Platinum tier
        if (totalScore >= 600) return 75;      // Gold tier
        if (totalScore >= 400) return 65;      // Silver tier
        return 50;                              // Bronze tier
    }

    /**
     * @notice Get credit tier name based on score
     * @param user Address of the user
     * @return Tier name (Bronze, Silver, Gold, Platinum)
     */
    function getCreditTier(address user) external view returns (string memory) {
        uint256 totalScore = scores[user].totalScore;

        if (totalScore >= 800) return "Platinum";
        if (totalScore >= 600) return "Gold";
        if (totalScore >= 400) return "Silver";
        return "Bronze";
    }

    // ============ Admin Functions ============

    /**
     * @notice Set authorization for a contract to update scores
     * @param updater Address of the updater contract
     * @param authorized Whether the updater is authorized
     */
    function setAuthorizedUpdater(address updater, bool authorized) external onlyOwner {
        authorizedUpdaters[updater] = authorized;
        emit AuthorizedUpdaterSet(updater, authorized);
    }

    // ============ Internal Functions ============

    /**
     * @notice Calculate payment history score (0-200)
     * @dev Based on on-time payment rate for last 12 payments
     */
    function _calculatePaymentScore(address user) internal view returns (uint256) {
        PaymentRecord[] memory history = paymentHistory[user];

        if (history.length == 0) {
            return 100; // Neutral score for new users
        }

        // Analyze last 12 payments (or all if less than 12)
        uint256 recordsToAnalyze = history.length > 12 ? 12 : history.length;
        uint256 onTimeCount = 0;
        uint256 startIndex = history.length - recordsToAnalyze;

        for (uint256 i = startIndex; i < history.length; i++) {
            if (history[i].onTime) {
                onTimeCount++;
            }
        }

        // Calculate on-time rate
        uint256 onTimeRate = (onTimeCount * 100) / recordsToAnalyze;

        // Score 0-200 based on on-time rate
        uint256 score = (onTimeRate * 200) / 100;

        // Bonus for perfect record
        if (onTimeRate == 100) {
            score = 200;
        }

        return score;
    }

    /**
     * @notice Calculate wallet age score (0-100)
     * @dev Based on how long the wallet has been active
     */
    function _calculateWalletAgeScore(address user) internal view returns (uint256) {
        uint256 creationTime = walletCreationTime[user];

        if (creationTime == 0) {
            return 0; // New wallet
        }

        uint256 ageInDays = (block.timestamp - creationTime) / 1 days;

        // Score increases with age, max at 730 days (2 years)
        if (ageInDays >= 730) return 100;

        return (ageInDays * 100) / 730;
    }

    /**
     * @notice Calculate protocol activity score (0-100)
     * @dev Based on number of interactions across Eon Protocol
     */
    function _calculateProtocolScore(address user) internal view returns (uint256) {
        uint256 interactions = protocolInteractions[user];

        // Score increases with interactions, max at 100 interactions
        if (interactions >= 100) return 100;

        return interactions;
    }

    // ============ Modifiers ============

    modifier onlyAuthorized() {
        require(
            authorizedUpdaters[msg.sender] || msg.sender == owner(),
            "Not authorized"
        );
        _;
    }
}
