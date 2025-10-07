'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import { TrendingUp, TrendingDown, DollarSign, Activity, ArrowUpRight, ArrowDownRight } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useAccount } from 'wagmi';
import { SupplyModal } from '@/components/modals/SupplyModal';
import { useUserLoansWithDetails } from '@/lib/hooks/useRealLoans';

// Asset configurations with real contract addresses
const ASSETS = [
  {
    symbol: 'USDC',
    icon: '💵',
    address: process.env.NEXT_PUBLIC_MOCK_USDC || '0x3aE970e1d73cB7eEFF6D007Ee6C15D79d91325AD',
    decimals: 6,
    collateralFactor: '80%',
  },
  {
    symbol: 'WETH',
    icon: '⟠',
    address: process.env.NEXT_PUBLIC_MOCK_WETH || '0x5D661e2F392A846f2E4B44D322A6f272106a334e',
    decimals: 18,
    collateralFactor: '75%',
  },
];

export default function MarketsPage() {
  const { address, isConnected } = useAccount();
  const [selectedAsset, setSelectedAsset] = useState<any>(null);
  const [showSupplyModal, setShowSupplyModal] = useState(false);
  const [showBorrowModal, setShowBorrowModal] = useState(false);

  // REAL DATA: User's loans from blockchain
  const { loans, count, isLoading } = useUserLoansWithDetails(address);

  const mockMarkets = [
    {
      ...ASSETS[0],
      totalSupply: '$24.5M',
      totalBorrow: '$18.2M',
      supplyAPY: '3.2%',
      borrowAPY: '5.8%',
      utilization: '74.3%',
    },
    {
      ...ASSETS[1],
      totalSupply: '$18.9M',
      totalBorrow: '$12.4M',
      supplyAPY: '2.8%',
      borrowAPY: '4.2%',
      utilization: '65.6%',
    },
  ];

  const handleSupply = (asset: any) => {
    setSelectedAsset(asset);
    setShowSupplyModal(true);
  };

  const handleBorrow = (asset: any) => {
    setSelectedAsset(asset);
    setShowBorrowModal(true);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-black via-violet-950/20 to-black p-4 md:p-8">
      <div className="max-w-7xl mx-auto">
        <motion.div className="mb-8" initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }}>
          <div className="flex items-center gap-3 mb-4">
            <div className="p-3 rounded-xl bg-gradient-to-br from-green-500/20 to-emerald-500/20 border border-green-500/30">
              <Activity className="h-8 w-8 text-green-400" />
            </div>
            <div>
              <h1 className="text-4xl md:text-5xl font-bold text-white">Markets</h1>
              <p className="text-white/60">Supply assets to earn interest or borrow against your collateral</p>
            </div>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            <Card className="bg-white/5 border-white/10">
              <CardContent className="pt-6">
                <div className="flex items-center gap-2 mb-1">
                  <DollarSign className="h-4 w-4 text-white/60" />
                  <div className="text-sm text-white/60">Total Supply</div>
                </div>
                <div className="text-2xl font-bold text-white">$43.4M</div>
              </CardContent>
            </Card>

            <Card className="bg-white/5 border-white/10">
              <CardContent className="pt-6">
                <div className="flex items-center gap-2 mb-1">
                  <ArrowDownRight className="h-4 w-4 text-white/60" />
                  <div className="text-sm text-white/60">Total Borrow</div>
                </div>
                <div className="text-2xl font-bold text-white">$30.6M</div>
              </CardContent>
            </Card>

            <Card className="bg-white/5 border-white/10">
              <CardContent className="pt-6">
                <div className="flex items-center gap-2 mb-1">
                  <Activity className="h-4 w-4 text-white/60" />
                  <div className="text-sm text-white/60">Liquidity</div>
                </div>
                <div className="text-2xl font-bold text-white">$12.8M</div>
              </CardContent>
            </Card>

            <Card className="bg-gradient-to-br from-green-500/10 to-emerald-500/10 border-green-500/30">
              <CardContent className="pt-6">
                <div className="flex items-center gap-2 mb-1">
                  <TrendingUp className="h-4 w-4 text-green-400" />
                  <div className="text-sm text-green-400">Avg Supply APY</div>
                </div>
                <div className="text-2xl font-bold text-green-400">3.0%</div>
              </CardContent>
            </Card>

            <Card className="bg-gradient-to-br from-red-500/10 to-orange-500/10 border-red-500/30">
              <CardContent className="pt-6">
                <div className="flex items-center gap-2 mb-1">
                  <TrendingDown className="h-4 w-4 text-red-400" />
                  <div className="text-sm text-red-400">Avg Borrow APY</div>
                </div>
                <div className="text-2xl font-bold text-red-400">5.0%</div>
              </CardContent>
            </Card>
          </div>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
          <Card className="bg-white/5 border-white/10">
            <CardHeader>
              <CardTitle className="text-white">All Markets</CardTitle>
              <CardDescription className="text-white/60">Select an asset to supply or borrow</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="hidden md:block overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-white/10">
                      <th className="text-left py-4 px-4 text-sm font-semibold text-white/60">Asset</th>
                      <th className="text-right py-4 px-4 text-sm font-semibold text-white/60">Total Supply</th>
                      <th className="text-right py-4 px-4 text-sm font-semibold text-white/60">Supply APY</th>
                      <th className="text-right py-4 px-4 text-sm font-semibold text-white/60">Total Borrow</th>
                      <th className="text-right py-4 px-4 text-sm font-semibold text-white/60">Borrow APY</th>
                      <th className="text-right py-4 px-4 text-sm font-semibold text-white/60">Utilization</th>
                      <th className="text-right py-4 px-4 text-sm font-semibold text-white/60">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {mockMarkets.map((market, index) => (
                      <motion.tr
                        key={market.symbol}
                        className="border-b border-white/5 hover:bg-white/5 transition-colors"
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: index * 0.05 }}
                      >
                        <td className="py-4 px-4">
                          <div className="flex items-center gap-3">
                            <div className="text-3xl">{market.icon}</div>
                            <div>
                              <div className="font-semibold text-white">{market.symbol}</div>
                              <div className="text-sm text-white/60">Collateral: {market.collateralFactor}</div>
                            </div>
                          </div>
                        </td>
                        <td className="py-4 px-4 text-right text-white font-medium">{market.totalSupply}</td>
                        <td className="py-4 px-4 text-right">
                          <div className="text-green-400 font-semibold">{market.supplyAPY}</div>
                        </td>
                        <td className="py-4 px-4 text-right text-white font-medium">{market.totalBorrow}</td>
                        <td className="py-4 px-4 text-right">
                          <div className="text-red-400 font-semibold">{market.borrowAPY}</div>
                        </td>
                        <td className="py-4 px-4 text-right">
                          <div className="flex items-center justify-end gap-2">
                            <div className="w-16 h-2 bg-white/10 rounded-full overflow-hidden">
                              <div className="h-full bg-violet-500" style={{ width: market.utilization }} />
                            </div>
                            <span className="text-white/60 text-sm">{market.utilization}</span>
                          </div>
                        </td>
                        <td className="py-4 px-4 text-right">
                          <div className="flex gap-2 justify-end">
                            <Button size="sm" className="bg-green-600 hover:bg-green-700" onClick={() => handleSupply(market)}>
                              <ArrowUpRight className="h-4 w-4 mr-1" />
                              Supply
                            </Button>
                            <Button size="sm" className="bg-red-600 hover:bg-red-700" onClick={() => handleBorrow(market)}>
                              <ArrowDownRight className="h-4 w-4 mr-1" />
                              Borrow
                            </Button>
                          </div>
                        </td>
                      </motion.tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="md:hidden space-y-4">
                {mockMarkets.map((market, index) => (
                  <motion.div
                    key={market.symbol}
                    className="bg-white/5 border border-white/10 rounded-xl p-4"
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.05 }}
                  >
                    <div className="flex items-center gap-3 mb-4">
                      <div className="text-3xl">{market.icon}</div>
                      <div className="flex-1">
                        <div className="font-semibold text-white text-lg">{market.symbol}</div>
                        <div className="text-sm text-white/60">Collateral: {market.collateralFactor}</div>
                      </div>
                      <Badge className="bg-violet-500/20 text-violet-400 border-violet-500/30">{market.utilization}</Badge>
                    </div>

                    <div className="grid grid-cols-2 gap-4 mb-4">
                      <div>
                        <div className="text-xs text-white/60 mb-1">Supply APY</div>
                        <div className="text-lg font-bold text-green-400">{market.supplyAPY}</div>
                        <div className="text-xs text-white/60">{market.totalSupply}</div>
                      </div>
                      <div>
                        <div className="text-xs text-white/60 mb-1">Borrow APY</div>
                        <div className="text-lg font-bold text-red-400">{market.borrowAPY}</div>
                        <div className="text-xs text-white/60">{market.totalBorrow}</div>
                      </div>
                    </div>

                    <div className="flex gap-2">
                      <Button size="sm" className="flex-1 bg-green-600 hover:bg-green-700" onClick={() => handleSupply(market)}>
                        Supply
                      </Button>
                      <Button size="sm" className="flex-1 bg-red-600 hover:bg-red-700" onClick={() => handleBorrow(market)}>
                        Borrow
                      </Button>
                    </div>
                  </motion.div>
                ))}
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* Your Positions - REAL DATA */}
        {isConnected && (
          <motion.div className="mt-8" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
            <Card className="bg-white/5 border-white/10">
              <CardHeader>
                <CardTitle className="text-white flex items-center justify-between">
                  <span>Your Positions</span>
                  {isLoading && <span className="text-sm text-white/60">Loading...</span>}
                  {!isLoading && count > 0 && (
                    <Badge className="bg-violet-500/20 text-violet-400 border-violet-500/30">{count} Active Loans</Badge>
                  )}
                </CardTitle>
                <CardDescription className="text-white/60">
                  {count > 0 ? 'Your active loans from the blockchain' : 'No active positions'}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Tabs defaultValue="borrow">
                  <TabsList className="bg-white/5 border border-white/10">
                    <TabsTrigger value="borrow">Borrowed ({count})</TabsTrigger>
                    <TabsTrigger value="supply">Supplied (0)</TabsTrigger>
                  </TabsList>

                  <TabsContent value="borrow" className="mt-4">
                    {count > 0 ? (
                      <div className="space-y-3">
                        {loans.map((loanId) => (
                          <div key={loanId} className="p-4 bg-white/5 rounded-lg border border-white/10">
                            <div className="flex items-center justify-between">
                              <div>
                                <div className="text-white font-semibold">Loan #{loanId}</div>
                                <div className="text-sm text-white/60">Active loan from CreditVaultV3</div>
                              </div>
                              <Button size="sm" variant="outline" className="border-white/20">
                                View Details
                              </Button>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="text-center py-8 text-white/60">
                        {isLoading ? 'Loading your loans...' : 'No active loans. Borrow assets to get started!'}
                      </div>
                    )}
                  </TabsContent>

                  <TabsContent value="supply" className="mt-4">
                    <div className="text-center py-8 text-white/60">
                      Supply functionality coming soon. Use the Supply buttons above to supply assets.
                    </div>
                  </TabsContent>
                </Tabs>
              </CardContent>
            </Card>
          </motion.div>
        )}
      </div>

      {selectedAsset && (
        <>
          <SupplyModal isOpen={showSupplyModal} onClose={() => setShowSupplyModal(false)} asset={selectedAsset} />

          {showBorrowModal && (
            <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={() => setShowBorrowModal(false)}>
              <div className="bg-neutral-900 border border-white/10 rounded-2xl p-6 max-w-md w-full mx-4" onClick={(e) => e.stopPropagation()}>
                <h3 className="text-2xl font-bold text-white mb-4">Borrow {selectedAsset.symbol}</h3>
                <p className="text-white/60 mb-6">Use the /borrow page to create credit-scored loans with better rates!</p>
                <Button onClick={() => setShowBorrowModal(false)} className="w-full bg-violet-600 hover:bg-violet-700">
                  Close
                </Button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
