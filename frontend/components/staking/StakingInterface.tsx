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
  Lock,
  Unlock,
  TrendingUp,
  Loader2,
  CheckCircle2,
  Info,
  Gift,
} from "lucide-react";
import { CONTRACT_ADDRESSES } from "@/lib/contracts/addresses";

const REGISTRY_ABI = [
  {
    inputs: [{ name: "amount", type: "uint256" }],
    name: "stake",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [{ name: "amount", type: "uint256" }],
    name: "unstake",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [{ name: "user", type: "address" }],
    name: "getStakeInfo",
    outputs: [
      {
        components: [
          { name: "amount", type: "uint256" },
          { name: "lockUntil", type: "uint256" },
        ],
        name: "",
        type: "tuple",
      },
    ],
    stateMutability: "view",
    type: "function",
  },
] as const;

const TOKEN_ABI = [
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

const STAKE_TIERS = [
  { amount: 100, bonus: 25, label: "Bronze Staker" },
  { amount: 500, bonus: 50, label: "Silver Staker" },
  { amount: 1000, bonus: 75, label: "Gold Staker" },
];

export function StakingInterface() {
  const { address, isConnected } = useAccount();
  const [stakeAmount, setStakeAmount] = useState("");
  const [unstakeAmount, setUnstakeAmount] = useState("");
  const [activeTab, setActiveTab] = useState<"stake" | "unstake">("stake");
  const [error, setError] = useState<string | null>(null);

  // Read staking token balance
  const { data: tokenBalance, refetch: refetchBalance } = useReadContract({
    address: CONTRACT_ADDRESSES[421614].StakingTokenV3 as `0x${string}`,
    abi: TOKEN_ABI,
    functionName: "balanceOf",
    args: address ? [address] : undefined,
    query: {
      enabled: !!address,
    },
  });

  // Read stake info
  const { data: stakeInfo, refetch: refetchStakeInfo } = useReadContract({
    address: CONTRACT_ADDRESSES[421614].CreditRegistryV3 as `0x${string}`,
    abi: REGISTRY_ABI,
    functionName: "getStakeInfo",
    args: address ? [address] : undefined,
    query: {
      enabled: !!address,
    },
  });

  // Read allowance
  const { data: allowance, refetch: refetchAllowance } = useReadContract({
    address: CONTRACT_ADDRESSES[421614].StakingTokenV3 as `0x${string}`,
    abi: TOKEN_ABI,
    functionName: "allowance",
    args: address
      ? [address, CONTRACT_ADDRESSES[421614].CreditRegistryV3 as `0x${string}`]
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

  // Stake transaction
  const {
    writeContract: stake,
    data: stakeHash,
    isPending: isStakePending,
  } = useWriteContract();

  const { isLoading: isStakeConfirming, isSuccess: isStakeSuccess } =
    useWaitForTransactionReceipt({ hash: stakeHash });

  // Unstake transaction
  const {
    writeContract: unstake,
    data: unstakeHash,
    isPending: isUnstakePending,
  } = useWriteContract();

  const { isLoading: isUnstakeConfirming, isSuccess: isUnstakeSuccess } =
    useWaitForTransactionReceipt({ hash: unstakeHash });

  // Handle approve success
  useEffect(() => {
    if (isApproveSuccess) {
      refetchAllowance();
    }
  }, [isApproveSuccess]);

  // Handle stake success
  useEffect(() => {
    if (isStakeSuccess) {
      setStakeAmount("");
      refetchBalance();
      refetchStakeInfo();
      refetchAllowance();
    }
  }, [isStakeSuccess]);

  // Handle unstake success
  useEffect(() => {
    if (isUnstakeSuccess) {
      setUnstakeAmount("");
      refetchBalance();
      refetchStakeInfo();
    }
  }, [isUnstakeSuccess]);

  const stakedAmount = stakeInfo ? Number(formatUnits(stakeInfo.amount, 18)) : 0;
  const lockUntil = stakeInfo ? Number(stakeInfo.lockUntil) : 0;
  const isLocked = lockUntil > Date.now() / 1000;
  const balance = tokenBalance ? Number(formatUnits(tokenBalance, 18)) : 0;

  const currentTier = STAKE_TIERS.slice()
    .reverse()
    .find((tier) => stakedAmount >= tier.amount) || null;

  const nextTier = STAKE_TIERS.find((tier) => stakedAmount < tier.amount) || null;

  const needsApproval =
    stakeAmount &&
    parseFloat(stakeAmount) > 0 &&
    (!allowance || allowance < parseUnits(stakeAmount, 18));

  const handleApprove = async () => {
    if (!stakeAmount) return;
    setError(null);

    try {
      approve({
        address: CONTRACT_ADDRESSES[421614].StakingTokenV3 as `0x${string}`,
        abi: TOKEN_ABI,
        functionName: "approve",
        args: [
          CONTRACT_ADDRESSES[421614].CreditRegistryV3 as `0x${string}`,
          parseUnits(stakeAmount, 18),
        ],
      });
    } catch (err: any) {
      setError(err.message || "Approval failed");
    }
  };

  const handleStake = async () => {
    if (!stakeAmount) return;
    setError(null);

    try {
      stake({
        address: CONTRACT_ADDRESSES[421614].CreditRegistryV3 as `0x${string}`,
        abi: REGISTRY_ABI,
        functionName: "stake",
        args: [parseUnits(stakeAmount, 18)],
      });
    } catch (err: any) {
      setError(err.message || "Staking failed");
    }
  };

  const handleUnstake = async () => {
    if (!unstakeAmount) return;
    setError(null);

    try {
      unstake({
        address: CONTRACT_ADDRESSES[421614].CreditRegistryV3 as `0x${string}`,
        abi: REGISTRY_ABI,
        functionName: "unstake",
        args: [parseUnits(unstakeAmount, 18)],
      });
    } catch (err: any) {
      setError(err.message || "Unstaking failed");
    }
  };

  if (!isConnected) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Stake EON Tokens</CardTitle>
          <CardDescription>Connect your wallet to stake</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Lock className="h-5 w-5" />
          Stake EON Tokens
        </CardTitle>
        <CardDescription>
          Stake EON tokens to boost your S3 (Sybil Resistance) score
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-6">
        {/* Current Stake Summary */}
        <div className="p-4 bg-gradient-to-br from-purple-50 to-blue-50 dark:from-purple-950 dark:to-blue-950 rounded-lg">
          <div className="flex items-center justify-between mb-3">
            <div>
              <div className="text-sm text-muted-foreground mb-1">Your Stake</div>
              <div className="text-3xl font-bold">
                {stakedAmount.toLocaleString()} EON
              </div>
            </div>
            {currentTier && (
              <Badge variant="outline" className="text-purple-700 bg-purple-50 border-purple-200">
                <Gift className="h-3 w-3 mr-1" />
                +{currentTier.bonus} points
              </Badge>
            )}
          </div>

          {isLocked && (
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Lock className="h-3 w-3" />
              Locked until {new Date(lockUntil * 1000).toLocaleDateString()}
            </div>
          )}
        </div>

        {/* Staking Tiers */}
        <div>
          <h3 className="font-semibold mb-3 flex items-center gap-2">
            <TrendingUp className="h-4 w-4" />
            Staking Bonuses
          </h3>
          <div className="space-y-2">
            {STAKE_TIERS.map((tier, index) => {
              const isActive = stakedAmount >= tier.amount;
              const isCurrent = currentTier?.amount === tier.amount;

              return (
                <div
                  key={index}
                  className={`p-3 rounded-lg border transition-all ${
                    isCurrent
                      ? "border-purple-300 bg-purple-50 dark:bg-purple-950"
                      : isActive
                      ? "border-green-300 bg-green-50 dark:bg-green-950"
                      : "border-muted bg-muted/30"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      {isActive ? (
                        <CheckCircle2 className="h-5 w-5 text-green-600" />
                      ) : (
                        <div className="h-5 w-5 rounded-full border-2 border-muted-foreground/30" />
                      )}
                      <div>
                        <div className="font-medium">{tier.label}</div>
                        <div className="text-xs text-muted-foreground">
                          Stake {tier.amount}+ EON
                        </div>
                      </div>
                    </div>
                    <Badge variant="outline">+{tier.bonus} points</Badge>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {nextTier && (
          <Alert className="border-blue-200 bg-blue-50 dark:bg-blue-950">
            <Info className="h-4 w-4" />
            <AlertDescription>
              Stake {(nextTier.amount - stakedAmount).toFixed(0)} more EON to unlock +
              {nextTier.bonus} points
            </AlertDescription>
          </Alert>
        )}

        <Separator />

        {/* Tabs */}
        <div className="flex gap-2">
          <Button
            variant={activeTab === "stake" ? "default" : "outline"}
            onClick={() => setActiveTab("stake")}
            className="flex-1"
          >
            <Lock className="h-4 w-4 mr-2" />
            Stake
          </Button>
          <Button
            variant={activeTab === "unstake" ? "default" : "outline"}
            onClick={() => setActiveTab("unstake")}
            className="flex-1"
          >
            <Unlock className="h-4 w-4 mr-2" />
            Unstake
          </Button>
        </div>

        {/* Stake Form */}
        {activeTab === "stake" && (
          <div className="space-y-4">
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-sm font-medium">Stake Amount</label>
                <div className="text-xs text-muted-foreground">
                  Balance: {balance.toLocaleString()} EON
                </div>
              </div>
              <div className="relative">
                <Input
                  type="number"
                  placeholder="0.0"
                  value={stakeAmount}
                  onChange={(e) => setStakeAmount(e.target.value)}
                  className="pr-16"
                />
                <div className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
                  EON
                </div>
              </div>
              <Button
                variant="link"
                size="sm"
                className="h-auto p-0 mt-1 text-xs"
                onClick={() => setStakeAmount(balance.toString())}
              >
                Use max
              </Button>
            </div>

            {error && (
              <Alert variant="destructive">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            {needsApproval ? (
              <Button
                onClick={handleApprove}
                disabled={
                  !stakeAmount ||
                  parseFloat(stakeAmount) === 0 ||
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
                  <>Approve EON</>
                )}
              </Button>
            ) : (
              <Button
                onClick={handleStake}
                disabled={
                  !stakeAmount ||
                  parseFloat(stakeAmount) === 0 ||
                  isStakePending ||
                  isStakeConfirming
                }
                className="w-full"
                size="lg"
              >
                {isStakePending || isStakeConfirming ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    {isStakePending ? "Staking..." : "Confirming..."}
                  </>
                ) : (
                  <>
                    <Lock className="mr-2 h-4 w-4" />
                    Stake {stakeAmount || "0"} EON
                  </>
                )}
              </Button>
            )}

            {isStakeSuccess && (
              <Alert className="border-green-500 bg-green-50 dark:bg-green-950">
                <CheckCircle2 className="h-4 w-4 text-green-600" />
                <AlertDescription className="text-green-900 dark:text-green-100">
                  Successfully staked! Your score will update shortly.
                </AlertDescription>
              </Alert>
            )}

            <div className="text-xs text-muted-foreground">
              <Info className="h-3 w-3 inline mr-1" />
              Staked tokens are locked for 30 days
            </div>
          </div>
        )}

        {/* Unstake Form */}
        {activeTab === "unstake" && (
          <div className="space-y-4">
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-sm font-medium">Unstake Amount</label>
                <div className="text-xs text-muted-foreground">
                  Staked: {stakedAmount.toLocaleString()} EON
                </div>
              </div>
              <div className="relative">
                <Input
                  type="number"
                  placeholder="0.0"
                  value={unstakeAmount}
                  onChange={(e) => setUnstakeAmount(e.target.value)}
                  max={stakedAmount}
                  disabled={isLocked}
                  className="pr-16"
                />
                <div className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
                  EON
                </div>
              </div>
              <Button
                variant="link"
                size="sm"
                className="h-auto p-0 mt-1 text-xs"
                onClick={() => setUnstakeAmount(stakedAmount.toString())}
                disabled={isLocked}
              >
                Unstake all
              </Button>
            </div>

            {isLocked && (
              <Alert variant="destructive">
                <AlertDescription>
                  Tokens are locked until {new Date(lockUntil * 1000).toLocaleString()}
                </AlertDescription>
              </Alert>
            )}

            {error && !isLocked && (
              <Alert variant="destructive">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            <Button
              onClick={handleUnstake}
              disabled={
                !unstakeAmount ||
                parseFloat(unstakeAmount) === 0 ||
                isLocked ||
                isUnstakePending ||
                isUnstakeConfirming
              }
              className="w-full"
              size="lg"
              variant="outline"
            >
              {isUnstakePending || isUnstakeConfirming ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  {isUnstakePending ? "Unstaking..." : "Confirming..."}
                </>
              ) : (
                <>
                  <Unlock className="mr-2 h-4 w-4" />
                  Unstake {unstakeAmount || "0"} EON
                </>
              )}
            </Button>

            {isUnstakeSuccess && (
              <Alert className="border-green-500 bg-green-50 dark:bg-green-950">
                <CheckCircle2 className="h-4 w-4 text-green-600" />
                <AlertDescription className="text-green-900 dark:text-green-100">
                  Successfully unstaked! Tokens returned to your wallet.
                </AlertDescription>
              </Alert>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
