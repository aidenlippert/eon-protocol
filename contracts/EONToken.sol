// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/ERC20Burnable.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/ERC20Permit.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/ERC20Votes.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title EON Token
 * @notice Governance token for EON Protocol
 * @dev ERC20 with voting, burning, and permit capabilities
 *
 * Key Features:
 * - ERC20Votes: Voting power delegation and historical tracking
 * - ERC20Permit: Gasless approvals via EIP-2612
 * - ERC20Burnable: Token burning for deflationary mechanics
 * - Ownable: Minting control for initial distribution
 *
 * Tokenomics:
 * - Total Supply: 1,000,000,000 EON (1 billion)
 * - Decimals: 18
 * - Distribution:
 *   - 30% Liquidity Mining (300M EON) - 4 year vesting
 *   - 25% Community Treasury (250M EON) - DAO controlled
 *   - 20% Team & Advisors (200M EON) - 4 year vesting, 1 year cliff
 *   - 15% Early Backers (150M EON) - 3 year vesting, 6 month cliff
 *   - 10% Protocol Reserve (100M EON) - Emergency fund
 *
 * Governance:
 * - 1 EON = 1 vote (after delegation)
 * - Snapshot voting via ERC20Votes
 * - On-chain governance via EONGovernor contract
 */
contract EONToken is ERC20, ERC20Burnable, ERC20Permit, ERC20Votes, Ownable {
    /// @notice Maximum total supply (1 billion tokens)
    uint256 public constant MAX_SUPPLY = 1_000_000_000 * 10**18;

    /// @notice Token distribution amounts
    uint256 public constant LIQUIDITY_MINING_ALLOCATION = 300_000_000 * 10**18; // 30%
    uint256 public constant COMMUNITY_TREASURY_ALLOCATION = 250_000_000 * 10**18; // 25%
    uint256 public constant TEAM_ALLOCATION = 200_000_000 * 10**18; // 20%
    uint256 public constant EARLY_BACKERS_ALLOCATION = 150_000_000 * 10**18; // 15%
    uint256 public constant PROTOCOL_RESERVE_ALLOCATION = 100_000_000 * 10**18; // 10%

    /// @notice Vesting contract addresses (set during deployment)
    address public liquidityMiningVault;
    address public communityTreasury;
    address public teamVesting;
    address public earlyBackersVesting;
    address public protocolReserve;

    /// @notice Minting completed flag
    bool public initialMintingComplete;

    /// @notice Events
    event InitialMintingCompleted(uint256 totalSupply);
    event VestingContractsSet(
        address liquidityMining,
        address treasury,
        address team,
        address backers,
        address reserve
    );

    /// @notice Errors
    error MintingAlreadyCompleted();
    error VestingContractsNotSet();
    error MaxSupplyExceeded();
    error ZeroAddress();

    constructor()
        ERC20("EON Protocol", "EON")
        ERC20Permit("EON Protocol")
        Ownable(msg.sender)
    {
        // Initial minting will be done via setVestingContracts + completeInitialMinting
    }

    /**
     * @notice Set vesting contract addresses (one-time setup)
     * @dev Must be called before initial minting
     * @param _liquidityMining Liquidity mining rewards vault
     * @param _treasury Community treasury (DAO controlled)
     * @param _team Team vesting contract
     * @param _backers Early backers vesting contract
     * @param _reserve Protocol reserve multisig
     */
    function setVestingContracts(
        address _liquidityMining,
        address _treasury,
        address _team,
        address _backers,
        address _reserve
    ) external onlyOwner {
        if (initialMintingComplete) revert MintingAlreadyCompleted();
        if (_liquidityMining == address(0) ||
            _treasury == address(0) ||
            _team == address(0) ||
            _backers == address(0) ||
            _reserve == address(0)) {
            revert ZeroAddress();
        }

        liquidityMiningVault = _liquidityMining;
        communityTreasury = _treasury;
        teamVesting = _team;
        earlyBackersVesting = _backers;
        protocolReserve = _reserve;

        emit VestingContractsSet(
            _liquidityMining,
            _treasury,
            _team,
            _backers,
            _reserve
        );
    }

    /**
     * @notice Complete initial token distribution
     * @dev Mints all tokens to vesting contracts in one atomic operation
     */
    function completeInitialMinting() external onlyOwner {
        if (initialMintingComplete) revert MintingAlreadyCompleted();
        if (liquidityMiningVault == address(0)) revert VestingContractsNotSet();

        // Mint to each allocation
        _mint(liquidityMiningVault, LIQUIDITY_MINING_ALLOCATION);
        _mint(communityTreasury, COMMUNITY_TREASURY_ALLOCATION);
        _mint(teamVesting, TEAM_ALLOCATION);
        _mint(earlyBackersVesting, EARLY_BACKERS_ALLOCATION);
        _mint(protocolReserve, PROTOCOL_RESERVE_ALLOCATION);

        // Verify total supply
        if (totalSupply() != MAX_SUPPLY) revert MaxSupplyExceeded();

        initialMintingComplete = true;

        emit InitialMintingCompleted(totalSupply());
    }

    /**
     * @notice Delegate voting power to another address
     * @dev Wrapper for ERC20Votes delegate function
     * @param delegatee Address to delegate votes to
     */
    function delegate(address delegatee) public virtual override {
        super.delegate(delegatee);
    }

    /**
     * @notice Delegate voting power via signature (gasless)
     * @dev EIP-712 signature-based delegation
     */
    function delegateBySig(
        address delegatee,
        uint256 nonce,
        uint256 expiry,
        uint8 v,
        bytes32 r,
        bytes32 s
    ) public virtual override {
        super.delegateBySig(delegatee, nonce, expiry, v, r, s);
    }

    /**
     * @notice Get current voting power of an account
     * @param account Address to check
     * @return votes Current vote balance
     */
    function getVotes(address account)
        public
        view
        virtual
        override
        returns (uint256)
    {
        return super.getVotes(account);
    }

    /**
     * @notice Get historical voting power at a specific block
     * @param account Address to check
     * @param blockNumber Historical block number
     * @return votes Vote balance at that block
     */
    function getPastVotes(address account, uint256 blockNumber)
        public
        view
        virtual
        override
        returns (uint256)
    {
        return super.getPastVotes(account, blockNumber);
    }

    // ============ Internal Overrides ============

    /**
     * @dev Override required by Solidity for multiple inheritance
     */
    function _update(address from, address to, uint256 amount)
        internal
        virtual
        override(ERC20, ERC20Votes)
    {
        super._update(from, to, amount);
    }

    /**
     * @dev Override required by Solidity for multiple inheritance
     */
    function nonces(address owner)
        public
        view
        virtual
        override(ERC20Permit, Nonces)
        returns (uint256)
    {
        return super.nonces(owner);
    }
}
