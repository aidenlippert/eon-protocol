import { CONTRACTS, NETWORK } from '@/lib/contracts';

export default function Home() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900">
      {/* Hero Section */}
      <div className="container mx-auto px-4 py-16">
        <div className="text-center mb-16">
          <h1 className="text-6xl font-bold text-white mb-4">
            ⏰ Eon Protocol
          </h1>
          <p className="text-2xl text-purple-200 mb-8">
            Time as Collateral - Temporal Reputation-Based Lending
          </p>
          <div className="flex gap-4 justify-center">
            <div className="bg-green-500/20 border border-green-500 rounded-lg px-6 py-3">
              <p className="text-green-400 font-semibold">✅ 100% Tests Passing</p>
            </div>
            <div className="bg-blue-500/20 border border-blue-500 rounded-lg px-6 py-3">
              <p className="text-blue-400 font-semibold">🚀 Live on Arbitrum Sepolia</p>
            </div>
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-16">
          <div className="bg-white/10 backdrop-blur-lg rounded-xl p-6 border border-white/20">
            <p className="text-purple-300 text-sm mb-2">Max LTV</p>
            <p className="text-4xl font-bold text-white">90%</p>
            <p className="text-gray-400 text-xs mt-1">Platinum Tier</p>
          </div>
          <div className="bg-white/10 backdrop-blur-lg rounded-xl p-6 border border-white/20">
            <p className="text-purple-300 text-sm mb-2">Grace Period</p>
            <p className="text-4xl font-bold text-white">72h</p>
            <p className="text-gray-400 text-xs mt-1">For Top Borrowers</p>
          </div>
          <div className="bg-white/10 backdrop-blur-lg rounded-xl p-6 border border-white/20">
            <p className="text-purple-300 text-sm mb-2">Insurance</p>
            <p className="text-4xl font-bold text-white">0.25%</p>
            <p className="text-gray-400 text-xs mt-1">Bad Debt Coverage</p>
          </div>
          <div className="bg-white/10 backdrop-blur-lg rounded-xl p-6 border border-white/20">
            <p className="text-purple-300 text-sm mb-2">Smart Contracts</p>
            <p className="text-4xl font-bold text-white">6</p>
            <p className="text-gray-400 text-xs mt-1">All Deployed</p>
          </div>
        </div>

        {/* Credit Tiers */}
        <div className="mb-16">
          <h2 className="text-3xl font-bold text-white mb-8 text-center">
            Credit Tier System
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="bg-orange-500/20 border-2 border-orange-500 rounded-xl p-6">
              <div className="text-4xl mb-2">🥉</div>
              <h3 className="text-xl font-bold text-orange-300 mb-2">Bronze</h3>
              <p className="text-orange-200 text-sm mb-4">Score: 0-399</p>
              <div className="space-y-2">
                <p className="text-white font-semibold">LTV: 50%</p>
                <p className="text-gray-300 text-sm">Grace: 0 hours</p>
              </div>
            </div>
            <div className="bg-gray-400/20 border-2 border-gray-400 rounded-xl p-6">
              <div className="text-4xl mb-2">🥈</div>
              <h3 className="text-xl font-bold text-gray-300 mb-2">Silver</h3>
              <p className="text-gray-200 text-sm mb-4">Score: 400-599</p>
              <div className="space-y-2">
                <p className="text-white font-semibold">LTV: 65%</p>
                <p className="text-gray-300 text-sm">Grace: 0 hours</p>
              </div>
            </div>
            <div className="bg-yellow-500/20 border-2 border-yellow-500 rounded-xl p-6">
              <div className="text-4xl mb-2">🥇</div>
              <h3 className="text-xl font-bold text-yellow-300 mb-2">Gold</h3>
              <p className="text-yellow-200 text-sm mb-4">Score: 600-799</p>
              <div className="space-y-2">
                <p className="text-white font-semibold">LTV: 75%</p>
                <p className="text-gray-300 text-sm">Grace: 24 hours</p>
              </div>
            </div>
            <div className="bg-purple-500/20 border-2 border-purple-500 rounded-xl p-6">
              <div className="text-4xl mb-2">💎</div>
              <h3 className="text-xl font-bold text-purple-300 mb-2">Platinum</h3>
              <p className="text-purple-200 text-sm mb-4">Score: 800-1000</p>
              <div className="space-y-2">
                <p className="text-white font-semibold">LTV: 90%</p>
                <p className="text-gray-300 text-sm">Grace: 72 hours</p>
              </div>
            </div>
          </div>
        </div>

        {/* Smart Contracts */}
        <div className="mb-16">
          <h2 className="text-3xl font-bold text-white mb-8 text-center">
            Deployed Smart Contracts
          </h2>
          <div className="bg-white/10 backdrop-blur-lg rounded-xl p-6 border border-white/20">
            <div className="space-y-4">
              {Object.entries(CONTRACTS).map(([name, address]) => (
                <div key={name} className="flex items-center justify-between border-b border-white/10 pb-4 last:border-0">
                  <div>
                    <p className="text-white font-semibold">{name}</p>
                    <p className="text-gray-400 text-sm font-mono">{address}</p>
                  </div>
                  <a
                    href={`${NETWORK.blockExplorer}/address/${address}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded-lg text-sm transition-colors"
                  >
                    View on Arbiscan →
                  </a>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* How It Works */}
        <div className="mb-16">
          <h2 className="text-3xl font-bold text-white mb-8 text-center">
            How It Works
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="bg-white/10 backdrop-blur-lg rounded-xl p-6 border border-white/20">
              <div className="text-4xl mb-4">📊</div>
              <h3 className="text-xl font-bold text-white mb-3">1. Build Reputation</h3>
              <p className="text-gray-300 text-sm">
                Hold assets over time, maintain good payment history, and build cross-protocol activity to increase your credit score.
              </p>
            </div>
            <div className="bg-white/10 backdrop-blur-lg rounded-xl p-6 border border-white/20">
              <div className="text-4xl mb-4">💰</div>
              <h3 className="text-xl font-bold text-white mb-3">2. Borrow More</h3>
              <p className="text-gray-300 text-sm">
                Higher credit scores unlock higher LTV ratios (50-90%) and longer grace periods (0-72 hours) before liquidation.
              </p>
            </div>
            <div className="bg-white/10 backdrop-blur-lg rounded-xl p-6 border border-white/20">
              <div className="text-4xl mb-4">🛡️</div>
              <h3 className="text-xl font-bold text-white mb-3">3. Stay Protected</h3>
              <p className="text-gray-300 text-sm">
                Insurance fund covers up to 0.25% of loan defaults, and fair Dutch auctions prevent instant liquidations.
              </p>
            </div>
          </div>
        </div>

        {/* Network Info */}
        <div className="text-center">
          <div className="bg-white/10 backdrop-blur-lg rounded-xl p-6 border border-white/20 inline-block">
            <p className="text-purple-300 mb-2">Network</p>
            <p className="text-white font-bold text-xl mb-4">{NETWORK.name}</p>
            <p className="text-gray-400 text-sm mb-4">Chain ID: {NETWORK.chainId}</p>
            <a
              href={NETWORK.rpcUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-purple-400 hover:text-purple-300 text-sm underline"
            >
              {NETWORK.rpcUrl}
            </a>
          </div>
        </div>

        {/* Footer */}
        <div className="text-center mt-16 text-gray-400">
          <p className="mb-2">Built with ❤️ on Arbitrum</p>
          <p className="text-sm">Phase 1: 100% Tests Passing • 6 Contracts Deployed • Testnet Live</p>
        </div>
      </div>
    </div>
  );
}
