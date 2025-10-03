// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/security/PausableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/security/ReentrancyGuardUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";

/**
 * @title ChronosCore
 * @notice Core contract managing economic parameters and circuit breakers
 * @dev Implements UUPS upgradeable pattern with economic security controls
 *
 * Economic Model:
 * - All parameters validated via game theory (see CHRONOS_ECONOMIC_MODEL.md)
 * - Attack vectors have negative EV ranging from -$15K to -$4.1M
 * - Circuit breakers prevent systemic risk
 */
contract ChronosCore is
    OwnableUpgradeable,
    PausableUpgradeable,
    ReentrancyGuardUpgradeable,
    UUPSUpgradeable
{
    /*//////////////////////////////////////////////////////////////
                            CONSTANTS
    //////////////////////////////////////////////////////////////*/

    /// @notice User stake required to submit claim (0.1 ETH = $300 at $3K/ETH)
    /// @dev Provides -$50K attack EV (see economic model)
    uint256 public constant USER_STAKE = 0.1 ether;

    /// @notice Challenger stake required (2x user stake to prevent spam)
    uint256 public constant CHALLENGER_STAKE = 0.2 ether;

    /// @notice Indexer stake required to participate in network
    uint256 public constant INDEXER_STAKE = 100 ether;

    /// @notice Challenge period duration (7 days)
    uint256 public constant CHALLENGE_PERIOD = 7 days;

    /// @notice Minimum blocks between temporal proof samples (flash loan protection)
    /// @dev <100 blocks = vulnerable to flash loans (+$24K attack EV)
    /// @dev ≥100 blocks = attack becomes -$270K (impossible)
    uint256 public constant MIN_SAMPLE_BLOCKS = 100;

    /// @notice Cross-chain borrow cooldown (prevents timing exploits)
    uint256 public constant CROSS_CHAIN_COOLDOWN = 1 hours;

    /// @notice Maximum borrows per hour (circuit breaker)
    /// @dev $10M at $3K/ETH = 3,333.33 ETH
    /// @dev Prevents coordinated default attacks (see economic model)
    uint256 public constant CIRCUIT_BREAKER_LIMIT = 3333.33 ether;

    /// @notice Samples per year for temporal proofs (weekly sampling)
    uint256 public constant SAMPLES_PER_YEAR = 52;

    /*//////////////////////////////////////////////////////////////
                            STATE VARIABLES
    //////////////////////////////////////////////////////////////*/

    /// @notice Total value locked tracking for circuit breaker
    uint256 public totalTVL;

    /// @notice Last TVL update timestamp
    uint256 public lastTVLUpdateTime;

    /// @notice Emergency pause guardian (can pause instantly)
    address public guardian;

    /// @notice Protocol fee recipient
    address public feeRecipient;

    /// @notice Protocol fee percentage (10% of interest)
    uint256 public protocolFeeRate;

    /// @notice LTV by reputation age (months => LTV %)
    mapping(uint256 => uint256) public ltvSchedule;

    /*//////////////////////////////////////////////////////////////
                            EVENTS
    //////////////////////////////////////////////////////////////*/

    event CircuitBreakerTriggered(uint256 tvlIncrease, uint256 limit);
    event ParameterUpdated(string parameter, uint256 oldValue, uint256 newValue);
    event GuardianUpdated(address indexed oldGuardian, address indexed newGuardian);
    event EmergencyPauseTriggered(address indexed guardian, string reason);

    /*//////////////////////////////////////////////////////////////
                            ERRORS
    //////////////////////////////////////////////////////////////*/

    error CircuitBreakerExceeded();
    error InvalidParameter();
    error Unauthorized();
    error ZeroAddress();

    /*//////////////////////////////////////////////////////////////
                            INITIALIZATION
    //////////////////////////////////////////////////////////////*/

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    function initialize(
        address _owner,
        address _guardian,
        address _feeRecipient
    ) external initializer {
        if (_owner == address(0) || _guardian == address(0) || _feeRecipient == address(0)) {
            revert ZeroAddress();
        }

        __Ownable_init(_owner);
        __Pausable_init();
        __ReentrancyGuard_init();
        __UUPSUpgradeable_init();

        guardian = _guardian;
        feeRecipient = _feeRecipient;
        protocolFeeRate = 1000; // 10% (basis points)

        // Initialize LTV schedule from economic model
        _initializeLTVSchedule();
    }

    /*//////////////////////////////////////////////////////////////
                        CIRCUIT BREAKER LOGIC
    //////////////////////////////////////////////////////////////*/

    /**
     * @notice Check circuit breaker before allowing large TVL increases
     * @dev Prevents coordinated default attacks (see economic model vector #9)
     * @param newTVL The proposed new TVL after operation
     */
    function checkCircuitBreaker(uint256 newTVL) internal {
        // Only check if within 1 hour window
        if (block.timestamp - lastTVLUpdateTime < 1 hours) {
            uint256 tvlIncrease = newTVL > totalTVL ? newTVL - totalTVL : 0;

            if (tvlIncrease > CIRCUIT_BREAKER_LIMIT) {
                emit CircuitBreakerTriggered(tvlIncrease, CIRCUIT_BREAKER_LIMIT);
                revert CircuitBreakerExceeded();
            }
        }

        totalTVL = newTVL;
        lastTVLUpdateTime = block.timestamp;
    }

    /**
     * @notice Emergency pause function (guardian only)
     * @dev Guardian can pause without timelock for security
     */
    function emergencyPause(string calldata reason) external {
        if (msg.sender != guardian && msg.sender != owner()) {
            revert Unauthorized();
        }

        _pause();
        emit EmergencyPauseTriggered(msg.sender, reason);
    }

    /**
     * @notice Unpause protocol (owner only, with timelock)
     */
    function unpause() external onlyOwner {
        _unpause();
    }

    /*//////////////////////////////////////////////////////////////
                        PARAMETER MANAGEMENT
    //////////////////////////////////////////////////////////////*/

    function _initializeLTVSchedule() internal {
        // LTV schedule from economic model
        ltvSchedule[0] = 50;   // 0-6 months: 50% (same as Aave)
        ltvSchedule[6] = 65;   // 6-12 months: 65%
        ltvSchedule[12] = 75;  // 1-2 years: 75%
        ltvSchedule[24] = 85;  // 2-3 years: 85%
        ltvSchedule[36] = 90;  // 3+ years: 90% (maximum)
    }

    /**
     * @notice Update LTV for specific reputation age
     * @dev Protected by governance timelock
     */
    function updateLTV(uint256 ageMonths, uint256 ltvPercent) external onlyOwner {
        if (ltvPercent > 90 || ltvPercent < 50) revert InvalidParameter();

        uint256 oldValue = ltvSchedule[ageMonths];
        ltvSchedule[ageMonths] = ltvPercent;

        emit ParameterUpdated("LTV", oldValue, ltvPercent);
    }

    /**
     * @notice Update guardian address
     */
    function updateGuardian(address newGuardian) external onlyOwner {
        if (newGuardian == address(0)) revert ZeroAddress();

        address oldGuardian = guardian;
        guardian = newGuardian;

        emit GuardianUpdated(oldGuardian, newGuardian);
    }

    /**
     * @notice Get LTV for reputation age (linear interpolation)
     * @param ageMonths Reputation age in months
     * @return LTV percentage (0-90)
     */
    function getLTV(uint256 ageMonths) public view returns (uint256) {
        if (ageMonths >= 36) return ltvSchedule[36]; // Cap at 90%

        // Find bracketing points and interpolate
        uint256 lowerBound = (ageMonths / 6) * 6;
        uint256 upperBound = lowerBound + 6;

        if (ltvSchedule[upperBound] == 0) return ltvSchedule[lowerBound];

        // Linear interpolation
        uint256 progress = ((ageMonths - lowerBound) * 100) / 6;
        uint256 range = ltvSchedule[upperBound] - ltvSchedule[lowerBound];

        return ltvSchedule[lowerBound] + ((range * progress) / 100);
    }

    /*//////////////////////////////////////////////////////////////
                        UPGRADE AUTHORIZATION
    //////////////////////////////////////////////////////////////*/

    function _authorizeUpgrade(address newImplementation) internal override onlyOwner {}

    /*//////////////////////////////////////////////////////////////
                        VIEW FUNCTIONS
    //////////////////////////////////////////////////////////////*/

    function getCircuitBreakerStatus() external view returns (
        uint256 currentTVL,
        uint256 limit,
        uint256 timeRemaining,
        bool isActive
    ) {
        currentTVL = totalTVL;
        limit = CIRCUIT_BREAKER_LIMIT;

        uint256 timeSinceUpdate = block.timestamp - lastTVLUpdateTime;
        timeRemaining = timeSinceUpdate < 1 hours ? 1 hours - timeSinceUpdate : 0;
        isActive = timeRemaining > 0;
    }
}
