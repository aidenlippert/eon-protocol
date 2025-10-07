'use client';

import { useState } from 'react';
import { useAccount } from 'wagmi';
import { motion } from 'framer-motion';
import { DollarSign, TrendingUp, Shield, Sparkles, ArrowRight, Loader2 } from 'lucide-react';
import { BorrowModal } from '@/components/modals/BorrowModal';
import { useRealCreditScore } from '@/lib/hooks/useRealScore';
import { colors } from '@/lib/design-tokens';

export default function BorrowPage() {
  const { address, isConnected } = useAccount();
  const [showModal, setShowModal] = useState(false);
  const [selectedAmount, setSelectedAmount] = useState(100);

  // REAL DATA: Credit score from ScoreOraclePhase3B
  const { score, tier, apr, isLoading } = useRealCreditScore(address);

  if (!isConnected) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4">
        <div className="text-center max-w-md">
          <div className="mb-6">
            <div
              className="w-20 h-20 mx-auto rounded-full flex items-center justify-center"
              style={{
                background: `linear-gradient(135deg, ${colors.accent.purple}, ${colors.accent.blue})`,
              }}
            >
              <Shield className="w-10 h-10 text-white" />
            </div>
          </div>
          <h1 className="text-3xl font-bold text-white mb-3">Connect Your Wallet</h1>
          <p className="text-white/60">
            Connect your wallet to access credit-based lending with competitive rates
          </p>
        </div>
      </div>
    );
  }

  // Loading state for blockchain data
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="h-12 w-12 animate-spin mx-auto mb-4 text-violet-400" />
          <p className="text-white/60">Loading your credit score from blockchain...</p>
        </div>
      </div>
    );
  }

  const getTierColor = (tier: string) => {
    const colors = {
      Bronze: 'from-orange-500 to-orange-600',
      Silver: 'from-gray-400 to-gray-500',
      Gold: 'from-yellow-500 to-yellow-600',
      Platinum: 'from-purple-500 to-purple-600',
    };
    return colors[tier as keyof typeof colors] || colors.Bronze;
  };

  const getLTVByTier = (tier: string) => {
    const ltv = { Bronze: 50, Silver: 70, Gold: 80, Platinum: 90 };
    return ltv[tier as keyof typeof ltv] || 50;
  };

  const ltv = getLTVByTier(tier);

  return (
    <div className="min-h-screen py-12 px-4">
      <div className="max-w-6xl mx-auto">
        {/* Hero Section */}
        <motion.div
          className="text-center mb-12"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          <div className="inline-flex items-center gap-2 mb-4 px-4 py-2 rounded-full bg-white/5 border border-white/10">
            <Sparkles className="w-4 h-4 text-violet-400" />
            <span className="text-sm text-white/70">Credit-Based Lending</span>
          </div>
          <h1 className="text-5xl font-bold text-white mb-4">
            Borrow with{' '}
            <span
              className="bg-clip-text text-transparent"
              style={{
                backgroundImage: `linear-gradient(135deg, ${colors.accent.purple}, ${colors.accent.blue})`,
              }}
            >
              Better Rates
            </span>
          </h1>
          <p className="text-xl text-white/60 max-w-2xl mx-auto">
            Your credit score unlocks better terms. Higher scores mean lower rates and higher LTV.
          </p>
        </motion.div>

        {/* Your Credit Tier */}
        <motion.div
          className="mb-12 p-8 rounded-2xl border"
          style={{
            background: colors.bg.card,
            borderColor: 'rgba(255, 255, 255, 0.1)',
          }}
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.5, delay: 0.1 }}
        >
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-2xl font-bold text-white mb-2">Your Credit Tier</h2>
              <p className="text-white/60">Based on your on-chain credit score</p>
            </div>
            <div
              className={`px-6 py-3 rounded-xl bg-gradient-to-r ${getTierColor(tier)} text-white font-bold text-xl`}
            >
              {tier}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="p-4 rounded-xl bg-white/5 border border-white/10">
              <div className="text-sm text-white/60 mb-1">Credit Score</div>
              <div className="text-3xl font-bold text-white">{score}</div>
              <div className="text-xs text-white/50 mt-1">out of 100 (from blockchain)</div>
            </div>
            <div className="p-4 rounded-xl bg-white/5 border border-white/10">
              <div className="text-sm text-white/60 mb-1">Interest Rate</div>
              <div className="text-3xl font-bold text-green-400">{apr}%</div>
              <div className="text-xs text-white/50 mt-1">APR (from ScoreOracle)</div>
            </div>
            <div className="p-4 rounded-xl bg-white/5 border border-white/10">
              <div className="text-sm text-white/60 mb-1">Max LTV</div>
              <div className="text-3xl font-bold text-blue-400">{ltv}%</div>
              <div className="text-xs text-white/50 mt-1">Loan-to-Value</div>
            </div>
          </div>
        </motion.div>

        {/* Quick Borrow Amounts */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.2 }}
        >
          <h2 className="text-2xl font-bold text-white mb-6">Quick Borrow</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <BorrowCard
              amount={100}
              ltv={ltv}
              apr={apr}
              onClick={() => {
                setSelectedAmount(100);
                setShowModal(true);
              }}
            />
            <BorrowCard
              amount={250}
              ltv={ltv}
              apr={apr}
              popular
              onClick={() => {
                setSelectedAmount(250);
                setShowModal(true);
              }}
            />
            <BorrowCard
              amount={500}
              ltv={ltv}
              apr={apr}
              onClick={() => {
                setSelectedAmount(500);
                setShowModal(true);
              }}
            />
          </div>
        </motion.div>

        {/* Tier Comparison */}
        <motion.div
          className="mt-16 mb-16"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.3 }}
        >
          <h2 className="text-3xl font-bold text-white mb-4 text-center">Credit Score Tiers</h2>
          <p className="text-white/60 text-center mb-8">Compare benefits across all credit tiers</p>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {/* Bronze */}
            <div className={`p-6 rounded-2xl border-2 ${tier === 'Bronze' ? 'border-orange-500 bg-orange-500/10' : 'border-white/10 bg-white/5'}`}>
              <div className="text-center mb-4">
                <div className="text-2xl font-bold text-orange-400 mb-1">Bronze</div>
                <div className="text-sm text-white/60">Score: 0-59</div>
                {tier === 'Bronze' && <div className="text-xs text-orange-400 mt-2 font-semibold">YOU ARE HERE</div>}
              </div>
              <div className="space-y-3">
                <div className="text-center">
                  <div className="text-3xl font-bold text-white">15%</div>
                  <div className="text-xs text-white/60">APR</div>
                </div>
                <div className="text-center">
                  <div className="text-3xl font-bold text-white">50%</div>
                  <div className="text-xs text-white/60">Max LTV</div>
                </div>
                <div className="text-xs text-white/40 text-center mt-4">
                  Basic lending terms for new users
                </div>
              </div>
            </div>

            {/* Silver */}
            <div className={`p-6 rounded-2xl border-2 ${tier === 'Silver' ? 'border-gray-400 bg-gray-400/10' : 'border-white/10 bg-white/5'}`}>
              <div className="text-center mb-4">
                <div className="text-2xl font-bold text-gray-300 mb-1">Silver</div>
                <div className="text-sm text-white/60">Score: 60-74</div>
                {tier === 'Silver' && <div className="text-xs text-gray-300 mt-2 font-semibold">YOU ARE HERE</div>}
              </div>
              <div className="space-y-3">
                <div className="text-center">
                  <div className="text-3xl font-bold text-white">8%</div>
                  <div className="text-xs text-white/60">APR</div>
                </div>
                <div className="text-center">
                  <div className="text-3xl font-bold text-white">70%</div>
                  <div className="text-xs text-white/60">Max LTV</div>
                </div>
                <div className="text-xs text-white/40 text-center mt-4">
                  Better rates for established users
                </div>
              </div>
            </div>

            {/* Gold */}
            <div className={`p-6 rounded-2xl border-2 ${tier === 'Gold' ? 'border-yellow-500 bg-yellow-500/10' : 'border-white/10 bg-white/5'}`}>
              <div className="text-center mb-4">
                <div className="text-2xl font-bold text-yellow-400 mb-1">Gold</div>
                <div className="text-sm text-white/60">Score: 75-89</div>
                {tier === 'Gold' && <div className="text-xs text-yellow-400 mt-2 font-semibold">YOU ARE HERE</div>}
              </div>
              <div className="space-y-3">
                <div className="text-center">
                  <div className="text-3xl font-bold text-white">6%</div>
                  <div className="text-xs text-white/60">APR</div>
                </div>
                <div className="text-center">
                  <div className="text-3xl font-bold text-white">80%</div>
                  <div className="text-xs text-white/60">Max LTV</div>
                </div>
                <div className="text-xs text-white/40 text-center mt-4">
                  Premium terms for trusted borrowers
                </div>
              </div>
            </div>

            {/* Platinum */}
            <div className={`p-6 rounded-2xl border-2 ${tier === 'Platinum' ? 'border-purple-500 bg-purple-500/10' : 'border-white/10 bg-white/5'}`}>
              <div className="text-center mb-4">
                <div className="text-2xl font-bold text-purple-400 mb-1">Platinum</div>
                <div className="text-sm text-white/60">Score: 90-100</div>
                {tier === 'Platinum' && <div className="text-xs text-purple-400 mt-2 font-semibold">YOU ARE HERE</div>}
              </div>
              <div className="space-y-3">
                <div className="text-center">
                  <div className="text-3xl font-bold text-white">4%</div>
                  <div className="text-xs text-white/60">APR</div>
                </div>
                <div className="text-center">
                  <div className="text-3xl font-bold text-white">90%</div>
                  <div className="text-xs text-white/60">Max LTV</div>
                </div>
                <div className="text-xs text-white/40 text-center mt-4">
                  Elite rates for top-tier credit
                </div>
              </div>
            </div>
          </div>

          <div className="mt-8 text-center">
            <p className="text-sm text-white/40">
              All rates are calculated on-chain by ScoreOraclePhase3B based on your 5-factor credit assessment
            </p>
          </div>
        </motion.div>

        {/* How It Works */}
        <motion.div
          className="mt-16"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.4 }}
        >
          <h2 className="text-2xl font-bold text-white mb-8 text-center">How It Works</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <StepCard
              number={1}
              title="Choose Amount"
              description="Select how much USDC you want to borrow"
              icon={<DollarSign className="w-6 h-6" />}
            />
            <StepCard
              number={2}
              title="Deposit Collateral"
              description="Lock ETH as collateral based on your LTV"
              icon={<Shield className="w-6 h-6" />}
            />
            <StepCard
              number={3}
              title="Receive Funds"
              description="Get USDC instantly in your wallet"
              icon={<TrendingUp className="w-6 h-6" />}
            />
          </div>
        </motion.div>

        {/* Borrow Modal */}
        <BorrowModal isOpen={showModal} onClose={() => setShowModal(false)} initialAmount={selectedAmount} />
      </div>
    </div>
  );
}

function BorrowCard({
  amount,
  ltv,
  apr,
  popular,
  onClick,
}: {
  amount: number;
  ltv: number;
  apr: number;
  popular?: boolean;
  onClick: () => void;
}) {
  const collateral = (amount / ltv) * 100;
  const monthlyPayment = (amount * (apr / 100)) / 12;

  return (
    <motion.div
      className={`p-6 rounded-2xl border cursor-pointer transition-all hover:scale-105 ${
        popular ? 'border-violet-500/50 bg-violet-500/10' : 'border-white/10 bg-white/5'
      }`}
      onClick={onClick}
      whileHover={{ y: -4 }}
    >
      {popular && (
        <div className="mb-3">
          <span className="px-3 py-1 rounded-full bg-violet-500 text-white text-xs font-semibold">
            Most Popular
          </span>
        </div>
      )}
      <div className="mb-4">
        <div className="text-sm text-white/60 mb-1">Borrow</div>
        <div className="text-4xl font-bold text-white">${amount}</div>
        <div className="text-sm text-white/50 mt-1">USDC</div>
      </div>

      <div className="space-y-2 mb-6">
        <div className="flex justify-between text-sm">
          <span className="text-white/60">Collateral</span>
          <span className="text-white">${collateral.toFixed(0)}</span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-white/60">Interest/mo</span>
          <span className="text-white">${monthlyPayment.toFixed(2)}</span>
        </div>
      </div>

      <button
        className="w-full py-3 rounded-xl font-semibold transition-colors"
        style={{
          background: popular
            ? `linear-gradient(135deg, ${colors.accent.purple}, ${colors.accent.blue})`
            : 'rgba(255, 255, 255, 0.1)',
          color: 'white',
        }}
      >
        Borrow ${amount}
        <ArrowRight className="inline ml-2 w-4 h-4" />
      </button>
    </motion.div>
  );
}

function StepCard({
  number,
  title,
  description,
  icon,
}: {
  number: number;
  title: string;
  description: string;
  icon: React.ReactNode;
}) {
  return (
    <div className="p-6 rounded-2xl bg-white/5 border border-white/10">
      <div className="flex items-center gap-4 mb-4">
        <div
          className="w-12 h-12 rounded-full flex items-center justify-center"
          style={{
            background: `linear-gradient(135deg, ${colors.accent.purple}, ${colors.accent.blue})`,
          }}
        >
          {icon}
        </div>
        <div
          className="text-4xl font-bold"
          style={{
            background: `linear-gradient(135deg, ${colors.accent.purple}, ${colors.accent.blue})`,
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
          }}
        >
          {number}
        </div>
      </div>
      <h3 className="text-xl font-bold text-white mb-2">{title}</h3>
      <p className="text-white/60">{description}</p>
    </div>
  );
}
