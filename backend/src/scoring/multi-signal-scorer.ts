import { ethers } from 'ethers';
import { db } from '../db/client';

/**
 * Multi-Signal Credit Scoring Engine
 * Aggregates temporal reputation, payment history, wallet age, and protocol activity
 */
export class MultiSignalScorer {
  private provider: ethers.Provider;
  private reputationScorerContract: ethers.Contract;

  constructor(
    provider: ethers.Provider,
    reputationScorerAddress: string,
    reputationScorerABI: any[]
  ) {
    this.provider = provider;
    this.reputationScorerContract = new ethers.Contract(
      reputationScorerAddress,
      reputationScorerABI,
      provider
    );
  }

  /**
   * Calculate comprehensive credit score for a user
   */
  async calculateScore(userAddress: string, baseScore: number): Promise<CreditScore> {
    console.log(`Calculating credit score for ${userAddress}...`);

    // Get individual subscores
    const paymentScore = await this.calculatePaymentScore(userAddress);
    const walletAgeScore = await this.calculateWalletAgeScore(userAddress);
    const protocolScore = await this.calculateProtocolActivityScore(userAddress);

    // Calculate weighted total
    const totalScore = this.calculateWeightedTotal(
      baseScore,
      paymentScore,
      walletAgeScore,
      protocolScore
    );

    // Determine LTV and tier
    const ltv = this.getLTVFromScore(totalScore);
    const tier = this.getTierFromScore(totalScore);

    const creditScore: CreditScore = {
      userAddress,
      baseScore,
      paymentScore,
      walletAgeScore,
      protocolScore,
      totalScore,
      ltv,
      tier,
      lastUpdated: new Date(),
    };

    // Store in database
    await this.storeScore(creditScore);

    console.log(`✅ Score calculated: ${totalScore} (${tier} tier, ${ltv}% LTV)`);

    return creditScore;
  }

  /**
   * Calculate payment history score (0-200)
   * Based on last 12 payments
   */
  private async calculatePaymentScore(userAddress: string): Promise<number> {
    const payments = await db.paymentHistory.findMany({
      where: { borrower: userAddress.toLowerCase() },
      orderBy: { created_at: 'desc' },
      take: 12,
    });

    if (payments.length === 0) {
      return 100; // Neutral score for new users
    }

    const onTimeCount = payments.filter(p => p.on_time).length;
    const onTimeRate = (onTimeCount / payments.length) * 100;

    // Base score from on-time rate
    let score = (onTimeRate * 200) / 100;

    // Bonus for perfect record
    if (onTimeRate === 100) {
      score = 200;
    }

    // Penalty for recent late payments
    const recentPayments = payments.slice(0, 3);
    const recentLateCount = recentPayments.filter(p => !p.on_time).length;
    if (recentLateCount > 0) {
      score -= recentLateCount * 10; // -10 points per recent late payment
    }

    return Math.max(0, Math.min(200, score));
  }

  /**
   * Calculate wallet age score (0-100)
   * Based on first transaction timestamp
   */
  private async calculateWalletAgeScore(userAddress: string): Promise<number> {
    // Check database for wallet creation time
    const walletRecord = await db.walletMetadata.findUnique({
      where: { address: userAddress.toLowerCase() },
    });

    if (!walletRecord || !walletRecord.first_transaction) {
      // If not in DB, fetch first transaction from blockchain
      const firstTx = await this.getFirstTransaction(userAddress);
      if (!firstTx) {
        return 0; // New wallet, no transactions
      }

      // Store for future use
      await db.walletMetadata.upsert({
        where: { address: userAddress.toLowerCase() },
        create: {
          address: userAddress.toLowerCase(),
          first_transaction: firstTx,
        },
        update: {
          first_transaction: firstTx,
        },
      });

      const ageInDays = (Date.now() - firstTx.getTime()) / (1000 * 60 * 60 * 24);
      return this.scoreFromAge(ageInDays);
    }

    const ageInDays = (Date.now() - walletRecord.first_transaction.getTime()) / (1000 * 60 * 60 * 24);
    return this.scoreFromAge(ageInDays);
  }

  /**
   * Calculate protocol activity score (0-100)
   * Based on interactions with Eon Protocol
   */
  private async calculateProtocolActivityScore(userAddress: string): Promise<number> {
    const interactions = await db.protocolInteraction.count({
      where: { user_address: userAddress.toLowerCase() },
    });

    // Score increases with interactions, max at 100
    if (interactions >= 100) return 100;

    return interactions;
  }

  /**
   * Calculate weighted total score
   * Weights: Base 50%, Payment 30%, Wallet Age 10%, Protocol 10%
   */
  private calculateWeightedTotal(
    baseScore: number,
    paymentScore: number,
    walletAgeScore: number,
    protocolScore: number
  ): number {
    const weighted = (
      (baseScore * 0.50) +
      (paymentScore * 0.30) +
      (walletAgeScore * 0.10) +
      (protocolScore * 0.10)
    );

    return Math.round(Math.min(1000, weighted));
  }

  /**
   * Get dynamic LTV from total score
   */
  private getLTVFromScore(totalScore: number): number {
    if (totalScore >= 800) return 90; // Platinum
    if (totalScore >= 600) return 75; // Gold
    if (totalScore >= 400) return 65; // Silver
    return 50; // Bronze
  }

  /**
   * Get credit tier from total score
   */
  private getTierFromScore(totalScore: number): string {
    if (totalScore >= 800) return 'Platinum';
    if (totalScore >= 600) return 'Gold';
    if (totalScore >= 400) return 'Silver';
    return 'Bronze';
  }

  /**
   * Convert age in days to score
   */
  private scoreFromAge(ageInDays: number): number {
    // Max score at 730 days (2 years)
    if (ageInDays >= 730) return 100;

    return Math.round((ageInDays / 730) * 100);
  }

  /**
   * Get first transaction timestamp for a wallet
   */
  private async getFirstTransaction(userAddress: string): Promise<Date | null> {
    try {
      // Get transaction count
      const txCount = await this.provider.getTransactionCount(userAddress);

      if (txCount === 0) {
        return null; // No transactions
      }

      // For now, use current time minus estimated age
      // TODO: Implement proper historical transaction lookup
      // This would require archive node access or indexing service

      return new Date(); // Placeholder
    } catch (error) {
      console.error('Error getting first transaction:', error);
      return null;
    }
  }

  /**
   * Store credit score in database
   */
  private async storeScore(creditScore: CreditScore): Promise<void> {
    await db.creditScore.upsert({
      where: { borrower: creditScore.userAddress.toLowerCase() },
      create: {
        borrower: creditScore.userAddress.toLowerCase(),
        base_score: creditScore.baseScore,
        payment_score: creditScore.paymentScore,
        wallet_age_score: creditScore.walletAgeScore,
        protocol_score: creditScore.protocolScore,
        total_score: creditScore.totalScore,
        ltv_percentage: creditScore.ltv,
        tier: creditScore.tier,
        last_updated: creditScore.lastUpdated,
      },
      update: {
        base_score: creditScore.baseScore,
        payment_score: creditScore.paymentScore,
        wallet_age_score: creditScore.walletAgeScore,
        protocol_score: creditScore.protocolScore,
        total_score: creditScore.totalScore,
        ltv_percentage: creditScore.ltv,
        tier: creditScore.tier,
        last_updated: creditScore.lastUpdated,
      },
    });
  }

  /**
   * Get score from database
   */
  async getScore(userAddress: string): Promise<CreditScore | null> {
    const record = await db.creditScore.findUnique({
      where: { borrower: userAddress.toLowerCase() },
    });

    if (!record) return null;

    return {
      userAddress: record.borrower,
      baseScore: record.base_score,
      paymentScore: record.payment_score,
      walletAgeScore: record.wallet_age_score,
      protocolScore: record.protocol_score,
      totalScore: record.total_score,
      ltv: record.ltv_percentage,
      tier: record.tier,
      lastUpdated: record.last_updated,
    };
  }

  /**
   * Get scores for multiple users
   */
  async getBatchScores(userAddresses: string[]): Promise<Map<string, CreditScore>> {
    const records = await db.creditScore.findMany({
      where: {
        borrower: {
          in: userAddresses.map(a => a.toLowerCase()),
        },
      },
    });

    const scoreMap = new Map<string, CreditScore>();

    for (const record of records) {
      scoreMap.set(record.borrower, {
        userAddress: record.borrower,
        baseScore: record.base_score,
        paymentScore: record.payment_score,
        walletAgeScore: record.wallet_age_score,
        protocolScore: record.protocol_score,
        totalScore: record.total_score,
        ltv: record.ltv_percentage,
        tier: record.tier,
        lastUpdated: record.last_updated,
      });
    }

    return scoreMap;
  }
}

export interface CreditScore {
  userAddress: string;
  baseScore: number;        // 0-1000 temporal score
  paymentScore: number;     // 0-200 payment history
  walletAgeScore: number;   // 0-100 wallet age
  protocolScore: number;    // 0-100 protocol activity
  totalScore: number;       // 0-1000 weighted total
  ltv: number;             // 50-90% dynamic LTV
  tier: string;            // Bronze, Silver, Gold, Platinum
  lastUpdated: Date;
}
