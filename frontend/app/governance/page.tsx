'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import {
  Vote,
  Users,
  Clock,
  CheckCircle2,
  XCircle,
  TrendingUp,
  ExternalLink,
  Plus
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useAccount } from 'wagmi';

/**
 * @title Governance Page
 * @notice Aave-inspired DAO governance interface
 * @dev On-chain voting, proposals, delegation
 */
export default function GovernancePage() {
  const { address, isConnected } = useAccount();
  const [activeTab, setActiveTab] = useState('active');

  // Mock data - will be replaced with actual contract calls
  const governanceStats = {
    totalProposals: 42,
    activeProposals: 3,
    votingPower: '125,430',
    quorum: '4%',
    treasury: '$12.5M',
  };

  const proposals = [
    {
      id: 1,
      title: 'Increase Liquidation Bonus to 8%',
      description: 'Proposal to increase liquidation incentive from 7% to 8% to improve protocol safety',
      status: 'Active',
      forVotes: '2,450,000',
      againstVotes: '450,000',
      quorumReached: true,
      timeLeft: '2 days',
      proposer: '0x1234...5678',
      created: '2025-01-15',
    },
    {
      id: 2,
      title: 'Add USDT as Collateral Asset',
      description: 'Enable USDT as an accepted collateral asset with 80% LTV',
      status: 'Active',
      forVotes: '3,200,000',
      againstVotes: '120,000',
      quorumReached: true,
      timeLeft: '4 days',
      proposer: '0xabcd...efgh',
      created: '2025-01-12',
    },
    {
      id: 3,
      title: 'Reduce Safety Module Cooldown to 7 Days',
      description: 'Shorten unstaking cooldown from 10 days to 7 days for better UX',
      status: 'Pending',
      forVotes: '0',
      againstVotes: '0',
      quorumReached: false,
      timeLeft: '12 hours until active',
      proposer: '0x9876...4321',
      created: '2025-01-18',
    },
  ];

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'Active': return 'bg-green-500/20 text-green-400 border-green-500/30';
      case 'Pending': return 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30';
      case 'Passed': return 'bg-blue-500/20 text-blue-400 border-blue-500/30';
      case 'Failed': return 'bg-red-500/20 text-red-400 border-red-500/30';
      default: return 'bg-gray-500/20 text-gray-400 border-gray-500/30';
    }
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
            <div className="p-3 rounded-xl bg-violet-500/20 border border-violet-500/30">
              <Vote className="h-8 w-8 text-violet-400" />
            </div>
            <div>
              <h1 className="text-4xl md:text-5xl font-bold text-white">
                Governance
              </h1>
              <p className="text-white/60">
                Shape the future of EON Protocol through decentralized governance
              </p>
            </div>
          </div>

          {/* Stats Grid */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mt-6">
            <Card className="bg-white/5 border-white/10">
              <CardContent className="pt-6">
                <div className="text-sm text-white/60 mb-1">Total Proposals</div>
                <div className="text-2xl font-bold text-white">{governanceStats.totalProposals}</div>
              </CardContent>
            </Card>

            <Card className="bg-white/5 border-white/10">
              <CardContent className="pt-6">
                <div className="text-sm text-white/60 mb-1">Active</div>
                <div className="text-2xl font-bold text-green-400">{governanceStats.activeProposals}</div>
              </CardContent>
            </Card>

            <Card className="bg-white/5 border-white/10">
              <CardContent className="pt-6">
                <div className="text-sm text-white/60 mb-1">Your Voting Power</div>
                <div className="text-2xl font-bold text-violet-400">{governanceStats.votingPower}</div>
              </CardContent>
            </Card>

            <Card className="bg-white/5 border-white/10">
              <CardContent className="pt-6">
                <div className="text-sm text-white/60 mb-1">Quorum</div>
                <div className="text-2xl font-bold text-white">{governanceStats.quorum}</div>
              </CardContent>
            </Card>

            <Card className="bg-white/5 border-white/10">
              <CardContent className="pt-6">
                <div className="text-sm text-white/60 mb-1">Treasury</div>
                <div className="text-2xl font-bold text-white">{governanceStats.treasury}</div>
              </CardContent>
            </Card>
          </div>
        </motion.div>

        {/* Create Proposal Button */}
        {isConnected && (
          <motion.div
            className="mb-6"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.2 }}
          >
            <Button className="bg-gradient-to-r from-violet-600 to-purple-600 hover:from-violet-700 hover:to-purple-700">
              <Plus className="h-4 w-4 mr-2" />
              Create Proposal
            </Button>
          </motion.div>
        )}

        {/* Tabs */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
        >
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="bg-white/5 border border-white/10">
              <TabsTrigger value="active">Active</TabsTrigger>
              <TabsTrigger value="pending">Pending</TabsTrigger>
              <TabsTrigger value="closed">Closed</TabsTrigger>
              <TabsTrigger value="your-votes">Your Votes</TabsTrigger>
            </TabsList>

            <TabsContent value="active" className="mt-6">
              <div className="space-y-4">
                {proposals.filter(p => p.status === 'Active').map((proposal, index) => (
                  <motion.div
                    key={proposal.id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.1 }}
                  >
                    <Card className="bg-white/5 border-white/10 hover:border-violet-500/50 transition-all cursor-pointer">
                      <CardHeader>
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <div className="flex items-center gap-3 mb-2">
                              <Badge className={getStatusColor(proposal.status)}>
                                {proposal.status}
                              </Badge>
                              <div className="flex items-center gap-2 text-sm text-white/60">
                                <Clock className="h-4 w-4" />
                                {proposal.timeLeft}
                              </div>
                            </div>
                            <CardTitle className="text-white text-xl mb-2">
                              #{proposal.id}: {proposal.title}
                            </CardTitle>
                            <CardDescription className="text-white/60">
                              {proposal.description}
                            </CardDescription>
                          </div>
                          <Button variant="outline" size="sm">
                            <ExternalLink className="h-4 w-4" />
                          </Button>
                        </div>
                      </CardHeader>
                      <CardContent>
                        {/* Voting Progress */}
                        <div className="space-y-3 mb-4">
                          <div>
                            <div className="flex justify-between text-sm mb-1">
                              <span className="text-green-400">For: {proposal.forVotes} EON</span>
                              <span className="text-white/60">
                                {parseInt(proposal.forVotes.replace(/,/g, '')) /
                                 (parseInt(proposal.forVotes.replace(/,/g, '')) + parseInt(proposal.againstVotes.replace(/,/g, ''))) * 100}%
                              </span>
                            </div>
                            <div className="h-2 bg-white/10 rounded-full overflow-hidden">
                              <div
                                className="h-full bg-green-500"
                                style={{
                                  width: `${parseInt(proposal.forVotes.replace(/,/g, '')) /
                                          (parseInt(proposal.forVotes.replace(/,/g, '')) + parseInt(proposal.againstVotes.replace(/,/g, ''))) * 100}%`
                                }}
                              />
                            </div>
                          </div>

                          <div>
                            <div className="flex justify-between text-sm mb-1">
                              <span className="text-red-400">Against: {proposal.againstVotes} EON</span>
                              <span className="text-white/60">
                                {parseInt(proposal.againstVotes.replace(/,/g, '')) /
                                 (parseInt(proposal.forVotes.replace(/,/g, '')) + parseInt(proposal.againstVotes.replace(/,/g, ''))) * 100}%
                              </span>
                            </div>
                            <div className="h-2 bg-white/10 rounded-full overflow-hidden">
                              <div
                                className="h-full bg-red-500"
                                style={{
                                  width: `${parseInt(proposal.againstVotes.replace(/,/g, '')) /
                                          (parseInt(proposal.forVotes.replace(/,/g, '')) + parseInt(proposal.againstVotes.replace(/,/g, ''))) * 100}%`
                                }}
                              />
                            </div>
                          </div>
                        </div>

                        {/* Quorum Status */}
                        <div className="flex items-center gap-2 text-sm mb-4">
                          {proposal.quorumReached ? (
                            <><CheckCircle2 className="h-4 w-4 text-green-400" /> <span className="text-green-400">Quorum Reached</span></>
                          ) : (
                            <><XCircle className="h-4 w-4 text-yellow-400" /> <span className="text-yellow-400">Quorum Not Reached</span></>
                          )}
                        </div>

                        {/* Vote Buttons */}
                        <div className="flex gap-3">
                          <Button className="flex-1 bg-green-600 hover:bg-green-700">
                            Vote For
                          </Button>
                          <Button className="flex-1 bg-red-600 hover:bg-red-700">
                            Vote Against
                          </Button>
                          <Button variant="outline">
                            Abstain
                          </Button>
                        </div>

                        {/* Metadata */}
                        <div className="mt-4 pt-4 border-t border-white/10 flex items-center justify-between text-sm text-white/60">
                          <div>Proposed by {proposal.proposer}</div>
                          <div>{proposal.created}</div>
                        </div>
                      </CardContent>
                    </Card>
                  </motion.div>
                ))}
              </div>
            </TabsContent>

            <TabsContent value="pending">
              <div className="text-center py-12 text-white/60">
                Pending proposals will appear here
              </div>
            </TabsContent>

            <TabsContent value="closed">
              <div className="text-center py-12 text-white/60">
                Historical proposals will appear here
              </div>
            </TabsContent>

            <TabsContent value="your-votes">
              {!isConnected ? (
                <div className="text-center py-12">
                  <div className="text-white/60 mb-4">Connect wallet to view your voting history</div>
                  <Button>Connect Wallet</Button>
                </div>
              ) : (
                <div className="text-center py-12 text-white/60">
                  Your voting history will appear here
                </div>
              )}
            </TabsContent>
          </Tabs>
        </motion.div>

        {/* Delegation Card */}
        <motion.div
          className="mt-8"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
        >
          <Card className="bg-gradient-to-br from-violet-500/10 to-purple-500/10 border-violet-500/30">
            <CardHeader>
              <CardTitle className="text-white flex items-center gap-2">
                <Users className="h-5 w-5" />
                Delegate Your Voting Power
              </CardTitle>
              <CardDescription className="text-white/70">
                Delegate your EON tokens to vote on your behalf or self-delegate to vote yourself
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex gap-3">
                <input
                  type="text"
                  placeholder="Enter delegate address (0x...)"
                  className="flex-1 bg-white/10 border border-white/20 rounded-lg px-4 py-2 text-white placeholder:text-white/40"
                />
                <Button className="bg-violet-600 hover:bg-violet-700">
                  Delegate
                </Button>
                <Button variant="outline">
                  Self-Delegate
                </Button>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </div>
    </div>
  );
}
