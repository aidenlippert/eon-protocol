'use client';

import { useAccount } from 'wagmi';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { CreditScoreCard } from '@/components/dashboard/CreditScoreCard';
import { BorrowInterface } from '@/components/borrow/BorrowInterface';
import { LoansList } from '@/components/dashboard/LoansList';
import { StakingInterface } from '@/components/staking/StakingInterface';
import { DiditKYCIntegration } from '@/components/kyc/DiditKYCIntegration';

export default function DashboardPage() {
  const { isConnected } = useAccount();

  if (!isConnected) {
    return (
      <div className="container mx-auto px-4 py-32">
        <div className="max-w-2xl mx-auto text-center">
          <h1 className="text-4xl font-bold mb-4">Dashboard</h1>
          <p className="text-neutral-400 mb-8">
            Connect your wallet to access your DeFi credit profile
          </p>
          <div className="text-violet-400">Please connect your wallet to continue</div>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-12">
      <div className="max-w-7xl mx-auto">
        <h1 className="text-4xl font-bold mb-8">Dashboard</h1>

        {/* Top Grid: Credit Score + KYC */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
          <div className="lg:col-span-2">
            <CreditScoreCard />
          </div>
          <div>
            <DiditKYCIntegration />
          </div>
        </div>

        {/* Main Tabs */}
        <Tabs defaultValue="borrow" className="w-full">
          <TabsList className="bg-neutral-900/50 border border-neutral-800">
            <TabsTrigger value="borrow">Borrow</TabsTrigger>
            <TabsTrigger value="loans">My Loans</TabsTrigger>
            <TabsTrigger value="staking">Staking</TabsTrigger>
          </TabsList>

          <TabsContent value="borrow" className="mt-6">
            <BorrowInterface />
          </TabsContent>

          <TabsContent value="loans" className="mt-6">
            <LoansList />
          </TabsContent>

          <TabsContent value="staking" className="mt-6">
            <StakingInterface />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
