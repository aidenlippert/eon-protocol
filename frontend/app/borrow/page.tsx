'use client';

import { useState } from 'react';
import { useAccount } from 'wagmi';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { TrendingUp, Wallet, Shield } from 'lucide-react';
import { useCreditScore } from '@/lib/hooks/useCreditScore';
import { useLendingPool } from '@/lib/hooks/useLendingPool';
import { getContractAddress } from '@/lib/contracts/addresses';

export default function BorrowPage() {
  const { isConnected } = useAccount();
  const { creditScore, tierLabel } = useCreditScore();
  const { deposit, borrow, repay, isPending } = useLendingPool();

  const [depositAmount, setDepositAmount] = useState('');
  const [borrowAmount, setBorrowAmount] = useState('');
  const [repayAmount, setRepayAmount] = useState('');

  const mockUSDC = getContractAddress(421614, 'MockUSDC');

  const handleDeposit = async () => {
    if (!depositAmount || !mockUSDC) return;
    try {
      await deposit(mockUSDC, depositAmount);
      setDepositAmount('');
    } catch (error) {
      console.error('Deposit failed:', error);
    }
  };

  const handleBorrow = async () => {
    if (!borrowAmount || !depositAmount || !mockUSDC) return;
    try {
      // borrow(borrowAsset, collateralAsset, borrowAmount, collateralAmount)
      await borrow(mockUSDC, mockUSDC, borrowAmount, depositAmount);
      setBorrowAmount('');
    } catch (error) {
      console.error('Borrow failed:', error);
    }
  };

  const handleRepay = async () => {
    if (!repayAmount || !mockUSDC) return;
    try {
      await repay(mockUSDC, repayAmount);
      setRepayAmount('');
    } catch (error) {
      console.error('Repay failed:', error);
    }
  };

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

  const ltv = creditScore?.ltv || 0;
  const score = creditScore?.score || 0;

  return (
    <div className="container mx-auto px-4 py-12">
      <div className="max-w-5xl mx-auto">
        <div className="mb-8">
          <h1 className="text-4xl font-bold mb-2">Borrow</h1>
          <div className="flex items-center gap-3">
            <span className="text-neutral-400">Your Credit Tier:</span>
            {score > 0 ? (
              <>
                <Badge className="bg-violet-500/10 text-violet-400 border-violet-500/20">
                  {tierLabel}
                </Badge>
                <span className="text-sm text-neutral-400">LTV: {ltv}%</span>
              </>
            ) : (
              <span className="text-neutral-500">No Credit Score</span>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
          <Card className="bg-neutral-900/50 border-neutral-800 p-8">
            <div className="flex items-center gap-2 mb-6">
              <Wallet className="h-5 w-5 text-green-400" />
              <h2 className="text-2xl font-bold">Deposit Collateral</h2>
            </div>
            <p className="text-neutral-400 mb-6">
              Deposit USDC as collateral to borrow against your credit tier
            </p>
            <div className="space-y-4">
              <Input
                type="number"
                placeholder="Amount (USDC)"
                value={depositAmount}
                onChange={(e) => setDepositAmount(e.target.value)}
                className="bg-neutral-950/50 border-neutral-800"
              />
              <Button
                className="w-full bg-green-600 hover:bg-green-700"
                onClick={handleDeposit}
                disabled={isPending || !depositAmount}
              >
                <TrendingUp className="mr-2 h-4 w-4" />
                {isPending ? 'Processing...' : 'Deposit USDC'}
              </Button>
            </div>
          </Card>

          <Card className="bg-neutral-900/50 border-neutral-800 p-8">
            <div className="flex items-center gap-2 mb-6">
              <Shield className="h-5 w-5 text-violet-400" />
              <h2 className="text-2xl font-bold">Borrow USDC</h2>
            </div>
            <p className="text-neutral-400 mb-6">
              Borrow up to {ltv}% of your collateral value
            </p>
            <div className="space-y-4">
              <Input
                type="number"
                placeholder="Amount (USDC)"
                value={borrowAmount}
                onChange={(e) => setBorrowAmount(e.target.value)}
                className="bg-neutral-950/50 border-neutral-800"
              />
              <Button
                className="w-full bg-violet-600 hover:bg-violet-700"
                onClick={handleBorrow}
                disabled={isPending || !borrowAmount || score === 0}
              >
                <TrendingUp className="mr-2 h-4 w-4" />
                {isPending ? 'Processing...' : 'Borrow USDC'}
              </Button>
            </div>
          </Card>
        </div>

        <Card className="bg-neutral-900/50 border-neutral-800 p-8">
          <h2 className="text-2xl font-bold mb-6">Repay Loan</h2>
          <div className="space-y-4">
            <Input
              type="number"
              placeholder="Repayment Amount (USDC)"
              value={repayAmount}
              onChange={(e) => setRepayAmount(e.target.value)}
              className="bg-neutral-950/50 border-neutral-800"
            />
            <Button
              className="w-full bg-blue-600 hover:bg-blue-700"
              onClick={handleRepay}
              disabled={isPending || !repayAmount}
            >
              {isPending ? 'Processing...' : 'Repay Loan'}
            </Button>
          </div>
        </Card>
      </div>
    </div>
  );
}
