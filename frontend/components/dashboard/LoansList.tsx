"use client";

import { useAccount, useReadContract } from "wagmi";
import { formatUnits } from "viem";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import {
  FileText,
  TrendingUp,
  Clock,
  AlertCircle,
  CheckCircle2,
  XCircle,
} from "lucide-react";
import { CONTRACT_ADDRESSES } from "@/lib/contracts/addresses";

const REGISTRY_ABI = [
  {
    inputs: [{ name: "borrower", type: "address" }],
    name: "getLoanIdsByBorrower",
    outputs: [{ name: "", type: "uint256[]" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [{ name: "loanId", type: "uint256" }],
    name: "getLoan",
    outputs: [
      {
        components: [
          { name: "loanId", type: "uint256" },
          { name: "borrower", type: "address" },
          { name: "principalUsd18", type: "uint256" },
          { name: "repaidUsd18", type: "uint256" },
          { name: "timestamp", type: "uint256" },
          { name: "status", type: "uint8" },
          { name: "lender", type: "address" },
        ],
        name: "",
        type: "tuple",
      },
    ],
    stateMutability: "view",
    type: "function",
  },
] as const;

const VAULT_ABI = [
  {
    inputs: [{ name: "loanId", type: "uint256" }],
    name: "calculateDebt",
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [{ name: "loanId", type: "uint256" }],
    name: "getVaultLoanData",
    outputs: [
      {
        components: [
          { name: "collateralToken", type: "address" },
          { name: "collateralAmount", type: "uint256" },
          { name: "aprBps", type: "uint16" },
          { name: "startTimestamp", type: "uint256" },
          { name: "graceStart", type: "uint256" },
          { name: "exists", type: "bool" },
        ],
        name: "",
        type: "tuple",
      },
    ],
    stateMutability: "view",
    type: "function",
  },
] as const;

const LOAN_STATUS = {
  0: { label: "Unknown", color: "gray", icon: AlertCircle },
  1: { label: "Active", color: "blue", icon: Clock },
  2: { label: "Repaid", color: "green", icon: CheckCircle2 },
  3: { label: "Liquidated", color: "red", icon: XCircle },
};

interface Loan {
  loanId: bigint;
  borrower: string;
  principalUsd18: bigint;
  repaidUsd18: bigint;
  timestamp: bigint;
  status: number;
  lender: string;
}

export function LoansList() {
  const { address, isConnected } = useAccount();

  // Read loan IDs
  const { data: loanIds, isLoading: isLoadingIds } = useReadContract({
    address: CONTRACT_ADDRESSES[421614].CreditRegistryV3 as `0x${string}`,
    abi: REGISTRY_ABI,
    functionName: "getLoanIdsByBorrower",
    args: address ? [address] : undefined,
    query: {
      enabled: !!address,
    },
  });

  if (!isConnected) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Your Loans</CardTitle>
          <CardDescription>Connect your wallet to view your loans</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  if (isLoadingIds) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Your Loans</CardTitle>
          <CardDescription>Loading...</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center h-32">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          </div>
        </CardContent>
      </Card>
    );
  }

  const loans = (loanIds as bigint[]) || [];

  if (loans.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Your Loans
          </CardTitle>
          <CardDescription>Manage your active and past loans</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8 text-muted-foreground">
            <FileText className="h-12 w-12 mx-auto mb-4 opacity-20" />
            <p>No loans yet</p>
            <p className="text-sm mt-1">Create your first loan to get started</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <FileText className="h-5 w-5" />
          Your Loans
        </CardTitle>
        <CardDescription>
          {loans.length} {loans.length === 1 ? "loan" : "loans"} total
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {loans.map((loanId) => (
            <LoanCard key={loanId.toString()} loanId={loanId} />
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

function LoanCard({ loanId }: { loanId: bigint }) {
  // Read loan data from registry
  const { data: loanData } = useReadContract({
    address: CONTRACT_ADDRESSES[421614].CreditRegistryV3 as `0x${string}`,
    abi: REGISTRY_ABI,
    functionName: "getLoan",
    args: [loanId],
  });

  // Read vault data
  const { data: vaultData } = useReadContract({
    address: CONTRACT_ADDRESSES[421614].CreditVaultV3 as `0x${string}`,
    abi: VAULT_ABI,
    functionName: "getVaultLoanData",
    args: [loanId],
  });

  // Calculate current debt
  const { data: currentDebt } = useReadContract({
    address: CONTRACT_ADDRESSES[421614].CreditVaultV3 as `0x${string}`,
    abi: VAULT_ABI,
    functionName: "calculateDebt",
    args: [loanId],
    query: {
      refetchInterval: 30000, // Refetch every 30 seconds
    },
  });

  const loan = loanData as Loan | undefined;
  if (!loan || !vaultData) return null;

  const status = LOAN_STATUS[loan.status as keyof typeof LOAN_STATUS];
  const StatusIcon = status.icon;

  const principal = parseFloat(formatUnits(loan.principalUsd18, 18));
  const repaid = parseFloat(formatUnits(loan.repaidUsd18, 18));
  const debt = currentDebt ? parseFloat(formatUnits(currentDebt, 18)) : 0;
  const apr = Number(vaultData.aprBps) / 100;

  const loanDate = new Date(Number(loan.timestamp) * 1000);
  const daysActive = Math.floor(
    (Date.now() - loanDate.getTime()) / (1000 * 60 * 60 * 24)
  );

  const repaymentProgress = principal > 0 ? (repaid / principal) * 100 : 0;

  return (
    <div className="border rounded-lg p-4 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <div className="font-medium">Loan #{loanId.toString()}</div>
          <div className="text-xs text-muted-foreground">
            {loanDate.toLocaleDateString()} · {daysActive} days active
          </div>
        </div>
        <Badge
          variant="outline"
          className={`${
            status.color === "blue"
              ? "text-blue-700 bg-blue-50 border-blue-200"
              : status.color === "green"
              ? "text-green-700 bg-green-50 border-green-200"
              : status.color === "red"
              ? "text-red-700 bg-red-50 border-red-200"
              : ""
          }`}
        >
          <StatusIcon className="h-3 w-3 mr-1" />
          {status.label}
        </Badge>
      </div>

      {/* Loan Details Grid */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <div className="text-xs text-muted-foreground mb-1">Principal</div>
          <div className="text-lg font-semibold">${principal.toFixed(2)}</div>
        </div>
        <div>
          <div className="text-xs text-muted-foreground mb-1">
            {loan.status === 1 ? "Current Debt" : "Repaid"}
          </div>
          <div className="text-lg font-semibold">
            ${loan.status === 1 ? debt.toFixed(2) : repaid.toFixed(2)}
          </div>
        </div>
        <div>
          <div className="text-xs text-muted-foreground mb-1">Interest Rate</div>
          <div className="font-medium">{apr}% APR</div>
        </div>
        <div>
          <div className="text-xs text-muted-foreground mb-1">Collateral</div>
          <div className="font-medium">
            {formatUnits(vaultData.collateralAmount, 18)} WETH
          </div>
        </div>
      </div>

      {/* Repayment Progress */}
      {loan.status === 1 && (
        <>
          <Separator />
          <div>
            <div className="flex items-center justify-between text-sm mb-2">
              <span className="text-muted-foreground">Repayment Progress</span>
              <span className="font-medium">{repaymentProgress.toFixed(1)}%</span>
            </div>
            <div className="h-2 bg-muted rounded-full overflow-hidden">
              <div
                className="h-full bg-blue-500 transition-all"
                style={{ width: `${Math.min(repaymentProgress, 100)}%` }}
              />
            </div>
            <div className="flex justify-between text-xs text-muted-foreground mt-1">
              <span>${repaid.toFixed(2)} repaid</span>
              <span>${principal.toFixed(2)} total</span>
            </div>
          </div>
        </>
      )}

      {/* Actions */}
      {loan.status === 1 && (
        <>
          <Separator />
          <div className="flex gap-2">
            <Button variant="default" size="sm" className="flex-1">
              <TrendingUp className="h-4 w-4 mr-2" />
              Repay
            </Button>
            <Button variant="outline" size="sm">
              Details
            </Button>
          </div>
        </>
      )}

      {/* Liquidation Warning */}
      {loan.status === 1 && vaultData.graceStart > BigInt(0) && (
        <div className="bg-red-50 dark:bg-red-950 border border-red-200 rounded-lg p-3">
          <div className="flex items-start gap-2">
            <AlertCircle className="h-4 w-4 text-red-600 mt-0.5" />
            <div className="text-sm">
              <div className="font-medium text-red-900 dark:text-red-100">
                Grace Period Active
              </div>
              <div className="text-red-700 dark:text-red-300 text-xs mt-0.5">
                Repay now to avoid liquidation
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
