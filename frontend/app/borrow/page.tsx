'use client';

import { useState, useEffect } from 'react';
import { useAccount } from 'wagmi';
import { motion } from 'framer-motion';
import { DollarSign, TrendingUp, Shield, Sparkles, ArrowRight } from 'lucide-react';
import { BorrowModal } from '@/components/modals/BorrowModal';
import { colors } from '@/lib/design-tokens';

interface ScoreData {
  score: number;
  tier: string;
}

export default function BorrowPage() {
  const { address, isConnected } = useAccount();
  const [showModal, setShowModal] = useState(false);
  const [selectedAmount, setSelectedAmount] = useState(100);
  const [scoreData, setScoreData] = useState<ScoreData | null>(null);

  useEffect(() => {
    if (address) {
      fetch(`/api/score/${address}`)
        .then((res) => res.json())
        .then((data) => setScoreData(data))
        .catch((err) => console.error('[Borrow] Score fetch error:', err));
    }
  }, [address]);

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

  const { score, tier } = scoreData || { score: 0, tier: 'Loading...' };

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
    const ltv = { Bronze: 50, Silver: 60, Gold: 70, Platinum: 80 };
    return ltv[tier as keyof typeof ltv] || 50;
  };

  const getAPRByTier = (tier: string) => {
    const apr = { Bronze: 12, Silver: 10, Gold: 7, Platinum: 5 };
    return apr[tier as keyof typeof apr] || 12;
  };

  const ltv = getLTVByTier(tier);
  const apr = getAPRByTier(tier);

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
              <div className="text-xs text-white/50 mt-1">out of 1000</div>
            </div>
            <div className="p-4 rounded-xl bg-white/5 border border-white/10">
              <div className="text-sm text-white/60 mb-1">Interest Rate</div>
              <div className="text-3xl font-bold text-green-400">{apr}%</div>
              <div className="text-xs text-white/50 mt-1">APR</div>
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

        {/* How It Works */}
        <motion.div
          className="mt-16"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.3 }}
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
