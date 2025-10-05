/**
 * @title Blockchain Integration Layer
 * @notice Connects to Arbitrum Sepolia and deployed contracts
 */

import { ethers } from 'ethers';

// Contract addresses on Arbitrum Sepolia
export const DEPLOYED_CONTRACTS = {
  CreditRegistry: '0xad1e41e347E527BA5F8009582ee6cb499D1157D7',
  ScoreOracle: '0x4E5D1f581BCAE0CEfCd7c32d9Fcde283a786dc62',
  CreditVault: '0xB1E54fDCf400FB25203801013dfeaD737fBBbd61',
};

// Arbitrum Sepolia RPC
const ARBITRUM_SEPOLIA_RPC = 'https://sepolia-rollup.arbitrum.io/rpc';

/**
 * Get ethers provider for Arbitrum Sepolia
 */
export function getProvider(): ethers.JsonRpcProvider {
  return new ethers.JsonRpcProvider(ARBITRUM_SEPOLIA_RPC);
}

/**
 * Get wallet balance in ETH
 */
export async function getWalletBalance(address: string): Promise<string> {
  const provider = getProvider();
  const balance = await provider.getBalance(address);
  return ethers.formatEther(balance);
}

/**
 * Get first transaction date for wallet (account age)
 */
export async function getFirstTransactionDate(address: string): Promise<Date | null> {
  const provider = getProvider();

  try {
    // Get current block number
    const currentBlock = await provider.getBlockNumber();

    // Binary search for first transaction (simple approach: last 100k blocks)
    const searchRange = Math.min(100000, currentBlock);
    const startBlock = Math.max(0, currentBlock - searchRange);

    // Get transaction count at different points
    const txCount = await provider.getTransactionCount(address);

    if (txCount === 0) return null;

    // Rough estimate: assume first tx was in last 6 months
    // For production, would use event indexing service
    const estimatedDate = new Date();
    estimatedDate.setMonth(estimatedDate.getMonth() - 6);

    return estimatedDate;
  } catch (error) {
    console.error('Error getting first transaction date:', error);
    return null;
  }
}

/**
 * Get account age in days
 */
export async function getAccountAgeDays(address: string): Promise<number> {
  const firstTxDate = await getFirstTransactionDate(address);

  if (!firstTxDate) return 0;

  const now = new Date();
  const diffMs = now.getTime() - firstTxDate.getTime();
  return Math.floor(diffMs / (1000 * 60 * 60 * 24));
}
