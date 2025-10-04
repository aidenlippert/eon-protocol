"use client";

import { useAccount } from "wagmi";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { CheckCircle2, Shield, ExternalLink, AlertCircle } from "lucide-react";
import { useKYCStatus } from "@/lib/hooks/useKYC";

export function KYCVerification() {
  const { address, isConnected } = useAccount();
  const { isVerified, kycProof } = useKYCStatus(address);

  if (!isConnected || !address) {
    return (
      <Card className="bg-neutral-900/50 border-neutral-800">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            KYC Verification
          </CardTitle>
          <CardDescription>
            Boost your score +150 points
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Alert>
            <AlertDescription>
              Connect wallet to verify
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="bg-neutral-900/50 border-neutral-800">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Shield className="h-5 w-5" />
          KYC Verification
        </CardTitle>
        <CardDescription>
          Boost your score +150 points
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {isVerified ? (
          <Alert variant="success">
            <CheckCircle2 className="h-4 w-4" />
            <AlertDescription>
              <div className="font-semibold">Verified</div>
              <div className="text-xs mt-1">
                Verified at: {kycProof?.verifiedAt ? new Date(Number(kycProof.verifiedAt) * 1000).toLocaleDateString() : 'N/A'}
              </div>
            </AlertDescription>
          </Alert>
        ) : (
          <>
            <Alert variant="warning">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                Complete KYC verification to unlock +150 score bonus
              </AlertDescription>
            </Alert>
            <Button
              className="w-full"
              onClick={() => {
                window.open('https://www.didit.me/', '_blank');
              }}
            >
              <ExternalLink className="h-4 w-4 mr-2" />
              Verify with Didit
            </Button>
            <p className="text-xs text-neutral-400">
              Complete the Didit KYC flow, then submit your proof on-chain
            </p>
          </>
        )}

        <div className="pt-4 border-t border-neutral-800">
          <div className="text-sm text-neutral-400 space-y-1">
            <div className="flex justify-between">
              <span>Privacy-First</span>
              <CheckCircle2 className="h-4 w-4 text-green-400" />
            </div>
            <div className="flex justify-between">
              <span>On-Chain Proof</span>
              <CheckCircle2 className="h-4 w-4 text-green-400" />
            </div>
            <div className="flex justify-between">
              <span>Score Bonus</span>
              <span className="text-violet-400">+150</span>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
