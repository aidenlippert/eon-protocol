// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import "./ChronosCore.sol";
import "./ChronosNFT.sol";
import "./interfaces/IZKVerifier.sol";

/**
 * @title ClaimManager
 * @notice Hybrid optimistic-ZK system for temporal ownership proofs
 * @dev Implements economic model with -$50K attack EV
 *
 * Flow:
 * 1. User submits optimistic claim with merkle root ($3 gas)
 * 2. 7-day challenge period (auto-indexer monitors)
 * 3. If challenged, user generates ZK proof ($20-50)
 * 4. If valid: challenger slashed, user wins
 * 5. If invalid: user slashed, challenger wins
 */
contract ClaimManager is ChronosCore {
    /*//////////////////////////////////////////////////////////////
                            STATE
    //////////////////////////////////////////////////////////////*/

    struct Claim {
        address user;
        uint256 minBalance;        // Minimum balance held (scaled)
        uint256 startBlock;        // Temporal proof start
        uint256 endBlock;          // Temporal proof end
        bytes32 merkleRoot;        // Root of temporal data
        uint96 stake;              // Packed with status
        uint64 challengeDeadline;  // Packed timestamp
        ClaimStatus status;        // Current status
    }

    struct Challenge {
        address challenger;
        uint96 stake;
        uint64 timestamp;
    }

    enum ClaimStatus {
        Pending,
        Challenged,
        Verified,
        Rejected
    }

    /// @notice All claims
    mapping(uint256 => Claim) public claims;

    /// @notice Active challenges
    mapping(uint256 => Challenge) public challenges;

    /// @notice Claim ID counter
    uint256 public claimIdCounter;

    /// @notice ZK proof verifier
    IZKVerifier public immutable zkVerifier;

    /// @notice Reputation NFT
    ChronosNFT public immutable chronosNFT;

    /// @notice User to latest claim ID
    mapping(address => uint256) public userLatestClaim;

    /// @notice Cross-chain borrow cooldowns
    mapping(address => mapping(uint32 => uint256)) public lastBorrowTime;

    /*//////////////////////////////////////////////////////////////
                            EVENTS
    //////////////////////////////////////////////////////////////*/

    event ClaimSubmitted(
        uint256 indexed claimId,
        address indexed user,
        uint256 minBalance,
        bytes32 merkleRoot
    );

    event ClaimChallenged(
        uint256 indexed claimId,
        address indexed challenger
    );

    event ClaimResolved(
        uint256 indexed claimId,
        ClaimStatus status,
        address winner
    );

    event ClaimFinalized(
        uint256 indexed claimId,
        address indexed user,
        uint256 reputationScore
    );

    /*//////////////////////////////////////////////////////////////
                            ERRORS
    //////////////////////////////////////////////////////////////*/

    error IncorrectStake();
    error ChallengePeriodOver();
    error NotChallengeable();
    error NotChallenged();
    error AlreadyResolved();
    error StillInChallengePeriod();
    error InvalidTemporalRange();
    error InsufficientSampleGap();

    /*//////////////////////////////////////////////////////////////
                            CONSTRUCTOR
    //////////////////////////////////////////////////////////////*/

    constructor(
        address _zkVerifier,
        address _chronosNFT
    ) {
        zkVerifier = IZKVerifier(_zkVerifier);
        chronosNFT = ChronosNFT(_chronosNFT);
    }

    /*//////////////////////////////////////////////////////////////
                        CLAIM SUBMISSION
    //////////////////////////////////////////////////////////////*/

    /**
     * @notice Submit optimistic temporal ownership claim
     * @param minBalance Minimum balance held throughout period (wei)
     * @param startBlock Start of temporal proof
     * @param endBlock End of temporal proof
     * @param merkleRoot Root hash of temporal data (for ZK verification)
     *
     * Gas optimization: ~80K gas via packed storage
     */
    function submitClaim(
        uint256 minBalance,
        uint256 startBlock,
        uint256 endBlock,
        bytes32 merkleRoot
    ) external payable nonReentrant whenNotPaused {
        // Validate stake
        if (msg.value != USER_STAKE) revert IncorrectStake();

        // Validate temporal range
        if (endBlock <= startBlock) revert InvalidTemporalRange();
        if (endBlock > block.number) revert InvalidTemporalRange();

        // Validate minimum sample gap (flash loan protection)
        uint256 durationBlocks = endBlock - startBlock;
        uint256 requiredSamples = (durationBlocks * SAMPLES_PER_YEAR) / (365 * 6500); // ~blocks/year
        if (requiredSamples > 0 && durationBlocks / requiredSamples < MIN_SAMPLE_BLOCKS) {
            revert InsufficientSampleGap();
        }

        uint256 claimId = ++claimIdCounter;

        // Pack storage for gas efficiency
        claims[claimId] = Claim({
            user: msg.sender,
            minBalance: minBalance,
            startBlock: startBlock,
            endBlock: endBlock,
            merkleRoot: merkleRoot,
            stake: uint96(msg.value),
            challengeDeadline: uint64(block.timestamp + CHALLENGE_PERIOD),
            status: ClaimStatus.Pending
        });

        userLatestClaim[msg.sender] = claimId;

        emit ClaimSubmitted(claimId, msg.sender, minBalance, merkleRoot);
    }

    /*//////////////////////////////////////////////////////////////
                        CHALLENGE MECHANISM
    //////////////////////////////////////////////////////////////*/

    /**
     * @notice Challenge a claim (typically by indexer)
     * @param claimId Claim to challenge
     *
     * Economic security:
     * - Challenger stakes 0.2 ETH ($600)
     * - Wins 0.3 ETH if correct (0.1 user + 0.2 own)
     * - Loses 0.2 ETH if wrong
     * - Expected value with 99.9% accuracy: +$900 * 0.999 - $600 * 0.001 = $898.5
     */
    function challengeClaim(uint256 claimId) external payable nonReentrant whenNotPaused {
        Claim storage claim = claims[claimId];

        // Validate
        if (msg.value != CHALLENGER_STAKE) revert IncorrectStake();
        if (block.timestamp >= claim.challengeDeadline) revert ChallengePeriodOver();
        if (claim.status != ClaimStatus.Pending) revert NotChallengeable();

        // Update state
        claim.status = ClaimStatus.Challenged;

        challenges[claimId] = Challenge({
            challenger: msg.sender,
            stake: uint96(msg.value),
            timestamp: uint64(block.timestamp)
        });

        emit ClaimChallenged(claimId, msg.sender);
    }

    /*//////////////////////////////////////////////////////////////
                        ZK DISPUTE RESOLUTION
    //////////////////////////////////////////////////////////////*/

    /**
     * @notice Resolve challenge with ZK proof
     * @param claimId Claim being resolved
     * @param zkProof ZK-SNARK proof of temporal ownership
     *
     * Proof verifies:
     * - User held ≥ minBalance in sampled blocks
     * - No transfers > 10% between samples
     * - Merkle root matches claimed data
     */
    function resolveWithZKProof(
        uint256 claimId,
        bytes calldata zkProof
    ) external nonReentrant whenNotPaused {
        Claim storage claim = claims[claimId];
        Challenge memory challenge = challenges[claimId];

        if (claim.status != ClaimStatus.Challenged) revert NotChallenged();

        // Pack public inputs for verifier
        uint256[4] memory publicInputs = [
            uint256(claim.merkleRoot),
            claim.minBalance,
            claim.startBlock,
            claim.endBlock
        ];

        // Verify ZK proof
        bool valid = zkVerifier.verify(zkProof, publicInputs);

        if (valid) {
            // User wins - challenger slashed
            claim.status = ClaimStatus.Verified;

            uint256 totalPayout = uint256(claim.stake) + uint256(challenge.stake);
            payable(claim.user).transfer(totalPayout);

            // Mint reputation NFT
            uint256 reputationScore = _calculateReputationScore(claim);
            chronosNFT.mint(claim.user, reputationScore);

            emit ClaimResolved(claimId, ClaimStatus.Verified, claim.user);
        } else {
            // Challenger wins - user slashed
            claim.status = ClaimStatus.Rejected;

            uint256 totalPayout = uint256(claim.stake) + uint256(challenge.stake);
            payable(challenge.challenger).transfer(totalPayout);

            emit ClaimResolved(claimId, ClaimStatus.Rejected, challenge.challenger);
        }

        // Clean up challenge
        delete challenges[claimId];
    }

    /*//////////////////////////////////////////////////////////////
                        AUTO-FINALIZATION
    //////////////////////////////////////////////////////////////*/

    /**
     * @notice Finalize unchallenged claim
     * @param claimId Claim to finalize
     *
     * If no challenge in 7 days, claim is accepted
     * User gets stake back + reputation NFT
     */
    function finalizeClaim(uint256 claimId) external nonReentrant whenNotPaused {
        Claim storage claim = claims[claimId];

        if (block.timestamp <= claim.challengeDeadline) revert StillInChallengePeriod();
        if (claim.status != ClaimStatus.Pending) revert AlreadyResolved();

        // Accept claim
        claim.status = ClaimStatus.Verified;

        // Return stake
        payable(claim.user).transfer(claim.stake);

        // Mint reputation NFT
        uint256 reputationScore = _calculateReputationScore(claim);
        chronosNFT.mint(claim.user, reputationScore);

        emit ClaimFinalized(claimId, claim.user, reputationScore);
    }

    /*//////////////////////////////////////////////////////////////
                        CROSS-CHAIN COOLDOWN
    //////////////////////////////////////////////////////////////*/

    /**
     * @notice Check cross-chain borrow cooldown
     * @dev Prevents attack vector #6 (cross-chain timing exploit)
     */
    function checkCrossChainCooldown(address user, uint32 chainId) public view returns (bool) {
        uint256 lastBorrow = lastBorrowTime[user][chainId];
        return block.timestamp >= lastBorrow + CROSS_CHAIN_COOLDOWN;
    }

    /**
     * @notice Record cross-chain borrow (called by LendingPool)
     */
    function recordBorrow(address user, uint32 chainId) external {
        // TODO: Add access control (only LendingPool)
        lastBorrowTime[user][chainId] = block.timestamp;
    }

    /*//////////////////////////////////////////////////////////////
                        REPUTATION CALCULATION
    //////////////////////////////////////////////////////////////*/

    /**
     * @notice Calculate reputation score from claim
     * @dev Score = 500 (base) + (months * 100), capped at 1000
     *
     * Economic model:
     * - 0-6 months: 500-600 score → 50-65% LTV
     * - 1 year: 700 score → 75% LTV
     * - 2 years: 900 score → 85% LTV
     * - 3+ years: 1000 score → 90% LTV
     */
    function _calculateReputationScore(Claim memory claim) internal pure returns (uint256) {
        // Calculate duration in months
        uint256 durationBlocks = claim.endBlock - claim.startBlock;
        uint256 durationMonths = durationBlocks / (30 * 6500); // ~blocks per month

        // Base score + monthly bonus
        uint256 score = 500 + (durationMonths * 100);

        // Cap at 1000
        return score > 1000 ? 1000 : score;
    }

    /*//////////////////////////////////////////////////////////////
                        VIEW FUNCTIONS
    //////////////////////////////////////////////////////////////*/

    function getClaimStatus(uint256 claimId) external view returns (
        ClaimStatus status,
        address user,
        uint256 challengeDeadline,
        bool isChallenged
    ) {
        Claim memory claim = claims[claimId];
        return (
            claim.status,
            claim.user,
            claim.challengeDeadline,
            challenges[claimId].challenger != address(0)
        );
    }

    function getUserActiveClaim(address user) external view returns (uint256) {
        uint256 claimId = userLatestClaim[user];
        Claim memory claim = claims[claimId];

        // Return only if pending or challenged
        if (claim.status == ClaimStatus.Pending || claim.status == ClaimStatus.Challenged) {
            return claimId;
        }

        return 0;
    }
}
