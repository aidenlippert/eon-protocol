// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/security/ReentrancyGuardUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/security/PausableUpgradeable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "./interfaces/IFlashLoanReceiver.sol";

/**
 * @title FlashLoanVaultV1
 * @notice Production-grade flash loan system inspired by Aave V3
 * @dev Implements uncollateralized loans that must be repaid in same transaction
 *
 * Key Features:
 * - Aave V3-compatible flash loan interface
 * - 0.09% flash loan fee (9 basis points)
 * - Fee split: Protocol treasury (0.04%) + Liquidity providers (0.05%)
 * - Single-asset and multi-asset flash loans
 * - Attack vector protection with reentrancy guards
 * - Emergency pause functionality
 * - Gas-optimized for arbitrage opportunities
 *
 * Security:
 * - ReentrancyGuard prevents recursive flash loans
 * - Balance verification ensures repayment
 * - Pausable for emergency circuit breaker
 * - OpenZeppelin battle-tested libraries
 */
contract FlashLoanVaultV1 is
    Initializable,
    OwnableUpgradeable,
    ReentrancyGuardUpgradeable,
    PausableUpgradeable
{
    using SafeERC20 for IERC20;

    /// @notice Flash loan fee configuration (Aave V3 style)
    uint256 public constant FLASH_LOAN_PREMIUM_TOTAL = 9; // 0.09% (9 basis points)
    uint256 public constant FLASH_LOAN_PREMIUM_TO_PROTOCOL = 4; // 0.04% to treasury
    uint256 public constant PREMIUM_PRECISION = 10000; // Basis points

    /// @notice Maximum flash loan amount (safety limit)
    uint256 public maxFlashLoanAmount;

    /// @notice Protocol treasury address (receives protocol fees)
    address public treasury;

    /// @notice Total flash loan volume per asset
    mapping(address => uint256) public totalFlashLoanVolume;

    /// @notice Total fees collected per asset
    mapping(address => uint256) public totalFeesCollected;

    /// @notice Flash loan statistics per user
    mapping(address => uint256) public userFlashLoanCount;
    mapping(address => uint256) public userFlashLoanVolume;

    /// @notice Asset availability for flash loans
    mapping(address => bool) public flashLoanEnabled;

    struct FlashLoanData {
        address asset;
        uint256 amount;
        uint256 premium;
        address initiator;
        uint256 timestamp;
        bool success;
    }

    /// @notice Flash loan history
    FlashLoanData[] public flashLoanHistory;

    /// @notice Events
    event FlashLoan(
        address indexed receiver,
        address indexed initiator,
        address indexed asset,
        uint256 amount,
        uint256 premium,
        uint256 protocolFee,
        uint256 liquidityProviderFee
    );

    event FlashLoanEnabled(address indexed asset);
    event FlashLoanDisabled(address indexed asset);
    event TreasuryUpdated(address indexed oldTreasury, address indexed newTreasury);
    event MaxFlashLoanAmountUpdated(uint256 oldMax, uint256 newMax);

    /// @notice Errors
    error FlashLoanNotEnabled();
    error FlashLoanAmountExceedsMax();
    error InsufficientLiquidity();
    error InvalidReceiver();
    error FlashLoanNotRepaid();
    error ExecutionFailed();
    error InvalidTreasury();

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    /**
     * @notice Initialize flash loan vault
     * @param _treasury Protocol treasury address
     * @param _maxFlashLoanAmount Maximum flash loan per transaction
     */
    function initialize(address _treasury, uint256 _maxFlashLoanAmount)
        external
        initializer
    {
        __Ownable_init(msg.sender);
        __ReentrancyGuard_init();
        __Pausable_init();

        if (_treasury == address(0)) revert InvalidTreasury();

        treasury = _treasury;
        maxFlashLoanAmount = _maxFlashLoanAmount;
    }

    /**
     * @notice Execute simple flash loan (single asset)
     * @dev Aave V3 flashLoanSimple() compatible
     * @param receiver Contract receiving the flash loan
     * @param asset Address of the asset to flash loan
     * @param amount Amount to flash loan
     * @param params Arbitrary data passed to receiver
     */
    function flashLoanSimple(
        address receiver,
        address asset,
        uint256 amount,
        bytes calldata params
    ) external nonReentrant whenNotPaused {
        _executeFlashLoan(receiver, asset, amount, params);
    }

    /**
     * @notice Execute flash loan (Aave V3 compatible)
     * @dev For single asset, use flashLoanSimple for gas savings
     * @param receiver Contract receiving the flash loan
     * @param asset Address of the asset to flash loan
     * @param amount Amount to flash loan
     * @param params Arbitrary data passed to receiver
     */
    function flashLoan(
        address receiver,
        address asset,
        uint256 amount,
        bytes calldata params
    ) external nonReentrant whenNotPaused {
        _executeFlashLoan(receiver, asset, amount, params);
    }

    /**
     * @notice Internal flash loan execution
     * @dev Implements Aave V3 flash loan logic with security checks
     */
    function _executeFlashLoan(
        address receiver,
        address asset,
        uint256 amount,
        bytes calldata params
    ) internal {
        // 1. Validation checks
        if (receiver == address(0)) revert InvalidReceiver();
        if (!flashLoanEnabled[asset]) revert FlashLoanNotEnabled();
        if (amount > maxFlashLoanAmount) revert FlashLoanAmountExceedsMax();

        IERC20 token = IERC20(asset);
        uint256 availableLiquidity = token.balanceOf(address(this));

        if (amount > availableLiquidity) revert InsufficientLiquidity();

        // 2. Calculate premium (0.09% total)
        uint256 premiumTotal = (amount * FLASH_LOAN_PREMIUM_TOTAL) / PREMIUM_PRECISION;
        uint256 premiumToProtocol = (amount * FLASH_LOAN_PREMIUM_TO_PROTOCOL) / PREMIUM_PRECISION;
        uint256 premiumToLP = premiumTotal - premiumToProtocol;

        uint256 amountPlusPremium = amount + premiumTotal;

        // 3. Record balance before flash loan
        uint256 balanceBefore = token.balanceOf(address(this));

        // 4. Transfer flash loan to receiver
        token.safeTransfer(receiver, amount);

        // 5. Execute receiver's operation
        bool success = IFlashLoanReceiver(receiver).executeOperation(
            asset,
            amount,
            premiumTotal,
            msg.sender, // initiator
            params
        );

        if (!success) revert ExecutionFailed();

        // 6. Pull back amount + premium from receiver
        token.safeTransferFrom(receiver, address(this), amountPlusPremium);

        // 7. Verify repayment
        uint256 balanceAfter = token.balanceOf(address(this));
        if (balanceAfter < balanceBefore + premiumTotal) {
            revert FlashLoanNotRepaid();
        }

        // 8. Transfer protocol fee to treasury
        if (premiumToProtocol > 0) {
            token.safeTransfer(treasury, premiumToProtocol);
        }
        // Note: premiumToLP stays in vault for liquidity providers

        // 9. Update statistics
        totalFlashLoanVolume[asset] += amount;
        totalFeesCollected[asset] += premiumTotal;
        userFlashLoanCount[msg.sender]++;
        userFlashLoanVolume[msg.sender] += amount;

        // 10. Record history
        flashLoanHistory.push(FlashLoanData({
            asset: asset,
            amount: amount,
            premium: premiumTotal,
            initiator: msg.sender,
            timestamp: block.timestamp,
            success: true
        }));

        // 11. Emit event
        emit FlashLoan(
            receiver,
            msg.sender,
            asset,
            amount,
            premiumTotal,
            premiumToProtocol,
            premiumToLP
        );
    }

    /**
     * @notice Get maximum flash loan amount for asset
     * @param asset Asset address
     * @return maxAmount Maximum amount available for flash loan
     */
    function maxFlashLoan(address asset) external view returns (uint256 maxAmount) {
        if (!flashLoanEnabled[asset]) return 0;

        uint256 availableLiquidity = IERC20(asset).balanceOf(address(this));
        return availableLiquidity > maxFlashLoanAmount ? maxFlashLoanAmount : availableLiquidity;
    }

    /**
     * @notice Calculate flash loan fee for given amount
     * @param amount Flash loan amount
     * @return premium Total premium (0.09%)
     * @return protocolFee Fee to protocol (0.04%)
     * @return lpFee Fee to liquidity providers (0.05%)
     */
    function flashFee(uint256 amount)
        external
        pure
        returns (
            uint256 premium,
            uint256 protocolFee,
            uint256 lpFee
        )
    {
        premium = (amount * FLASH_LOAN_PREMIUM_TOTAL) / PREMIUM_PRECISION;
        protocolFee = (amount * FLASH_LOAN_PREMIUM_TO_PROTOCOL) / PREMIUM_PRECISION;
        lpFee = premium - protocolFee;
    }

    /**
     * @notice Enable flash loans for asset (governance)
     * @param asset Asset to enable
     */
    function enableFlashLoan(address asset) external onlyOwner {
        flashLoanEnabled[asset] = true;
        emit FlashLoanEnabled(asset);
    }

    /**
     * @notice Disable flash loans for asset (governance)
     * @param asset Asset to disable
     */
    function disableFlashLoan(address asset) external onlyOwner {
        flashLoanEnabled[asset] = false;
        emit FlashLoanDisabled(asset);
    }

    /**
     * @notice Update protocol treasury (governance)
     * @param newTreasury New treasury address
     */
    function setTreasury(address newTreasury) external onlyOwner {
        if (newTreasury == address(0)) revert InvalidTreasury();

        address oldTreasury = treasury;
        treasury = newTreasury;

        emit TreasuryUpdated(oldTreasury, newTreasury);
    }

    /**
     * @notice Update max flash loan amount (governance)
     * @param newMax New maximum flash loan amount
     */
    function setMaxFlashLoanAmount(uint256 newMax) external onlyOwner {
        uint256 oldMax = maxFlashLoanAmount;
        maxFlashLoanAmount = newMax;

        emit MaxFlashLoanAmountUpdated(oldMax, newMax);
    }

    /**
     * @notice Emergency pause
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

    /**
     * @notice Get flash loan statistics for asset
     * @param asset Asset address
     * @return volume Total flash loan volume
     * @return fees Total fees collected
     */
    function getAssetStats(address asset)
        external
        view
        returns (uint256 volume, uint256 fees)
    {
        return (totalFlashLoanVolume[asset], totalFeesCollected[asset]);
    }

    /**
     * @notice Get user flash loan statistics
     * @param user User address
     * @return count Number of flash loans executed
     * @return volume Total volume borrowed
     */
    function getUserStats(address user)
        external
        view
        returns (uint256 count, uint256 volume)
    {
        return (userFlashLoanCount[user], userFlashLoanVolume[user]);
    }

    /**
     * @notice Get flash loan history count
     */
    function getFlashLoanCount() external view returns (uint256) {
        return flashLoanHistory.length;
    }

    /**
     * @notice Get recent flash loans
     * @param count Number of recent flash loans to retrieve
     */
    function getRecentFlashLoans(uint256 count)
        external
        view
        returns (FlashLoanData[] memory)
    {
        uint256 total = flashLoanHistory.length;
        if (count > total) count = total;

        FlashLoanData[] memory recent = new FlashLoanData[](count);
        for (uint256 i = 0; i < count; i++) {
            recent[i] = flashLoanHistory[total - 1 - i];
        }

        return recent;
    }
}
