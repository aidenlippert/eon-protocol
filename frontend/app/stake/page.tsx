'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import { Shield, TrendingUp, AlertTriangle, DollarSign } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useAccount } from 'wagmi';
import { StakeModal } from '@/components/modals/StakeModal';

export default function StakePage() {
  const { address, isConnected } = useAccount();
  const [showStakeModal, setShowStakeModal] = useState(false);
  const [showUnstakeModal, setShowUnstakeModal] = useState(false);
  const [stakeModalType, setStakeModalType] = useState<'stake' | 'unstake'>('stake');

  const handleStake = () => {
    setStakeModalType('stake');
    setShowStakeModal(true);
  };

  const handleUnstake = () => {
    setStakeModalType('unstake');
    setShowStakeModal(true);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-black via-violet-950/20 to-black p-4 md:p-8">
      <div className="max-w-5xl mx-auto">
        <motion.div className="mb-8" initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }}>
          <div className="flex items-center gap-3 mb-6">
            <div className="p-3 rounded-xl bg-gradient-to-br from-violet-500/20 to-purple-500/20 border border-violet-500/30">
              <Shield className="h-8 w-8 text-violet-400" />
            </div>
            <div>
              <h1 className="text-4xl md:text-5xl font-bold text-white">Safety Module</h1>
              <p className="text-white/60">Stake EON to earn protocol fees and secure the protocol</p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <Card className="bg-white/5 border-white/10">
              <CardContent className="pt-6">
                <div className="flex items-center gap-2 mb-1">
                  <DollarSign className="h-4 w-4 text-white/60" />
                  <div className="text-sm text-white/60">TVL</div>
                </div>
                <div className="text-2xl font-bold text-white">$8.5M</div>
              </CardContent>
            </Card>

            <Card className="bg-gradient-to-br from-green-500/10 to-emerald-500/10 border-green-500/30">
              <CardContent className="pt-6">
                <div className="flex items-center gap-2 mb-1">
                  <TrendingUp className="h-4 w-4 text-green-400" />
                  <div className="text-sm text-green-400">APY</div>
                </div>
                <div className="text-2xl font-bold text-green-400">12.4%</div>
              </CardContent>
            </Card>

            <Card className="bg-white/5 border-white/10">
              <CardContent className="pt-6">
                <div className="flex items-center gap-2 mb-1">
                  <Shield className="h-4 w-4 text-white/60" />
                  <div className="text-sm text-white/60">Your Stake</div>
                </div>
                <div className="text-2xl font-bold text-white">{isConnected ? '0 EON' : '—'}</div>
              </CardContent>
            </Card>

            <Card className="bg-white/5 border-white/10">
              <CardContent className="pt-6">
                <div className="flex items-center gap-2 mb-1">
                  <DollarSign className="h-4 w-4 text-white/60" />
                  <div className="text-sm text-white/60">Pending Rewards</div>
                </div>
                <div className="text-2xl font-bold text-white">{isConnected ? '0 EON' : '—'}</div>
              </CardContent>
            </Card>
          </div>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
          <Card className="bg-white/5 border-white/10">
            <CardContent className="pt-6">
              <Tabs defaultValue="stake">
                <TabsList className="bg-white/5 border border-white/10 w-full">
                  <TabsTrigger value="stake" className="flex-1">Stake</TabsTrigger>
                  <TabsTrigger value="unstake" className="flex-1">Unstake</TabsTrigger>
                </TabsList>

                <TabsContent value="stake" className="mt-6">
                  <div className="space-y-6">
                    <div className="bg-gradient-to-br from-green-500/10 to-emerald-500/10 border border-green-500/30 rounded-xl p-6">
                      <h3 className="text-xl font-bold text-white mb-4">APY Calculator</h3>
                      <div className="grid grid-cols-3 gap-4 text-center">
                        <div>
                          <div className="text-sm text-white/60 mb-1">Daily</div>
                          <div className="text-lg font-bold text-white">0.034%</div>
                          <div className="text-xs text-white/50">~$0.34 per $1000</div>
                        </div>
                        <div>
                          <div className="text-sm text-white/60 mb-1">Monthly</div>
                          <div className="text-lg font-bold text-white">1.03%</div>
                          <div className="text-xs text-white/50">~$10.30 per $1000</div>
                        </div>
                        <div>
                          <div className="text-sm text-white/60 mb-1">Yearly</div>
                          <div className="text-lg font-bold text-green-400">12.4%</div>
                          <div className="text-xs text-white/50">~$124 per $1000</div>
                        </div>
                      </div>
                    </div>

                    <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-xl p-4">
                      <div className="flex items-start gap-3">
                        <AlertTriangle className="w-5 h-5 text-yellow-400 flex-shrink-0 mt-0.5" />
                        <div>
                          <div className="font-semibold text-yellow-400">Slashing Risk</div>
                          <div className="text-sm text-yellow-400/80 mt-1">
                            Staked EON may be slashed up to 30% during shortfall events to cover protocol losses
                          </div>
                        </div>
                      </div>
                    </div>

                    <Button onClick={handleStake} className="w-full h-14 text-lg bg-violet-600 hover:bg-violet-700">
                      Stake EON
                    </Button>

                    <div className="bg-white/5 rounded-xl p-6">
                      <h4 className="font-semibold text-white mb-3">How it Works</h4>
                      <div className="space-y-3 text-sm text-white/70">
                        <div className="flex gap-3">
                          <div className="text-violet-400 font-bold">1.</div>
                          <div>Stake your EON tokens to the Safety Module</div>
                        </div>
                        <div className="flex gap-3">
                          <div className="text-violet-400 font-bold">2.</div>
                          <div>Earn protocol fees from flash loans and borrowing</div>
                        </div>
                        <div className="flex gap-3">
                          <div className="text-violet-400 font-bold">3.</div>
                          <div>Help secure the protocol against bad debt</div>
                        </div>
                        <div className="flex gap-3">
                          <div className="text-violet-400 font-bold">4.</div>
                          <div>Unstake anytime after 10-day cooldown period</div>
                        </div>
                      </div>
                    </div>
                  </div>
                </TabsContent>

                <TabsContent value="unstake" className="mt-6">
                  <div className="space-y-6">
                    <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-4">
                      <div className="flex items-start gap-3">
                        <AlertTriangle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
                        <div>
                          <div className="font-semibold text-red-400">Unstaking Process</div>
                          <ul className="text-sm text-red-400/80 mt-2 space-y-1">
                            <li>• 10-day cooldown period after activation</li>
                            <li>• 2-day window to withdraw after cooldown</li>
                            <li>• No rewards earned during cooldown</li>
                          </ul>
                        </div>
                      </div>
                    </div>

                    <Button onClick={handleUnstake} variant="outline" className="w-full h-14 text-lg border-white/20 hover:bg-white/10">
                      Unstake EON
                    </Button>
                  </div>
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>
        </motion.div>
      </div>

      <StakeModal isOpen={showStakeModal} onClose={() => setShowStakeModal(false)} type={stakeModalType} />
    </div>
  );
}
