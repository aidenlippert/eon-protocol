import { ethers } from 'ethers';
import { PrismaClient } from '@prisma/client';
import { TemporalValidator } from './validator';

/**
 * CREDIT ENGINE - Core DeFi Reputation System
 *
 * Manages:
 * 1. User credit scores (0-1000)
 * 2. Dynamic LTV calculations
 * 3. Borrowing power estimation
 * 4. Risk assessment
 * 5. Credit history tracking
 */
export class CreditEngine {
  private db: PrismaClient;
  private validator: TemporalValidator;
  private provider: ethers.JsonRpcProvider;

  constructor(
    alchemyApiKey: string,
    rpcUrl: string
  ) {
    this.db = new PrismaClient();
    this.validator = new TemporalValidator(alchemyApiKey);
    this.provider = new ethers.JsonRpcProvider(rpcUrl);
  }

  /**
   * GET USER CREDIT PROFILE
   *
   * Returns complete credit/reputation data for lending decisions
   */
  async getCreditProfile(userAddress: string): Promise<CreditProfile> {
    const normalized = userAddress.toLowerCase();

    // Get latest reputation from DB
    const reputation = await this.db.reputation.findUnique({
      where: { userAddress: normalized }
    });

    // Get all accepted claims (credit history)
    const claims = await this.db.claim.findMany({
      where: {
        user: normalized,
        status: 'ACCEPTED'
      },
      orderBy: { createdAt: 'desc' }
    });

    // Calculate current on-chain balance
    const currentBalance = await this.provider.getBalance(userAddress);

    // Get active borrows across all chains
    const activeDebt = await this.getActiveDebt(userAddress);

    // Calculate credit metrics
    const reputationScore = reputation?.score || 0;
    const ltv = this.validator.calculateDynamicLTV(reputationScore);
    const creditLimit = this.validator.calculateCreditLimit(
      currentBalance,
      reputationScore,
      activeDebt
    );

    // Risk assessment
    const riskTier = this.calculateRiskTier(reputationScore, claims.length);

    return {
      userAddress: normalized,
      reputationScore,
      ltv,
      currentBalance: currentBalance.toString(),
      activeDebt: activeDebt.toString(),
      availableCredit: creditLimit.toString(),
      claimsAccepted: claims.length,
      accountAge: reputation?.ageMonths || 0,
      riskTier,
      lastUpdated: reputation?.updatedAt || new Date()
    };
  }

  /**
   * ESTIMATE BORROWING POWER
   *
   * Simulate credit limit without submitting claim
   */
  async estimateBorrowingPower(
    userAddress: string,
    minBalance: bigint,
    durationMonths: number
  ): Promise<BorrowingEstimate> {
    // Simulate reputation score
    const durationBlocks = durationMonths * 30 * 6500;
    const startBlock = await this.provider.getBlockNumber() - durationBlocks;
    const endBlock = await this.provider.getBlockNumber();

    const simulatedScore = this.validator['calculateReputationScore'](
      startBlock,
      endBlock,
      minBalance
    );

    const ltv = this.validator.calculateDynamicLTV(simulatedScore);
    const maxBorrow = (minBalance * BigInt(ltv)) / 100n;

    return {
      estimatedScore: simulatedScore,
      ltv,
      maxBorrowAmount: maxBorrow.toString(),
      requiredProof: {
        minBalance: minBalance.toString(),
        durationMonths
      }
    };
  }

  /**
   * VALIDATE AND UPDATE CREDIT SCORE
   *
   * Called when claim is accepted on-chain
   */
  async updateCreditScore(
    userAddress: string,
    claimId: string
  ): Promise<void> {
    const claim = await this.db.claim.findUnique({
      where: { claimId }
    });

    if (!claim) throw new Error('Claim not found');

    // Validate claim with archive node
    const validation = await this.validator.validateTemporalClaim(
      userAddress,
      BigInt(claim.minBalance),
      claim.startBlock,
      claim.endBlock
    );

    if (!validation.isValid) {
      throw new Error('Claim validation failed');
    }

    // Update reputation in DB
    await this.db.reputation.upsert({
      where: { userAddress: userAddress.toLowerCase() },
      create: {
        userAddress: userAddress.toLowerCase(),
        score: validation.reputationScore,
        ageMonths: this.calculateAgeMonths(claim.startBlock, claim.endBlock),
        lastClaimId: claimId,
        updatedAt: new Date()
      },
      update: {
        score: validation.reputationScore,
        ageMonths: this.calculateAgeMonths(claim.startBlock, claim.endBlock),
        lastClaimId: claimId,
        updatedAt: new Date()
      }
    });

    console.log(`✅ Credit score updated for ${userAddress}: ${validation.reputationScore}/1000`);
  }

  /**
   * CHECK CREDITWORTHINESS
   *
   * Determine if user qualifies for loan
   */
  async checkCreditworthiness(
    userAddress: string,
    requestedAmount: bigint
  ): Promise<CreditDecision> {
    const profile = await this.getCreditProfile(userAddress);
    const availableCredit = BigInt(profile.availableCredit);

    // Decision criteria
    const hasReputation = profile.reputationScore >= 500;
    const hasCapacity = availableCredit >= requestedAmount;
    const notOverextended = BigInt(profile.activeDebt) < BigInt(profile.currentBalance) / 2n;

    const approved = hasReputation && hasCapacity && notOverextended;

    return {
      approved,
      requestedAmount: requestedAmount.toString(),
      availableCredit: profile.availableCredit,
      reputationScore: profile.reputationScore,
      ltv: profile.ltv,
      reasons: this.getDecisionReasons(
        approved,
        hasReputation,
        hasCapacity,
        notOverextended
      )
    };
  }

  /**
   * Calculate risk tier (A-F)
   */
  private calculateRiskTier(score: number, claimCount: number): RiskTier {
    if (score >= 900 && claimCount >= 3) return 'A';
    if (score >= 800 && claimCount >= 2) return 'B';
    if (score >= 700 && claimCount >= 1) return 'C';
    if (score >= 600) return 'D';
    if (score >= 500) return 'E';
    return 'F';
  }

  /**
   * Calculate account age in months
   */
  private calculateAgeMonths(startBlock: number, endBlock: number): number {
    const durationBlocks = endBlock - startBlock;
    return Math.floor(durationBlocks / (30 * 6500));
  }

  /**
   * Get active debt across all chains
   * TODO: Implement cross-chain debt aggregation via LayerZero
   */
  private async getActiveDebt(userAddress: string): Promise<bigint> {
    // Placeholder - will query LendingPool contract
    return 0n;
  }

  /**
   * Generate human-readable decision reasons
   */
  private getDecisionReasons(
    approved: boolean,
    hasReputation: boolean,
    hasCapacity: boolean,
    notOverextended: boolean
  ): string[] {
    const reasons: string[] = [];

    if (!approved) {
      if (!hasReputation) reasons.push('Insufficient reputation score (minimum 500)');
      if (!hasCapacity) reasons.push('Requested amount exceeds available credit');
      if (!notOverextended) reasons.push('Debt-to-asset ratio too high');
    } else {
      reasons.push('Strong credit profile');
      reasons.push('Sufficient collateral');
      reasons.push('Responsible debt management');
    }

    return reasons;
  }
}

/**
 * Types
 */
export interface CreditProfile {
  userAddress: string;
  reputationScore: number;
  ltv: number;
  currentBalance: string;
  activeDebt: string;
  availableCredit: string;
  claimsAccepted: number;
  accountAge: number;
  riskTier: RiskTier;
  lastUpdated: Date;
}

export interface BorrowingEstimate {
  estimatedScore: number;
  ltv: number;
  maxBorrowAmount: string;
  requiredProof: {
    minBalance: string;
    durationMonths: number;
  };
}

export interface CreditDecision {
  approved: boolean;
  requestedAmount: string;
  availableCredit: string;
  reputationScore: number;
  ltv: number;
  reasons: string[];
}

export type RiskTier = 'A' | 'B' | 'C' | 'D' | 'E' | 'F';

/**
 * Example usage:
 *
 * const engine = new CreditEngine(
 *   process.env.ALCHEMY_API_KEY!,
 *   process.env.RPC_URL!
 * );
 *
 * // Get user's credit profile
 * const profile = await engine.getCreditProfile('0x742d35Cc...');
 * console.log(`Score: ${profile.reputationScore}, LTV: ${profile.ltv}%`);
 * console.log(`Available credit: ${ethers.formatEther(profile.availableCredit)} ETH`);
 *
 * // Check if user can borrow 5 ETH
 * const decision = await engine.checkCreditworthiness(
 *   '0x742d35Cc...',
 *   ethers.parseEther('5')
 * );
 *
 * if (decision.approved) {
 *   console.log('✅ Loan approved!');
 * } else {
 *   console.log('❌ Loan denied:', decision.reasons);
 * }
 */
