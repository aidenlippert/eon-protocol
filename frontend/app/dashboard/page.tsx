'use client';

import { useAccount } from 'wagmi';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Wallet, TrendingUp, Shield, AlertTriangle } from 'lucide-react';
import { useCreditScore } from '@/lib/hooks/useCreditScore';
import { useLendingPool } from '@/lib/hooks/useLendingPool';
import { useHealthFactor } from '@/lib/hooks/useHealthFactor';

export default function DashboardPage() {
  const { isConnected } = useAccount();
  const { creditScore, tierLabel, riskLevel, isLoading: scoreLoading } = useCreditScore();
  const { loanCount } = useLendingPool();
  const { healthFactor, status, isLiquidatable, isLoading: hfLoading } = useHealthFactor(loanCount ? 0 : undefined);

  if (!isConnected) {
    return (
      <div className="container mx-auto px-4 py-32">
        <div className="max-w-2xl mx-auto text-center">
          <h1 className="text-4xl font-bold mb-4">Dashboard</h1>
          <p className="text-neutral-400 mb-8">
            Connect your wallet to view your lending positions
          </p>
          <div className="text-violet-400">Please connect your wallet to continue</div>
        </div>
      </div>
    );
  }

  const score = creditScore?.score || 0;
  const tier = tierLabel || 'No Score';
  const risk = riskLevel || 'Unknown';

  // Mock data for positions (will be replaced with actual loan data)
  const totalCollateral = 0;
  const totalDebt = 0;

  return (
    <div className="container mx-auto px-4 py-12">
      <div className="max-w-7xl mx-auto">
        <h1 className="text-4xl font-bold mb-8">Dashboard</h1>

        {/* Overview Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <Card className="bg-neutral-900/50 border-neutral-800 p-6">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-neutral-400">Credit Score</span>
              <Wallet className="h-4 w-4 text-violet-400" />
            </div>
            {scoreLoading ? (
              <div className="text-3xl font-bold text-neutral-600">Loading...</div>
            ) : score > 0 ? (
              <>
                <div className="text-3xl font-bold text-violet-400">{score}</div>
                <Badge className="mt-2 bg-violet-500/10 text-violet-400 border-violet-500/20">
                  {tier}
                </Badge>
              </>
            ) : (
              <div className="text-lg font-medium text-neutral-500">No Credit Score</div>
            )}
          </Card>

          <Card className="bg-neutral-900/50 border-neutral-800 p-6">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-neutral-400">Total Collateral</span>
              <TrendingUp className="h-4 w-4 text-green-400" />
            </div>
            <div className="text-3xl font-bold">${totalCollateral.toFixed(2)}</div>
            <div className="text-sm text-neutral-400 mt-2">USDC</div>
          </Card>

          <Card className="bg-neutral-900/50 border-neutral-800 p-6">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-neutral-400">Total Borrowed</span>
              <Shield className="h-4 w-4 text-blue-400" />
            </div>
            <div className="text-3xl font-bold">${totalDebt.toFixed(2)}</div>
            <div className="text-sm text-neutral-400 mt-2">USDC</div>
          </Card>

          <Card className="bg-neutral-900/50 border-neutral-800 p-6">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-neutral-400">Health Factor</span>
              <AlertTriangle className={`h-4 w-4 ${status?.severity === 'safe' ? 'text-green-400' : status?.severity === 'warning' ? 'text-yellow-400' : status?.severity === 'danger' ? 'text-orange-400' : 'text-red-400'}`} />
            </div>
            {hfLoading ? (
              <div className="text-2xl font-bold text-neutral-600">Loading...</div>
            ) : healthFactor ? (
              <>
                <div className={`text-3xl font-bold ${status?.color === 'green' ? 'text-green-400' : status?.color === 'yellow' ? 'text-yellow-400' : status?.color === 'orange' ? 'text-orange-400' : 'text-red-400'}`}>
                  {healthFactor.toFixed(2)}
                </div>
                <div className="text-sm text-neutral-400 mt-2">{status?.label}</div>
              </>
            ) : (
              <>
                <div className="text-3xl font-bold text-green-400">∞</div>
                <div className="text-sm text-neutral-400 mt-2">No Loans</div>
              </>
            )}
          </Card>
        </div>

        {/* Tabs */}
        <Tabs defaultValue="positions" className="w-full">
          <TabsList className="bg-neutral-900/50 border border-neutral-800">
            <TabsTrigger value="positions">Positions</TabsTrigger>
            <TabsTrigger value="history">History</TabsTrigger>
            <TabsTrigger value="analytics">Analytics</TabsTrigger>
          </TabsList>

          <TabsContent value="positions" className="mt-6">
            <Card className="bg-neutral-900/50 border-neutral-800 p-8">
              <h3 className="text-xl font-semibold mb-4">Your Positions</h3>
              {totalCollateral === 0 && totalDebt === 0 ? (
                <div className="text-center py-12 text-neutral-400">
                  No active positions. Deposit collateral to start borrowing.
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="flex items-center justify-between p-4 bg-neutral-950/50 rounded-lg">
                    <div>
                      <div className="font-medium">Collateral</div>
                      <div className="text-sm text-neutral-400">USDC Deposited</div>
                    </div>
                    <div className="text-right">
                      <div className="font-bold">${totalCollateral.toFixed(2)}</div>
                      <div className="text-sm text-green-400">+0.00%</div>
                    </div>
                  </div>
                  {totalDebt > 0 && (
                    <div className="flex items-center justify-between p-4 bg-neutral-950/50 rounded-lg">
                      <div>
                        <div className="font-medium">Debt</div>
                        <div className="text-sm text-neutral-400">USDC Borrowed</div>
                      </div>
                      <div className="text-right">
                        <div className="font-bold">${totalDebt.toFixed(2)}</div>
                        <div className="text-sm text-blue-400">APR: 5%</div>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </Card>
          </TabsContent>

          <TabsContent value="history" className="mt-6">
            <Card className="bg-neutral-900/50 border-neutral-800 p-8">
              <h3 className="text-xl font-semibold mb-4">Transaction History</h3>
              <div className="text-center py-12 text-neutral-400">
                No transaction history yet
              </div>
            </Card>
          </TabsContent>

          <TabsContent value="analytics" className="mt-6">
            <Card className="bg-neutral-900/50 border-neutral-800 p-8">
              <h3 className="text-xl font-semibold mb-4">Portfolio Analytics</h3>
              <div className="text-center py-12 text-neutral-400">
                Analytics coming soon
              </div>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
