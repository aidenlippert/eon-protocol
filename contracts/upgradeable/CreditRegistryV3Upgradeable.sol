// SPDX-License-Identifier: MIT
pragma solidity 0.8.20;

import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/ReentrancyGuardUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import "@openzeppelin/contracts/utils/cryptography/MessageHashUtils.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

/**
 * @title CreditRegistryV3Upgradeable
 * @notice UUPS Upgradeable credit bureau with S1-S5 data tracking
 * @dev Phase 3 - Production-ready with upgrade capability
 *
 * UPGRADE PATTERN: UUPS (Universal Upgradeable Proxy Standard)
 * - Minimal proxy with upgrade logic in implementation
 * - Owner-controlled upgrades via _authorizeUpgrade()
 * - Data preservation across upgrades
 * - Gas-efficient compared to TransparentUpgradeableProxy
 *
 * ENHANCEMENTS:
 * - S1: Repayment history with O(1) aggregate storage
 * - S2: Collateral utilization tracking
 * - S3: KYC proof storage (Didit integration)
 * - S4: Cross-chain reputation storage (CCIP ready)
 * - S5: Governance participation tracking
 */
contract CreditRegistryV3Upgradeable is
    Initializable,
    OwnableUpgradeable,
    ReentrancyGuardUpgradeable,
    UUPSUpgradeable
{
    using ECDSA for bytes32;
    using MessageHashUtils for bytes32;

    // ==================== EVENTS ====================

    // S1 - Repayment History
    event LoanRegistered(address indexed borrower, uint256 indexed loanId, uint256 principalUsd18, uint256 timestamp, address indexed lender);
    event RepaymentRegistered(address indexed borrower, uint256 indexed loanId, uint256 amountUsd18, uint256 timestamp, address indexed payer);
    event LiquidationRegistered(address indexed borrower, uint256 indexed loanId, uint256 amountUsd18, uint256 timestamp, address indexed liquidator);

    // S2 - Collateral Utilization
    event CollateralDataRecorded(uint256 indexed loanId, address indexed collateralToken, uint256 collateralValueUsd18, uint16 userScore);

    // S3 - Sybil Resistance
    event KYCVerified(address indexed user, bytes32 credentialHash, uint256 expiresAt);
    event StakeDeposited(address indexed staker, uint256 amount, uint256 lockUntil);
    event StakeWithdrawn(address indexed staker, uint256 amount);
    event FirstSeenRecorded(address indexed wallet, uint256 timestamp);

    // S4 - Cross-Chain Reputation
    event CrossChainReputationReceived(address indexed user, uint64 indexed sourceChainSelector, uint16 score, uint256 timestamp);

    // S5 - Governance Participation
    event VoteRecorded(address indexed voter, uint256 indexed proposalId, uint256 timestamp);
    event ProposalRecorded(address indexed proposer, uint256 indexed proposalId, uint256 timestamp);

    // System
    event LenderAuthorized(address indexed lender, bool allowed);
    event CCIPSenderAuthorized(address indexed sender, bool allowed);
    event GovernanceAuthorized(address indexed governance, bool allowed);

    // ==================== ENUMS ====================

    enum LoanStatus { Unknown, Active, Repaid, Liquidated }

    // ==================== STRUCTS ====================

    // S1 - Repayment History
    struct LoanRecord {
        uint256 loanId;
        address borrower;
        uint256 principalUsd18;
        uint256 repaidUsd18;
        uint256 timestamp;
        LoanStatus status;
        address lender;
    }

    // GAS OPTIMIZED - Aggregate Credit Data (no loops needed)
    struct AggregateCreditData {
        // S1 - Repayment History Aggregates
        uint256 totalLoans;
        uint256 repaidLoans;
        uint256 liquidatedLoans;
        uint256 activeLoans;

        // S2 - Collateral Utilization Aggregates
        uint256 totalCollateralUsd18;
        uint256 totalBorrowedUsd18;
        uint256 maxLtvBorrowCount; // Count of loans borrowed at max LTV

        // S3 - Sybil Resistance
        uint256 firstSeen;
        KYCProof kyc;
        StakeInfo stake;
    }

    // S2 - Collateral Utilization
    struct CollateralData {
        address collateralToken;
        uint256 collateralValueUsd18;
        uint256 principalUsd18;
        uint16 userScoreAtBorrow;
    }

    // S3 - Sybil Resistance
    struct KYCProof {
        bytes32 credentialHash;
        uint256 verifiedAt;
        uint256 expiresAt;
    }

    struct StakeInfo {
        uint256 amount;
        uint256 lockUntil;
    }

    // S4 - Cross-Chain Reputation
    struct CrossChainScore {
        uint16 overallScore;
        uint256 updatedAt;
    }

    // S5 - Governance Participation
    struct GovernanceActivity {
        uint256 voteCount;
        uint256 proposalCount;
        uint256 lastVoteTimestamp;
    }

    // ==================== STATE ====================

    // S1 - Repayment History
    uint256 public nextLoanId;
    mapping(uint256 => LoanRecord) public loans;
    mapping(address => uint256[]) public userLoanIds;

    // S2 - Collateral Utilization
    mapping(uint256 => CollateralData) public collateralData;
    mapping(address => address[]) private userCollateralAssets;

    // S3 - Sybil Resistance
    address public stakeToken;

    // S4 - Cross-Chain Reputation
    mapping(address => mapping(uint64 => CrossChainScore)) public crossChainScores;

    // S5 - Governance Participation
    mapping(address => GovernanceActivity) public governanceActivity;

    // GAS OPTIMIZED - Aggregate Storage
    mapping(address => AggregateCreditData) public aggregateCreditData;

    // Access Control
    mapping(address => bool) public authorizedLenders;
    mapping(address => bool) public authorizedCCIPSenders;
    mapping(address => bool) public authorizedGovernance;

    // ==================== UPGRADEABLE PATTERN ====================

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    /**
     * @notice Initialize the contract (replaces constructor)
     * @dev Called once during proxy deployment
     */
    function initialize(address _owner, address _stakeToken) external initializer {
        __Ownable_init(_owner);
        __ReentrancyGuard_init();
        __UUPSUpgradeable_init();

        stakeToken = _stakeToken;
        nextLoanId = 1;
    }

    /**
     * @notice Authorize contract upgrades (UUPS requirement)
     * @dev Only owner can upgrade the implementation
     */
    function _authorizeUpgrade(address newImplementation) internal override onlyOwner {}

    /**
     * @notice Get current implementation version
     * @dev Useful for verifying upgrades
     */
    function version() external pure returns (string memory) {
        return "3.0.0";
    }

    // ==================== S1: REPAYMENT HISTORY ====================

    function registerLoan(
        address borrower,
        uint256 principalUsd18
    ) external onlyAuthorizedLender nonReentrant returns (uint256 loanId) {
        require(borrower != address(0), "Invalid borrower");
        require(principalUsd18 > 0, "Invalid principal");

        loanId = nextLoanId++;

        loans[loanId] = LoanRecord({
            loanId: loanId,
            borrower: borrower,
            principalUsd18: principalUsd18,
            repaidUsd18: 0,
            timestamp: block.timestamp,
            status: LoanStatus.Active,
            lender: msg.sender
        });

        userLoanIds[borrower].push(loanId);

        // GAS OPTIMIZED - Update aggregates
        AggregateCreditData storage agg = aggregateCreditData[borrower];
        agg.totalLoans++;
        agg.activeLoans++;
        agg.totalBorrowedUsd18 += principalUsd18;

        // Track first interaction
        if (agg.firstSeen == 0) {
            agg.firstSeen = block.timestamp;
            emit FirstSeenRecorded(borrower, block.timestamp);
        }

        emit LoanRegistered(borrower, loanId, principalUsd18, block.timestamp, msg.sender);
    }

    function registerRepayment(
        uint256 loanId,
        uint256 amountUsd18
    ) external onlyAuthorizedLender nonReentrant {
        LoanRecord storage loan = loans[loanId];
        require(loan.status == LoanStatus.Active, "Loan not active");

        loan.repaidUsd18 += amountUsd18;

        // GAS OPTIMIZED - Update aggregates
        AggregateCreditData storage agg = aggregateCreditData[loan.borrower];

        if (loan.repaidUsd18 >= loan.principalUsd18) {
            loan.status = LoanStatus.Repaid;
            agg.repaidLoans++;
            agg.activeLoans--;
            agg.totalBorrowedUsd18 -= loan.principalUsd18;
        }

        emit RepaymentRegistered(loan.borrower, loanId, amountUsd18, block.timestamp, msg.sender);
    }

    function registerLiquidation(
        uint256 loanId,
        uint256 recoveredUsd18
    ) external onlyAuthorizedLender nonReentrant {
        LoanRecord storage loan = loans[loanId];
        require(loan.status == LoanStatus.Active, "Loan not active");

        loan.status = LoanStatus.Liquidated;
        loan.repaidUsd18 += recoveredUsd18;

        // GAS OPTIMIZED - Update aggregates
        AggregateCreditData storage agg = aggregateCreditData[loan.borrower];
        agg.liquidatedLoans++;
        agg.activeLoans--;
        agg.totalBorrowedUsd18 -= loan.principalUsd18;

        emit LiquidationRegistered(loan.borrower, loanId, recoveredUsd18, block.timestamp, msg.sender);
    }

    // ==================== S2: COLLATERAL UTILIZATION ====================

    function recordCollateralData(
        uint256 loanId,
        address collateralToken,
        uint256 collateralValueUsd18,
        uint16 userScore
    ) external onlyAuthorizedLender nonReentrant {
        LoanRecord memory loan = loans[loanId];
        require(loan.status == LoanStatus.Active, "Loan not active");

        collateralData[loanId] = CollateralData({
            collateralToken: collateralToken,
            collateralValueUsd18: collateralValueUsd18,
            principalUsd18: loan.principalUsd18,
            userScoreAtBorrow: userScore
        });

        // Track unique collateral assets
        if (!_hasCollateralAsset(loan.borrower, collateralToken)) {
            userCollateralAssets[loan.borrower].push(collateralToken);
        }

        // GAS OPTIMIZED - Update aggregates
        AggregateCreditData storage agg = aggregateCreditData[loan.borrower];
        agg.totalCollateralUsd18 += collateralValueUsd18;

        // Check if borrowed at max LTV (threshold: 90% of collateral value)
        uint256 ltvPercent = (loan.principalUsd18 * 100) / collateralValueUsd18;
        if (ltvPercent >= 80) {
            agg.maxLtvBorrowCount++;
        }

        emit CollateralDataRecorded(loanId, collateralToken, collateralValueUsd18, userScore);
    }

    function _hasCollateralAsset(address user, address token) private view returns (bool) {
        address[] memory assets = userCollateralAssets[user];
        for (uint256 i = 0; i < assets.length; i++) {
            if (assets[i] == token) return true;
        }
        return false;
    }

    function getUserCollateralAssets(address user) external view returns (address[] memory) {
        return userCollateralAssets[user];
    }

    // ==================== S3: SYBIL RESISTANCE ====================

    function recordKYCProof(
        address user,
        bytes32 credentialHash,
        uint256 expiresAt,
        bytes calldata proof
    ) external onlyOwner {
        require(user != address(0), "Invalid user");
        require(expiresAt > block.timestamp, "Already expired");

        AggregateCreditData storage agg = aggregateCreditData[user];
        agg.kyc = KYCProof({
            credentialHash: credentialHash,
            verifiedAt: block.timestamp,
            expiresAt: expiresAt
        });

        emit KYCVerified(user, credentialHash, expiresAt);
    }

    function depositStake(uint256 amount, uint256 lockDuration) external nonReentrant {
        require(amount > 0, "Invalid amount");
        require(lockDuration >= 30 days, "Min 30 days");

        IERC20(stakeToken).transferFrom(msg.sender, address(this), amount);

        AggregateCreditData storage agg = aggregateCreditData[msg.sender];
        agg.stake.amount += amount;
        agg.stake.lockUntil = block.timestamp + lockDuration;

        emit StakeDeposited(msg.sender, amount, agg.stake.lockUntil);
    }

    function withdrawStake() external nonReentrant {
        AggregateCreditData storage agg = aggregateCreditData[msg.sender];
        require(agg.stake.amount > 0, "No stake");
        require(block.timestamp >= agg.stake.lockUntil, "Still locked");

        uint256 amount = agg.stake.amount;
        agg.stake.amount = 0;
        agg.stake.lockUntil = 0;

        IERC20(stakeToken).transfer(msg.sender, amount);

        emit StakeWithdrawn(msg.sender, amount);
    }

    // ==================== S4: CROSS-CHAIN REPUTATION ====================

    function receiveCrossChainScore(
        address user,
        uint64 sourceChainSelector,
        uint16 score
    ) external onlyAuthorizedCCIPSender {
        crossChainScores[user][sourceChainSelector] = CrossChainScore({
            overallScore: score,
            updatedAt: block.timestamp
        });

        emit CrossChainReputationReceived(user, sourceChainSelector, score, block.timestamp);
    }

    function getCrossChainScore(
        address user,
        uint64 chainSelector
    ) external view returns (CrossChainScore memory) {
        return crossChainScores[user][chainSelector];
    }

    // ==================== S5: GOVERNANCE PARTICIPATION ====================

    function recordVote(address voter, uint256 proposalId) external onlyAuthorizedGovernance {
        GovernanceActivity storage activity = governanceActivity[voter];
        activity.voteCount++;
        activity.lastVoteTimestamp = block.timestamp;

        emit VoteRecorded(voter, proposalId, block.timestamp);
    }

    function recordProposal(address proposer, uint256 proposalId) external onlyAuthorizedGovernance {
        GovernanceActivity storage activity = governanceActivity[proposer];
        activity.proposalCount++;

        emit ProposalRecorded(proposer, proposalId, block.timestamp);
    }

    function getGovernanceActivity(address user) external view returns (GovernanceActivity memory) {
        return governanceActivity[user];
    }

    // ==================== VIEW FUNCTIONS ====================

    function getLoan(uint256 loanId) external view returns (LoanRecord memory) {
        return loans[loanId];
    }

    function getUserLoans(address borrower) external view returns (uint256[] memory) {
        return userLoanIds[borrower];
    }

    function getAggregateCreditData(address user) external view returns (AggregateCreditData memory) {
        return aggregateCreditData[user];
    }

    // ==================== ACCESS CONTROL ====================

    function setLenderAuthorization(address lender, bool allowed) external onlyOwner {
        authorizedLenders[lender] = allowed;
        emit LenderAuthorized(lender, allowed);
    }

    function setCCIPSenderAuthorization(address sender, bool allowed) external onlyOwner {
        authorizedCCIPSenders[sender] = allowed;
        emit CCIPSenderAuthorized(sender, allowed);
    }

    function setGovernanceAuthorization(address governance, bool allowed) external onlyOwner {
        authorizedGovernance[governance] = allowed;
        emit GovernanceAuthorized(governance, allowed);
    }

    modifier onlyAuthorizedLender() {
        require(authorizedLenders[msg.sender], "Not authorized lender");
        _;
    }

    modifier onlyAuthorizedCCIPSender() {
        require(authorizedCCIPSenders[msg.sender], "Not authorized CCIP sender");
        _;
    }

    modifier onlyAuthorizedGovernance() {
        require(authorizedGovernance[msg.sender], "Not authorized governance");
        _;
    }
}
