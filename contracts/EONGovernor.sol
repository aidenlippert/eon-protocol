// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/governance/Governor.sol";
import "@openzeppelin/contracts/governance/extensions/GovernorSettings.sol";
import "@openzeppelin/contracts/governance/extensions/GovernorCountingSimple.sol";
import "@openzeppelin/contracts/governance/extensions/GovernorVotes.sol";
import "@openzeppelin/contracts/governance/extensions/GovernorVotesQuorumFraction.sol";
import "@openzeppelin/contracts/governance/extensions/GovernorTimelockControl.sol";

/**
 * @title EON Governor
 * @notice On-chain governance for EON Protocol
 * @dev OpenZeppelin Governor with timelock and quorum
 *
 * Governance Parameters (Aave-inspired):
 * - Voting Delay: 1 day (7200 blocks)
 * - Voting Period: 3 days (21600 blocks)
 * - Proposal Threshold: 100,000 EON (0.01% of supply)
 * - Quorum: 4% of total supply (40M EON)
 * - Timelock Delay: 2 days (safety buffer)
 *
 * Proposal Lifecycle:
 * 1. Create: User with 100k+ EON creates proposal
 * 2. Delay: 1 day waiting period (anti-manipulation)
 * 3. Active: 3 days of voting (For/Against/Abstain)
 * 4. Queued: 2 day timelock if quorum met
 * 5. Execute: Proposal executes on-chain
 *
 * Security:
 * - Timelock prevents instant execution
 * - Quorum ensures legitimacy
 * - Proposal threshold prevents spam
 * - Vote delegation for gas efficiency
 */
contract EONGovernor is
    Governor,
    GovernorSettings,
    GovernorCountingSimple,
    GovernorVotes,
    GovernorVotesQuorumFraction,
    GovernorTimelockControl
{
    /// @notice Governance parameters
    uint256 private constant VOTING_DELAY = 7_200; // 1 day (assuming 12s blocks)
    uint256 private constant VOTING_PERIOD = 21_600; // 3 days
    uint256 private constant PROPOSAL_THRESHOLD = 100_000 * 10**18; // 100k EON
    uint256 private constant QUORUM_PERCENTAGE = 4; // 4% of supply

    constructor(
        IVotes _token,
        TimelockController _timelock
    )
        Governor("EON Governor")
        GovernorSettings(
            VOTING_DELAY,
            VOTING_PERIOD,
            PROPOSAL_THRESHOLD
        )
        GovernorVotes(_token)
        GovernorVotesQuorumFraction(QUORUM_PERCENTAGE)
        GovernorTimelockControl(_timelock)
    {}

    // ============ Proposal Creation ============

    /**
     * @notice Create a new governance proposal
     * @dev Requires proposal threshold of EON tokens
     * @param targets Array of target addresses
     * @param values Array of ETH values
     * @param calldatas Array of function call data
     * @param description Proposal description
     * @return proposalId Unique proposal identifier
     */
    function propose(
        address[] memory targets,
        uint256[] memory values,
        bytes[] memory calldatas,
        string memory description
    ) public virtual override(Governor, IGovernor) returns (uint256) {
        return super.propose(targets, values, calldatas, description);
    }

    // ============ Voting ============

    /**
     * @notice Cast a vote on a proposal
     * @param proposalId Proposal to vote on
     * @param support Vote type (0=Against, 1=For, 2=Abstain)
     * @return weight Vote weight
     */
    function castVote(uint256 proposalId, uint8 support)
        public
        virtual
        override(Governor, IGovernor)
        returns (uint256)
    {
        return super.castVote(proposalId, support);
    }

    /**
     * @notice Cast vote with reason string
     * @param proposalId Proposal to vote on
     * @param support Vote type
     * @param reason Explanation for vote
     */
    function castVoteWithReason(
        uint256 proposalId,
        uint8 support,
        string calldata reason
    ) public virtual override(Governor, IGovernor) returns (uint256) {
        return super.castVoteWithReason(proposalId, support, reason);
    }

    /**
     * @notice Cast vote with signature (gasless voting)
     * @dev EIP-712 signature-based voting
     */
    function castVoteBySig(
        uint256 proposalId,
        uint8 support,
        uint8 v,
        bytes32 r,
        bytes32 s
    ) public virtual override(Governor, IGovernor) returns (uint256) {
        return super.castVoteBySig(proposalId, support, v, r, s);
    }

    // ============ Proposal Execution ============

    /**
     * @notice Queue a successful proposal in timelock
     * @dev Only callable after voting period ends
     */
    function queue(
        address[] memory targets,
        uint256[] memory values,
        bytes[] memory calldatas,
        bytes32 descriptionHash
    ) public virtual override returns (uint256) {
        return super.queue(targets, values, calldatas, descriptionHash);
    }

    /**
     * @notice Execute a queued proposal
     * @dev Only callable after timelock delay
     */
    function execute(
        address[] memory targets,
        uint256[] memory values,
        bytes[] memory calldatas,
        bytes32 descriptionHash
    ) public payable virtual override(Governor, IGovernor) returns (uint256) {
        return super.execute(targets, values, calldatas, descriptionHash);
    }

    /**
     * @notice Cancel a proposal
     * @dev Only proposer or if below threshold
     */
    function cancel(
        address[] memory targets,
        uint256[] memory values,
        bytes[] memory calldatas,
        bytes32 descriptionHash
    ) public virtual override returns (uint256) {
        return super.cancel(targets, values, calldatas, descriptionHash);
    }

    // ============ View Functions ============

    /**
     * @notice Get proposal state
     * @param proposalId Proposal to check
     * @return State enum (Pending, Active, Canceled, Defeated, Succeeded, Queued, Expired, Executed)
     */
    function state(uint256 proposalId)
        public
        view
        virtual
        override(Governor, GovernorTimelockControl)
        returns (ProposalState)
    {
        return super.state(proposalId);
    }

    /**
     * @notice Check if proposal needs queuing
     */
    function proposalNeedsQueuing(uint256 proposalId)
        public
        view
        virtual
        override(Governor, GovernorTimelockControl)
        returns (bool)
    {
        return super.proposalNeedsQueuing(proposalId);
    }

    /**
     * @notice Get voting threshold for creating proposals
     */
    function proposalThreshold()
        public
        view
        virtual
        override(Governor, GovernorSettings)
        returns (uint256)
    {
        return super.proposalThreshold();
    }

    /**
     * @notice Get current quorum (4% of total supply)
     * @param blockNumber Block number to check
     */
    function quorum(uint256 blockNumber)
        public
        view
        virtual
        override(Governor, GovernorVotesQuorumFraction)
        returns (uint256)
    {
        return super.quorum(blockNumber);
    }

    // ============ Internal Overrides ============

    function _execute(
        uint256 proposalId,
        address[] memory targets,
        uint256[] memory values,
        bytes[] memory calldatas,
        bytes32 descriptionHash
    ) internal virtual override(Governor, GovernorTimelockControl) {
        super._execute(proposalId, targets, values, calldatas, descriptionHash);
    }

    function _cancel(
        address[] memory targets,
        uint256[] memory values,
        bytes[] memory calldatas,
        bytes32 descriptionHash
    ) internal virtual override(Governor, GovernorTimelockControl) returns (uint256) {
        return super._cancel(targets, values, calldatas, descriptionHash);
    }

    function _executor()
        internal
        view
        virtual
        override(Governor, GovernorTimelockControl)
        returns (address)
    {
        return super._executor();
    }

    /**
     * @notice Check if contract supports interface
     */
    function supportsInterface(bytes4 interfaceId)
        public
        view
        virtual
        override(Governor, GovernorTimelockControl)
        returns (bool)
    {
        return super.supportsInterface(interfaceId);
    }
}
