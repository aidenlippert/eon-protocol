// SPDX-License-Identifier: MIT
pragma solidity 0.8.20;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import "@openzeppelin/contracts/utils/cryptography/MessageHashUtils.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

/**
 * @title CreditRegistryV3
 * @notice Complete credit bureau with S1-S5 data tracking
 * @dev Phase 3B - Full 5-factor credit scoring system
 *
 * ENHANCEMENTS OVER V2:
 * - S2: Collateral utilization tracking
 * - S3: KYC proof storage (Didit integration)
 * - S4: Cross-chain reputation storage (CCIP ready)
 * - S5: Governance participation tracking
 */
contract CreditRegistryV3 is Ownable, ReentrancyGuard {
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
        uint256 totalLoans;
        uint256 repaidLoans;
        uint256 updatedAt;
    }

    // S5 - Governance Participation
    struct GovernanceActivity {
        uint256 voteCount;
        uint256 proposalCount;
        uint256 lastVoteTimestamp;
        uint256 lastProposalTimestamp;
    }

    // ==================== STATE ====================

    // S1 - Repayment History
    mapping(uint256 => LoanRecord) private _loansById;
    mapping(address => uint256[]) private _loanIdsByBorrower;
    uint256 private _nextLoanId = 1;

    // S2 - Collateral Utilization
    mapping(uint256 => CollateralData) public loanCollateralData;
    mapping(address => address[]) private _userCollateralAssets; // User => unique collateral tokens

    // S3 - Sybil Resistance
    mapping(address => uint256) public walletFirstSeen;
    mapping(address => KYCProof) public kycProofs;
    mapping(address => StakeInfo) public stakes;
    IERC20 public stakingToken;
    address public kycIssuer; // Didit issuer address

    // S4 - Cross-Chain Reputation
    mapping(address => mapping(uint64 => CrossChainScore)) public crossChainScores; // User => ChainSelector => Score

    // S5 - Governance Participation
    mapping(address => GovernanceActivity) public governanceActivity;

    // Authorization
    mapping(address => bool) public authorizedLenders;
    mapping(address => bool) public authorizedCCIPSenders; // For cross-chain messages
    mapping(address => bool) public authorizedGovernance; // For vote/proposal recording

    // ==================== MODIFIERS ====================

    modifier onlyLender() {
        require(authorizedLenders[msg.sender], "Not authorized lender");
        _;
    }

    modifier onlyCCIPSender() {
        require(authorizedCCIPSenders[msg.sender], "Not authorized CCIP sender");
        _;
    }

    modifier onlyGovernance() {
        require(authorizedGovernance[msg.sender], "Not authorized governance");
        _;
    }

    // ==================== CONSTRUCTOR ====================

    constructor(address _stakingToken, address _kycIssuer) Ownable(msg.sender) {
        stakingToken = IERC20(_stakingToken);
        kycIssuer = _kycIssuer;
    }

    // ==================== S1: REPAYMENT HISTORY ====================

    function registerLoan(address borrower, uint256 principalUsd18) external onlyLender returns (uint256) {
        uint256 loanId = _nextLoanId++;

        _loansById[loanId] = LoanRecord({
            loanId: loanId,
            borrower: borrower,
            principalUsd18: principalUsd18,
            repaidUsd18: 0,
            timestamp: block.timestamp,
            status: LoanStatus.Active,
            lender: msg.sender
        });

        _loanIdsByBorrower[borrower].push(loanId);

        // Record first seen if new user
        if (walletFirstSeen[borrower] == 0) {
            walletFirstSeen[borrower] = block.timestamp;
            emit FirstSeenRecorded(borrower, block.timestamp);
        }

        emit LoanRegistered(borrower, loanId, principalUsd18, block.timestamp, msg.sender);
        return loanId;
    }

    function registerRepayment(uint256 loanId, uint256 amountUsd18) external onlyLender {
        LoanRecord storage loan = _loansById[loanId];
        require(loan.status == LoanStatus.Active, "Loan not active");
        require(loan.lender == msg.sender, "Wrong lender");

        loan.repaidUsd18 += amountUsd18;

        if (loan.repaidUsd18 >= loan.principalUsd18) {
            loan.status = LoanStatus.Repaid;
        }

        emit RepaymentRegistered(loan.borrower, loanId, amountUsd18, block.timestamp, msg.sender);
    }

    function registerLiquidation(uint256 loanId, uint256 recoveredUsd18) external onlyLender {
        LoanRecord storage loan = _loansById[loanId];
        require(loan.status == LoanStatus.Active, "Loan not active");
        require(loan.lender == msg.sender, "Wrong lender");

        loan.status = LoanStatus.Liquidated;
        loan.repaidUsd18 += recoveredUsd18;

        emit LiquidationRegistered(loan.borrower, loanId, recoveredUsd18, block.timestamp, msg.sender);
    }

    // ==================== S2: COLLATERAL UTILIZATION ====================

    function recordCollateralData(
        uint256 loanId,
        address collateralToken,
        uint256 collateralValueUsd18,
        uint16 userScore
    ) external onlyLender {
        require(_loansById[loanId].status == LoanStatus.Active, "Loan not active");

        loanCollateralData[loanId] = CollateralData({
            collateralToken: collateralToken,
            collateralValueUsd18: collateralValueUsd18,
            principalUsd18: _loansById[loanId].principalUsd18,
            userScoreAtBorrow: userScore
        });

        // Track unique collateral assets
        address borrower = _loansById[loanId].borrower;
        if (!_hasCollateralAsset(borrower, collateralToken)) {
            _userCollateralAssets[borrower].push(collateralToken);
        }

        emit CollateralDataRecorded(loanId, collateralToken, collateralValueUsd18, userScore);
    }

    function _hasCollateralAsset(address user, address token) private view returns (bool) {
        address[] memory assets = _userCollateralAssets[user];
        for (uint256 i = 0; i < assets.length; i++) {
            if (assets[i] == token) return true;
        }
        return false;
    }

    // ==================== S3: SYBIL RESISTANCE (KYC) ====================

    function submitKYCProof(
        bytes32 credentialHash,
        uint256 expiresAt,
        bytes memory signature
    ) external {
        // Verify signature from Didit issuer
        bytes32 messageHash = keccak256(abi.encodePacked(msg.sender, credentialHash, expiresAt));
        bytes32 ethSignedHash = messageHash.toEthSignedMessageHash();
        address signer = ethSignedHash.recover(signature);

        require(signer == kycIssuer, "Invalid KYC signature");
        require(expiresAt > block.timestamp, "KYC proof expired");

        kycProofs[msg.sender] = KYCProof({
            credentialHash: credentialHash,
            verifiedAt: block.timestamp,
            expiresAt: expiresAt
        });

        emit KYCVerified(msg.sender, credentialHash, expiresAt);
    }

    function setKYCIssuer(address _kycIssuer) external onlyOwner {
        kycIssuer = _kycIssuer;
    }

    // ==================== S3: SYBIL RESISTANCE (STAKING) ====================

    function stake(uint256 amount) external nonReentrant {
        require(amount > 0, "Zero amount");

        stakingToken.transferFrom(msg.sender, address(this), amount);

        stakes[msg.sender].amount += amount;
        stakes[msg.sender].lockUntil = block.timestamp + 30 days;

        emit StakeDeposited(msg.sender, amount, stakes[msg.sender].lockUntil);
    }

    function unstake(uint256 amount) external nonReentrant {
        require(amount > 0, "Zero amount");
        require(stakes[msg.sender].amount >= amount, "Insufficient stake");
        require(block.timestamp >= stakes[msg.sender].lockUntil, "Stake locked");

        stakes[msg.sender].amount -= amount;
        stakingToken.transfer(msg.sender, amount);

        emit StakeWithdrawn(msg.sender, amount);
    }

    // ==================== S4: CROSS-CHAIN REPUTATION ====================

    function receiveCrossChainReputation(
        address user,
        uint64 sourceChainSelector,
        uint16 overallScore,
        uint256 totalLoans,
        uint256 repaidLoans
    ) external onlyCCIPSender {
        crossChainScores[user][sourceChainSelector] = CrossChainScore({
            overallScore: overallScore,
            totalLoans: totalLoans,
            repaidLoans: repaidLoans,
            updatedAt: block.timestamp
        });

        emit CrossChainReputationReceived(user, sourceChainSelector, overallScore, block.timestamp);
    }

    // ==================== S5: GOVERNANCE PARTICIPATION ====================

    function recordVote(address voter, uint256 proposalId) external onlyGovernance {
        governanceActivity[voter].voteCount++;
        governanceActivity[voter].lastVoteTimestamp = block.timestamp;

        emit VoteRecorded(voter, proposalId, block.timestamp);
    }

    function recordProposal(address proposer, uint256 proposalId) external onlyGovernance {
        governanceActivity[proposer].proposalCount++;
        governanceActivity[proposer].lastProposalTimestamp = block.timestamp;

        emit ProposalRecorded(proposer, proposalId, block.timestamp);
    }

    // ==================== AUTHORIZATION ====================

    function setAuthorizedLender(address lender, bool allowed) external onlyOwner {
        authorizedLenders[lender] = allowed;
        emit LenderAuthorized(lender, allowed);
    }

    function setAuthorizedCCIPSender(address sender, bool allowed) external onlyOwner {
        authorizedCCIPSenders[sender] = allowed;
        emit CCIPSenderAuthorized(sender, allowed);
    }

    function setAuthorizedGovernance(address governance, bool allowed) external onlyOwner {
        authorizedGovernance[governance] = allowed;
        emit GovernanceAuthorized(governance, allowed);
    }

    // ==================== VIEW FUNCTIONS ====================

    // S1 - Repayment History
    function getLoan(uint256 loanId) external view returns (LoanRecord memory) {
        return _loansById[loanId];
    }

    function getLoanIdsByBorrower(address borrower) external view returns (uint256[] memory) {
        return _loanIdsByBorrower[borrower];
    }

    function getFirstSeen(address wallet) external view returns (uint256) {
        return walletFirstSeen[wallet];
    }

    function getStakeInfo(address user) external view returns (StakeInfo memory) {
        return stakes[user];
    }

    // S2 - Collateral Utilization
    function getCollateralData(uint256 loanId) external view returns (CollateralData memory) {
        return loanCollateralData[loanId];
    }

    function getUserCollateralAssets(address user) external view returns (address[] memory) {
        return _userCollateralAssets[user];
    }

    // S3 - Sybil Resistance
    function getKYCProof(address user) external view returns (KYCProof memory) {
        return kycProofs[user];
    }

    function isKYCVerified(address user) external view returns (bool) {
        KYCProof memory proof = kycProofs[user];
        return proof.verifiedAt > 0 && proof.expiresAt > block.timestamp;
    }

    // S4 - Cross-Chain Reputation
    function getCrossChainScore(address user, uint64 chainSelector) external view returns (CrossChainScore memory) {
        return crossChainScores[user][chainSelector];
    }

    // S5 - Governance Participation
    function getGovernanceActivity(address user) external view returns (GovernanceActivity memory) {
        return governanceActivity[user];
    }
}
