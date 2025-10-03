'use client';

import { motion } from 'framer-motion';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { ArrowRight, Shield, TrendingUp, Clock, CheckCircle } from 'lucide-react';

export default function Home() {
  return (
    <div className="min-h-screen">
      {/* Hero Section */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-violet-500/10 via-transparent to-purple-500/10" />

        <div className="container relative mx-auto px-4 py-32">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
            className="max-w-4xl mx-auto text-center"
          >
            <h1 className="text-6xl font-bold mb-6 bg-gradient-to-r from-violet-400 via-purple-400 to-violet-600 bg-clip-text text-transparent">
              Temporal Reputation Lending
            </h1>
            <p className="text-xl text-neutral-400 mb-8 max-w-2xl mx-auto">
              Unlock undercollateralized loans based on your on-chain reputation.
              Higher credit scores mean lower collateral requirements and better rates.
            </p>
            <div className="flex gap-4 justify-center">
              <Link href="/dashboard">
                <Button size="lg" className="bg-violet-600 hover:bg-violet-700">
                  Launch App <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </Link>
              <Link href="/profile">
                <Button size="lg" variant="outline">
                  Calculate Score
                </Button>
              </Link>
            </div>
          </motion.div>

          {/* Stats */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.2 }}
            className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-4xl mx-auto mt-16"
          >
            <Card className="bg-neutral-900/50 border-neutral-800 p-6 backdrop-blur-sm">
              <div className="text-3xl font-bold text-violet-400">$0M</div>
              <div className="text-sm text-neutral-400 mt-1">Total Value Locked</div>
            </Card>
            <Card className="bg-neutral-900/50 border-neutral-800 p-6 backdrop-blur-sm">
              <div className="text-3xl font-bold text-violet-400">0</div>
              <div className="text-sm text-neutral-400 mt-1">Active Loans</div>
            </Card>
            <Card className="bg-neutral-900/50 border-neutral-800 p-6 backdrop-blur-sm">
              <div className="text-3xl font-bold text-violet-400">0%</div>
              <div className="text-sm text-neutral-400 mt-1">Default Rate</div>
            </Card>
          </motion.div>
        </div>
      </section>

      {/* Features */}
      <section className="py-24 bg-neutral-950/50">
        <div className="container mx-auto px-4">
          <h2 className="text-3xl font-bold text-center mb-12">How It Works</h2>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-6xl mx-auto">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5 }}
              viewport={{ once: true }}
            >
              <Card className="bg-neutral-900/50 border-neutral-800 p-8 h-full backdrop-blur-sm">
                <div className="w-12 h-12 rounded-lg bg-violet-500/10 flex items-center justify-center mb-4">
                  <Shield className="h-6 w-6 text-violet-400" />
                </div>
                <h3 className="text-xl font-semibold mb-3">Build Reputation</h3>
                <p className="text-neutral-400">
                  Your on-chain history is analyzed to calculate a credit score (0-1000).
                  Transaction volume, DeFi activity, and repayment history all contribute.
                </p>
              </Card>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.1 }}
              viewport={{ once: true }}
            >
              <Card className="bg-neutral-900/50 border-neutral-800 p-8 h-full backdrop-blur-sm">
                <div className="w-12 h-12 rounded-lg bg-violet-500/10 flex items-center justify-center mb-4">
                  <TrendingUp className="h-6 w-6 text-violet-400" />
                </div>
                <h3 className="text-xl font-semibold mb-3">Unlock Higher LTV</h3>
                <p className="text-neutral-400">
                  Bronze (50%) → Silver (65%) → Gold (75%) → Platinum (90%).
                  Higher tiers unlock better loan terms and lower collateral requirements.
                </p>
              </Card>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.2 }}
              viewport={{ once: true }}
            >
              <Card className="bg-neutral-900/50 border-neutral-800 p-8 h-full backdrop-blur-sm">
                <div className="w-12 h-12 rounded-lg bg-violet-500/10 flex items-center justify-center mb-4">
                  <Clock className="h-6 w-6 text-violet-400" />
                </div>
                <h3 className="text-xl font-semibold mb-3">Grace Periods</h3>
                <p className="text-neutral-400">
                  Higher tiers get 24-72 hour grace periods before liquidation.
                  Insurance fund covers defaults, protecting lenders.
                </p>
              </Card>
            </motion.div>
          </div>
        </div>
      </section>

      {/* Credit Tiers */}
      <section className="py-24">
        <div className="container mx-auto px-4">
          <h2 className="text-3xl font-bold text-center mb-12">Credit Tiers</h2>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-6 max-w-6xl mx-auto">
            {[
              { name: 'Bronze', score: '0-499', ltv: '50%', grace: '24h', color: 'from-amber-700 to-amber-900' },
              { name: 'Silver', score: '500-649', ltv: '65%', grace: '48h', color: 'from-gray-400 to-gray-600' },
              { name: 'Gold', score: '650-799', ltv: '75%', grace: '60h', color: 'from-yellow-400 to-yellow-600' },
              { name: 'Platinum', score: '800-1000', ltv: '90%', grace: '72h', color: 'from-violet-400 to-purple-600' },
            ].map((tier, i) => (
              <Card key={tier.name} className="bg-neutral-900/50 border-neutral-800 p-6 backdrop-blur-sm">
                <div className={`w-full h-2 rounded-full bg-gradient-to-r ${tier.color} mb-4`} />
                <h3 className="text-xl font-bold mb-2">{tier.name}</h3>
                <div className="space-y-2 text-sm text-neutral-400">
                  <div className="flex items-center gap-2">
                    <CheckCircle className="h-4 w-4 text-violet-400" />
                    Score: {tier.score}
                  </div>
                  <div className="flex items-center gap-2">
                    <CheckCircle className="h-4 w-4 text-violet-400" />
                    Max LTV: {tier.ltv}
                  </div>
                  <div className="flex items-center gap-2">
                    <CheckCircle className="h-4 w-4 text-violet-400" />
                    Grace: {tier.grace}
                  </div>
                </div>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-24 bg-gradient-to-br from-violet-500/10 via-transparent to-purple-500/10">
        <div className="container mx-auto px-4 text-center">
          <h2 className="text-4xl font-bold mb-6">Ready to Start Lending?</h2>
          <p className="text-xl text-neutral-400 mb-8 max-w-2xl mx-auto">
            Connect your wallet to calculate your credit score and unlock better loan terms.
          </p>
          <Link href="/dashboard">
            <Button size="lg" className="bg-violet-600 hover:bg-violet-700">
              Launch Dashboard <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </Link>
        </div>
      </section>
    </div>
  );
}
