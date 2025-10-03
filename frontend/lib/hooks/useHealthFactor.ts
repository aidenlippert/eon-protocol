import { useReadContract, useAccount } from 'wagmi';
import { getContractAddress } from '../contracts/addresses';
import HealthFactorMonitorABI from '../contracts/HealthFactorMonitor.json';
import { formatUnits } from 'viem';

export function useHealthFactor(loanId?: number) {
  const { address } = useAccount();

  const { data: healthFactor, isLoading } = useReadContract({
    address: getContractAddress(421614, 'HealthFactorMonitor') as `0x${string}`,
    abi: HealthFactorMonitorABI,
    functionName: 'calculateHealthFactor',
    args: address && loanId !== undefined ? [address, BigInt(loanId)] : undefined,
    query: {
      enabled: !!address && loanId !== undefined,
    },
  });

  const hf = healthFactor ? Number(formatUnits(healthFactor as bigint, 18)) : null;

  const status = hf ? getHealthStatus(hf) : null;
  const isLiquidatable = hf ? hf < 1.0 : false;

  return {
    healthFactor: hf,
    status,
    isLiquidatable,
    isLoading,
  };
}

function getHealthStatus(hf: number): {
  label: string;
  color: string;
  severity: 'safe' | 'warning' | 'danger' | 'critical';
} {
  if (hf >= 1.5) {
    return { label: 'Healthy', color: 'green', severity: 'safe' };
  } else if (hf >= 1.2) {
    return { label: 'Moderate', color: 'yellow', severity: 'warning' };
  } else if (hf >= 1.0) {
    return { label: 'At Risk', color: 'orange', severity: 'danger' };
  } else {
    return { label: 'Liquidatable', color: 'red', severity: 'critical' };
  }
}
