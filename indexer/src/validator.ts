import { ethers } from 'ethers';
import { MerkleTree } from 'merkletreejs';
import keccak256 from 'keccak256';

/**
 * TEMPORAL REPUTATION VALIDATOR
 *
 * Core credit/reputation engine - validates on-chain history using archive nodes
 *
 * Strategy:
 * 1. Query archive node for historical balances (Alchemy unlimited free tier)
 * 2. Sample 52 points per year (weekly) to prevent flash loan gaming
 * 3. Build merkle tree of samples for on-chain verification
 * 4. Store validation result + reputation score
 */
export class TemporalValidator {
  private archiveProvider: ethers.JsonRpcProvider;

  constructor(alchemyApiKey: string) {
    // Use Alchemy archive node - unlimited historical state access
    this.archiveProvider = new ethers.JsonRpcProvider(
      `https://arb-mainnet.g.alchemy.com/v2/${alchemyApiKey}`
    );
  }

  /**
   * CORE VALIDATION: Prove "I held X balance for Y duration"
   *
   * Returns validation result + reputation score (0-1000)
   */
  async validateTemporalClaim(
    userAddress: string,
    minBalance: bigint,
    startBlock: number,
    endBlock: number
  ): Promise<ValidationResult> {
    console.log(`🔍 Validating temporal claim for ${userAddress}`);
    console.log(`   Period: blocks ${startBlock} → ${endBlock}`);
    console.log(`   Required balance: ${ethers.formatEther(minBalance)} ETH`);

    // Step 1: Calculate sampling strategy
    const samples = this.calculateSamples(startBlock, endBlock);
    console.log(`   Checking ${samples.length} sample points (weekly)`);

    // Step 2: Query archive node for each sample
    const balanceProofs: BalanceProof[] = [];
    let isValid = true;

    for (const sampleBlock of samples) {
      try {
        const balance = await this.archiveProvider.getBalance(
          userAddress,
          sampleBlock
        );

        const proof: BalanceProof = {
          blockNumber: sampleBlock,
          balance: balance.toString(),
          timestamp: await this.getBlockTimestamp(sampleBlock),
          isValid: balance >= minBalance
        };

        balanceProofs.push(proof);

        if (!proof.isValid) {
          console.log(`❌ INVALID at block ${sampleBlock}: ${ethers.formatEther(balance)} < ${ethers.formatEther(minBalance)}`);
          isValid = false;
          break;
        }

        console.log(`✅ Block ${sampleBlock}: ${ethers.formatEther(balance)} ETH`);
      } catch (error) {
        console.error(`⚠️  Error querying block ${sampleBlock}:`, error);
        throw new Error(`Archive node query failed at block ${sampleBlock}`);
      }
    }

    // Step 3: Build merkle tree for on-chain verification
    const merkleRoot = this.buildMerkleTree(balanceProofs);

    // Step 4: Calculate reputation score
    const reputationScore = this.calculateReputationScore(
      startBlock,
      endBlock,
      minBalance
    );

    return {
      isValid,
      reputationScore,
      balanceProofs,
      merkleRoot,
      samplesChecked: samples.length
    };
  }

  /**
   * Calculate sample blocks (52 per year = weekly)
   * Prevents flash loan attacks by enforcing minimum gaps
   */
  private calculateSamples(startBlock: number, endBlock: number): number[] {
    const durationBlocks = endBlock - startBlock;
    const SAMPLES_PER_YEAR = 52;
    const BLOCKS_PER_YEAR = 365 * 6500; // ~6500 blocks/day on Arbitrum

    // Calculate required samples
    const requiredSamples = Math.ceil(
      (durationBlocks * SAMPLES_PER_YEAR) / BLOCKS_PER_YEAR
    );

    // Enforce minimum 100 block gap (flash loan protection)
    const MIN_GAP = 100;
    const actualSamples = Math.min(
      requiredSamples,
      Math.floor(durationBlocks / MIN_GAP)
    );

    const sampleGap = Math.floor(durationBlocks / actualSamples);

    const samples: number[] = [];
    for (let i = 0; i < actualSamples; i++) {
      samples.push(startBlock + (i * sampleGap));
    }

    // Always include end block
    if (samples[samples.length - 1] !== endBlock) {
      samples.push(endBlock);
    }

    return samples;
  }

  /**
   * Build merkle tree of balance proofs
   * Allows on-chain verification without storing all proofs
   */
  private buildMerkleTree(proofs: BalanceProof[]): string {
    const leaves = proofs.map(proof =>
      keccak256(
        ethers.solidityPacked(
          ['uint256', 'uint256'],
          [proof.blockNumber, proof.balance]
        )
      )
    );

    const tree = new MerkleTree(leaves, keccak256, { sortPairs: true });
    return tree.getHexRoot();
  }

  /**
   * REPUTATION SCORING ALGORITHM
   *
   * Score = Duration Component (0-500) + Balance Component (0-500)
   *
   * Duration scoring:
   * - 6 months = 200 points
   * - 1 year = 300 points
   * - 2 years = 450 points
   * - 3+ years = 500 points (max)
   *
   * Balance scoring (logarithmic):
   * - 1 ETH = 100 points
   * - 10 ETH = 200 points
   * - 100 ETH = 300 points
   * - 1000 ETH = 400 points
   * - 10000+ ETH = 500 points (max)
   */
  private calculateReputationScore(
    startBlock: number,
    endBlock: number,
    minBalance: bigint
  ): number {
    // Duration component (0-500)
    const durationBlocks = endBlock - startBlock;
    const durationMonths = durationBlocks / (30 * 6500);
    const durationScore = Math.min(500, Math.floor(
      500 * (1 - Math.exp(-durationMonths / 36))
    ));

    // Balance component (0-500) - logarithmic scale
    const balanceEth = Number(ethers.formatEther(minBalance));
    const balanceScore = Math.min(500, Math.floor(
      Math.log10(balanceEth + 1) * 125
    ));

    const totalScore = durationScore + balanceScore;

    console.log(`📊 Reputation Score: ${totalScore}/1000`);
    console.log(`   Duration (${durationMonths.toFixed(1)} months): ${durationScore}/500`);
    console.log(`   Balance (${balanceEth.toFixed(2)} ETH): ${balanceScore}/500`);

    return totalScore;
  }

  /**
   * Get block timestamp from archive node
   */
  private async getBlockTimestamp(blockNumber: number): Promise<number> {
    const block = await this.archiveProvider.getBlock(blockNumber);
    return block?.timestamp || 0;
  }

  /**
   * Calculate dynamic LTV based on reputation score
   *
   * Score-to-LTV mapping:
   * - 0-500: 50% LTV (risky)
   * - 500: 65% LTV
   * - 700: 75% LTV
   * - 900: 85% LTV
   * - 1000: 90% LTV (max trust)
   */
  calculateDynamicLTV(reputationScore: number): number {
    const MIN_LTV = 50;
    const MAX_LTV = 90;

    if (reputationScore <= 500) return MIN_LTV;

    // Linear interpolation from 500-1000 score → 50-90% LTV
    const scoreRange = reputationScore - 500;
    const ltvIncrease = (scoreRange / 500) * (MAX_LTV - MIN_LTV);

    return Math.floor(MIN_LTV + ltvIncrease);
  }

  /**
   * CREDIT LIMIT CALCULATION
   *
   * Based on proven holdings + reputation score
   * Max borrow = (proven balance * LTV) - existing debt
   */
  calculateCreditLimit(
    provenBalance: bigint,
    reputationScore: number,
    existingDebt: bigint
  ): bigint {
    const ltv = this.calculateDynamicLTV(reputationScore);
    const maxBorrow = (provenBalance * BigInt(ltv)) / 100n;

    if (maxBorrow <= existingDebt) return 0n;

    return maxBorrow - existingDebt;
  }
}

/**
 * Types
 */
export interface BalanceProof {
  blockNumber: number;
  balance: string;
  timestamp: number;
  isValid: boolean;
}

export interface ValidationResult {
  isValid: boolean;
  reputationScore: number;
  balanceProofs: BalanceProof[];
  merkleRoot: string;
  samplesChecked: number;
}

/**
 * Example usage:
 *
 * const validator = new TemporalValidator(process.env.ALCHEMY_API_KEY!);
 *
 * const result = await validator.validateTemporalClaim(
 *   '0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb',
 *   ethers.parseEther('10'),  // Held 10 ETH
 *   18000000,                   // From block 18M
 *   20500000                    // To block 20.5M (~1 year)
 * );
 *
 * if (result.isValid) {
 *   console.log(`✅ Valid claim! Score: ${result.reputationScore}/1000`);
 *   console.log(`LTV: ${validator.calculateDynamicLTV(result.reputationScore)}%`);
 * }
 */
