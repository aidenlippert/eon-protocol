'use client';

import { useState } from 'react';
import { ConnectButton } from '@rainbow-me/rainbowkit';
import { useAccount, useWriteContract, useBlockNumber, useReadContract } from 'wagmi';
import { parseEther, formatEther, keccak256, toBytes } from 'viem';
import { arbitrumSepolia } from 'wagmi/chains';
import { CONTRACTS, CLAIM_MANAGER_ABI } from '../contracts';
import Link from 'next/link';

export default function Claim() {
  const { address, chain } = useAccount();
  const { data: currentBlock } = useBlockNumber();
  const { writeContract, isPending } = useWriteContract();

  const [balance, setBalance] = useState('10');
  const [durationDays, setDurationDays] = useState('365');

  // Read user stake amount
  const { data: userStake } = useReadContract({
    address: CONTRACTS.arbitrumSepolia.claimManager as `0x${string}`,
    abi: CLAIM_MANAGER_ABI,
    functionName: 'USER_STAKE',
  });

  const calculateScore = (bal: string, days: string): number => {
    const balanceEth = parseFloat(bal) || 0;
    const months = (parseFloat(days) || 0) / 30;

    // Duration score (0-500)
    const durationScore = Math.min(500, Math.floor(500 * (1 - Math.exp(-months / 36))));

    // Balance score (0-500)
    const balanceScore = Math.min(500, Math.floor(Math.log10(balanceEth + 1) * 125));

    return durationScore + balanceScore;
  };

  const calculateLTV = (score: number): number => {
    if (score <= 500) return 50;
    return Math.floor(50 + ((score - 500) * 40) / 500);
  };

  const estimatedScore = calculateScore(balance, durationDays);
  const estimatedLTV = calculateLTV(estimatedScore);

  const handleSubmit = async () => {
    if (!address || !currentBlock) return;

    const durationBlocks = Math.floor((parseFloat(durationDays) * 6500)); // ~6500 blocks/day
    const startBlock = Number(currentBlock) - durationBlocks;
    const endBlock = Number(currentBlock);

    // Generate dummy merkle root for testnet (in prod, this comes from indexer)
    const merkleRoot = keccak256(toBytes(`${address}-${startBlock}-${endBlock}`));

    try {
      await writeContract({
        address: CONTRACTS.arbitrumSepolia.claimManager as `0x${string}`,
        abi: CLAIM_MANAGER_ABI,
        functionName: 'submitClaim',
        args: [
          parseEther(balance),
          BigInt(startBlock),
          BigInt(endBlock),
          merkleRoot
        ],
        value: userStake || parseEther('0.1'),
      });
    } catch (error) {
      console.error('Error submitting claim:', error);
    }
  };

  return (
    <main className="min-h-screen bg-black text-white p-8">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="flex justify-between items-center mb-12">
          <Link href="/" className="text-2xl font-bold hover:text-gray-400">EON</Link>
          <ConnectButton />
        </div>

        <h1 className="text-5xl font-bold mb-4">Prove Your Holdings</h1>
        <p className="text-xl text-gray-400 mb-12">
          Submit a temporal ownership claim to earn reputation
        </p>

        {!address ? (
          <div className="border border-gray-800 p-12 rounded-lg text-center">
            <p className="text-2xl mb-6 text-gray-400">Connect wallet to continue</p>
            <ConnectButton />
          </div>
        ) : chain?.id !== arbitrumSepolia.id ? (
          <div className="border border-red-500 p-8 rounded-lg text-center">
            <p className="text-xl mb-4">⚠️ Wrong Network</p>
            <p className="text-gray-400">Please switch to Arbitrum Sepolia</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-8">
            {/* Form */}
            <div className="space-y-6">
              <div>
                <label className="block text-sm text-gray-400 mb-2">I held</label>
                <div className="flex items-center gap-4">
                  <input
                    type="number"
                    value={balance}
                    onChange={(e) => setBalance(e.target.value)}
                    className="flex-1 bg-gray-900 border border-gray-700 p-4 rounded-lg text-2xl focus:border-white focus:outline-none"
                    placeholder="10"
                    step="0.1"
                    min="0"
                  />
                  <span className="text-2xl text-gray-400">ETH</span>
                </div>
              </div>

              <div>
                <label className="block text-sm text-gray-400 mb-2">For at least</label>
                <div className="flex items-center gap-4">
                  <input
                    type="number"
                    value={durationDays}
                    onChange={(e) => setDurationDays(e.target.value)}
                    className="flex-1 bg-gray-900 border border-gray-700 p-4 rounded-lg text-2xl focus:border-white focus:outline-none"
                    placeholder="365"
                    step="1"
                    min="0"
                  />
                  <span className="text-2xl text-gray-400">days</span>
                </div>
                <p className="text-sm text-gray-500 mt-2">
                  ~{Math.floor(parseFloat(durationDays) / 30)} months
                </p>
              </div>

              <div className="pt-4">
                <button
                  onClick={handleSubmit}
                  disabled={isPending || !balance || !durationDays}
                  className="w-full bg-white text-black font-bold py-4 rounded-lg text-xl hover:bg-gray-200 transition disabled:bg-gray-700 disabled:text-gray-400 disabled:cursor-not-allowed"
                >
                  {isPending ? 'Submitting...' : `Submit Claim (${formatEther(userStake || parseEther('0.1'))} ETH stake)`}
                </button>
                <p className="text-sm text-gray-500 mt-2 text-center">
                  Stake refunded after 7-day challenge period
                </p>
              </div>
            </div>

            {/* Preview */}
            <div className="border border-gray-800 p-8 rounded-lg space-y-6">
              <div>
                <p className="text-sm text-gray-400 mb-2">Estimated Reputation</p>
                <p className="text-5xl font-bold">{estimatedScore}/1000</p>
                <div className="w-full bg-gray-800 h-2 rounded-full mt-4">
                  <div
                    className="bg-white h-2 rounded-full transition-all"
                    style={{ width: `${(estimatedScore / 1000) * 100}%` }}
                  />
                </div>
              </div>

              <div>
                <p className="text-sm text-gray-400 mb-2">Estimated LTV</p>
                <p className="text-5xl font-bold">{estimatedLTV}%</p>
              </div>

              <div>
                <p className="text-sm text-gray-400 mb-2">Max Borrow (if {balance} ETH collateral)</p>
                <p className="text-3xl font-bold">
                  {((parseFloat(balance) * estimatedLTV) / 100).toFixed(2)} ETH
                </p>
              </div>

              <div className="pt-4 border-t border-gray-800">
                <p className="text-sm text-gray-400 mb-2">Risk Tier</p>
                <p className="text-2xl font-bold">
                  {estimatedScore >= 900 ? 'A' : estimatedScore >= 800 ? 'B' : estimatedScore >= 700 ? 'C' : estimatedScore >= 600 ? 'D' : estimatedScore >= 500 ? 'E' : 'F'}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Info */}
        <div className="mt-12 p-6 border border-gray-800 rounded-lg">
          <h3 className="font-bold mb-4">How Claims Work</h3>
          <ul className="space-y-2 text-gray-400 text-sm">
            <li>✓ Archive node validates your balance at 52 weekly checkpoints</li>
            <li>✓ 7-day challenge period (indexers verify off-chain)</li>
            <li>✓ If unchallenged → Claim accepted, reputation NFT minted</li>
            <li>✓ If challenged → Provide ZK proof or lose stake</li>
            <li>✓ Reputation decays 10 points/month without fresh claims</li>
          </ul>
        </div>
      </div>
    </main>
  );
}
