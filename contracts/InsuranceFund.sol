// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

/**
 * @title InsuranceFund
 * @notice Protocol insurance fund for bad debt coverage
 * @dev Collects 5% of protocol revenue and provides first-loss protection
 */
contract InsuranceFund is Ownable, ReentrancyGuard {
    using SafeERC20 for IERC20;

    // ============ Structs ============

    struct CoverageRecord {
        uint256 loanId;
        address lender;
        uint256 lossAmount;
        uint256 coveredAmount;
        uint256 timestamp;
    }

    // ============ State Variables ============

    IERC20 public immutable stablecoin; // USDC/USDT

    uint256 public totalFunds;
    uint256 public totalCovered;
    uint256 public totalDefaults;

    // Revenue allocation percentage (5% = 500 basis points)
    uint256 public constant REVENUE_ALLOCATION_PERCENT = 500; // 5% in basis points
    uint256 public constant REVENUE_PERCENTAGE = 5;
    uint256 public constant PERCENTAGE_DENOMINATOR = 100;

    // Maximum coverage per loan (0.25% = 25 basis points)
    uint256 public constant MAX_COVERAGE_PERCENT = 25; // 0.25% in basis points
    uint256 public constant MAX_COVERAGE_BPS = 25;
    uint256 public constant BASIS_POINTS = 10000;

    // Authorized contracts that can request coverage
    mapping(address => bool) public authorizedRequestors;

    // Lender contributions (optional)
    mapping(address => uint256) public lenderContributions;

    // Coverage history
    CoverageRecord[] public coverageHistory;

    // ============ Events ============

    event Deposit(address indexed depositor, uint256 amount);
    event FundsDeposited(address indexed depositor, uint256 amount, uint256 newTotal);
    event RevenueAllocated(uint256 protocolRevenue, uint256 allocationAmount);
    event LossCovered(
        uint256 indexed loanId,
        address indexed lender,
        uint256 lossAmount,
        uint256 coveredAmount
    );
    event AuthorizedRequestorSet(address indexed requestor, bool authorized);
    event EmergencyWithdrawal(address indexed recipient, uint256 amount);

    // ============ Constructor ============

    constructor(address _stablecoin) Ownable(msg.sender) {
        stablecoin = IERC20(_stablecoin);
    }

    // ============ External Functions ============

    /**
     * @notice Deposit funds into the insurance pool
     * @param amount Amount to deposit
     */
    function deposit(uint256 amount) external nonReentrant {
        require(amount > 0, "Amount must be > 0");

        stablecoin.safeTransferFrom(msg.sender, address(this), amount);

        totalFunds += amount;
        lenderContributions[msg.sender] += amount;

        emit Deposit(msg.sender, amount);
        emit FundsDeposited(msg.sender, amount, totalFunds);
    }

    /**
     * @notice Allocate protocol revenue to insurance fund
     * @param protocolRevenue Total protocol revenue from fees
     */
    function allocateRevenue(uint256 protocolRevenue) external onlyAuthorized nonReentrant {
        require(protocolRevenue > 0, "Amount must be > 0");

        uint256 allocationAmount = (protocolRevenue * REVENUE_PERCENTAGE) / PERCENTAGE_DENOMINATOR;

        stablecoin.safeTransferFrom(msg.sender, address(this), allocationAmount);

        totalFunds += allocationAmount;

        emit RevenueAllocated(protocolRevenue, allocationAmount);
    }

    /**
     * @notice Cover a loss from a defaulted loan
     * @param lender Address of the lender who suffered the loss
     * @param loanId ID of the defaulted loan (for record keeping)
     * @param principal Original loan principal amount
     * @param lossAmount Total loss amount
     * @return Amount actually covered by insurance
     */
    function coverLoss(
        address lender,
        uint256 loanId,
        uint256 principal,
        uint256 lossAmount
    ) external onlyAuthorized nonReentrant returns (uint256) {
        require(lender != address(0), "Invalid lender address");
        require(lossAmount > 0, "Loss amount must be > 0");

        // Calculate maximum coverage (0.25% of principal)
        uint256 maxCoverage = (principal * MAX_COVERAGE_BPS) / BASIS_POINTS;

        // Coverage is lesser of: available funds, max coverage, or actual loss
        uint256 coveredAmount = _min(_min(totalFunds, maxCoverage), lossAmount);

        require(coveredAmount <= totalFunds, "Insufficient funds");

        if (coveredAmount > 0) {
            totalFunds -= coveredAmount;
            totalCovered += coveredAmount;
            totalDefaults++;

            // Transfer coverage to lender
            stablecoin.safeTransfer(lender, coveredAmount);

            // Record coverage
            coverageHistory.push(CoverageRecord({
                loanId: loanId,
                lender: lender,
                lossAmount: lossAmount,
                coveredAmount: coveredAmount,
                timestamp: block.timestamp
            }));

            emit LossCovered(loanId, lender, lossAmount, coveredAmount);
        }

        return coveredAmount;
    }

    // ============ View Functions ============

    /**
     * @notice Get maximum possible coverage for a principal amount
     * @dev Always returns 0.25% of principal, regardless of fund balance
     * @param principal Loan principal amount
     * @return Maximum coverage (0.25% of principal)
     */
    function getMaxCoveragePercent(uint256 principal) public pure returns (uint256) {
        return (principal * MAX_COVERAGE_BPS) / BASIS_POINTS;
    }

    /**
     * @notice Get available coverage for a given principal
     * @dev Limited by current fund balance
     * @param principal Loan principal amount
     * @return Coverage amount (min of max coverage and available funds)
     */
    function getAvailableCoverage(uint256 principal) public view returns (uint256) {
        uint256 maxCoverage = (principal * MAX_COVERAGE_BPS) / BASIS_POINTS;
        return _min(totalFunds, maxCoverage);
    }

    /**
     * @notice Get insurance fund statistics
     * @return _totalFunds Total funds available
     * @return _totalCovered Total amount covered historically
     * @return _totalDefaults Number of defaults covered
     * @return _utilizationRate Percentage of funds used (basis points)
     */
    function getStatistics() external view returns (
        uint256 _totalFunds,
        uint256 _totalCovered,
        uint256 _totalDefaults,
        uint256 _utilizationRate
    ) {
        _totalFunds = totalFunds;
        _totalCovered = totalCovered;
        _totalDefaults = totalDefaults;

        uint256 totalHistoricalFunds = totalFunds + totalCovered;
        _utilizationRate = totalHistoricalFunds > 0
            ? (totalCovered * BASIS_POINTS) / totalHistoricalFunds
            : 0;
    }

    /**
     * @notice Get coverage history
     * @param startIndex Starting index
     * @param count Number of records to return
     * @return Array of coverage records
     */
    function getCoverageHistory(
        uint256 startIndex,
        uint256 count
    ) external view returns (CoverageRecord[] memory) {
        require(startIndex < coverageHistory.length, "Invalid start index");

        uint256 endIndex = _min(startIndex + count, coverageHistory.length);
        uint256 resultCount = endIndex - startIndex;

        CoverageRecord[] memory records = new CoverageRecord[](resultCount);

        for (uint256 i = 0; i < resultCount; i++) {
            records[i] = coverageHistory[startIndex + i];
        }

        return records;
    }

    /**
     * @notice Get total coverage history count
     * @return Number of coverage records
     */
    function getCoverageHistoryCount() external view returns (uint256) {
        return coverageHistory.length;
    }

    /**
     * @notice Check if fund can cover a specific loss
     * @param principal Loan principal
     * @return Whether the loss can be covered
     */
    function canCoverLoss(uint256 principal) external view returns (bool) {
        return getAvailableCoverage(principal) > 0;
    }

    /**
     * @notice Get default history for a specific loan
     * @param loanId ID of the loan
     * @return Coverage record for the loan
     */
    function getDefaultHistory(uint256 loanId) external view returns (CoverageRecord memory) {
        for (uint256 i = 0; i < coverageHistory.length; i++) {
            if (coverageHistory[i].loanId == loanId) {
                return coverageHistory[i];
            }
        }
        // Return empty record if not found
        return CoverageRecord({
            loanId: 0,
            lender: address(0),
            lossAmount: 0,
            coveredAmount: 0,
            timestamp: 0
        });
    }

    // ============ Admin Functions ============

    /**
     * @notice Set authorization for a contract to request coverage
     * @param requestor Address of the requestor contract
     * @param authorized Whether the requestor is authorized
     */
    function setAuthorizedRequestor(address requestor, bool authorized) external onlyOwner {
        authorizedRequestors[requestor] = authorized;
        emit AuthorizedRequestorSet(requestor, authorized);
    }

    /**
     * @notice Emergency withdrawal (only owner, for migrations)
     * @param amount Amount to withdraw
     */
    function emergencyWithdraw(uint256 amount) external onlyOwner nonReentrant {
        require(amount <= totalFunds, "Insufficient funds");

        totalFunds -= amount;
        stablecoin.safeTransfer(msg.sender, amount);

        emit EmergencyWithdrawal(msg.sender, amount);
    }

    // ============ Internal Functions ============

    function _min(uint256 a, uint256 b) internal pure returns (uint256) {
        return a < b ? a : b;
    }

    // ============ Modifiers ============

    modifier onlyAuthorized() {
        require(
            authorizedRequestors[msg.sender] || msg.sender == owner(),
            "Not authorized"
        );
        _;
    }
}
