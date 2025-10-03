'use client';

import { useAccount } from 'wagmi';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { TrendingUp } from 'lucide-react';

export default function BorrowPage() {
  const { isConnected } = useAccount();

  if (!isConnected) {
    return (
      <div className="container mx-auto px-4 py-32">
        <div className="max-w-2xl mx-auto text-center">
          <h1 className="text-4xl font-bold mb-4">Borrow</h1>
          <p className="text-neutral-400 mb-8">
            Connect your wallet to access lending markets
          </p>
          <div className="text-violet-400">Please connect your wallet to continue</div>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-12">
      <div className="max-w-5xl mx-auto">
        <h1 className="text-4xl font-bold mb-8">Borrow</h1>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card className="bg-neutral-900/50 border-neutral-800 p-8">
            <h2 className="text-2xl font-bold mb-6">Deposit Collateral</h2>
            <p className="text-neutral-400 mb-6">
              Deposit USDC as collateral to borrow against your credit tier
            </p>
            <Button className="w-full bg-violet-600 hover:bg-violet-700">
              <TrendingUp className="mr-2 h-4 w-4" />
              Coming Soon
            </Button>
          </Card>

          <Card className="bg-neutral-900/50 border-neutral-800 p-8">
            <h2 className="text-2xl font-bold mb-6">Borrow USDC</h2>
            <p className="text-neutral-400 mb-6">
              Borrow up to your LTV limit based on your credit tier
            </p>
            <Button className="w-full bg-violet-600 hover:bg-violet-700">
              <TrendingUp className="mr-2 h-4 w-4" />
              Coming Soon
            </Button>
          </Card>
        </div>
      </div>
    </div>
  );
}
