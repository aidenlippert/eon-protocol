import { ethers } from 'ethers';
import { db } from '../db/client';
import { AlertDispatcher, AlertType } from './alert-dispatcher';

/**
 * Real-time Health Factor Monitor
 * Checks all active loans every 5 minutes and sends alerts
 */
export class HealthMonitor {
  private provider: ethers.Provider;
  private healthMonitorContract: ethers.Contract;
  private lendingPoolContract: ethers.Contract;
  private alertDispatcher: AlertDispatcher;

  // Health factor thresholds
  private readonly LIQUIDATION_THRESHOLD = 0.95;
  private readonly CRITICAL_THRESHOLD = 0.97;  // T-24h warning
  private readonly WARNING_THRESHOLD = 1.0;    // T-72h warning

  constructor(
    provider: ethers.Provider,
    healthMonitorAddress: string,
    healthMonitorABI: any[],
    lendingPoolAddress: string,
    lendingPoolABI: any[],
    alertDispatcher: AlertDispatcher
  ) {
    this.provider = provider;
    this.healthMonitorContract = new ethers.Contract(
      healthMonitorAddress,
      healthMonitorABI,
      provider
    );
    this.lendingPoolContract = new ethers.Contract(
      lendingPoolAddress,
      lendingPoolABI,
      provider
    );
    this.alertDispatcher = alertDispatcher;
  }

  /**
   * Monitor all active loans and send alerts
   */
  async monitorAllPositions(): Promise<void> {
    console.log('🔍 Starting health factor monitoring...');

    const activeLoans = await db.loan.findMany({
      where: { status: 'ACTIVE' },
    });

    console.log(`Found ${activeLoans.length} active loans to monitor`);

    for (const loan of activeLoans) {
      try {
        await this.monitorLoan(loan.borrower, loan.id);
      } catch (error) {
        console.error(`Error monitoring loan ${loan.id}:`, error);
      }
    }

    console.log('✅ Health factor monitoring complete\n');
  }

  /**
   * Monitor a single loan
   */
  private async monitorLoan(borrower: string, loanId: number): Promise<void> {
    // Calculate current health factor
    const hf = await this.calculateHealthFactor(borrower, loanId);

    // Get previous health factor from DB
    const previousRecord = await db.healthFactor.findUnique({
      where: {
        borrower_loanId: {
          borrower: borrower.toLowerCase(),
          loan_id: loanId,
        },
      },
    });

    const previousHF = previousRecord ? parseFloat(previousRecord.health_factor) : null;

    // Update database
    await this.updateHealthFactorRecord(borrower, loanId, hf);

    // Check thresholds and send alerts
    await this.checkThresholdsAndAlert(borrower, loanId, hf, previousHF);
  }

  /**
   * Calculate health factor for a loan
   */
  private async calculateHealthFactor(
    borrower: string,
    loanId: number
  ): Promise<number> {
    // Call smart contract to calculate HF
    const hfBigInt = await this.healthMonitorContract.calculateHealthFactor(
      borrower,
      loanId
    );

    // Convert from wei (1e18) to decimal
    const hf = Number(ethers.formatEther(hfBigInt));

    return hf;
  }

  /**
   * Update health factor record in database
   */
  private async updateHealthFactorRecord(
    borrower: string,
    loanId: number,
    healthFactor: number
  ): Promise<void> {
    // Get loan details for collateral and debt values
    const loanDetails = await this.lendingPoolContract.getLoan(loanId);

    const collateralValue = ethers.formatEther(loanDetails.collateralAmount);
    const debtValue = ethers.formatEther(loanDetails.borrowedAmount);

    await db.healthFactor.upsert({
      where: {
        borrower_loanId: {
          borrower: borrower.toLowerCase(),
          loan_id: loanId,
        },
      },
      create: {
        borrower: borrower.toLowerCase(),
        loan_id: loanId,
        collateral_value: collateralValue,
        debt_value: debtValue,
        health_factor: healthFactor.toString(),
        liquidatable: healthFactor < this.LIQUIDATION_THRESHOLD,
        last_checked: new Date(),
      },
      update: {
        collateral_value: collateralValue,
        debt_value: debtValue,
        health_factor: healthFactor.toString(),
        liquidatable: healthFactor < this.LIQUIDATION_THRESHOLD,
        last_checked: new Date(),
      },
    });
  }

  /**
   * Check health factor thresholds and send appropriate alerts
   */
  private async checkThresholdsAndAlert(
    borrower: string,
    loanId: number,
    currentHF: number,
    previousHF: number | null
  ): Promise<void> {
    // Get user notification preferences
    const user = await db.user.findUnique({
      where: { address: borrower.toLowerCase() },
    });

    if (!user || !user.notifications_enabled) {
      return; // User has disabled notifications
    }

    // Liquidation imminent (HF < 0.95)
    if (currentHF < this.LIQUIDATION_THRESHOLD) {
      await this.alertDispatcher.sendAlert({
        type: AlertType.LIQUIDATION_IMMINENT,
        recipient: borrower,
        email: user.email,
        phone: user.phone,
        telegram: user.telegram_id,
        data: {
          loanId,
          healthFactor: currentHF,
          threshold: this.LIQUIDATION_THRESHOLD,
          timeframe: '1 hour',
        },
      });

      console.log(`🚨 CRITICAL: Loan ${loanId} liquidation imminent (HF: ${currentHF.toFixed(4)})`);
      return;
    }

    // Critical warning (0.95 ≤ HF < 0.97) - T-24h
    if (currentHF < this.CRITICAL_THRESHOLD) {
      // Only send if HF just entered this range (avoid spam)
      if (previousHF === null || previousHF >= this.CRITICAL_THRESHOLD) {
        await this.alertDispatcher.sendAlert({
          type: AlertType.LIQUIDATION_WARNING_24H,
          recipient: borrower,
          email: user.email,
          data: {
            loanId,
            healthFactor: currentHF,
            threshold: this.LIQUIDATION_THRESHOLD,
            timeframe: '24 hours',
          },
        });

        console.log(`⚠️  WARNING: Loan ${loanId} approaching liquidation (HF: ${currentHF.toFixed(4)})`);
      }
      return;
    }

    // Warning (0.97 ≤ HF < 1.0) - T-72h
    if (currentHF < this.WARNING_THRESHOLD) {
      if (previousHF === null || previousHF >= this.WARNING_THRESHOLD) {
        await this.alertDispatcher.sendAlert({
          type: AlertType.LIQUIDATION_WARNING_72H,
          recipient: borrower,
          email: user.email,
          data: {
            loanId,
            healthFactor: currentHF,
            threshold: this.LIQUIDATION_THRESHOLD,
            timeframe: '72 hours',
          },
        });

        console.log(`⚡ INFO: Loan ${loanId} health factor low (HF: ${currentHF.toFixed(4)})`);
      }
      return;
    }

    // Health factor improved (crossed back above threshold)
    if (previousHF !== null && previousHF < this.WARNING_THRESHOLD && currentHF >= this.WARNING_THRESHOLD) {
      await this.alertDispatcher.sendAlert({
        type: AlertType.HEALTH_IMPROVED,
        recipient: borrower,
        email: user.email,
        data: {
          loanId,
          healthFactor: currentHF,
          previousHealthFactor: previousHF,
        },
      });

      console.log(`✅ RECOVERY: Loan ${loanId} health factor improved (HF: ${currentHF.toFixed(4)})`);
    }
  }

  /**
   * Get risk level for a loan
   */
  async getRiskLevel(borrower: string, loanId: number): Promise<RiskLevel> {
    const record = await db.healthFactor.findUnique({
      where: {
        borrower_loanId: {
          borrower: borrower.toLowerCase(),
          loan_id: loanId,
        },
      },
    });

    if (!record) {
      return RiskLevel.UNKNOWN;
    }

    const hf = parseFloat(record.health_factor);

    if (hf >= 1.2) return RiskLevel.SAFE;
    if (hf >= 1.0) return RiskLevel.WARNING;
    if (hf >= this.LIQUIDATION_THRESHOLD) return RiskLevel.DANGER;
    return RiskLevel.CRITICAL;
  }

  /**
   * Get health status for a loan
   */
  async getHealthStatus(borrower: string, loanId: number): Promise<HealthStatus | null> {
    const record = await db.healthFactor.findUnique({
      where: {
        borrower_loanId: {
          borrower: borrower.toLowerCase(),
          loan_id: loanId,
        },
      },
    });

    if (!record) return null;

    const hf = parseFloat(record.health_factor);
    const riskLevel = await this.getRiskLevel(borrower, loanId);

    return {
      borrower: record.borrower,
      loanId: record.loan_id,
      collateralValue: parseFloat(record.collateral_value),
      debtValue: parseFloat(record.debt_value),
      healthFactor: hf,
      liquidatable: record.liquidatable,
      riskLevel,
      lastChecked: record.last_checked,
    };
  }

  /**
   * Start monitoring loop (runs every 5 minutes)
   */
  startMonitoringLoop(): void {
    console.log('🚀 Starting health factor monitoring loop (5 min intervals)...\n');

    // Run immediately
    this.monitorAllPositions();

    // Then run every 5 minutes
    setInterval(() => {
      this.monitorAllPositions();
    }, 5 * 60 * 1000); // 5 minutes
  }
}

export enum RiskLevel {
  SAFE = 'SAFE',           // HF >= 1.2
  WARNING = 'WARNING',     // 1.0 <= HF < 1.2
  DANGER = 'DANGER',       // 0.95 <= HF < 1.0
  CRITICAL = 'CRITICAL',   // HF < 0.95
  UNKNOWN = 'UNKNOWN',
}

export interface HealthStatus {
  borrower: string;
  loanId: number;
  collateralValue: number;
  debtValue: number;
  healthFactor: number;
  liquidatable: boolean;
  riskLevel: RiskLevel;
  lastChecked: Date;
}
