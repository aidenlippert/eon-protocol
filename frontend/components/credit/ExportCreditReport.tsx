'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { FileDown, Loader2 } from 'lucide-react';
import { downloadCreditReport } from '@/lib/pdf/credit-report';
import { useAccount } from 'wagmi';
import { toast } from 'sonner';

interface ScoreData {
  score: number;
  tier: string;
  breakdown: {
    s1_payment_history: number;
    s2_credit_utilization: number;
    s3_account_age: number;
    s4_identity_trust: number;
    s5_asset_diversity: number;
    s6_protocol_mix: number;
    s7_activity_control: number;
  };
  easAttestation?: string;
}

interface ExportCreditReportProps {
  scoreData: ScoreData;
  kycVerified: boolean;
}

export function ExportCreditReport({ scoreData, kycVerified }: ExportCreditReportProps) {
  const { address } = useAccount();
  const [isGenerating, setIsGenerating] = useState(false);

  const handleExport = async () => {
    if (!address) {
      toast.error('Please connect your wallet');
      return;
    }

    setIsGenerating(true);

    try {
      // Fetch loan history
      const loansRes = await fetch(`/api/loans/${address}`);
      const loansData = await loansRes.json();
      const loans = loansData.loans || [];

      // Calculate stats
      const totalBorrowed = loans.reduce(
        (sum: number, loan: any) => sum + parseFloat(loan.principalUsd18) / 1e18,
        0
      );

      const repaidLoans = loans.filter((loan: any) => loan.status === 'Repaid');
      const totalRepaid = repaidLoans.reduce(
        (sum: number, loan: any) => sum + parseFloat(loan.principalUsd18) / 1e18,
        0
      );

      const onTimePayments = repaidLoans.length; // Simplified - in production, check if repaid before liquidation

      // Generate PDF
      downloadCreditReport({
        address,
        score: scoreData.score,
        tier: scoreData.tier,
        breakdown: scoreData.breakdown,
        loans,
        kycVerified,
        easAttestation: scoreData.easAttestation,
        totalBorrowed,
        totalRepaid,
        onTimePayments,
      });

      toast.success('Credit report downloaded successfully! 📄');
    } catch (error: any) {
      console.error('PDF generation error:', error);
      toast.error('Failed to generate credit report');
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <Button
      onClick={handleExport}
      disabled={isGenerating}
      variant="outline"
      className="w-full sm:w-auto"
    >
      {isGenerating ? (
        <>
          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
          Generating PDF...
        </>
      ) : (
        <>
          <FileDown className="w-4 h-4 mr-2" />
          Export Credit Report
        </>
      )}
    </Button>
  );
}
