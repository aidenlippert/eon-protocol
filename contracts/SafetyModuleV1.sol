// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/security/ReentrancyGuardUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/security/PausableUpgradeable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

/**
 * @title SafetyModuleV1
 * @notice Aave-style staking insurance for EON Protocol
 * @dev Stake EON tokens to earn rewards and provide protocol insurance
 *
 * Key Features:
 * - Stake EON tokens to earn protocol fee rewards (APY)
 * - Act as protocol insurance fund for bad debt
 * - Slashing mechanism during shortfall events
 * - Cooldown period for unstaking (10 days)
 * - Rewards distributed from protocol fees
 * - Emergency pause functionality
 *
 * How it Works:
 * 1. Users stake EON tokens
 * 2. Earn APY from protocol lending fees
 * 3. If protocol has bad debt, staked tokens slashed (up to 30%)
 * 4. Unstaking requires 10-day cooldown period
 * 5. Rewards auto-compound or claimed manually
 *
 * Aave Safety Module Inspiration:
 * - Aave has $400M+ staked in SM
 * - ~7% APY for stakers
 * - Up to 30% slashing during shortfall
 * - Protects protocol solvency
 */
contract SafetyModuleV1 is
    Initializable,
    OwnableUpgradeable,
    ReentrancyGuardUpgradeable,
    PausableUpgradeable
{
    using SafeERC20 for IERC20;

    /// @notice EON token contract
    IERC20 public eonToken;

    /// @notice Staking parameters
    uint256 public constant COOLDOWN_PERIOD = 10 days;
    uint256 public constant UNSTAKE_WINDOW = 2 days;
    uint256 public constant MAX_SLASH_PERCENTAGE = 30_00; // 30% (basis points)
    uint256 public constant PERCENTAGE_PRECISION = 100_00; // 10000 = 100%

    /// @notice Current APY for stakers (in basis points, e.g. 700 = 7%)
    uint256 public stakingAPY;

    /// @notice Total staked amount
    uint256 public totalStaked;

    /// @notice Total rewards distributed
    uint256 public totalRewardsDistributed;

    /// @notice Total slashed amount (shortfall events)
    uint256 public totalSlashed;

    struct StakerInfo {
        uint256 stakedAmount;
        uint256 rewardDebt;
        uint256 pendingRewards;
        uint256 cooldownStart;
        uint256 lastStakeTime;
    }

    /// @notice Staker information
    mapping(address => StakerInfo) public stakers;

    /// @notice Reward accounting
    uint256 public accRewardPerShare; // Accumulated rewards per share (scaled by 1e18)
    uint256 public lastRewardTime;

    /// @notice Events
    event Staked(address indexed user, uint256 amount, uint256 totalStaked);
    event CooldownActivated(address indexed user, uint256 cooldownEnd);
    event Unstaked(address indexed user, uint256 amount, uint256 totalStaked);
    event RewardsClaimed(address indexed user, uint256 amount);
    event RewardsAdded(uint256 amount, uint256 newAPY);
    event Slashed(uint256 amount, uint256 slashPercentage, string reason);
    event APYUpdated(uint256 oldAPY, uint256 newAPY);

    /// @notice Errors
    error ZeroAmount();
    error InsufficientBalance();
    error CooldownNotActive();
    error CooldownNotFinished();
    error UnstakeWindowExpired();
    error SlashPercentageTooHigh();

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    /**
     * @notice Initialize safety module
     * @param _eonToken EON token address
     * @param _initialAPY Initial staking APY (basis points, e.g. 700 = 7%)
     */
    function initialize(address _eonToken, uint256 _initialAPY)
        external
        initializer
    {
        __Ownable_init(msg.sender);
        __ReentrancyGuard_init();
        __Pausable_init();

        eonToken = IERC20(_eonToken);
        stakingAPY = _initialAPY;
        lastRewardTime = block.timestamp;
    }

    /**
     * @notice Stake EON tokens
     * @param amount Amount to stake
     */
    function stake(uint256 amount) external nonReentrant whenNotPaused {
        if (amount == 0) revert ZeroAmount();

        _updateRewards(msg.sender);

        StakerInfo storage staker = stakers[msg.sender];

        // Transfer tokens from user
        eonToken.safeTransferFrom(msg.sender, address(this), amount);

        staker.stakedAmount += amount;
        staker.lastStakeTime = block.timestamp;
        staker.rewardDebt = (staker.stakedAmount * accRewardPerShare) / 1e18;

        totalStaked += amount;

        emit Staked(msg.sender, amount, totalStaked);
    }

    /**
     * @notice Activate cooldown period to unstake
     * @dev Must wait COOLDOWN_PERIOD before unstaking
     */
    function activateCooldown() external nonReentrant {
        StakerInfo storage staker = stakers[msg.sender];
        if (staker.stakedAmount == 0) revert InsufficientBalance();

        staker.cooldownStart = block.timestamp;

        emit CooldownActivated(msg.sender, block.timestamp + COOLDOWN_PERIOD);
    }

    /**
     * @notice Unstake tokens after cooldown
     * @param amount Amount to unstake
     */
    function unstake(uint256 amount) external nonReentrant whenNotPaused {
        if (amount == 0) revert ZeroAmount();

        StakerInfo storage staker = stakers[msg.sender];
        if (staker.stakedAmount < amount) revert InsufficientBalance();
        if (staker.cooldownStart == 0) revert CooldownNotActive();

        uint256 cooldownEnd = staker.cooldownStart + COOLDOWN_PERIOD;
        if (block.timestamp < cooldownEnd) revert CooldownNotFinished();

        uint256 unstakeWindowEnd = cooldownEnd + UNSTAKE_WINDOW;
        if (block.timestamp > unstakeWindowEnd) revert UnstakeWindowExpired();

        _updateRewards(msg.sender);

        staker.stakedAmount -= amount;
        staker.rewardDebt = (staker.stakedAmount * accRewardPerShare) / 1e18;
        staker.cooldownStart = 0; // Reset cooldown

        totalStaked -= amount;

        // Transfer tokens back to user
        eonToken.safeTransfer(msg.sender, amount);

        emit Unstaked(msg.sender, amount, totalStaked);
    }

    /**
     * @notice Claim pending rewards
     */
    function claimRewards() external nonReentrant {
        _updateRewards(msg.sender);

        StakerInfo storage staker = stakers[msg.sender];
        uint256 pending = staker.pendingRewards;

        if (pending > 0) {
            staker.pendingRewards = 0;
            eonToken.safeTransfer(msg.sender, pending);

            emit RewardsClaimed(msg.sender, pending);
        }
    }

    /**
     * @notice Add rewards to be distributed (from protocol fees)
     * @dev Called by protocol contracts when fees collected
     * @param amount Reward amount
     */
    function addRewards(uint256 amount) external nonReentrant {
        if (amount == 0) revert ZeroAmount();

        // Transfer reward tokens to safety module
        eonToken.safeTransferFrom(msg.sender, address(this), amount);

        if (totalStaked > 0) {
            accRewardPerShare += (amount * 1e18) / totalStaked;
        }

        totalRewardsDistributed += amount;

        emit RewardsAdded(amount, stakingAPY);
    }

    /**
     * @notice Slash staked tokens during shortfall event (governance only)
     * @dev Used to cover protocol bad debt
     * @param slashPercentage Percentage to slash (basis points, max 3000 = 30%)
     * @param recipient Address to send slashed tokens (protocol treasury)
     * @param reason Reason for slashing
     */
    function slash(
        uint256 slashPercentage,
        address recipient,
        string calldata reason
    ) external onlyOwner nonReentrant {
        if (slashPercentage > MAX_SLASH_PERCENTAGE) {
            revert SlashPercentageTooHigh();
        }

        uint256 slashAmount = (totalStaked * slashPercentage) / PERCENTAGE_PRECISION;

        totalStaked -= slashAmount;
        totalSlashed += slashAmount;

        // Transfer slashed tokens to recipient (treasury)
        eonToken.safeTransfer(recipient, slashAmount);

        emit Slashed(slashAmount, slashPercentage, reason);
    }

    /**
     * @notice Update staking APY (governance)
     * @param newAPY New APY in basis points
     */
    function setStakingAPY(uint256 newAPY) external onlyOwner {
        uint256 oldAPY = stakingAPY;
        stakingAPY = newAPY;

        emit APYUpdated(oldAPY, newAPY);
    }

    /**
     * @notice Get staker info
     * @param user Address to check
     */
    function getStakerInfo(address user)
        external
        view
        returns (
            uint256 stakedAmount,
            uint256 pendingRewards,
            uint256 cooldownStart,
            uint256 cooldownEnd,
            bool canUnstake
        )
    {
        StakerInfo memory staker = stakers[user];
        stakedAmount = staker.stakedAmount;

        // Calculate pending rewards
        uint256 accReward = accRewardPerShare;
        if (totalStaked > 0 && block.timestamp > lastRewardTime) {
            uint256 timeElapsed = block.timestamp - lastRewardTime;
            uint256 reward = (totalStaked * stakingAPY * timeElapsed) /
                            (365 days * PERCENTAGE_PRECISION);
            accReward += (reward * 1e18) / totalStaked;
        }

        pendingRewards = staker.pendingRewards +
                        ((staker.stakedAmount * accReward) / 1e18) -
                        staker.rewardDebt;

        cooldownStart = staker.cooldownStart;
        cooldownEnd = cooldownStart > 0 ? cooldownStart + COOLDOWN_PERIOD : 0;

        canUnstake = cooldownStart > 0 &&
                    block.timestamp >= cooldownEnd &&
                    block.timestamp <= cooldownEnd + UNSTAKE_WINDOW;
    }

    /**
     * @notice Get total value locked (TVL)
     */
    function getTVL() external view returns (uint256) {
        return totalStaked;
    }

    /**
     * @notice Get current APY
     */
    function getCurrentAPY() external view returns (uint256) {
        return stakingAPY;
    }

    /**
     * @notice Pause staking/unstaking
     */
    function pause() external onlyOwner {
        _pause();
    }

    /**
     * @notice Unpause
     */
    function unpause() external onlyOwner {
        _unpause();
    }

    // ============ Internal Functions ============

    /**
     * @notice Update rewards for a staker
     */
    function _updateRewards(address user) internal {
        StakerInfo storage staker = stakers[user];

        if (staker.stakedAmount > 0) {
            uint256 pending = ((staker.stakedAmount * accRewardPerShare) / 1e18) -
                             staker.rewardDebt;
            staker.pendingRewards += pending;
        }

        staker.rewardDebt = (staker.stakedAmount * accRewardPerShare) / 1e18;
    }
}
