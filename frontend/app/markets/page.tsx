'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import {
  TrendingUp,
  TrendingDown,
  DollarSign,
  Percent,
  Info,
  ArrowUpRight,
  ArrowDownRight,
  Activity
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useAccount } from 'wagmi';

/**
 * @title Markets Page
 * @notice Aave/Compound inspired lending markets interface
 * @dev Supply/Borrow with dynamic APY based on utilization
 */
export default function MarketsPage() {
  const { address, isConnected } = useAccount();
  const [selectedMarket, setSelectedMarket] = useState<any>(null);
  const [actionType, setActionType] = useState<'supply' | 'borrow'>('supply');

  // Mock market data - will be replaced with actual contract calls
  const markets = [
    {
      asset: 'USDC',
      icon: '💵',
      totalSupply: '$24,500,000',
      totalBorrow: '$18,200,000',
      supplyAPY: '3.2%',
      borrowAPY: '5.8%',
      utilization: '74.3%',
      liquidity: '$6,300,000',
      collateralFactor: '80%',
      yourSupply: '$0',
      yourBorrow: '$0',
    },
    {
      asset: 'WETH',
      icon: '⟠',
      totalSupply: '$18,900,000',
      totalBorrow: '$12,400,000',
      supplyAPY: '2.8%',
      borrowAPY: '4.2%',
      utilization: '65.6%',
      liquidity: '$6,500,000',
      collateralFactor: '75%',
      yourSupply: '$5,000',
      yourBorrow: '$0',
    },
    {
      asset: 'WBTC',
      icon: '₿',
      totalSupply: '$12,300,000',
      totalBorrow: '$8,100,000',
      supplyAPY: '1.9%',
      borrowAPY: '3.5%',
      utilization: '65.9%',
      liquidity: '$4,200,000',
      collateralFactor: '70%',
      yourSupply: '$0',
      yourBorrow: '$0',
    },
    {
      asset: 'DAI',
      icon: '◈',
      totalSupply: '$8,700,000',
      totalBorrow: '$6,200,000',
      supplyAPY: '4.1%',
      borrowAPY: '6.5%',
      utilization: '71.3%',
      liquidity: '$2,500,000',
      collateralFactor: '80%',
      yourSupply: '$0',
      yourBorrow: '$2,500',
    },
    {
      asset: 'USDT',
      icon: '₮',
      totalSupply: '$15,200,000',
      totalBorrow: '$11,800,000',
      supplyAPY: '3.5%',
      borrowAPY: '5.2%',
      utilization: '77.6%',
      liquidity: '$3,400,000',
      collateralFactor: '80%',
      yourSupply: '$0',
      yourBorrow: '$0',
    },
  ];

  const protocolStats = {
    totalSupply: '$79.6M',
    totalBorrow: '$56.7M',
    totalLiquidity: '$22.9M',
    avgSupplyAPY: '3.1%',
    avgBorrowAPY: '5.0%',
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
            <div className="p-3 rounded-xl bg-gradient-to-br from-green-500/20 to-emerald-500/20 border border-green-500/30">
              <Activity className="h-8 w-8 text-green-400" />
            </div>
            <div>
              <h1 className="text-4xl md:text-5xl font-bold text-white">
                Markets
              </h1>
              <p className="text-white/60">
                Supply assets to earn interest or borrow against your collateral
              </p>
            </div>
          </div>

          {/* Protocol Stats */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            <Card className="bg-white/5 border-white/10">
              <CardContent className="pt-6">
                <div className="flex items-center gap-2 mb-1">
                  <DollarSign className="h-4 w-4 text-white/60" />
                  <div className="text-sm text-white/60">Total Supply</div>
                </div>
                <div className="text-2xl font-bold text-white">{protocolStats.totalSupply}</div>
              </CardContent>
            </Card>

            <Card className="bg-white/5 border-white/10">
              <CardContent className="pt-6">
                <div className="flex items-center gap-2 mb-1">
                  <ArrowDownRight className="h-4 w-4 text-white/60" />
                  <div className="text-sm text-white/60">Total Borrow</div>
                </div>
                <div className="text-2xl font-bold text-white">{protocolStats.totalBorrow}</div>
              </CardContent>
            </Card>

            <Card className="bg-white/5 border-white/10">
              <CardContent className="pt-6">
                <div className="flex items-center gap-2 mb-1">
                  <Activity className="h-4 w-4 text-white/60" />
                  <div className="text-sm text-white/60">Liquidity</div>
                </div>
                <div className="text-2xl font-bold text-white">{protocolStats.totalLiquidity}</div>
              </CardContent>
            </Card>

            <Card className="bg-gradient-to-br from-green-500/10 to-emerald-500/10 border-green-500/30">
              <CardContent className="pt-6">
                <div className="flex items-center gap-2 mb-1">
                  <TrendingUp className="h-4 w-4 text-green-400" />
                  <div className="text-sm text-green-400">Avg Supply APY</div>
                </div>
                <div className="text-2xl font-bold text-green-400">{protocolStats.avgSupplyAPY}</div>
              </CardContent>
            </Card>

            <Card className="bg-gradient-to-br from-red-500/10 to-orange-500/10 border-red-500/30">
              <CardContent className="pt-6">
                <div className="flex items-center gap-2 mb-1">
                  <TrendingDown className="h-4 w-4 text-red-400" />
                  <div className="text-sm text-red-400">Avg Borrow APY</div>
                </div>
                <div className="text-2xl font-bold text-red-400">{protocolStats.avgBorrowAPY}</div>
              </CardContent>
            </Card>
          </div>
        </motion.div>

        {/* Markets Table */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
        >
          <Card className="bg-white/5 border-white/10">
            <CardHeader>
              <CardTitle className="text-white">All Markets</CardTitle>
              <CardDescription className="text-white/60">
                Select an asset to supply or borrow
              </CardDescription>
            </CardHeader>
            <CardContent>
              {/* Desktop Table */}
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
                    {markets.map((market, index) => (
                      <motion.tr
                        key={market.asset}
                        className="border-b border-white/5 hover:bg-white/5 transition-colors"
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: index * 0.05 }}
                      >
                        <td className="py-4 px-4">
                          <div className="flex items-center gap-3">
                            <div className="text-3xl">{market.icon}</div>
                            <div>
                              <div className="font-semibold text-white">{market.asset}</div>
                              <div className="text-sm text-white/60">Collateral: {market.collateralFactor}</div>
                            </div>
                          </div>
                        </td>
                        <td className="py-4 px-4 text-right text-white font-medium">
                          {market.totalSupply}
                        </td>
                        <td className="py-4 px-4 text-right">
                          <div className="text-green-400 font-semibold">{market.supplyAPY}</div>
                        </td>
                        <td className="py-4 px-4 text-right text-white font-medium">
                          {market.totalBorrow}
                        </td>
                        <td className="py-4 px-4 text-right">
                          <div className="text-red-400 font-semibold">{market.borrowAPY}</div>
                        </td>
                        <td className="py-4 px-4 text-right">
                          <div className="flex items-center justify-end gap-2">
                            <div className="w-16 h-2 bg-white/10 rounded-full overflow-hidden">
                              <div
                                className="h-full bg-violet-500"
                                style={{ width: market.utilization }}
                              />
                            </div>
                            <span className="text-white/60 text-sm">{market.utilization}</span>
                          </div>
                        </td>
                        <td className="py-4 px-4 text-right">
                          <div className="flex gap-2 justify-end">
                            <Button
                              size="sm"
                              className="bg-green-600 hover:bg-green-700"
                              onClick={() => {
                                setSelectedMarket(market);
                                setActionType('supply');
                              }}
                            >
                              <ArrowUpRight className="h-4 w-4 mr-1" />
                              Supply
                            </Button>
                            <Button
                              size="sm"
                              className="bg-red-600 hover:bg-red-700"
                              onClick={() => {
                                setSelectedMarket(market);
                                setActionType('borrow');
                              }}
                            >
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

              {/* Mobile Cards */}
              <div className="md:hidden space-y-4">
                {markets.map((market, index) => (
                  <motion.div
                    key={market.asset}
                    className="bg-white/5 border border-white/10 rounded-xl p-4"
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.05 }}
                  >
                    <div className="flex items-center gap-3 mb-4">
                      <div className="text-3xl">{market.icon}</div>
                      <div className="flex-1">
                        <div className="font-semibold text-white text-lg">{market.asset}</div>
                        <div className="text-sm text-white/60">Collateral: {market.collateralFactor}</div>
                      </div>
                      <Badge className="bg-violet-500/20 text-violet-400 border-violet-500/30">
                        {market.utilization}
                      </Badge>
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
                      <Button
                        size="sm"
                        className="flex-1 bg-green-600 hover:bg-green-700"
                        onClick={() => {
                          setSelectedMarket(market);
                          setActionType('supply');
                        }}
                      >
                        Supply
                      </Button>
                      <Button
                        size="sm"
                        className="flex-1 bg-red-600 hover:bg-red-700"
                        onClick={() => {
                          setSelectedMarket(market);
                          setActionType('borrow');
                        }}
                      >
                        Borrow
                      </Button>
                    </div>
                  </motion.div>
                ))}
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* Your Positions */}
        {isConnected && (
          <motion.div
            className="mt-8"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
          >
            <Card className="bg-white/5 border-white/10">
              <CardHeader>
                <CardTitle className="text-white">Your Positions</CardTitle>
                <CardDescription className="text-white/60">
                  Assets you have supplied or borrowed
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Tabs defaultValue="supply">
                  <TabsList className="bg-white/5 border border-white/10">
                    <TabsTrigger value="supply">Supplied</TabsTrigger>
                    <TabsTrigger value="borrow">Borrowed</TabsTrigger>
                  </TabsList>

                  <TabsContent value="supply" className="mt-4">
                    <div className="space-y-3">
                      {markets.filter(m => parseFloat(m.yourSupply.replace('$', '').replace(',', '')) > 0).map((market) => (
                        <div key={market.asset} className="flex items-center justify-between p-4 bg-white/5 rounded-lg border border-white/10">
                          <div className="flex items-center gap-3">
                            <div className="text-2xl">{market.icon}</div>
                            <div>
                              <div className="font-semibold text-white">{market.asset}</div>
                              <div className="text-sm text-green-400">{market.supplyAPY} APY</div>
                            </div>
                          </div>
                          <div className="text-right">
                            <div className="font-semibold text-white">{market.yourSupply}</div>
                            <Button size="sm" variant="outline" className="mt-2">
                              Withdraw
                            </Button>
                          </div>
                        </div>
                      ))}
                      {markets.filter(m => parseFloat(m.yourSupply.replace('$', '').replace(',', '')) > 0).length === 0 && (
                        <div className="text-center py-8 text-white/60">
                          No supplied assets
                        </div>
                      )}
                    </div>
                  </TabsContent>

                  <TabsContent value="borrow" className="mt-4">
                    <div className="space-y-3">
                      {markets.filter(m => parseFloat(m.yourBorrow.replace('$', '').replace(',', '')) > 0).map((market) => (
                        <div key={market.asset} className="flex items-center justify-between p-4 bg-white/5 rounded-lg border border-white/10">
                          <div className="flex items-center gap-3">
                            <div className="text-2xl">{market.icon}</div>
                            <div>
                              <div className="font-semibold text-white">{market.asset}</div>
                              <div className="text-sm text-red-400">{market.borrowAPY} APY</div>
                            </div>
                          </div>
                          <div className="text-right">
                            <div className="font-semibold text-white">{market.yourBorrow}</div>
                            <Button size="sm" variant="outline" className="mt-2">
                              Repay
                            </Button>
                          </div>
                        </div>
                      ))}
                      {markets.filter(m => parseFloat(m.yourBorrow.replace('$', '').replace(',', '')) > 0).length === 0 && (
                        <div className="text-center py-8 text-white/60">
                          No borrowed assets
                        </div>
                      )}
                    </div>
                  </TabsContent>
                </Tabs>
              </CardContent>
            </Card>
          </motion.div>
        )}
      </div>
    </div>
  );
}
