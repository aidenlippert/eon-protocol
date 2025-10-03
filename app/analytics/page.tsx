'use client';

import { useReadContract } from 'wagmi';
import { Card } from '@/components/ui/card';
import { CONTRACTS } from '@/lib/contracts';
import { INSURANCE_FUND_ABI } from '@/lib/abi';
import { formatUnits } from 'viem';
import { Shield, DollarSign, AlertTriangle } from 'lucide-react';

export default function AnalyticsPage() {
  const { data: insuranceStats } = useReadContract({
    address: CONTRACTS.InsuranceFund as `0x${string}`,
    abi: INSURANCE_FUND_ABI,
    functionName: 'getStatistics',
  });

  const totalCovered = insuranceStats ? Number(formatUnits(insuranceStats[0], 6)) : 0;
  const totalPaidOut = insuranceStats ? Number(formatUnits(insuranceStats[1], 6)) : 0;
  const totalDefaults = insuranceStats ? Number(insuranceStats[2]) : 0;

  return (
    <div className="container mx-auto px-4 py-12">
      <div className="max-w-7xl mx-auto">
        <h1 className="text-4xl font-bold mb-8">Protocol Analytics</h1>

        {/* Protocol Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <Card className="bg-neutral-900/50 border-neutral-800 p-6">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-neutral-400">Total Value Locked</span>
              <DollarSign className="h-4 w-4 text-green-400" />
            </div>
            <div className="text-3xl font-bold">${totalCovered.toFixed(2)}</div>
            <div className="text-sm text-neutral-400 mt-2">Across all pools</div>
          </Card>

          <Card className="bg-neutral-900/50 border-neutral-800 p-6">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-neutral-400">Insurance Pool</span>
              <Shield className="h-4 w-4 text-violet-400" />
            </div>
            <div className="text-3xl font-bold text-violet-400">${totalCovered.toFixed(2)}</div>
            <div className="text-sm text-neutral-400 mt-2">Available coverage</div>
          </Card>

          <Card className="bg-neutral-900/50 border-neutral-800 p-6">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-neutral-400">Default Rate</span>
              <AlertTriangle className="h-4 w-4 text-yellow-400" />
            </div>
            <div className="text-3xl font-bold">{totalDefaults}</div>
            <div className="text-sm text-neutral-400 mt-2">Total defaults</div>
          </Card>
        </div>

        {/* Insurance Fund Details */}
        <Card className="bg-neutral-900/50 border-neutral-800 p-8 mb-8">
          <h2 className="text-2xl font-bold mb-6">Insurance Fund</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div>
              <div className="text-sm text-neutral-400 mb-1">Total Coverage</div>
              <div className="text-2xl font-bold">${totalCovered.toFixed(2)}</div>
            </div>
            <div>
              <div className="text-sm text-neutral-400 mb-1">Claims Paid</div>
              <div className="text-2xl font-bold">${totalPaidOut.toFixed(2)}</div>
            </div>
            <div>
              <div className="text-sm text-neutral-400 mb-1">Success Rate</div>
              <div className="text-2xl font-bold text-green-400">
                {totalDefaults > 0 ? ((1 - totalPaidOut / totalCovered) * 100).toFixed(1) : '100'}%
              </div>
            </div>
          </div>
        </Card>

        {/* Markets */}
        <Card className="bg-neutral-900/50 border-neutral-800 p-8">
          <h2 className="text-2xl font-bold mb-6">Active Markets</h2>
          <div className="space-y-4">
            <div className="flex items-center justify-between p-4 bg-neutral-950/50 rounded-lg">
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 rounded-full bg-blue-500/10 flex items-center justify-center">
                  <DollarSign className="h-5 w-5 text-blue-400" />
                </div>
                <div>
                  <div className="font-medium">USDC</div>
                  <div className="text-sm text-neutral-400">Arbitrum Sepolia</div>
                </div>
              </div>
              <div className="text-right">
                <div className="font-bold">${totalCovered.toFixed(2)}</div>
                <div className="text-sm text-neutral-400">TVL</div>
              </div>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}
