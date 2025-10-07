'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import {
  Shield,
  TrendingUp,
  Clock,
  AlertTriangle,
  Info,
  Zap,
  DollarSign,
  Lock
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useAccount } from 'wagmi';

/**
 * @title Staking Page (Safety Module)
 * @notice Aave-inspired staking interface
 * @dev Stake EON to earn rewards and provide protocol insurance
 */
export default function StakePage() {
  const { address, isConnected } = useAccount();
  const [stakeAmount, setStakeAmount] = useState('');
  const [unstakeAmount, setUnstakeAmount] = useState('');
  const [activeTab, setActiveTab] = useState('stake');

  // Mock data - will be replaced with actual contract calls
  const safetyModuleStats = {
    totalStaked: '$12,450,000',
    apy: '7.2%',
    yourStake: '50,000',
    yourRewards: '1,234',
    cooldownStatus: null, // or { endTime: '...' }
    slashingRisk: '30%',
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-black via-violet-950/20 to-black p-4 md:p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <motion.div
          className="mb-8"
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <div className="flex items-center gap-3 mb-4">
            <div className="p-3 rounded-xl bg-gradient-to-br from-violet-500/20 to-purple-500/20 border border-violet-500/30">
              <Shield className="h-8 w-8 text-violet-400" />
            </div>
            <div>
              <h1 className="text-4xl md:text-5xl font-bold text-white">
                Safety Module
              </h1>
              <p className="text-white/60">
                Stake EON to earn rewards and protect the protocol
              </p>
            </div>
          </div>

          {/* Warning Banner */}
          <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-xl p-4 flex items-start gap-3">
            <AlertTriangle className="h-5 w-5 text-yellow-400 flex-shrink-0 mt-0.5" />
            <div className="text-sm text-yellow-400">
              <div className="font-semibold mb-1">Slashing Risk</div>
              <div className="text-yellow-400/80">
                Staked EON may be slashed up to {safetyModuleStats.slashingRisk} during shortfall events to cover protocol bad debt. In return, you earn {safetyModuleStats.apy} APY from protocol fees.
              </div>
            </div>
          </div>
        </motion.div>

        {/* Stats Grid */}
        <motion.div
          className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
        >
          <Card className="bg-white/5 border-white/10">
            <CardContent className="pt-6">
              <div className="flex items-center gap-2 mb-2">
                <DollarSign className="h-4 w-4 text-white/60" />
                <div className="text-sm text-white/60">Total Value Locked</div>
              </div>
              <div className="text-3xl font-bold text-white">{safetyModuleStats.totalStaked}</div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-green-500/10 to-emerald-500/10 border-green-500/30">
            <CardContent className="pt-6">
              <div className="flex items-center gap-2 mb-2">
                <TrendingUp className="h-4 w-4 text-green-400" />
                <div className="text-sm text-green-400">Current APY</div>
              </div>
              <div className="text-3xl font-bold text-green-400">{safetyModuleStats.apy}</div>
            </CardContent>
          </Card>

          <Card className="bg-white/5 border-white/10">
            <CardContent className="pt-6">
              <div className="flex items-center gap-2 mb-2">
                <Lock className="h-4 w-4 text-white/60" />
                <div className="text-sm text-white/60">Your Staked EON</div>
              </div>
              <div className="text-3xl font-bold text-violet-400">{safetyModuleStats.yourStake}</div>
            </CardContent>
          </Card>

          <Card className="bg-white/5 border-white/10">
            <CardContent className="pt-6">
              <div className="flex items-center gap-2 mb-2">
                <Zap className="h-4 w-4 text-white/60" />
                <div className="text-sm text-white/60">Pending Rewards</div>
              </div>
              <div className="text-3xl font-bold text-yellow-400">{safetyModuleStats.yourRewards}</div>
              <Button size="sm" variant="outline" className="mt-2">
                Claim
              </Button>
            </CardContent>
          </Card>
        </motion.div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main Staking Card */}
          <motion.div
            className="lg:col-span-2"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
          >
            <Card className="bg-white/5 border-white/10">
              <CardHeader>
                <CardTitle className="text-white">Stake / Unstake</CardTitle>
                <CardDescription className="text-white/60">
                  Earn rewards by staking EON tokens
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Tabs value={activeTab} onValueChange={setActiveTab}>
                  <TabsList className="bg-white/5 border border-white/10 w-full">
                    <TabsTrigger value="stake" className="flex-1">Stake</TabsTrigger>
                    <TabsTrigger value="unstake" className="flex-1">Unstake</TabsTrigger>
                  </TabsList>

                  <TabsContent value="stake" className="space-y-4">
                    <div>
                      <div className="flex justify-between text-sm mb-2">
                        <span className="text-white/60">Amount to Stake</span>
                        <span className="text-white/60">Balance: 100,000 EON</span>
                      </div>
                      <div className="relative">
                        <input
                          type="number"
                          placeholder="0.00"
                          value={stakeAmount}
                          onChange={(e) => setStakeAmount(e.target.value)}
                          className="w-full bg-white/10 border border-white/20 rounded-lg px-4 py-3 text-white text-xl placeholder:text-white/40"
                        />
                        <Button
                          size="sm"
                          variant="outline"
                          className="absolute right-2 top-1/2 -translate-y-1/2"
                          onClick={() => setStakeAmount('100000')}
                        >
                          MAX
                        </Button>
                      </div>
                    </div>

                    {/* Stake Preview */}
                    <div className="bg-white/5 border border-white/10 rounded-lg p-4 space-y-2">
                      <div className="flex justify-between text-sm">
                        <span className="text-white/60">APY</span>
                        <span className="text-green-400 font-semibold">{safetyModuleStats.apy}</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-white/60">Daily Rewards (estimate)</span>
                        <span className="text-white">
                          {stakeAmount ? ((parseFloat(stakeAmount) * 0.072) / 365).toFixed(2) : '0.00'} EON
                        </span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-white/60">Monthly Rewards (estimate)</span>
                        <span className="text-white">
                          {stakeAmount ? ((parseFloat(stakeAmount) * 0.072) / 12).toFixed(2) : '0.00'} EON
                        </span>
                      </div>
                    </div>

                    <Button className="w-full bg-gradient-to-r from-violet-600 to-purple-600 hover:from-violet-700 hover:to-purple-700 py-6 text-lg">
                      Stake EON
                    </Button>

                    <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-3 flex items-start gap-2 text-sm">
                      <Info className="h-4 w-4 text-blue-400 flex-shrink-0 mt-0.5" />
                      <div className="text-blue-400">
                        Staked EON provides insurance for the protocol. You can unstake after a 10-day cooldown period.
                      </div>
                    </div>
                  </TabsContent>

                  <TabsContent value="unstake" className="space-y-4">
                    {!safetyModuleStats.cooldownStatus ? (
                      <>
                        <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-4 flex items-start gap-3">
                          <Clock className="h-5 w-5 text-yellow-400 flex-shrink-0" />
                          <div className="text-sm text-yellow-400">
                            <div className="font-semibold mb-1">Cooldown Not Active</div>
                            <div className="text-yellow-400/80">
                              You must activate the 10-day cooldown period before unstaking. After cooldown, you have 2 days to unstake.
                            </div>
                          </div>
                        </div>

                        <Button className="w-full bg-yellow-600 hover:bg-yellow-700 py-6 text-lg">
                          Activate Cooldown (10 days)
                        </Button>
                      </>
                    ) : (
                      <>
                        <div className="bg-green-500/10 border border-green-500/30 rounded-lg p-4 flex items-start gap-3">
                          <Clock className="h-5 w-5 text-green-400 flex-shrink-0" />
                          <div className="text-sm text-green-400">
                            <div className="font-semibold mb-1">Cooldown Active</div>
                            <div className="text-green-400/80">
                              Unstaking available in: 7 days, 12 hours
                            </div>
                          </div>
                        </div>

                        <div>
                          <div className="flex justify-between text-sm mb-2">
                            <span className="text-white/60">Amount to Unstake</span>
                            <span className="text-white/60">Staked: {safetyModuleStats.yourStake} EON</span>
                          </div>
                          <div className="relative">
                            <input
                              type="number"
                              placeholder="0.00"
                              value={unstakeAmount}
                              onChange={(e) => setUnstakeAmount(e.target.value)}
                              className="w-full bg-white/10 border border-white/20 rounded-lg px-4 py-3 text-white text-xl placeholder:text-white/40"
                            />
                            <Button
                              size="sm"
                              variant="outline"
                              className="absolute right-2 top-1/2 -translate-y-1/2"
                              onClick={() => setUnstakeAmount(safetyModuleStats.yourStake)}
                            >
                              MAX
                            </Button>
                          </div>
                        </div>

                        <Button className="w-full bg-red-600 hover:bg-red-700 py-6 text-lg" disabled>
                          Unstake (Available in 7d 12h)
                        </Button>
                      </>
                    )}
                  </TabsContent>
                </Tabs>
              </CardContent>
            </Card>
          </motion.div>

          {/* Info Sidebar */}
          <motion.div
            className="space-y-4"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.3 }}
          >
            {/* How it Works */}
            <Card className="bg-white/5 border-white/10">
              <CardHeader>
                <CardTitle className="text-white text-lg">How it Works</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-sm text-white/70">
                <div className="flex gap-3">
                  <div className="flex-shrink-0 w-6 h-6 rounded-full bg-violet-500/20 border border-violet-500/30 flex items-center justify-center text-violet-400 font-semibold">
                    1
                  </div>
                  <div>
                    <div className="text-white font-medium mb-1">Stake EON</div>
                    <div>Lock your EON tokens to earn protocol fee rewards</div>
                  </div>
                </div>

                <div className="flex gap-3">
                  <div className="flex-shrink-0 w-6 h-6 rounded-full bg-violet-500/20 border border-violet-500/30 flex items-center justify-center text-violet-400 font-semibold">
                    2
                  </div>
                  <div>
                    <div className="text-white font-medium mb-1">Earn Rewards</div>
                    <div>Receive ~7% APY from lending protocol fees</div>
                  </div>
                </div>

                <div className="flex gap-3">
                  <div className="flex-shrink-0 w-6 h-6 rounded-full bg-violet-500/20 border border-violet-500/30 flex items-center justify-center text-violet-400 font-semibold">
                    3
                  </div>
                  <div>
                    <div className="text-white font-medium mb-1">Provide Insurance</div>
                    <div>Your stake acts as protocol insurance against bad debt</div>
                  </div>
                </div>

                <div className="flex gap-3">
                  <div className="flex-shrink-0 w-6 h-6 rounded-full bg-violet-500/20 border border-violet-500/30 flex items-center justify-center text-violet-400 font-semibold">
                    4
                  </div>
                  <div>
                    <div className="text-white font-medium mb-1">Unstake</div>
                    <div>10-day cooldown + 2-day unstake window</div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Slashing Info */}
            <Card className="bg-red-500/10 border-red-500/30">
              <CardHeader>
                <CardTitle className="text-white text-lg flex items-center gap-2">
                  <AlertTriangle className="h-5 w-5 text-red-400" />
                  Slashing Risk
                </CardTitle>
              </CardHeader>
              <CardContent className="text-sm text-red-400/80 space-y-2">
                <p>
                  During shortfall events (protocol bad debt), up to {safetyModuleStats.slashingRisk} of staked EON may be slashed to cover losses.
                </p>
                <p>
                  This mechanism protects lenders and maintains protocol solvency. In return, stakers earn higher APY.
                </p>
              </CardContent>
            </Card>

            {/* Stats Card */}
            <Card className="bg-white/5 border-white/10">
              <CardHeader>
                <CardTitle className="text-white text-lg">Safety Module Stats</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                <div className="flex justify-between">
                  <span className="text-white/60">Total Stakers</span>
                  <span className="text-white font-semibold">1,247</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-white/60">Average Stake</span>
                  <span className="text-white font-semibold">9,972 EON</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-white/60">Total Rewards Paid</span>
                  <span className="text-white font-semibold">$892,450</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-white/60">Slashing Events</span>
                  <span className="text-white font-semibold">0</span>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        </div>
      </div>
    </div>
  );
}
