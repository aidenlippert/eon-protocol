// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/cryptography/MerkleProof.sol";

/**
 * @title CreditRegistryV1_1
 * @notice Credit score registry with optimistic oracle mechanism
 * @dev Enhanced v1.1 model with 8-factor scoring (300-850 range)
 *
 * OPTIMISTIC ORACLE DESIGN:
 * 1. Score attester posts score + merkle root
 * 2. Challenge period (1 hour default)
 * 3. Anyone can challenge with bond
 * 4. If challenged, attester must provide merkle proof
 * 5. Invalid scores are rejected, challenger gets reward
 *
 * PROGRESSIVE DECENTRALIZATION:
 * - Phase 1 (Launch): Team-controlled attester (transparent, auditable)
 * - Phase 2 (Month 6): Chainlink Functions integration
 * - Phase 3 (Month 12+): ZK-ML integration
 */
contract CreditRegistryV1_1 is Ownable, ReentrancyGuard {

    // ============ Structs ============

    /**
     * @notice Credit score data (v1.1 enhanced model)
     * @param score Credit score (300-850, FICO-like)
     * @param tier Credit tier (0=Subprime, 1=Fair, 2=Good, 3=Very Good, 4=Exceptional)
     * @param ltv Recommended LTV percentage (0-90)
     * @param interestRateMultiplier Interest rate multiplier (80-150 = 0.8x to 1.5x)
     * @param lastUpdated Timestamp of last score update
     * @param dataQuality Data quality (0=low, 1=medium, 2=high)
     */
    struct CreditScore {
        uint16 score;                   // 300-850
        uint8 tier;                     // 0-4
        uint8 ltv;                      // 0-90%
        uint16 interestRateMultiplier;  // 80-150 (0.8x-1.5x in basis points)
        uint64 lastUpdated;             // Timestamp
        uint8 dataQuality;              // 0-2
    }

    /**
     * @notice Score attestation with optimistic oracle data
     * @param scoreHash Hash of the score data
     * @param merkleRoot Merkle root of supporting evidence
     * @param attester Address that posted the attestation
     * @param timestamp When attestation was posted
     * @param challengeDeadline Deadline for challenges
     * @param challenged Whether this attestation has been challenged
     */
    struct ScoreAttestation {
        bytes32 scoreHash;
        bytes32 merkleRoot;
        address attester;
        uint64 timestamp;
        uint64 challengeDeadline;
        bool challenged;
        bool finalized;
    }

    /**
     * @notice Challenge to a score attestation
     * @param challenger Address that initiated the challenge
     * @param bond Amount of bond posted
     * @param reason Brief reason code for challenge
     * @param resolved Whether challenge has been resolved
     */
    struct Challenge {
        address challenger;
        uint256 bond;
        uint8 reason;
        bool resolved;
        bool successful;
    }

    // ============ State Variables ============

    /// @notice Current credit scores for each user
    mapping(address => CreditScore) public scores;

    /// @notice Pending attestations (userAddress => attestation)
    mapping(address => ScoreAttestation) public pendingAttestations;

    /// @notice Challenges (userAddress => challenge)
    mapping(address => Challenge) public challenges;

    /// @notice Authorized score attesters
    mapping(address => bool) public authorizedAttesters;

    /// @notice Challenge period duration (default 1 hour)
    uint256 public challengePeriod = 1 hours;

    /// @notice Minimum challenge bond (default 500 USDC = 500e6)
    uint256 public challengeBond = 500e6;

    /// @notice Challenge reward percentage (default 50% of bond)
    uint256 public challengeRewardBps = 5000; // 50%

    /// @notice Treasury address for failed challenge bonds
    address public treasury;

    // ============ Events ============

    event ScoreAttested(
        address indexed user,
        uint16 score,
        uint8 tier,
        bytes32 merkleRoot,
        address indexed attester,
        uint64 challengeDeadline
    );

    event ScoreChallenged(
        address indexed user,
        address indexed challenger,
        uint256 bond,
        uint8 reason
    );

    event ChallengeResolved(
        address indexed user,
        address indexed challenger,
        bool successful,
        uint256 reward
    );

    event ScoreFinalized(
        address indexed user,
        uint16 score,
        uint8 tier,
        uint8 ltv
    );

    event AttesterAuthorized(address indexed attester, bool authorized);
    event ChallengePeriodUpdated(uint256 newPeriod);
    event ChallengeBondUpdated(uint256 newBond);

    // ============ Errors ============

    error UnauthorizedAttester();
    error InvalidScore();
    error InvalidTier();
    error InvalidLTV();
    error AttestationPending();
    error NoPendingAttestation();
    error ChallengePeriodNotExpired();
    error AlreadyChallenged();
    error InsufficientBond();
    error ChallengeNotFound();
    error AlreadyResolved();
    error InvalidMerkleProof();

    // ============ Constructor ============

    constructor(address _treasury) Ownable(msg.sender) {
        require(_treasury != address(0), "Invalid treasury");
        treasury = _treasury;

        // Initially authorize deployer as attester
        authorizedAttesters[msg.sender] = true;
        emit AttesterAuthorized(msg.sender, true);
    }

    // ============ External Functions ============

    /**
     * @notice Attest to a user's credit score (optimistic oracle)
     * @param user User address
     * @param score Credit score (300-850)
     * @param tier Credit tier (0-4)
     * @param ltv Recommended LTV (0-90)
     * @param interestRateMultiplier Interest rate multiplier (80-150)
     * @param dataQuality Data quality (0-2)
     * @param merkleRoot Merkle root of supporting evidence
     */
    function attestScore(
        address user,
        uint16 score,
        uint8 tier,
        uint8 ltv,
        uint16 interestRateMultiplier,
        uint8 dataQuality,
        bytes32 merkleRoot
    ) external {
        if (!authorizedAttesters[msg.sender]) revert UnauthorizedAttester();
        if (score < 300 || score > 850) revert InvalidScore();
        if (tier > 4) revert InvalidTier();
        if (ltv > 90) revert InvalidLTV();
        if (pendingAttestations[user].attester != address(0) && !pendingAttestations[user].finalized) {
            revert AttestationPending();
        }

        // Create score hash
        bytes32 scoreHash = keccak256(abi.encode(
            user,
            score,
            tier,
            ltv,
            interestRateMultiplier,
            dataQuality,
            block.timestamp
        ));

        // Create attestation
        uint64 deadline = uint64(block.timestamp + challengePeriod);
        pendingAttestations[user] = ScoreAttestation({
            scoreHash: scoreHash,
            merkleRoot: merkleRoot,
            attester: msg.sender,
            timestamp: uint64(block.timestamp),
            challengeDeadline: deadline,
            challenged: false,
            finalized: false
        });

        emit ScoreAttested(user, score, tier, merkleRoot, msg.sender, deadline);
    }

    /**
     * @notice Challenge a pending score attestation
     * @param user User whose score is being challenged
     * @param reason Reason code for challenge
     */
    function challengeScore(address user, uint8 reason) external payable {
        ScoreAttestation storage attestation = pendingAttestations[user];
        if (attestation.attester == address(0)) revert NoPendingAttestation();
        if (attestation.challenged) revert AlreadyChallenged();
        if (block.timestamp >= attestation.challengeDeadline) revert ChallengePeriodNotExpired();
        if (msg.value < challengeBond) revert InsufficientBond();

        // Mark as challenged
        attestation.challenged = true;

        // Create challenge record
        challenges[user] = Challenge({
            challenger: msg.sender,
            bond: msg.value,
            reason: reason,
            resolved: false,
            successful: false
        });

        emit ScoreChallenged(user, msg.sender, msg.value, reason);
    }

    /**
     * @notice Resolve a challenge by providing merkle proof
     * @param user User address
     * @param score Credit score being attested
     * @param tier Credit tier
     * @param ltv LTV
     * @param interestRateMultiplier Interest rate multiplier
     * @param dataQuality Data quality
     * @param proof Merkle proof of evidence
     */
    function resolveChallenge(
        address user,
        uint16 score,
        uint8 tier,
        uint8 ltv,
        uint16 interestRateMultiplier,
        uint8 dataQuality,
        bytes32[] calldata proof
    ) external {
        ScoreAttestation storage attestation = pendingAttestations[user];
        Challenge storage challenge = challenges[user];

        if (!attestation.challenged) revert ChallengeNotFound();
        if (challenge.resolved) revert AlreadyResolved();

        // Verify score hash matches
        bytes32 scoreHash = keccak256(abi.encode(
            user,
            score,
            tier,
            ltv,
            interestRateMultiplier,
            dataQuality,
            attestation.timestamp
        ));

        require(scoreHash == attestation.scoreHash, "Score hash mismatch");

        // Verify merkle proof (simplified - in production, would verify full evidence)
        bytes32 leaf = keccak256(abi.encodePacked(user, score));
        bool validProof = MerkleProof.verify(proof, attestation.merkleRoot, leaf);

        challenge.resolved = true;

        if (validProof) {
            // Challenge failed - attester was correct
            challenge.successful = false;

            // Return bond to challenger minus penalty
            uint256 penalty = (challenge.bond * challengeRewardBps) / 10000;
            payable(challenge.challenger).transfer(challenge.bond - penalty);
            payable(treasury).transfer(penalty);

            // Finalize score
            _finalizeScore(user, score, tier, ltv, interestRateMultiplier, dataQuality);

            emit ChallengeResolved(user, challenge.challenger, false, 0);
        } else {
            // Challenge succeeded - attester was wrong
            challenge.successful = true;

            // Reward challenger
            uint256 reward = challenge.bond + (challenge.bond * challengeRewardBps) / 10000;
            payable(challenge.challenger).transfer(reward);

            // Clear invalid attestation
            delete pendingAttestations[user];

            emit ChallengeResolved(user, challenge.challenger, true, reward);
        }
    }

    /**
     * @notice Finalize a score after challenge period expires
     * @param user User address
     * @param score Credit score
     * @param tier Credit tier
     * @param ltv LTV
     * @param interestRateMultiplier Interest rate multiplier
     * @param dataQuality Data quality
     */
    function finalizeScore(
        address user,
        uint16 score,
        uint8 tier,
        uint8 ltv,
        uint16 interestRateMultiplier,
        uint8 dataQuality
    ) external {
        ScoreAttestation storage attestation = pendingAttestations[user];

        if (attestation.attester == address(0)) revert NoPendingAttestation();
        if (block.timestamp < attestation.challengeDeadline) revert ChallengePeriodNotExpired();
        if (attestation.challenged) revert AlreadyChallenged();

        // Verify score hash
        bytes32 scoreHash = keccak256(abi.encode(
            user,
            score,
            tier,
            ltv,
            interestRateMultiplier,
            dataQuality,
            attestation.timestamp
        ));

        require(scoreHash == attestation.scoreHash, "Score hash mismatch");

        _finalizeScore(user, score, tier, ltv, interestRateMultiplier, dataQuality);
    }

    /**
     * @notice Get user's current credit score
     * @param user User address
     * @return CreditScore struct
     */
    function getScore(address user) external view returns (CreditScore memory) {
        return scores[user];
    }

    /**
     * @notice Check if user has a valid, recent score
     * @param user User address
     * @param maxAge Maximum age in seconds (e.g., 30 days)
     * @return bool True if score is valid and recent
     */
    function hasValidScore(address user, uint256 maxAge) external view returns (bool) {
        CreditScore memory userScore = scores[user];
        if (userScore.score == 0) return false;
        if (block.timestamp - userScore.lastUpdated > maxAge) return false;
        return true;
    }

    // ============ Admin Functions ============

    /**
     * @notice Authorize/deauthorize a score attester
     * @param attester Attester address
     * @param authorized Whether to authorize
     */
    function setAuthorizedAttester(address attester, bool authorized) external onlyOwner {
        authorizedAttesters[attester] = authorized;
        emit AttesterAuthorized(attester, authorized);
    }

    /**
     * @notice Update challenge period
     * @param newPeriod New period in seconds
     */
    function setChallengePeriod(uint256 newPeriod) external onlyOwner {
        require(newPeriod >= 10 minutes && newPeriod <= 24 hours, "Invalid period");
        challengePeriod = newPeriod;
        emit ChallengePeriodUpdated(newPeriod);
    }

    /**
     * @notice Update challenge bond amount
     * @param newBond New bond amount
     */
    function setChallengeBond(uint256 newBond) external onlyOwner {
        require(newBond >= 100e6 && newBond <= 10000e6, "Invalid bond"); // 100-10,000 USDC
        challengeBond = newBond;
        emit ChallengeBondUpdated(newBond);
    }

    /**
     * @notice Update treasury address
     * @param newTreasury New treasury address
     */
    function setTreasury(address newTreasury) external onlyOwner {
        require(newTreasury != address(0), "Invalid treasury");
        treasury = newTreasury;
    }

    // ============ Internal Functions ============

    /**
     * @notice Internal function to finalize a credit score
     */
    function _finalizeScore(
        address user,
        uint16 score,
        uint8 tier,
        uint8 ltv,
        uint16 interestRateMultiplier,
        uint8 dataQuality
    ) internal {
        scores[user] = CreditScore({
            score: score,
            tier: tier,
            ltv: ltv,
            interestRateMultiplier: interestRateMultiplier,
            lastUpdated: uint64(block.timestamp),
            dataQuality: dataQuality
        });

        pendingAttestations[user].finalized = true;

        emit ScoreFinalized(user, score, tier, ltv);
    }

    /**
     * @notice Emergency withdrawal (only for stuck funds)
     */
    function emergencyWithdraw() external onlyOwner {
        payable(treasury).transfer(address(this).balance);
    }

    // Allow contract to receive ETH for challenges
    receive() external payable {}
}
