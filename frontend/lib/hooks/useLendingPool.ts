import { useReadContract, useWriteContract, useAccount } from 'wagmi';
import { getContractAddress } from '../contracts/addresses';
import LendingPoolABI from '../contracts/LendingPoolV1.json';
import { parseUnits, formatUnits } from 'viem';

export function useLendingPool() {
  const { address } = useAccount();

  // Get user's loan count
  const { data: loanCount } = useReadContract({
    address: getContractAddress(421614, 'LendingPoolV1') as `0x${string}`,
    abi: LendingPoolABI,
    functionName: 'getUserLoanCount',
    args: address ? [address] : undefined,
    query: {
      enabled: !!address,
    },
  });

  // Write functions
  const { writeContract, isPending, isSuccess } = useWriteContract();

  const deposit = async (assetAddress: string, amount: string, decimals: number = 6) => {
    return writeContract({
      address: getContractAddress(421614, 'LendingPoolV1') as `0x${string}`,
      abi: LendingPoolABI,
      functionName: 'deposit',
      args: [assetAddress, parseUnits(amount, decimals)],
    });
  };

  const borrow = async (
    borrowAsset: string,
    collateralAsset: string,
    borrowAmount: string,
    collateralAmount: string,
    borrowDecimals: number = 6,
    collateralDecimals: number = 18
  ) => {
    return writeContract({
      address: getContractAddress(421614, 'LendingPoolV1') as `0x${string}`,
      abi: LendingPoolABI,
      functionName: 'borrow',
      args: [
        borrowAsset,
        collateralAsset,
        parseUnits(borrowAmount, borrowDecimals),
        parseUnits(collateralAmount, collateralDecimals),
      ],
    });
  };

  const repay = async (assetAddress: string, amount: string, decimals: number = 6) => {
    return writeContract({
      address: getContractAddress(421614, 'LendingPoolV1') as `0x${string}`,
      abi: LendingPoolABI,
      functionName: 'repay',
      args: [assetAddress, parseUnits(amount, decimals)],
    });
  };

  return {
    loanCount: loanCount ? Number(loanCount) : 0,
    deposit,
    borrow,
    repay,
    isPending,
    isSuccess,
  };
}

export function useLendingPoolStats(assetAddress?: string) {
  const { data: tvl } = useReadContract({
    address: getContractAddress(421614, 'LendingPoolV1') as `0x${string}`,
    abi: LendingPoolABI,
    functionName: 'getTotalValueLocked',
    args: assetAddress ? [assetAddress] : undefined,
    query: {
      enabled: !!assetAddress,
    },
  });

  const { data: utilization } = useReadContract({
    address: getContractAddress(421614, 'LendingPoolV1') as `0x${string}`,
    abi: LendingPoolABI,
    functionName: 'getUtilizationRate',
    args: assetAddress ? [assetAddress] : undefined,
    query: {
      enabled: !!assetAddress,
    },
  });

  const { data: borrowRate } = useReadContract({
    address: getContractAddress(421614, 'LendingPoolV1') as `0x${string}`,
    abi: LendingPoolABI,
    functionName: 'calculateBorrowRate',
    args: assetAddress ? [assetAddress] : undefined,
    query: {
      enabled: !!assetAddress,
    },
  });

  return {
    tvl: tvl ? formatUnits(tvl as bigint, 6) : '0',
    utilization: utilization ? Number(formatUnits(utilization as bigint, 18)) * 100 : 0,
    borrowRate: borrowRate ? Number(formatUnits(borrowRate as bigint, 18)) * 100 : 0,
  };
}
