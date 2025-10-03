'use client';

import { motion } from 'framer-motion';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ArrowRight, Shield, TrendingUp, Clock, CheckCircle, Sparkles, Lock, Zap, BarChart3, Award, Users } from 'lucide-react';

export default function Home() {
  return (
    <div className="min-h-screen">
      {/* Hero Section - Enhanced */}
      <section className="relative overflow-hidden bg-gradient-to-b from-neutral-950 via-neutral-900 to-neutral-950">
        {/* Animated background gradients */}
        <div className="absolute inset-0">
          <div className="absolute inset-0 bg-gradient-to-br from-violet-600/20 via-purple-600/10 to-blue-600/20 opacity-30 blur-3xl" />
          <div className="absolute top-1/4 -left-1/4 w-1/2 h-1/2 bg-violet-500/30 rounded-full blur-[120px]" />
          <div className="absolute bottom-1/4 -right-1/4 w-1/2 h-1/2 bg-purple-500/30 rounded-full blur-[120px]" />
        </div>

        <div className="container relative mx-auto px-4 py-24 lg:py-32">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
            className="max-w-5xl mx-auto text-center"
          >
            {/* Badge */}
            <motion.div
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.5 }}
              className="inline-flex items-center gap-2 mb-6"
            >
              <Badge className="bg-violet-500/10 text-violet-400 border-violet-500/20 px-4 py-1.5 text-sm font-medium">
                <Sparkles className="h-3.5 w-3.5 mr-1.5" />
                Credit-Based DeFi Lending
              </Badge>
            </motion.div>

            {/* Main Heading */}
            <h1 className="text-5xl md:text-7xl font-bold mb-6 tracking-tight">
              <span className="bg-gradient-to-r from-white via-violet-200 to-violet-400 bg-clip-text text-transparent">
                Undercollateralized Loans
              </span>
              <br />
              <span className="text-white">Based on Reputation</span>
            </h1>

            {/* Subheading */}
            <p className="text-lg md:text-xl text-neutral-400 mb-10 max-w-3xl mx-auto leading-relaxed">
              Eon Protocol brings traditional credit scoring to DeFi. Build your on-chain reputation,
              unlock higher LTV ratios, and borrow with confidence.
            </p>

            {/* CTA Buttons */}
            <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
              <Link href="/profile">
                <Button size="lg" className="bg-violet-600 hover:bg-violet-700 shadow-lg shadow-violet-600/50 text-base px-8">
                  Calculate Your Score
                  <ArrowRight className="ml-2 h-5 w-5" />
                </Button>
              </Link>
              <Link href="/dashboard">
                <Button size="lg" variant="outline" className="border-neutral-700 hover:bg-neutral-800 text-base px-8">
                  View Dashboard
                </Button>
              </Link>
            </div>

            {/* Trust Indicators */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.8, delay: 0.3 }}
              className="mt-12 flex flex-wrap items-center justify-center gap-6 text-sm text-neutral-500"
            >
              <div className="flex items-center gap-2">
                <Shield className="h-4 w-4 text-violet-400" />
                <span>Audited Smart Contracts</span>
              </div>
              <div className="flex items-center gap-2">
                <Lock className="h-4 w-4 text-violet-400" />
                <span>Non-Custodial</span>
              </div>
              <div className="flex items-center gap-2">
                <Zap className="h-4 w-4 text-violet-400" />
                <span>Instant Settlement</span>
              </div>
            </motion.div>
          </motion.div>

          {/* Stats Cards - Enhanced */}
          <motion.div
            initial={{ opacity: 0, y: 40 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.4 }}
            className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-4xl mx-auto mt-20"
          >
            <Card className="bg-neutral-900/80 border-neutral-800 backdrop-blur-xl p-8 hover:border-violet-500/50 transition-all duration-300 group">
              <div className="flex items-start justify-between mb-3">
                <div className="w-12 h-12 rounded-xl bg-violet-500/10 flex items-center justify-center group-hover:bg-violet-500/20 transition-colors">
                  <BarChart3 className="h-6 w-6 text-violet-400" />
                </div>
              </div>
              <div className="text-4xl font-bold text-white mb-2">$0M</div>
              <div className="text-sm text-neutral-400">Total Value Locked</div>
            </Card>

            <Card className="bg-neutral-900/80 border-neutral-800 backdrop-blur-xl p-8 hover:border-violet-500/50 transition-all duration-300 group">
              <div className="flex items-start justify-between mb-3">
                <div className="w-12 h-12 rounded-xl bg-violet-500/10 flex items-center justify-center group-hover:bg-violet-500/20 transition-colors">
                  <Users className="h-6 w-6 text-violet-400" />
                </div>
              </div>
              <div className="text-4xl font-bold text-white mb-2">0</div>
              <div className="text-sm text-neutral-400">Active Borrowers</div>
            </Card>

            <Card className="bg-neutral-900/80 border-neutral-800 backdrop-blur-xl p-8 hover:border-violet-500/50 transition-all duration-300 group">
              <div className="flex items-start justify-between mb-3">
                <div className="w-12 h-12 rounded-xl bg-green-500/10 flex items-center justify-center group-hover:bg-green-500/20 transition-colors">
                  <Award className="h-6 w-6 text-green-400" />
                </div>
              </div>
              <div className="text-4xl font-bold text-white mb-2">0%</div>
              <div className="text-sm text-neutral-400">Default Rate</div>
            </Card>
          </motion.div>
        </div>
      </section>

      {/* How It Works - Enhanced */}
      <section className="py-24 lg:py-32 bg-neutral-950 relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-neutral-900 to-neutral-950" />

        <div className="container relative mx-auto px-4">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            viewport={{ once: true }}
            className="text-center mb-16"
          >
            <Badge className="bg-violet-500/10 text-violet-400 border-violet-500/20 mb-4">
              How It Works
            </Badge>
            <h2 className="text-4xl md:text-5xl font-bold mb-4">
              Three Simple Steps
            </h2>
            <p className="text-xl text-neutral-400 max-w-2xl mx-auto">
              Start borrowing with lower collateral in minutes
            </p>
          </motion.div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-6xl mx-auto">
            {[
              {
                icon: Shield,
                step: '01',
                title: 'Build Your Reputation',
                description: 'Connect your wallet and we\'ll analyze your on-chain history. Transaction volume, DeFi activity, repayment history, and time in market all contribute to your credit score.',
                color: 'violet'
              },
              {
                icon: TrendingUp,
                step: '02',
                title: 'Unlock Higher LTV',
                description: 'Your credit score determines your tier and benefits. Move from Bronze (50% LTV) to Platinum (90% LTV) as you build reputation and maintain good borrowing behavior.',
                color: 'purple'
              },
              {
                icon: Clock,
                step: '03',
                title: 'Borrow with Confidence',
                description: 'Higher tiers get extended grace periods (24-72 hours) before liquidation. Our insurance fund protects lenders, creating a sustainable lending ecosystem.',
                color: 'blue'
              }
            ].map((item, i) => (
              <motion.div
                key={item.title}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: i * 0.1 }}
                viewport={{ once: true }}
              >
                <Card className="bg-neutral-900/50 border-neutral-800 p-8 h-full hover:border-violet-500/50 transition-all duration-300 backdrop-blur-sm group">
                  <div className="mb-6">
                    <div className={`w-14 h-14 rounded-2xl bg-${item.color}-500/10 flex items-center justify-center mb-4 group-hover:bg-${item.color}-500/20 transition-colors`}>
                      <item.icon className={`h-7 w-7 text-${item.color}-400`} />
                    </div>
                    <Badge variant="outline" className="text-xs font-mono text-neutral-500 border-neutral-700">
                      STEP {item.step}
                    </Badge>
                  </div>
                  <h3 className="text-2xl font-semibold mb-4">{item.title}</h3>
                  <p className="text-neutral-400 leading-relaxed">
                    {item.description}
                  </p>
                </Card>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Credit Tiers - Enhanced */}
      <section className="py-24 lg:py-32 bg-gradient-to-b from-neutral-950 via-neutral-900 to-neutral-950 relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-violet-600/5 via-purple-600/5 to-blue-600/5" />

        <div className="container relative mx-auto px-4">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            viewport={{ once: true }}
            className="text-center mb-16"
          >
            <Badge className="bg-violet-500/10 text-violet-400 border-violet-500/20 mb-4">
              Credit Tiers
            </Badge>
            <h2 className="text-4xl md:text-5xl font-bold mb-4">
              Your Path to Better Rates
            </h2>
            <p className="text-xl text-neutral-400 max-w-2xl mx-auto">
              Progress through tiers to unlock better loan terms
            </p>
          </motion.div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 max-w-7xl mx-auto">
            {[
              { name: 'Bronze', score: '300-579', ltv: '50%', grace: '24h', rate: '12%', color: 'from-amber-600 to-amber-800', icon: '🥉' },
              { name: 'Silver', score: '580-669', ltv: '65%', grace: '48h', rate: '10%', color: 'from-gray-400 to-gray-600', icon: '🥈' },
              { name: 'Gold', score: '670-799', ltv: '75%', grace: '60h', rate: '8%', color: 'from-yellow-400 to-yellow-600', icon: '🥇' },
              { name: 'Platinum', score: '800-850', ltv: '90%', grace: '72h', rate: '6%', color: 'from-violet-400 to-purple-600', icon: '💎' },
            ].map((tier, i) => (
              <motion.div
                key={tier.name}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: i * 0.1 }}
                viewport={{ once: true }}
              >
                <Card className="bg-neutral-900/50 border-neutral-800 p-6 backdrop-blur-sm hover:border-violet-500/50 transition-all duration-300 group h-full">
                  <div className={`w-full h-1.5 rounded-full bg-gradient-to-r ${tier.color} mb-6`} />

                  <div className="text-center mb-6">
                    <div className="text-4xl mb-3">{tier.icon}</div>
                    <h3 className="text-2xl font-bold mb-1">{tier.name}</h3>
                    <p className="text-sm text-neutral-500">Score: {tier.score}</p>
                  </div>

                  <div className="space-y-3">
                    <div className="flex items-center justify-between p-3 bg-neutral-950/50 rounded-lg">
                      <span className="text-sm text-neutral-400">Max LTV</span>
                      <span className="text-sm font-semibold text-white">{tier.ltv}</span>
                    </div>
                    <div className="flex items-center justify-between p-3 bg-neutral-950/50 rounded-lg">
                      <span className="text-sm text-neutral-400">Interest Rate</span>
                      <span className="text-sm font-semibold text-green-400">{tier.rate}</span>
                    </div>
                    <div className="flex items-center justify-between p-3 bg-neutral-950/50 rounded-lg">
                      <span className="text-sm text-neutral-400">Grace Period</span>
                      <span className="text-sm font-semibold text-white">{tier.grace}</span>
                    </div>
                  </div>
                </Card>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section - Enhanced */}
      <section className="py-24 lg:py-32 bg-gradient-to-br from-violet-600/10 via-purple-600/5 to-blue-600/10 relative overflow-hidden">
        <div className="absolute inset-0">
          <div className="absolute inset-0 bg-gradient-to-r from-violet-500/10 via-purple-500/10 to-blue-500/10 blur-3xl" />
        </div>

        <div className="container relative mx-auto px-4">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            viewport={{ once: true }}
            className="max-w-4xl mx-auto text-center"
          >
            <h2 className="text-4xl md:text-5xl font-bold mb-6">
              Ready to Get Started?
            </h2>
            <p className="text-xl text-neutral-400 mb-10 max-w-2xl mx-auto leading-relaxed">
              Connect your wallet, calculate your credit score, and start borrowing
              with lower collateral requirements today.
            </p>

            <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
              <Link href="/profile">
                <Button size="lg" className="bg-violet-600 hover:bg-violet-700 shadow-lg shadow-violet-600/50 text-base px-8">
                  Calculate My Score
                  <ArrowRight className="ml-2 h-5 w-5" />
                </Button>
              </Link>
              <Link href="/dashboard">
                <Button size="lg" variant="outline" className="border-neutral-700 hover:bg-neutral-800 text-base px-8">
                  Explore Dashboard
                </Button>
              </Link>
            </div>

            <div className="mt-12 flex flex-wrap items-center justify-center gap-8 text-sm text-neutral-500">
              <div className="flex items-center gap-2">
                <CheckCircle className="h-5 w-5 text-green-400" />
                <span>No Credit Check Required</span>
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle className="h-5 w-5 text-green-400" />
                <span>Instant Approval</span>
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle className="h-5 w-5 text-green-400" />
                <span>No Hidden Fees</span>
              </div>
            </div>
          </motion.div>
        </div>
      </section>
    </div>
  );
}
