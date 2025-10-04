"use client";

import { useState, useEffect } from "react";
import { useAccount, useReadContract, useWriteContract, useWaitForTransactionReceipt } from "wagmi";
import { parseUnits, formatUnits } from "viem";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Separator } from "@/components/ui/separator";
import {
  TrendingDown,
  Loader2,
  CheckCircle2,
  AlertTriangle,
  Info,
  DollarSign,
  Wallet,
} from "lucide-react";
import { CONTRACT_ADDRESSES } from "@/lib/contracts/addresses";

const VAULT_ABI = [
  {
    inputs: [
      { name: "collateralToken", type: "address" },
      { name: "collateralAmount", type: "uint256" },
      { name: "principalUsd18", type: "uint256" },
    ],
    name: "borrow",
    outputs: [{ name: "loanId", type: "uint256" }],
    stateMutability: "nonpayable",
    type: "function",
  },
] as const;

const ORACLE_ABI = [
  {
    inputs: [{ name: "subject", type: "address" }],
    name: "computeScore",
    outputs: [
      {
        components: [
          { name: "overall", type: "uint16" },
          { name: "s1_repayment", type: "uint8" },
          { name: "s2_collateral", type: "uint8" },
          { name: "s3_sybil", type: "uint8" },
          { name: "s4_crossChain", type: "uint8" },
          { name: "s5_governance", type: "uint8" },
          { name: "s3_raw", type: "int16" },
        ],
        name: "",
        type: "tuple",
      },
    ],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [{ name: "overall", type: "uint16" }],
    name: "getAPR",
    outputs: [{ name: "aprBps", type: "uint16" }],
    stateMutability: "pure",
    type: "function",
  },
] as const;

const ERC20_ABI = [
  {
    inputs: [{ name: "owner", type: "address" }],
    name: "balanceOf",
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [
      { name: "spender", type: "address" },
      { name: "amount", type: "uint256" },
    ],
    name: "approve",
    outputs: [{ name: "", type: "bool" }],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [
      { name: "owner", type: "address" },
      { name: "spender", type: "address" },
    ],
    name: "allowance",
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
    type: "function",
  },
] as const;

const COLLATERAL_OPTIONS = [
  {
    symbol: "WETH",
    name: "Wrapped Ether",
    address: CONTRACT_ADDRESSES[421614].MockWETH as `0x${string}`,
    decimals: 18,
    price: 2000, // $2000 per WETH
  },
  {
    symbol: "USDC",
    name: "USD Coin",
    address: CONTRACT_ADDRESSES[421614].MockUSDC as `0x${string}`,
    decimals: 6,
    price: 1, // $1 per USDC
  },
];

const LTV_BY_TIER = [50, 70, 80, 90];
const TIER_NAMES = ["Bronze", "Silver", "Gold", "Platinum"];

export function BorrowInterface() {
  const { address, isConnected } = useAccount();

  // State
  const [selectedCollateral, setSelectedCollateral] = useState(COLLATERAL_OPTIONS[0]);
  const [collateralAmount, setCollateralAmount] = useState("");
  const [borrowAmount, setBorrowAmount] = useState("");
  const [step, setStep] = useState<"input" | "approve" | "borrow">("input");
  const [error, setError] = useState<string | null>(null);

  // Read user's credit score
  const { data: scoreData } = useReadContract({
    address: CONTRACT_ADDRESSES[421614].ScoreOraclePhase3B as `0x${string}`,
    abi: ORACLE_ABI,
    functionName: "computeScore",
    args: address ? [address] : undefined,
    query: {
      enabled: !!address,
    },
  });

  // Read APR based on score
  const { data: aprBps } = useReadContract({
    address: CONTRACT_ADDRESSES[421614].ScoreOraclePhase3B as `0x${string}`,
    abi: ORACLE_ABI,
    functionName: "getAPR",
    args: scoreData ? [scoreData.overall] : undefined,
    query: {
      enabled: !!scoreData,
    },
  });

  // Read collateral balance
  const { data: collateralBalance, refetch: refetchBalance } = useReadContract({
    address: selectedCollateral.address,
    abi: ERC20_ABI,
    functionName: "balanceOf",
    args: address ? [address] : undefined,
    query: {
      enabled: !!address,
    },
  });

  // Read allowance
  const { data: allowance, refetch: refetchAllowance } = useReadContract({
    address: selectedCollateral.address,
    abi: ERC20_ABI,
    functionName: "allowance",
    args: address
      ? [address, CONTRACT_ADDRESSES[421614].CreditVaultV3 as `0x${string}`]
      : undefined,
    query: {
      enabled: !!address,
    },
  });

  // Approve transaction
  const {
    writeContract: approve,
    data: approveHash,
    isPending: isApprovePending,
  } = useWriteContract();

  const { isLoading: isApproveConfirming, isSuccess: isApproveSuccess } =
    useWaitForTransactionReceipt({ hash: approveHash });

  // Borrow transaction
  const {
    writeContract: borrow,
    data: borrowHash,
    isPending: isBorrowPending,
  } = useWriteContract();

  const { isLoading: isBorrowConfirming, isSuccess: isBorrowSuccess } =
    useWaitForTransactionReceipt({ hash: borrowHash });

  // Calculate values
  const score = scoreData?.overall ? Number(scoreData.overall) : 0;
  const tier = score >= 90 ? 3 : score >= 75 ? 2 : score >= 60 ? 1 : 0;
  const maxLTV = LTV_BY_TIER[tier];
  const apr = aprBps ? Number(aprBps) / 100 : 0;

  const collateralValue = collateralAmount
    ? parseFloat(collateralAmount) * selectedCollateral.price
    : 0;

  const maxBorrowAmount = collateralValue * (maxLTV / 100);

  const currentLTV = collateralValue > 0 && borrowAmount
    ? (parseFloat(borrowAmount) / collateralValue) * 100
    : 0;

  const needsApproval =
    collateralAmount &&
    parseFloat(collateralAmount) > 0 &&
    (!allowance ||
      allowance < parseUnits(collateralAmount, selectedCollateral.decimals));

  // Handle approve success
  useEffect(() => {
    if (isApproveSuccess) {
      refetchAllowance();
      setStep("borrow");
    }
  }, [isApproveSuccess]);

  // Handle borrow success
  useEffect(() => {
    if (isBorrowSuccess) {
      setCollateralAmount("");
      setBorrowAmount("");
      setStep("input");
      refetchBalance();
      refetchAllowance();
    }
  }, [isBorrowSuccess]);

  const handleApprove = async () => {
    if (!collateralAmount) return;
    setError(null);

    try {
      approve({
        address: selectedCollateral.address,
        abi: ERC20_ABI,
        functionName: "approve",
        args: [
          CONTRACT_ADDRESSES[421614].CreditVaultV3 as `0x${string}`,
          parseUnits(collateralAmount, selectedCollateral.decimals),
        ],
      });
    } catch (err: any) {
      setError(err.message || "Approval failed");
    }
  };

  const handleBorrow = async () => {
    if (!collateralAmount || !borrowAmount) return;
    setError(null);

    try {
      borrow({
        address: CONTRACT_ADDRESSES[421614].CreditVaultV3 as `0x${string}`,
        abi: VAULT_ABI,
        functionName: "borrow",
        args: [
          selectedCollateral.address,
          parseUnits(collateralAmount, selectedCollateral.decimals),
          parseUnits(borrowAmount, 18), // USD with 18 decimals
        ],
      });
    } catch (err: any) {
      setError(err.message || "Borrow failed");
    }
  };

  if (!isConnected) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Borrow</CardTitle>
          <CardDescription>Connect your wallet to borrow</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <TrendingDown className="h-5 w-5" />
          Borrow
        </CardTitle>
        <CardDescription>
          Borrow stablecoins against your collateral based on your credit score
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-6">
        {/* Credit Score Summary */}
        <div className="grid grid-cols-3 gap-4 p-4 bg-muted/50 rounded-lg">
          <div>
            <div className="text-xs text-muted-foreground mb-1">Credit Score</div>
            <div className="text-2xl font-bold">{score}</div>
            <Badge variant="outline" className="mt-1">
              {TIER_NAMES[tier]}
            </Badge>
          </div>
          <div>
            <div className="text-xs text-muted-foreground mb-1">Your APR</div>
            <div className="text-2xl font-bold">{apr}%</div>
          </div>
          <div>
            <div className="text-xs text-muted-foreground mb-1">Max LTV</div>
            <div className="text-2xl font-bold">{maxLTV}%</div>
          </div>
        </div>

        {/* Collateral Selection */}
        <div>
          <label className="text-sm font-medium mb-2 block">Select Collateral</label>
          <div className="grid grid-cols-2 gap-2">
            {COLLATERAL_OPTIONS.map((option) => (
              <Button
                key={option.symbol}
                variant={
                  selectedCollateral.symbol === option.symbol ? "default" : "outline"
                }
                onClick={() => setSelectedCollateral(option)}
                className="justify-start"
              >
                <Wallet className="h-4 w-4 mr-2" />
                {option.symbol}
              </Button>
            ))}
          </div>
        </div>

        {/* Collateral Amount */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="text-sm font-medium">Collateral Amount</label>
            <div className="text-xs text-muted-foreground">
              Balance:{" "}
              {collateralBalance
                ? formatUnits(collateralBalance, selectedCollateral.decimals)
                : "0"}{" "}
              {selectedCollateral.symbol}
            </div>
          </div>
          <div className="relative">
            <Input
              type="number"
              placeholder="0.0"
              value={collateralAmount}
              onChange={(e) => setCollateralAmount(e.target.value)}
              className="pr-20"
            />
            <div className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
              {selectedCollateral.symbol}
            </div>
          </div>
          {collateralValue > 0 && (
            <div className="text-xs text-muted-foreground mt-1">
              ≈ ${collateralValue.toFixed(2)} USD
            </div>
          )}
        </div>

        {/* Borrow Amount */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="text-sm font-medium">Borrow Amount (USD)</label>
            <div className="text-xs text-muted-foreground">
              Max: ${maxBorrowAmount.toFixed(2)}
            </div>
          </div>
          <div className="relative">
            <Input
              type="number"
              placeholder="0.0"
              value={borrowAmount}
              onChange={(e) => setBorrowAmount(e.target.value)}
              max={maxBorrowAmount}
              className="pr-12"
            />
            <DollarSign className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          </div>
          {collateralValue > 0 && (
            <Button
              variant="link"
              size="sm"
              className="h-auto p-0 mt-1 text-xs"
              onClick={() => setBorrowAmount(maxBorrowAmount.toFixed(2))}
            >
              Use max ({maxLTV}% LTV)
            </Button>
          )}
        </div>

        {/* LTV Warning */}
        {currentLTV > 0 && (
          <Alert
            variant={currentLTV > maxLTV ? "destructive" : "default"}
            className={currentLTV > maxLTV ? "" : "border-blue-200 bg-blue-50 dark:bg-blue-950"}
          >
            <Info className="h-4 w-4" />
            <AlertDescription>
              <div className="flex items-center justify-between">
                <span>Current LTV: {currentLTV.toFixed(1)}%</span>
                {currentLTV > maxLTV && (
                  <span className="text-xs">
                    Exceeds max LTV of {maxLTV}%
                  </span>
                )}
              </div>
              <div className="mt-2 h-2 bg-muted rounded-full overflow-hidden">
                <div
                  className={`h-full transition-all ${
                    currentLTV > maxLTV ? "bg-red-500" : "bg-blue-500"
                  }`}
                  style={{ width: `${Math.min(currentLTV, 100)}%` }}
                />
              </div>
            </AlertDescription>
          </Alert>
        )}

        {/* Loan Summary */}
        {borrowAmount && parseFloat(borrowAmount) > 0 && (
          <div className="p-4 border rounded-lg space-y-2">
            <div className="font-medium mb-2">Loan Summary</div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Borrow Amount</span>
              <span className="font-medium">${borrowAmount}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Collateral</span>
              <span className="font-medium">
                {collateralAmount} {selectedCollateral.symbol}
              </span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">LTV Ratio</span>
              <span className="font-medium">{currentLTV.toFixed(1)}%</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Interest Rate</span>
              <span className="font-medium">{apr}% APR</span>
            </div>
            <Separator className="my-2" />
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Est. Interest (30 days)</span>
              <span className="font-medium">
                ${((parseFloat(borrowAmount) * apr) / 100 / 12).toFixed(2)}
              </span>
            </div>
          </div>
        )}

        {/* Error Message */}
        {error && (
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {/* Action Buttons */}
        <div className="space-y-2">
          {needsApproval ? (
            <Button
              onClick={handleApprove}
              disabled={
                !collateralAmount ||
                parseFloat(collateralAmount) === 0 ||
                isApprovePending ||
                isApproveConfirming
              }
              className="w-full"
              size="lg"
            >
              {isApprovePending || isApproveConfirming ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  {isApprovePending ? "Approving..." : "Confirming..."}
                </>
              ) : (
                <>Approve {selectedCollateral.symbol}</>
              )}
            </Button>
          ) : (
            <Button
              onClick={handleBorrow}
              disabled={
                !borrowAmount ||
                parseFloat(borrowAmount) === 0 ||
                currentLTV > maxLTV ||
                isBorrowPending ||
                isBorrowConfirming
              }
              className="w-full"
              size="lg"
            >
              {isBorrowPending || isBorrowConfirming ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  {isBorrowPending ? "Borrowing..." : "Confirming..."}
                </>
              ) : (
                <>Borrow ${borrowAmount || "0"}</>
              )}
            </Button>
          )}

          {isBorrowSuccess && (
            <Alert className="border-green-500 bg-green-50 dark:bg-green-950">
              <CheckCircle2 className="h-4 w-4 text-green-600" />
              <AlertDescription className="text-green-900 dark:text-green-100">
                Loan created successfully! View in your dashboard.
              </AlertDescription>
            </Alert>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
