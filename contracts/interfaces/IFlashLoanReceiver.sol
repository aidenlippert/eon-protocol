// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title IFlashLoanReceiver
 * @notice Interface for flash loan receiver contracts (Aave V3 compatible)
 * @dev Implement this interface to receive flash loans from FlashLoanVault
 */
interface IFlashLoanReceiver {
    /**
     * @notice Execute operation after receiving flash loan
     * @dev Called by FlashLoanVault after transferring assets to receiver
     * @param asset Address of the flash-loaned asset
     * @param amount Amount flash-loaned
     * @param premium Fee amount (0.09% of amount)
     * @param initiator Address that initiated the flash loan
     * @param params Arbitrary bytes-encoded params from initiator
     * @return success True if operation succeeds
     */
    function executeOperation(
        address asset,
        uint256 amount,
        uint256 premium,
        address initiator,
        bytes calldata params
    ) external returns (bool success);
}

/**
 * @title IFlashLoanSimpleReceiver
 * @notice Simplified interface for single-asset flash loans
 * @dev Use this for simpler flash loan operations with single reserve
 */
interface IFlashLoanSimpleReceiver {
    /**
     * @notice Execute operation after receiving simple flash loan
     * @param asset Address of the flash-loaned asset
     * @param amount Amount flash-loaned
     * @param premium Fee amount
     * @param initiator Address that initiated the flash loan
     * @param params Arbitrary bytes-encoded params
     * @return success True if operation succeeds
     */
    function executeOperation(
        address asset,
        uint256 amount,
        uint256 premium,
        address initiator,
        bytes calldata params
    ) external returns (bool success);
}
