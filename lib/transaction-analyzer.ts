/**
 * Real On-Chain Transaction Analyzer
 * Fetches and analyzes actual transaction history from Arbiscan API
 */

export interface Transaction {
  hash: string;
  from: string;
  to: string;
  value: string;
  timeStamp: string;
  isError: string;
  methodId: string;
  functionName: string;
  blockNumber: string;
  gas: string;
  gasPrice: string;
  gasUsed: string;
}

export interface DeFiInteraction {
  protocol: string;
  type: 'swap' | 'lend' | 'borrow' | 'stake' | 'liquidity' | 'transfer' | 'unknown';
  hash: string;
  timestamp: number;
  address: string;
  value: string;
}

export interface WalletAnalysis {
  totalTransactions: number;
  firstTransactionDate: Date | null;
  walletAgeInDays: number;
  defiInteractions: DeFiInteraction[];
  totalVolume: bigint;
  uniqueContracts: Set<string>;
  failedTransactions: number;
  successRate: number;
  avgGasPrice: bigint;
}

// Known DeFi protocol addresses on Arbitrum
const DEFI_PROTOCOLS: Record<string, { name: string; type: string }> = {
  '0x794a61358d6845594f94dc1db02a252b5b4814ad': { name: 'Aave V3 Pool', type: 'lend' },
  '0x68b3465833fb72a70ecdf485e0e4c7bd8665fc45': { name: 'Uniswap V3 Router', type: 'swap' },
  '0x1111111254eeb25477b68fb85ed929f73a960582': { name: '1inch Router', type: 'swap' },
  '0x6a7c8b4b6ed8e2af43c65b5d61a9f1e8e7c8a9b4': { name: 'GMX', type: 'swap' },
  '0xfc5a1a6eb076a2c7ad06ed22c90d7e710e35ad0a': { name: 'GMX Router', type: 'swap' },
};

const ARBISCAN_API_BASE = 'https://api-sepolia.arbiscan.io/api';

export async function fetchTransactionHistory(address: string): Promise<Transaction[]> {
  try {
    const url = `${ARBISCAN_API_BASE}?module=account&action=txlist&address=${address}&startblock=0&endblock=99999999&page=1&offset=1000&sort=asc&apikey=YourApiKeyToken`;

    const response = await fetch(url);
    const data = await response.json();

    if (data.status === '1' && Array.isArray(data.result)) {
      return data.result;
    }

    return [];
  } catch (error) {
    console.error('Failed to fetch transactions:', error);
    return [];
  }
}

export async function analyzeWallet(address: string): Promise<WalletAnalysis> {
  const txs = await fetchTransactionHistory(address);

  if (txs.length === 0) {
    return {
      totalTransactions: 0,
      firstTransactionDate: null,
      walletAgeInDays: 0,
      defiInteractions: [],
      totalVolume: BigInt(0),
      uniqueContracts: new Set(),
      failedTransactions: 0,
      successRate: 0,
      avgGasPrice: BigInt(0),
    };
  }

  // Calculate wallet age
  const firstTx = txs[0];
  const firstTxDate = new Date(Number(firstTx.timeStamp) * 1000);
  const now = new Date();
  const walletAgeInDays = Math.floor((now.getTime() - firstTxDate.getTime()) / (1000 * 60 * 60 * 24));

  // Analyze DeFi interactions
  const defiInteractions: DeFiInteraction[] = [];
  const uniqueContracts = new Set<string>();
  let totalVolume = BigInt(0);
  let failedCount = 0;
  let totalGasPrice = BigInt(0);

  for (const tx of txs) {
    const toAddress = tx.to?.toLowerCase() || '';
    uniqueContracts.add(toAddress);

    if (tx.isError === '1') {
      failedCount++;
    }

    totalVolume += BigInt(tx.value || '0');
    totalGasPrice += BigInt(tx.gasPrice || '0');

    // Check if interaction is with known DeFi protocol
    const protocol = DEFI_PROTOCOLS[toAddress];
    if (protocol) {
      defiInteractions.push({
        protocol: protocol.name,
        type: protocol.type as DeFiInteraction['type'],
        hash: tx.hash,
        timestamp: Number(tx.timeStamp),
        address: tx.to,
        value: tx.value,
      });
    } else if (tx.functionName || tx.methodId !== '0x') {
      // Contract interaction (likely DeFi even if not in our known list)
      defiInteractions.push({
        protocol: 'Unknown Contract',
        type: 'unknown',
        hash: tx.hash,
        timestamp: Number(tx.timeStamp),
        address: tx.to,
        value: tx.value,
      });
    }
  }

  const successRate = txs.length > 0 ? ((txs.length - failedCount) / txs.length) * 100 : 0;
  const avgGasPrice = txs.length > 0 ? totalGasPrice / BigInt(txs.length) : BigInt(0);

  return {
    totalTransactions: txs.length,
    firstTransactionDate: firstTxDate,
    walletAgeInDays,
    defiInteractions,
    totalVolume,
    uniqueContracts,
    failedTransactions: failedCount,
    successRate,
    avgGasPrice,
  };
}

export function calculateRealScore(analysis: WalletAnalysis): {
  total: number;
  breakdown: {
    walletAge: { score: number; max: number; evidence: string };
    txVolume: { score: number; max: number; evidence: string };
    defiInteractions: { score: number; max: number; evidence: string };
    liquidationHistory: { score: number; max: number; evidence: string };
    repaymentHistory: { score: number; max: number; evidence: string };
    balance: { score: number; max: number; evidence: string };
  };
} {
  // 1. Wallet Age (150 points max)
  const walletAgeScore = Math.min((analysis.walletAgeInDays / 365) * 150, 150);

  // 2. Transaction Volume (200 points max)
  const txVolumeScore = Math.min((analysis.totalTransactions / 100) * 200, 200);

  // 3. DeFi Interactions (250 points max)
  const defiScore = Math.min((analysis.defiInteractions.length / 50) * 250, 250);

  // 4. Liquidation History (200 points max) - perfect score if no failures
  const liquidationScore = Math.max(200 - (analysis.failedTransactions * 10), 0);

  // 5. Repayment History (150 points max) - based on success rate
  const repaymentScore = (analysis.successRate / 100) * 150;

  // 6. Balance (50 points max) - placeholder (need real balance)
  const balanceScore = 0;

  const total = Math.round(
    walletAgeScore + txVolumeScore + defiScore + liquidationScore + repaymentScore + balanceScore
  );

  return {
    total,
    breakdown: {
      walletAge: {
        score: Math.round(walletAgeScore),
        max: 150,
        evidence: `Wallet active for ${analysis.walletAgeInDays} days (first tx: ${analysis.firstTransactionDate?.toLocaleDateString() || 'N/A'})`,
      },
      txVolume: {
        score: Math.round(txVolumeScore),
        max: 200,
        evidence: `${analysis.totalTransactions} transactions sent from this wallet`,
      },
      defiInteractions: {
        score: Math.round(defiScore),
        max: 250,
        evidence: `${analysis.defiInteractions.length} DeFi protocol interactions (${[...new Set(analysis.defiInteractions.map(d => d.protocol))].join(', ') || 'None'})`,
      },
      liquidationHistory: {
        score: Math.round(liquidationScore),
        max: 200,
        evidence: `${analysis.failedTransactions} failed transactions out of ${analysis.totalTransactions} (${analysis.successRate.toFixed(1)}% success rate)`,
      },
      repaymentHistory: {
        score: Math.round(repaymentScore),
        max: 150,
        evidence: `${analysis.successRate.toFixed(1)}% transaction success rate`,
      },
      balance: {
        score: Math.round(balanceScore),
        max: 50,
        evidence: 'Balance analysis pending',
      },
    },
  };
}
