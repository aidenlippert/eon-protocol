'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import { Vote, Users, TrendingUp, Clock } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useAccount } from 'wagmi';
import { VoteModal } from '@/components/modals/VoteModal';
import { DelegateModal } from '@/components/modals/DelegateModal';

export default function GovernancePage() {
  const { address, isConnected } = useAccount();
  const [selectedProposal, setSelectedProposal] = useState<any>(null);
  const [showVoteModal, setShowVoteModal] = useState(false);
  const [showDelegateModal, setShowDelegateModal] = useState(false);

  const proposals = [
    {
      id: 1,
      title: 'Increase Liquidation Bonus to 8%',
      description: 'Proposal to increase liquidation incentive from 7% to 8% to improve protocol safety',
      status: 'Active',
      forVotes: '2.45M EON',
      againstVotes: '450K EON',
      timeLeft: '2 days',
    },
    {
      id: 2,
      title: 'Add USDT as Collateral Asset',
      description: 'Enable USDT as an accepted collateral asset with 80% LTV',
      status: 'Active',
      forVotes: '3.20M EON',
      againstVotes: '120K EON',
      timeLeft: '4 days',
    },
  ];

  const handleVote = (proposal: any) => {
    setSelectedProposal(proposal);
    setShowVoteModal(true);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-black via-violet-950/20 to-black p-4 md:p-8">
      <div className="max-w-7xl mx-auto">
        <motion.div className="mb-8" initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }}>
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <div className="p-3 rounded-xl bg-violet-500/20 border border-violet-500/30">
                <Vote className="h-8 w-8 text-violet-400" />
              </div>
              <div>
                <h1 className="text-4xl md:text-5xl font-bold text-white">Governance</h1>
                <p className="text-white/60">Vote on proposals and shape the future of EON Protocol</p>
              </div>
            </div>
            <Button onClick={() => setShowDelegateModal(true)} variant="outline" className="border-white/20">
              <Users className="mr-2 h-4 w-4" />
              Delegate
            </Button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <Card className="bg-white/5 border-white/10">
              <CardContent className="pt-6">
                <div className="flex items-center gap-2 mb-1">
                  <Vote className="h-4 w-4 text-white/60" />
                  <div className="text-sm text-white/60">Total Proposals</div>
                </div>
                <div className="text-2xl font-bold text-white">42</div>
              </CardContent>
            </Card>

            <Card className="bg-white/5 border-white/10">
              <CardContent className="pt-6">
                <div className="flex items-center gap-2 mb-1">
                  <Clock className="h-4 w-4 text-white/60" />
                  <div className="text-sm text-white/60">Active</div>
                </div>
                <div className="text-2xl font-bold text-white">3</div>
              </CardContent>
            </Card>

            <Card className="bg-white/5 border-white/10">
              <CardContent className="pt-6">
                <div className="flex items-center gap-2 mb-1">
                  <TrendingUp className="h-4 w-4 text-white/60" />
                  <div className="text-sm text-white/60">Your Voting Power</div>
                </div>
                <div className="text-2xl font-bold text-white">{isConnected ? '125.4K' : '0'}</div>
              </CardContent>
            </Card>

            <Card className="bg-white/5 border-white/10">
              <CardContent className="pt-6">
                <div className="flex items-center gap-2 mb-1">
                  <Users className="h-4 w-4 text-white/60" />
                  <div className="text-sm text-white/60">Quorum</div>
                </div>
                <div className="text-2xl font-bold text-white">4%</div>
              </CardContent>
            </Card>
          </div>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
          <Card className="bg-white/5 border-white/10">
            <CardHeader>
              <CardTitle className="text-white">Active Proposals</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {proposals.map((proposal, index) => (
                  <motion.div
                    key={proposal.id}
                    className="bg-white/5 border border-white/10 rounded-xl p-6"
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.1 }}
                  >
                    <div className="flex items-start justify-between mb-4">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          <Badge className="bg-green-500/20 text-green-400 border-green-500/30">{proposal.status}</Badge>
                          <span className="text-sm text-white/60">
                            <Clock className="inline h-4 w-4 mr-1" />
                            {proposal.timeLeft}
                          </span>
                        </div>
                        <h3 className="text-xl font-bold text-white mb-2">{proposal.title}</h3>
                        <p className="text-white/60">{proposal.description}</p>
                      </div>
                    </div>

                    <div className="space-y-3 mb-4">
                      <div>
                        <div className="flex justify-between text-sm mb-1">
                          <span className="text-green-400">For</span>
                          <span className="text-white">{proposal.forVotes}</span>
                        </div>
                        <div className="h-2 bg-white/10 rounded-full overflow-hidden">
                          <div className="h-full bg-green-500" style={{ width: '84%' }}></div>
                        </div>
                      </div>
                      <div>
                        <div className="flex justify-between text-sm mb-1">
                          <span className="text-red-400">Against</span>
                          <span className="text-white">{proposal.againstVotes}</span>
                        </div>
                        <div className="h-2 bg-white/10 rounded-full overflow-hidden">
                          <div className="h-full bg-red-500" style={{ width: '16%' }}></div>
                        </div>
                      </div>
                    </div>

                    <Button onClick={() => handleVote(proposal)} className="w-full bg-violet-600 hover:bg-violet-700">
                      Cast Your Vote
                    </Button>
                  </motion.div>
                ))}
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </div>

      {selectedProposal && (
        <VoteModal isOpen={showVoteModal} onClose={() => setShowVoteModal(false)} proposal={selectedProposal} />
      )}

      <DelegateModal isOpen={showDelegateModal} onClose={() => setShowDelegateModal(false)} />
    </div>
  );
}
