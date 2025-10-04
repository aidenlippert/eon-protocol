// SPDX-License-Identifier: MIT
pragma solidity 0.8.20;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import "@openzeppelin/contracts/utils/cryptography/MessageHashUtils.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

/**
 * @title CreditRegistryV2
 * @notice Enhanced credit registry with canonical loan records and repayment tracking
 * @dev Privacy-first for attestations (only hashes stored), full loan history tracking
 *
 * KEY FEATURES:
 * - Canonical loan tracking (registerLoan, registerRepayment, registerLiquidation)
 * - Privacy-first attestation storage (hashes only)
 * - Wallet age tracking for sybil resistance
 * - Staking support with lock periods
 * - Wallet bundling with signature verification
 * - Authorized lenders and attesters
 */
contract CreditRegistryV2 is Ownable, ReentrancyGuard {
    using ECDSA for bytes32;
    using MessageHashUtils for bytes32;

    // ==================== EVENTS ====================

    event LoanRegistered(address indexed borrower, uint256 indexed loanId, uint256 principalUsd18, uint256 timestamp, address indexed lender);
    event RepaymentRegistered(address indexed borrower, uint256 indexed loanId, uint256 amountUsd18, uint256 timestamp, address indexed payer);
    event LiquidationRegistered(address indexed borrower, uint256 indexed loanId, uint256 amountUsd18, uint256 timestamp, address indexed liquidator);
    event AttestationPosted(bytes32 indexed attestationHash, address indexed subject, address indexed issuer, uint256 timestamp);
    event WalletsLinked(address indexed owner, address[] wallets, uint256 timestamp);
    event StakeDeposited(address indexed staker, uint256 amount, uint256 lockUntil);
    event StakeWithdrawn(address indexed staker, uint256 amount);
    event LenderAuthorized(address indexed lender, bool allowed);
    event AttesterAuthorized(address indexed attester, bool allowed);
    event FirstSeenRecorded(address indexed wallet, uint256 timestamp);

    // ==================== ENUMS ====================

    enum LoanStatus { Unknown, Active, Repaid, Liquidated }

    // ==================== STRUCTS ====================

    struct LoanRecord {
        uint256 loanId;
        address borrower;
        uint256 principalUsd18;     // Principal in USD with 18 decimals
        uint256 repaidUsd18;        // Cumulative repaid amount
        uint256 timestamp;          // Loan open timestamp
        LoanStatus status;
        address lender;
    }

    struct Attestation {
        bytes32 attestationHash;    // keccak256(attestationData) - privacy first!
        address subject;
        address issuer;
        uint256 timestamp;
        bytes signature;
    }

    struct StakeInfo {
        uint256 amount;
        uint256 lockUntil;
    }

    // ==================== STATE ====================

    // Loans by ID
    mapping(uint256 => LoanRecord) private _loansById;

    // Borrower => loan IDs
    mapping(address => uint256[]) private _loanIdsByBorrower;

    // Next loan ID (starts at 1)
    uint256 private _nextLoanId = 1;

    // Attestations by hash (privacy-first storage)
    mapping(bytes32 => Attestation) private _attestations;

    // Authorization
    mapping(address => bool) public authorizedLenders;
    mapping(address => bool) public authorizedAttesters;

    // Wallet age tracking
    mapping(address => uint256) public walletFirstSeen;

    // Wallet bundles (multi-wallet linking)
    mapping(address => address[]) public walletBundles;

    // Stakes
    mapping(address => StakeInfo) public stakes;
    IERC20 public stakingToken;

    // ==================== MODIFIERS ====================

    modifier onlyLender() {
        require(authorizedLenders[msg.sender], "Not authorized lender");
        _;
    }

    modifier onlyAttester() {
        require(authorizedAttesters[msg.sender], "Not authorized attester");
        _;
    }

    // ==================== CONSTRUCTOR ====================

    constructor(address _stakingToken) Ownable(msg.sender) {
        stakingToken = IERC20(_stakingToken);
    }

    // ==================== ADMIN ====================

    function setStakingToken(address token) external onlyOwner {
        require(token != address(0), "Zero address");
        stakingToken = IERC20(token);
    }

    function setAuthorizedLender(address lender, bool allowed) external onlyOwner {
        require(lender != address(0), "Zero address");
        authorizedLenders[lender] = allowed;
        emit LenderAuthorized(lender, allowed);
    }

    function setAuthorizedAttester(address attester, bool allowed) external onlyOwner {
        require(attester != address(0), "Zero address");
        authorizedAttesters[attester] = allowed;
        emit AttesterAuthorized(attester, allowed);
    }

    function setFirstSeen(address wallet, uint256 timestamp) external onlyOwner {
        walletFirstSeen[wallet] = timestamp;
        emit FirstSeenRecorded(wallet, timestamp);
    }

    // ==================== LOAN TRACKING ====================

    /**
     * @notice Register a new loan (called by authorized lenders)
     * @param borrower Borrower address
     * @param principalUsd18 Principal amount in USD (18 decimals)
     * @return loanId Assigned loan ID
     */
    function registerLoan(address borrower, uint256 principalUsd18) external onlyLender returns (uint256) {
        require(borrower != address(0), "Zero borrower");
        require(principalUsd18 > 0, "Zero principal");

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

        // Record first seen if new wallet
        if (walletFirstSeen[borrower] == 0) {
            walletFirstSeen[borrower] = block.timestamp;
            emit FirstSeenRecorded(borrower, block.timestamp);
        }

        emit LoanRegistered(borrower, loanId, principalUsd18, block.timestamp, msg.sender);
        return loanId;
    }

    /**
     * @notice Register a repayment for a loan
     * @param loanId Loan identifier
     * @param amountUsd18 Repayment amount in USD (18 decimals)
     */
    function registerRepayment(uint256 loanId, uint256 amountUsd18) external onlyLender {
        require(amountUsd18 > 0, "Zero amount");

        LoanRecord storage loan = _loansById[loanId];
        require(loan.loanId != 0, "Loan not found");
        require(loan.status == LoanStatus.Active, "Loan not active");

        loan.repaidUsd18 += amountUsd18;

        // Mark as repaid if fully repaid
        if (loan.repaidUsd18 >= loan.principalUsd18) {
            loan.status = LoanStatus.Repaid;
        }

        emit RepaymentRegistered(loan.borrower, loanId, amountUsd18, block.timestamp, msg.sender);
    }

    /**
     * @notice Register a liquidation (default)
     * @param loanId Loan identifier
     * @param recoveredUsd18 Amount recovered from liquidation
     */
    function registerLiquidation(uint256 loanId, uint256 recoveredUsd18) external onlyLender {
        LoanRecord storage loan = _loansById[loanId];
        require(loan.loanId != 0, "Loan not found");
        require(loan.status == LoanStatus.Active, "Loan not active");

        loan.status = LoanStatus.Liquidated;
        loan.repaidUsd18 += recoveredUsd18;

        emit LiquidationRegistered(loan.borrower, loanId, recoveredUsd18, block.timestamp, msg.sender);
    }

    // ==================== LOAN GETTERS ====================

    function getLoan(uint256 loanId) external view returns (LoanRecord memory) {
        return _loansById[loanId];
    }

    function getLoanIdsByBorrower(address borrower) external view returns (uint256[] memory) {
        return _loanIdsByBorrower[borrower];
    }

    function getLoansByBorrower(address borrower) external view returns (LoanRecord[] memory) {
        uint256[] storage ids = _loanIdsByBorrower[borrower];
        LoanRecord[] memory loans = new LoanRecord[](ids.length);

        for (uint256 i = 0; i < ids.length; i++) {
            loans[i] = _loansById[ids[i]];
        }

        return loans;
    }

    function getActiveLoanCount(address borrower) external view returns (uint256) {
        uint256[] storage ids = _loanIdsByBorrower[borrower];
        uint256 count = 0;

        for (uint256 i = 0; i < ids.length; i++) {
            if (_loansById[ids[i]].status == LoanStatus.Active) {
                count++;
            }
        }

        return count;
    }

    // ==================== ATTESTATIONS ====================

    /**
     * @notice Post an attestation (KYC, credit data, etc.)
     * @param attestationHash Hash of attestation data (privacy-first)
     * @param subject Subject of attestation
     * @param timestamp Attestation timestamp
     * @param signature Attester signature
     */
    function postAttestation(
        bytes32 attestationHash,
        address subject,
        uint256 timestamp,
        bytes calldata signature
    ) external {
        // Verify signature
        bytes32 messageHash = keccak256(abi.encodePacked(attestationHash, subject, timestamp));
        address signer = messageHash.toEthSignedMessageHash().recover(signature);

        require(
            authorizedAttesters[signer] || authorizedAttesters[msg.sender],
            "Attester not authorized"
        );

        _attestations[attestationHash] = Attestation({
            attestationHash: attestationHash,
            subject: subject,
            issuer: signer,
            timestamp: timestamp,
            signature: signature
        });

        // Record first seen
        if (walletFirstSeen[subject] == 0) {
            walletFirstSeen[subject] = block.timestamp;
            emit FirstSeenRecorded(subject, block.timestamp);
        }

        emit AttestationPosted(attestationHash, subject, signer, timestamp);
    }

    function getAttestation(bytes32 attestationHash) external view returns (Attestation memory) {
        return _attestations[attestationHash];
    }

    // ==================== STAKING ====================

    function depositStake(uint256 amount, uint256 lockSeconds) external nonReentrant {
        require(address(stakingToken) != address(0), "No staking token");
        require(amount > 0, "Zero amount");

        bool success = stakingToken.transferFrom(msg.sender, address(this), amount);
        require(success, "Transfer failed");

        StakeInfo storage stake = stakes[msg.sender];
        stake.amount += amount;

        uint256 newLockUntil = block.timestamp + lockSeconds;
        if (newLockUntil > stake.lockUntil) {
            stake.lockUntil = newLockUntil;
        }

        // Record first seen
        if (walletFirstSeen[msg.sender] == 0) {
            walletFirstSeen[msg.sender] = block.timestamp;
            emit FirstSeenRecorded(msg.sender, block.timestamp);
        }

        emit StakeDeposited(msg.sender, amount, stake.lockUntil);
    }

    function withdrawStake(uint256 amount) external nonReentrant {
        StakeInfo storage stake = stakes[msg.sender];
        require(stake.amount >= amount, "Insufficient stake");
        require(block.timestamp >= stake.lockUntil, "Still locked");

        stake.amount -= amount;

        bool success = stakingToken.transfer(msg.sender, amount);
        require(success, "Transfer failed");

        emit StakeWithdrawn(msg.sender, amount);
    }

    // ==================== WALLET LINKING ====================

    function linkWallets(
        address owner,
        address[] calldata wallets,
        bytes[] calldata signatures,
        uint256 nonce
    ) external {
        require(wallets.length == signatures.length, "Length mismatch");

        bytes32 walletsHash = keccak256(abi.encodePacked(wallets));

        for (uint256 i = 0; i < wallets.length; i++) {
            bytes32 messageHash = keccak256(
                abi.encodePacked(owner, walletsHash, nonce, block.chainid)
            );
            address signer = messageHash.toEthSignedMessageHash().recover(signatures[i]);
            require(signer == wallets[i], "Invalid signature");

            // Record first seen for each wallet
            if (walletFirstSeen[wallets[i]] == 0) {
                walletFirstSeen[wallets[i]] = block.timestamp;
                emit FirstSeenRecorded(wallets[i], block.timestamp);
            }
        }

        walletBundles[owner] = wallets;
        emit WalletsLinked(owner, wallets, block.timestamp);
    }

    function getWalletBundle(address owner) external view returns (address[] memory) {
        return walletBundles[owner];
    }

    // ==================== WALLET AGE ====================

    function getFirstSeen(address wallet) external view returns (uint256) {
        return walletFirstSeen[wallet];
    }

    function recordFirstSeen() external {
        if (walletFirstSeen[msg.sender] == 0) {
            walletFirstSeen[msg.sender] = block.timestamp;
            emit FirstSeenRecorded(msg.sender, block.timestamp);
        }
    }

    function getWalletAge(address wallet) external view returns (uint256) {
        uint256 firstSeen = walletFirstSeen[wallet];
        if (firstSeen == 0) return 0;
        return block.timestamp - firstSeen;
    }

    // ==================== STAKE GETTERS ====================

    function getStakeInfo(address staker) external view returns (StakeInfo memory) {
        return stakes[staker];
    }

    // ==================== EMERGENCY ====================

    function rescueERC20(address token, address to, uint256 amount) external onlyOwner {
        require(to != address(0), "Zero address");
        bool success = IERC20(token).transfer(to, amount);
        require(success, "Transfer failed");
    }

    function rescueETH(address payable to, uint256 amount) external onlyOwner {
        require(to != address(0), "Zero address");
        (bool success, ) = to.call{value: amount}("");
        require(success, "Transfer failed");
    }

    // Allow receiving ETH for potential future use
    receive() external payable {}
}
