// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import "./ChronosCore.sol";
import "./ChronosNFT.sol";
import "./ReputationOracle.sol";
import "@openzeppelin/contracts/governance/Governor.sol";
import "@openzeppelin/contracts/governance/extensions/GovernorSettings.sol";
import "@openzeppelin/contracts/governance/extensions/GovernorCountingSimple.sol";
import "@openzeppelin/contracts/governance/extensions/GovernorVotes.sol";
import "@openzeppelin/contracts/governance/extensions/GovernorVotesQuorumFraction.sol";
import "@openzeppelin/contracts/governance/extensions/GovernorTimelockControl.sol";

/**
 * @title ChronosGovernance
 * @notice DAO governance with social recovery mechanism
 * @dev Extends OpenZeppelin Governor for secure on-chain governance
 *
 * Features:
 * - Token-weighted voting (1 reputation score = 1 vote)
 * - 7-day voting period with 2-day timelock
 * - 4% quorum requirement
 * - Social recovery votes for slashed users
 * - Parameter adjustment proposals
 *
 * Security:
 * - Timelock prevents instant execution (2-day delay)
 * - Quorum prevents governance attacks
 * - Only non-slashed users can vote
 */
contract ChronosGovernance is
    Governor,
    GovernorSettings,
    GovernorCountingSimple,
    GovernorVotes,
    GovernorVotesQuorumFraction,
    GovernorTimelockControl
{
    /*//////////////////////////////////////////////////////////////
                            STATE
    //////////////////////////////////////////////////////////////*/

    /// @notice ChronosNFT contract (voting power source)
    ChronosNFT public immutable chronosNFT;

    /// @notice ReputationOracle contract
    ReputationOracle public immutable reputationOracle;

    /// @notice Proposal types
    enum ProposalType {
        PARAMETER_CHANGE,
        SOCIAL_RECOVERY,
        EMERGENCY_PAUSE,
        UPGRADE_CONTRACT,
        TREASURY_SPEND
    }

    /// @notice Proposal metadata
    struct ProposalMetadata {
        ProposalType proposalType;
        address target;
        uint256 value;
        string description;
        uint256 createdAt;
    }

    /// @notice Proposal metadata storage
    mapping(uint256 => ProposalMetadata) public proposalMetadata;

    /// @notice Social recovery proposals
    mapping(uint256 => address) public socialRecoveryTarget;

    /*//////////////////////////////////////////////////////////////
                            EVENTS
    //////////////////////////////////////////////////////////////*/

    event ProposalCreatedWithMetadata(
        uint256 indexed proposalId,
        ProposalType proposalType,
        address indexed proposer,
        string description
    );

    event SocialRecoveryExecuted(
        uint256 indexed proposalId,
        address indexed user,
        bool approved
    );

    event ParameterChanged(
        string indexed parameter,
        uint256 oldValue,
        uint256 newValue
    );

    /*//////////////////////////////////////////////////////////////
                            ERRORS
    //////////////////////////////////////////////////////////////*/

    error SlashedCannotVote();
    error InvalidProposalType();
    error SocialRecoveryFailed();

    /*//////////////////////////////////////////////////////////////
                            CONSTRUCTOR
    //////////////////////////////////////////////////////////////*/

    constructor(
        IVotes _token,
        TimelockController _timelock,
        address _chronosNFT,
        address _reputationOracle
    )
        Governor("Chronos DAO")
        GovernorSettings(
            1 days,    // voting delay: 1 day
            7 days,    // voting period: 7 days
            100e18     // proposal threshold: 100 reputation
        )
        GovernorVotes(_token)
        GovernorVotesQuorumFraction(4) // 4% quorum
        GovernorTimelockControl(_timelock)
    {
        chronosNFT = ChronosNFT(_chronosNFT);
        reputationOracle = ReputationOracle(_reputationOracle);
    }

    /*//////////////////////////////////////////////////////////////
                        PROPOSAL FUNCTIONS
    //////////////////////////////////////////////////////////////*/

    /**
     * @notice Create parameter change proposal
     * @param targets Contract addresses to call
     * @param values ETH values to send
     * @param calldatas Function call data
     * @param description Proposal description
     */
    function propose(
        address[] memory targets,
        uint256[] memory values,
        bytes[] memory calldatas,
        string memory description
    ) public override(Governor, IGovernor) returns (uint256) {
        // Prevent slashed users from proposing
        if (reputationOracle.blacklisted(msg.sender)) {
            revert SlashedCannotVote();
        }

        uint256 proposalId = super.propose(targets, values, calldatas, description);

        // Store metadata
        proposalMetadata[proposalId] = ProposalMetadata({
            proposalType: ProposalType.PARAMETER_CHANGE,
            target: targets.length > 0 ? targets[0] : address(0),
            value: values.length > 0 ? values[0] : 0,
            description: description,
            createdAt: block.timestamp
        });

        emit ProposalCreatedWithMetadata(
            proposalId,
            ProposalType.PARAMETER_CHANGE,
            msg.sender,
            description
        );

        return proposalId;
    }

    /**
     * @notice Create social recovery proposal for slashed user
     * @param user Address to recover
     * @param justification Why user should be restored
     */
    function proposeSocialRecovery(
        address user,
        string memory justification
    ) external returns (uint256) {
        require(reputationOracle.blacklisted(user), "User not slashed");

        // Prevent slashed users from proposing
        if (reputationOracle.blacklisted(msg.sender)) {
            revert SlashedCannotVote();
        }

        // Create proposal to call restoreReputation
        address[] memory targets = new address[](1);
        targets[0] = address(reputationOracle);

        uint256[] memory values = new uint256[](1);
        values[0] = 0;

        bytes[] memory calldatas = new bytes[](1);
        calldatas[0] = abi.encodeWithSelector(
            ReputationOracle.restoreReputation.selector,
            user
        );

        string memory description = string(
            abi.encodePacked(
                "Social Recovery for ",
                _addressToString(user),
                ": ",
                justification
            )
        );

        uint256 proposalId = super.propose(targets, values, calldatas, description);

        // Store metadata
        proposalMetadata[proposalId] = ProposalMetadata({
            proposalType: ProposalType.SOCIAL_RECOVERY,
            target: user,
            value: 0,
            description: justification,
            createdAt: block.timestamp
        });

        socialRecoveryTarget[proposalId] = user;

        emit ProposalCreatedWithMetadata(
            proposalId,
            ProposalType.SOCIAL_RECOVERY,
            msg.sender,
            description
        );

        return proposalId;
    }

    /**
     * @notice Create emergency pause proposal
     * @param target Contract to pause
     * @param reason Emergency reason
     */
    function proposeEmergencyPause(
        address target,
        string memory reason
    ) external returns (uint256) {
        // Prevent slashed users from proposing
        if (reputationOracle.blacklisted(msg.sender)) {
            revert SlashedCannotVote();
        }

        address[] memory targets = new address[](1);
        targets[0] = target;

        uint256[] memory values = new uint256[](1);
        values[0] = 0;

        bytes[] memory calldatas = new bytes[](1);
        calldatas[0] = abi.encodeWithSelector(
            ChronosCore.pause.selector
        );

        string memory description = string(
            abi.encodePacked(
                "EMERGENCY PAUSE: ",
                reason
            )
        );

        uint256 proposalId = super.propose(targets, values, calldatas, description);

        // Store metadata
        proposalMetadata[proposalId] = ProposalMetadata({
            proposalType: ProposalType.EMERGENCY_PAUSE,
            target: target,
            value: 0,
            description: reason,
            createdAt: block.timestamp
        });

        emit ProposalCreatedWithMetadata(
            proposalId,
            ProposalType.EMERGENCY_PAUSE,
            msg.sender,
            description
        );

        return proposalId;
    }

    /*//////////////////////////////////////////////////////////////
                        VOTING FUNCTIONS
    //////////////////////////////////////////////////////////////*/

    /**
     * @notice Cast vote with slashing check
     * @param proposalId Proposal to vote on
     * @param support Vote direction (0=Against, 1=For, 2=Abstain)
     */
    function castVote(
        uint256 proposalId,
        uint8 support
    ) public override(Governor, IGovernor) returns (uint256) {
        // Prevent slashed users from voting
        if (reputationOracle.blacklisted(msg.sender)) {
            revert SlashedCannotVote();
        }

        return super.castVote(proposalId, support);
    }

    /**
     * @notice Cast vote with reason
     */
    function castVoteWithReason(
        uint256 proposalId,
        uint8 support,
        string calldata reason
    ) public override(Governor, IGovernor) returns (uint256) {
        // Prevent slashed users from voting
        if (reputationOracle.blacklisted(msg.sender)) {
            revert SlashedCannotVote();
        }

        return super.castVoteWithReason(proposalId, support, reason);
    }

    /**
     * @notice Cast vote with signature
     */
    function castVoteBySig(
        uint256 proposalId,
        uint8 support,
        uint8 v,
        bytes32 r,
        bytes32 s
    ) public override(Governor, IGovernor) returns (uint256) {
        // Extract voter address from signature
        address voter = ecrecover(
            _hashTypedDataV4(
                keccak256(
                    abi.encode(
                        keccak256("Ballot(uint256 proposalId,uint8 support)"),
                        proposalId,
                        support
                    )
                )
            ),
            v,
            r,
            s
        );

        // Prevent slashed users from voting
        if (reputationOracle.blacklisted(voter)) {
            revert SlashedCannotVote();
        }

        return super.castVoteBySig(proposalId, support, v, r, s);
    }

    /*//////////////////////////////////////////////////////////////
                        EXECUTION FUNCTIONS
    //////////////////////////////////////////////////////////////*/

    /**
     * @notice Execute proposal after timelock
     */
    function execute(
        address[] memory targets,
        uint256[] memory values,
        bytes[] memory calldatas,
        bytes32 descriptionHash
    ) public payable override(Governor, IGovernor) returns (uint256) {
        uint256 proposalId = hashProposal(targets, values, calldatas, descriptionHash);

        // Check if social recovery
        if (proposalMetadata[proposalId].proposalType == ProposalType.SOCIAL_RECOVERY) {
            address user = socialRecoveryTarget[proposalId];
            emit SocialRecoveryExecuted(proposalId, user, true);
        }

        return super.execute(targets, values, calldatas, descriptionHash);
    }

    /*//////////////////////////////////////////////////////////////
                        ADMIN FUNCTIONS
    //////////////////////////////////////////////////////////////*/

    /**
     * @notice Update voting delay (requires governance)
     * @param newVotingDelay New delay in blocks
     */
    function setVotingDelay(
        uint256 newVotingDelay
    ) public override onlyGovernance {
        uint256 oldValue = votingDelay();
        super.setVotingDelay(newVotingDelay);
        emit ParameterChanged("votingDelay", oldValue, newVotingDelay);
    }

    /**
     * @notice Update voting period (requires governance)
     * @param newVotingPeriod New period in blocks
     */
    function setVotingPeriod(
        uint256 newVotingPeriod
    ) public override onlyGovernance {
        uint256 oldValue = votingPeriod();
        super.setVotingPeriod(newVotingPeriod);
        emit ParameterChanged("votingPeriod", oldValue, newVotingPeriod);
    }

    /**
     * @notice Update proposal threshold (requires governance)
     * @param newProposalThreshold New threshold
     */
    function setProposalThreshold(
        uint256 newProposalThreshold
    ) public override onlyGovernance {
        uint256 oldValue = proposalThreshold();
        super.setProposalThreshold(newProposalThreshold);
        emit ParameterChanged("proposalThreshold", oldValue, newProposalThreshold);
    }

    /*//////////////////////////////////////////////////////////////
                        VIEW FUNCTIONS
    //////////////////////////////////////////////////////////////*/

    function getProposalMetadata(
        uint256 proposalId
    ) external view returns (ProposalMetadata memory) {
        return proposalMetadata[proposalId];
    }

    function getSocialRecoveryTarget(
        uint256 proposalId
    ) external view returns (address) {
        return socialRecoveryTarget[proposalId];
    }

    /**
     * @notice Get user's voting power
     * @param account User address
     * @param timepoint Block number for snapshot
     * @return Voting power (reputation score)
     */
    function getVotes(
        address account,
        uint256 timepoint
    ) public view override(Governor, IGovernor) returns (uint256) {
        // Slashed users have 0 voting power
        if (reputationOracle.blacklisted(account)) {
            return 0;
        }

        return super.getVotes(account, timepoint);
    }

    /*//////////////////////////////////////////////////////////////
                        INTERNAL FUNCTIONS
    //////////////////////////////////////////////////////////////*/

    /**
     * @notice Convert address to string
     */
    function _addressToString(address _addr) internal pure returns (string memory) {
        bytes32 value = bytes32(uint256(uint160(_addr)));
        bytes memory alphabet = "0123456789abcdef";
        bytes memory str = new bytes(42);
        str[0] = "0";
        str[1] = "x";
        for (uint256 i = 0; i < 20; i++) {
            str[2 + i * 2] = alphabet[uint8(value[i + 12] >> 4)];
            str[3 + i * 2] = alphabet[uint8(value[i + 12] & 0x0f)];
        }
        return string(str);
    }

    /*//////////////////////////////////////////////////////////////
                        REQUIRED OVERRIDES
    //////////////////////////////////////////////////////////////*/

    function votingDelay()
        public
        view
        override(IGovernor, GovernorSettings)
        returns (uint256)
    {
        return super.votingDelay();
    }

    function votingPeriod()
        public
        view
        override(IGovernor, GovernorSettings)
        returns (uint256)
    {
        return super.votingPeriod();
    }

    function quorum(uint256 blockNumber)
        public
        view
        override(IGovernor, GovernorVotesQuorumFraction)
        returns (uint256)
    {
        return super.quorum(blockNumber);
    }

    function state(uint256 proposalId)
        public
        view
        override(Governor, GovernorTimelockControl)
        returns (ProposalState)
    {
        return super.state(proposalId);
    }

    function proposalNeedsQueuing(uint256 proposalId)
        public
        view
        override(Governor, GovernorTimelockControl)
        returns (bool)
    {
        return super.proposalNeedsQueuing(proposalId);
    }

    function proposalThreshold()
        public
        view
        override(Governor, GovernorSettings)
        returns (uint256)
    {
        return super.proposalThreshold();
    }

    function _queueOperations(
        uint256 proposalId,
        address[] memory targets,
        uint256[] memory values,
        bytes[] memory calldatas,
        bytes32 descriptionHash
    ) internal override(Governor, GovernorTimelockControl) returns (uint48) {
        return super._queueOperations(proposalId, targets, values, calldatas, descriptionHash);
    }

    function _executeOperations(
        uint256 proposalId,
        address[] memory targets,
        uint256[] memory values,
        bytes[] memory calldatas,
        bytes32 descriptionHash
    ) internal override(Governor, GovernorTimelockControl) {
        super._executeOperations(proposalId, targets, values, calldatas, descriptionHash);
    }

    function _cancel(
        address[] memory targets,
        uint256[] memory values,
        bytes[] memory calldatas,
        bytes32 descriptionHash
    ) internal override(Governor, GovernorTimelockControl) returns (uint256) {
        return super._cancel(targets, values, calldatas, descriptionHash);
    }

    function _executor()
        internal
        view
        override(Governor, GovernorTimelockControl)
        returns (address)
    {
        return super._executor();
    }
}
