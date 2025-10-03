'use client';

import { ConnectButton } from '@rainbow-me/rainbowkit';
import Link from 'next/link';
import { useAccount } from 'wagmi';

export default function Home() {
  const { address, isConnected } = useAccount();

  return (
    <main className="min-h-screen bg-black text-white p-8">
      {/* Header */}
      <header className="flex justify-between items-center mb-20">
        <h1 className="text-2xl font-bold">EON PROTOCOL</h1>
        <ConnectButton />
      </header>

      {/* Hero Section */}
      <div className="max-w-6xl mx-auto">
        <h2 className="text-7xl font-bold mb-6">
          UNDERCOLLATERALIZED<br />LENDING
        </h2>

        <p className="text-2xl text-gray-400 mb-8 max-w-3xl">
          Time as Collateral. Prove your on-chain history, earn reputation, borrow more.
        </p>

        {/* CTA Buttons */}
        <div className="flex gap-4 mb-20">
          {isConnected ? (
            <>
              <Link
                href="/claim"
                className="bg-white text-black px-8 py-4 rounded-lg font-semibold hover:bg-gray-200 transition"
              >
                Submit Claim →
              </Link>
              <Link
                href="/profile"
                className="border border-white px-8 py-4 rounded-lg font-semibold hover:bg-white hover:text-black transition"
              >
                View Profile
              </Link>
            </>
          ) : (
            <div className="text-gray-500 text-lg">
              Connect your wallet to get started
            </div>
          )}
        </div>

        {/* How It Works */}
        <div className="grid md:grid-cols-3 gap-8 mb-20">
          <div className="border border-gray-800 p-6 rounded-lg">
            <div className="text-4xl mb-4">📊</div>
            <h3 className="text-xl font-bold mb-2">1. Submit Claims</h3>
            <p className="text-gray-400">
              Prove you held assets over time. Build your temporal ownership history.
            </p>
          </div>

          <div className="border border-gray-800 p-6 rounded-lg">
            <div className="text-4xl mb-4">⭐</div>
            <h3 className="text-xl font-bold mb-2">2. Earn Reputation</h3>
            <p className="text-gray-400">
              Get scored 0-1000 based on your holdings. Higher score = higher LTV.
            </p>
          </div>

          <div className="border border-gray-800 p-6 rounded-lg">
            <div className="text-4xl mb-4">💰</div>
            <h3 className="text-xl font-bold mb-2">3. Borrow More</h3>
            <p className="text-gray-400">
              Access 50-90% LTV loans. Better reputation = less collateral needed.
            </p>
          </div>
        </div>

        {/* Stats */}
        <div className="grid md:grid-cols-4 gap-6 border-t border-gray-800 pt-12">
          <div>
            <div className="text-4xl font-bold text-green-400">50-90%</div>
            <div className="text-gray-500 mt-2">Dynamic LTV</div>
          </div>
          <div>
            <div className="text-4xl font-bold text-blue-400">0-1000</div>
            <div className="text-gray-500 mt-2">Reputation Score</div>
          </div>
          <div>
            <div className="text-4xl font-bold text-purple-400">ZK</div>
            <div className="text-gray-500 mt-2">Dispute Proofs</div>
          </div>
          <div>
            <div className="text-4xl font-bold text-yellow-400">24/7</div>
            <div className="text-gray-500 mt-2">Permissionless</div>
          </div>
        </div>
      </div>

      {/* Footer */}
      <footer className="max-w-6xl mx-auto mt-20 pt-8 border-t border-gray-800 text-center text-gray-500">
        <p>Arbitrum Sepolia Testnet • Built with Next.js + Wagmi + RainbowKit</p>
      </footer>
    </main>
  );
}
