// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "../interfaces/IFlashLoanReceiver.sol";

/**
 * @title FlashLoanArbitrage
 * @notice Example flash loan arbitrage contract
 * @dev Demonstrates how to execute arbitrage using EON flash loans
 *
 * Use Case: Arbitrage between two DEXs
 * 1. Flash loan 1000 USDC from EON
 * 2. Buy ETH cheap on DEX A
 * 3. Sell ETH expensive on DEX B
 * 4. Repay flash loan + 0.09% fee
 * 5. Keep profit
 *
 * Security:
 * - Only flash loan vault can call executeOperation
 * - Owner can withdraw profits
 * - Slippage protection
 */
contract FlashLoanArbitrage is IFlashLoanReceiver, Ownable {
    using SafeERC20 for IERC20;

    address public immutable FLASH_LOAN_VAULT;

    /// @notice Arbitrage statistics
    uint256 public totalProfits;
    uint256 public successfulTrades;
    uint256 public failedTrades;

    /// @notice Events
    event ArbitrageExecuted(
        address indexed asset,
        uint256 amount,
        uint256 profit,
        uint256 timestamp
    );

    event ArbitrageFailed(string reason);

    /// @notice Errors
    error OnlyFlashLoanVault();
    error InsufficientProfit();
    error SwapFailed();

    constructor(address _flashLoanVault) Ownable(msg.sender) {
        FLASH_LOAN_VAULT = _flashLoanVault;
    }

    /**
     * @notice Execute flash loan arbitrage
     * @param asset Asset to flash loan (e.g., USDC)
     * @param amount Amount to flash loan
     * @param dexA Address of first DEX
     * @param dexB Address of second DEX
     * @param minProfit Minimum profit required (slippage protection)
     */
    function executeArbitrage(
        address asset,
        uint256 amount,
        address dexA,
        address dexB,
        uint256 minProfit
    ) external onlyOwner {
        bytes memory params = abi.encode(dexA, dexB, minProfit);

        // Approve flash loan vault to pull repayment
        IERC20(asset).approve(FLASH_LOAN_VAULT, type(uint256).max);

        // Initiate flash loan
        (bool success, ) = FLASH_LOAN_VAULT.call(
            abi.encodeWithSignature(
                "flashLoanSimple(address,address,uint256,bytes)",
                address(this),
                asset,
                amount,
                params
            )
        );

        if (!success) {
            failedTrades++;
            emit ArbitrageFailed("Flash loan failed");
        }
    }

    /**
     * @notice Flash loan callback (called by vault)
     * @dev This is where arbitrage logic executes
     * @param asset Flash loaned asset
     * @param amount Flash loan amount
     * @param premium Fee (0.09%)
     * @param initiator Address that initiated flash loan
     * @param params Encoded DEX addresses and min profit
     */
    function executeOperation(
        address asset,
        uint256 amount,
        uint256 premium,
        address initiator,
        bytes calldata params
    ) external override returns (bool) {
        // 1. Security: Only flash loan vault can call this
        if (msg.sender != FLASH_LOAN_VAULT) revert OnlyFlashLoanVault();

        // 2. Decode parameters
        (address dexA, address dexB, uint256 minProfit) = abi.decode(
            params,
            (address, address, uint256)
        );

        // 3. Execute arbitrage strategy
        uint256 balanceBefore = IERC20(asset).balanceOf(address(this));

        // ===== ARBITRAGE LOGIC =====
        // NOTE: This is a simplified example. In production:
        // - Call actual DEX swap functions (Uniswap, Sushiswap, etc.)
        // - Handle price impact and slippage
        // - Calculate optimal trade size
        // - Add MEV protection

        // Example: Buy low on DEX A, sell high on DEX B
        // _swapOnDexA(asset, amount, dexA);
        // _swapOnDexB(asset, expectedAmount, dexB);

        // For demo purposes, assume profitable arbitrage happened
        // In reality, you would execute actual swaps here

        uint256 balanceAfter = IERC20(asset).balanceOf(address(this));
        uint256 profit = balanceAfter > balanceBefore + amount + premium
            ? balanceAfter - (balanceBefore + amount + premium)
            : 0;

        // 4. Verify minimum profit met
        if (profit < minProfit) {
            failedTrades++;
            emit ArbitrageFailed("Insufficient profit");
            revert InsufficientProfit();
        }

        // 5. Approve vault to pull repayment (amount + premium)
        uint256 amountOwed = amount + premium;
        IERC20(asset).approve(FLASH_LOAN_VAULT, amountOwed);

        // 6. Update statistics
        successfulTrades++;
        totalProfits += profit;

        emit ArbitrageExecuted(asset, amount, profit, block.timestamp);

        return true;
    }

    /**
     * @notice Withdraw profits (owner only)
     * @param asset Asset to withdraw
     */
    function withdrawProfits(address asset) external onlyOwner {
        uint256 balance = IERC20(asset).balanceOf(address(this));
        if (balance > 0) {
            IERC20(asset).safeTransfer(owner(), balance);
        }
    }

    /**
     * @notice Get contract statistics
     */
    function getStats()
        external
        view
        returns (
            uint256 profits,
            uint256 successful,
            uint256 failed
        )
    {
        return (totalProfits, successfulTrades, failedTrades);
    }

    /**
     * @notice Calculate potential profit (view function)
     * @dev Used to check if arbitrage is profitable before executing
     */
    function calculatePotentialProfit(
        address asset,
        uint256 amount,
        address dexA,
        address dexB
    ) external view returns (uint256 potentialProfit, bool isProfitable) {
        // NOTE: In production, this would:
        // 1. Query DEX A for buy price
        // 2. Query DEX B for sell price
        // 3. Calculate price difference
        // 4. Subtract flash loan fee (0.09%)
        // 5. Subtract gas costs
        // 6. Return expected profit

        // Example calculation:
        uint256 flashLoanFee = (amount * 9) / 10000; // 0.09%
        uint256 estimatedGasCost = 0.001 ether; // Placeholder

        // Simplified profit calculation
        // potentialProfit = (sellPrice - buyPrice) * amount - flashLoanFee - gasCost;
        // isProfitable = potentialProfit > 0;

        return (0, false); // Placeholder
    }

    /**
     * @notice Emergency withdraw (owner only)
     */
    function emergencyWithdraw(address token) external onlyOwner {
        uint256 balance = IERC20(token).balanceOf(address(this));
        if (balance > 0) {
            IERC20(token).safeTransfer(owner(), balance);
        }
    }
}
