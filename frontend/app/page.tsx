'use client';

import { ConnectButton } from '@rainbow-me/rainbowkit';
import { useAccount, useReadContract } from 'wagmi';
import { CONTRACTS } from '@/lib/contracts';
import { REPUTATION_SCORER_ABI, INSURANCE_FUND_ABI } from '@/lib/abi';

export default function Home() {
  const { address, isConnected } = useAccount();

  // Read user's credit score
  const { data: userScore } = useReadContract({
    address: CONTRACTS.ReputationScorer as `0x${string}`,
    abi: REPUTATION_SCORER_ABI,
    functionName: 'scores',
    args: address ? [address] : undefined,
    query: { enabled: !!address }
  });

  // Read insurance fund stats
  const { data: insuranceStats } = useReadContract({
    address: CONTRACTS.InsuranceFund as `0x${string}`,
    abi: INSURANCE_FUND_ABI,
    functionName: 'getStatistics',
  });

  const formatEther = (value: bigint | undefined) => {
    if (!value) return '0';
    return (Number(value) / 1e18).toFixed(2);
  };

  return (
    <div className="min-h-screen bg-black text-white">
      {/* Header */}
      <header className="border-b border-gray-800">
        <div className="container mx-auto px-6 py-4 flex justify-between items-center">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-purple-600 rounded"></div>
            <span className="text-xl font-semibold">Eon Protocol</span>
          </div>
          <ConnectButton />
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-6 py-16">
        
        {!isConnected ? (
          /* Not Connected State */
          <div className="max-w-4xl mx-auto text-center py-20">
            <h1 className="text-5xl font-bold mb-6">
              Reputation-Based Lending
            </h1>
            <p className="text-xl text-gray-400 mb-12">
              Unlock undercollateralized loans based on your on-chain history.<br/>
              Connect your wallet to get started.
            </p>
            <div className="inline-block">
              <ConnectButton />
            </div>
          </div>
        ) : (
          /* Connected State - Show Real Data */
          <div className="max-w-6xl mx-auto">
            
            {/* User Credit Score Card */}
            <div className="bg-gray-900 border border-gray-800 rounded-lg p-8 mb-8">
              <h2 className="text-2xl font-semibold mb-6">Your Credit Profile</h2>
              
              {userScore && userScore[4] > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                  <div>
                    <p className="text-sm text-gray-400 mb-2">Credit Score</p>
                    <p className="text-3xl font-bold">{userScore[4].toString()}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-400 mb-2">Tier</p>
                    <p className="text-3xl font-bold">{userScore[5] || 'N/A'}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-400 mb-2">Max LTV</p>
                    <p className="text-3xl font-bold">{userScore[6].toString()}%</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-400 mb-2">Last Updated</p>
                    <p className="text-sm text-gray-400">
                      {new Date(Number(userScore[7]) * 1000).toLocaleDateString()}
                    </p>
                  </div>
                </div>
              ) : (
                <div className="text-center py-8">
                  <p className="text-gray-400 mb-4">No credit score calculated yet</p>
                  <p className="text-sm text-gray-500">
                    Your wallet: {address?.slice(0, 6)}...{address?.slice(-4)}
                  </p>
                  <p className="text-sm text-gray-500 mt-2">
                    Contact protocol to calculate your initial score
                  </p>
                </div>
              )}
            </div>

            {/* Protocol Stats */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
              <div className="bg-gray-900 border border-gray-800 rounded-lg p-6">
                <p className="text-sm text-gray-400 mb-2">Insurance Fund</p>
                <p className="text-2xl font-bold">
                  {insuranceStats ? formatEther(insuranceStats[0]) : '0'} USDC
                </p>
              </div>
              <div className="bg-gray-900 border border-gray-800 rounded-lg p-6">
                <p className="text-sm text-gray-400 mb-2">Total Covered</p>
                <p className="text-2xl font-bold">
                  {insuranceStats ? formatEther(insuranceStats[1]) : '0'} USDC
                </p>
              </div>
              <div className="bg-gray-900 border border-gray-800 rounded-lg p-6">
                <p className="text-sm text-gray-400 mb-2">Total Defaults</p>
                <p className="text-2xl font-bold">
                  {insuranceStats ? insuranceStats[2].toString() : '0'}
                </p>
              </div>
            </div>

            {/* How It Works */}
            <div className="bg-gray-900 border border-gray-800 rounded-lg p-8">
              <h2 className="text-2xl font-semibold mb-6">How It Works</h2>
              <div className="space-y-4">
                <div className="flex gap-4">
                  <div className="flex-shrink-0 w-8 h-8 bg-purple-600 rounded-full flex items-center justify-center text-sm font-bold">1</div>
                  <div>
                    <h3 className="font-semibold mb-1">Build Reputation</h3>
                    <p className="text-sm text-gray-400">
                      Your on-chain history determines your credit score (0-1000)
                    </p>
                  </div>
                </div>
                <div className="flex gap-4">
                  <div className="flex-shrink-0 w-8 h-8 bg-purple-600 rounded-full flex items-center justify-center text-sm font-bold">2</div>
                  <div>
                    <h3 className="font-semibold mb-1">Unlock Higher LTV</h3>
                    <p className="text-sm text-gray-400">
                      Bronze (50%) → Silver (65%) → Gold (75%) → Platinum (90%)
                    </p>
                  </div>
                </div>
                <div className="flex gap-4">
                  <div className="flex-shrink-0 w-8 h-8 bg-purple-600 rounded-full flex items-center justify-center text-sm font-bold">3</div>
                  <div>
                    <h3 className="font-semibold mb-1">Grace Periods</h3>
                    <p className="text-sm text-gray-400">
                      Higher tiers get 24-72 hour grace periods before liquidation
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Contracts */}
            <div className="mt-8 pt-8 border-t border-gray-800">
              <h3 className="text-sm text-gray-400 mb-4">Smart Contracts (Arbitrum Sepolia)</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-sm">
                {Object.entries(CONTRACTS).map(([name, address]) => (
                  <a
                    key={name}
                    href={`https://sepolia.arbiscan.io/address/${address}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-gray-400 hover:text-purple-400 transition-colors"
                  >
                    {name}: {address.slice(0, 6)}...{address.slice(-4)}
                  </a>
                ))}
              </div>
            </div>
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-gray-800 mt-20">
        <div className="container mx-auto px-6 py-8 text-center text-sm text-gray-500">
          <p>Eon Protocol • Arbitrum Sepolia Testnet</p>
        </div>
      </footer>
    </div>
  );
}
