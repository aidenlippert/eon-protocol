'use client';

import { motion } from 'framer-motion';
import { Vote, Users, Clock, AlertCircle } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useAccount } from 'wagmi';
import { useState } from 'react';
import { DelegateModal } from '@/components/modals/DelegateModal';

export default function GovernancePage() {
  const { isConnected } = useAccount();
  const [showDelegateModal, setShowDelegateModal] = useState(false);

  return (
    <div className="min-h-screen bg-gradient-to-br from-black via-violet-950/20 to-black p-4 md:p-8">
      <div className="max-w-7xl mx-auto">
        <motion.div className="mb-8" initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }}>
          <div className="flex items-center gap-3 mb-6">
            <div className="p-3 rounded-xl bg-violet-500/20 border border-violet-500/30">
              <Vote className="h-8 w-8 text-violet-400" />
            </div>
            <div>
              <h1 className="text-4xl md:text-5xl font-bold text-white">Governance</h1>
              <p className="text-white/60">Vote on proposals and shape the future of EON Protocol</p>
            </div>
          </div>
        </motion.div>

        {/* Coming Soon Notice */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
          <Card className="bg-violet-500/10 border-violet-500/30 mb-8">
            <CardContent className="pt-6">
              <div className="flex items-start gap-4">
                <AlertCircle className="h-6 w-6 text-violet-400 flex-shrink-0 mt-1" />
                <div>
                  <h3 className="text-lg font-semibold text-white mb-2">Governance Coming Soon</h3>
                  <p className="text-white/60 mb-4">
                    The EON governance token and EONGovernor contract are currently being deployed. Once live, EON holders will be able to:
                  </p>
                  <ul className="space-y-2 text-white/60">
                    <li className="flex items-center gap-2">
                      <div className="w-1.5 h-1.5 rounded-full bg-violet-400" />
                      Create and vote on protocol parameter changes
                    </li>
                    <li className="flex items-center gap-2">
                      <div className="w-1.5 h-1.5 rounded-full bg-violet-400" />
                      Propose new collateral assets and their risk parameters
                    </li>
                    <li className="flex items-center gap-2">
                      <div className="w-1.5 h-1.5 rounded-full bg-violet-400" />
                      Adjust fee structures and interest rate models
                    </li>
                    <li className="flex items-center gap-2">
                      <div className="w-1.5 h-1.5 rounded-full bg-violet-400" />
                      Allocate community treasury funds
                    </li>
                  </ul>
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* Stats Grid */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
            <Card className="bg-white/5 border-white/10">
              <CardContent className="pt-6">
                <div className="flex items-center gap-2 mb-1">
                  <Vote className="h-4 w-4 text-white/60" />
                  <div className="text-sm text-white/60">Total Proposals</div>
                </div>
                <div className="text-2xl font-bold text-white">0</div>
                <div className="text-xs text-white/40 mt-1">Pending deployment</div>
              </CardContent>
            </Card>

            <Card className="bg-white/5 border-white/10">
              <CardContent className="pt-6">
                <div className="flex items-center gap-2 mb-1">
                  <Clock className="h-4 w-4 text-white/60" />
                  <div className="text-sm text-white/60">Active</div>
                </div>
                <div className="text-2xl font-bold text-white">0</div>
                <div className="text-xs text-white/40 mt-1">No active votes</div>
              </CardContent>
            </Card>

            <Card className="bg-white/5 border-white/10">
              <CardContent className="pt-6">
                <div className="flex items-center gap-2 mb-1">
                  <Users className="h-4 w-4 text-white/60" />
                  <div className="text-sm text-white/60">Your Voting Power</div>
                </div>
                <div className="text-2xl font-bold text-white">{isConnected ? '0' : '-'}</div>
                <div className="text-xs text-white/40 mt-1">EON tokens</div>
              </CardContent>
            </Card>

            <Card className="bg-white/5 border-white/10">
              <CardContent className="pt-6">
                <div className="flex items-center gap-2 mb-1">
                  <Vote className="h-4 w-4 text-white/60" />
                  <div className="text-sm text-white/60">Delegation</div>
                </div>
                <div className="text-2xl font-bold text-white">-</div>
                <div className="text-xs text-white/40 mt-1">Not yet available</div>
              </CardContent>
            </Card>
          </div>
        </motion.div>

        {/* No Proposals Yet */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
          <Card className="bg-white/5 border-white/10">
            <CardHeader>
              <CardTitle className="text-white">Active Proposals</CardTitle>
              <CardDescription>On-chain governance proposals will appear here</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-center py-16">
                <Vote className="h-16 w-16 text-white/10 mx-auto mb-4" />
                <h3 className="text-lg font-semibold text-white/60 mb-2">No Active Proposals</h3>
                <p className="text-white/40 mb-6">
                  Governance proposals will appear here once the EON token and EONGovernor contracts are deployed.
                </p>
                <Button disabled variant="outline" className="border-white/20">
                  <Vote className="mr-2 h-4 w-4" />
                  Create Proposal (Coming Soon)
                </Button>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </div>

      <DelegateModal isOpen={showDelegateModal} onClose={() => setShowDelegateModal(false)} />
    </div>
  );
}
