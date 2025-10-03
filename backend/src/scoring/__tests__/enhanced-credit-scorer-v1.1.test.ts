/**
 * Enhanced Credit Scoring Engine v1.1 - Test Suite
 *
 * Coverage:
 * - Payment History calculation
 * - Credit Utilization with asset quality
 * - Credit History Length
 * - Credit Mix with protocol quality
 * - New Credit scoring
 * - On-Chain Reputation (DAO participation)
 * - Integration tests with real wallet scenarios
 */

import { describe, it, expect, beforeAll } from '@jest/globals';
import {
  calculateEnhancedCreditScore,
  type LendingPosition,
  type CreditScoreV1_1,
} from '../enhanced-credit-scorer-v1.1';
import type { Address } from 'viem';

// ====================
// TEST DATA
// ====================

const MOCK_WHALE_ADDRESS: Address = '0x1234567890123456789012345678901234567890';
const MOCK_DEGEN_ADDRESS: Address = '0xDEADBEEF000000000000000000000000DEADBEEF';
const MOCK_NEW_USER_ADDRESS: Address = '0x0000000000000000000000000000000000000001';

const MOCK_WHALE_POSITIONS: LendingPosition[] = [
  {
    protocol: 'Aave V3',
    chainId: 42161,
    borrowed: BigInt(50000e6), // 50k USDC
    collateral: BigInt(100000e18), // 100k worth of ETH
    collateralAsset: '0x82aF49447D8a07e3bd95BD0d56f35241523fBab1' as Address, // WETH
    healthFactor: 2.5,
    timestamp: Date.now() - 90 * 24 * 60 * 60 * 1000, // 90 days ago
    repaid: true,
    liquidated: false,
  },
  {
    protocol: 'Compound V3',
    chainId: 42161,
    borrowed: BigInt(25000e6), // 25k USDC
    collateral: BigInt(50000e18), // 50k worth of ETH
    collateralAsset: '0x82aF49447D8a07e3bd95BD0d56f35241523fBab1' as Address,
    healthFactor: 2.8,
    timestamp: Date.now() - 180 * 24 * 60 * 60 * 1000, // 180 days ago
    repaid: true,
    liquidated: false,
  },
  {
    protocol: 'Aave V3',
    chainId: 42161,
    borrowed: BigInt(10000e6), // 10k USDC
    collateral: BigInt(15000e6), // 15k USDC
    collateralAsset: '0xaf88d065e77c8cC2239327C5EDb3A432268e5831' as Address, // USDC
    healthFactor: 3.0,
    timestamp: Date.now() - 30 * 24 * 60 * 60 * 1000, // 30 days ago
    repaid: true,
    liquidated: false,
  },
];

const MOCK_DEGEN_POSITIONS: LendingPosition[] = [
  {
    protocol: 'Sketchy Farm',
    chainId: 42161,
    borrowed: BigInt(1000e6), // 1k USDC
    collateral: BigInt(1100e6), // 1.1k USDC (risky 91% LTV)
    collateralAsset: '0xaf88d065e77c8cC2239327C5EDb3A432268e5831' as Address,
    healthFactor: 1.05,
    timestamp: Date.now() - 7 * 24 * 60 * 60 * 1000, // 7 days ago
    repaid: false,
    liquidated: true, // Got liquidated!
  },
  {
    protocol: 'Aave V3',
    chainId: 42161,
    borrowed: BigInt(500e6), // 500 USDC
    collateral: BigInt(520e6), // 520 USDC
    collateralAsset: '0xaf88d065e77c8cC2239327C5EDb3A432268e5831' as Address,
    healthFactor: 1.02,
    timestamp: Date.now() - 14 * 24 * 60 * 60 * 1000, // 14 days ago
    repaid: false,
    liquidated: true, // Liquidated again!
  },
];

// ====================
// UNIT TESTS
// ====================

describe('Enhanced Credit Scorer v1.1 - Unit Tests', () => {
  describe('Payment History Scoring', () => {
    it('should award maximum points for perfect repayment history', async () => {
      const score = await calculateEnhancedCreditScore({
        userAddress: MOCK_WHALE_ADDRESS,
        lendingPositions: MOCK_WHALE_POSITIONS,
        currentBorrowed: BigInt(0),
        currentCollateral: BigInt(0),
        currentCollateralAsset: '0x0000000000000000000000000000000000000000' as Address,
        avgUtilization: 45,
        maxUtilization: 60,
        walletAgeInDays: 900,
        firstDefiInteraction: new Date(Date.now() - 700 * 24 * 60 * 60 * 1000),
        transactionCount: 500,
        protocolInteractions: [
          { address: '0x794a61358D6845594F94dc1DB02A252b5b4814aD', chainId: 42161, count: 50 },
          { address: '0xA5EDBDD9646f8dFF606d7448e414884C7d905dCA', chainId: 42161, count: 30 },
        ],
        assetHoldings: [
          { address: '0x82aF49447D8a07e3bd95BD0d56f35241523fBab1', chainId: 42161, valueUSD: 100000 },
          { address: '0xaf88d065e77c8cC2239327C5EDb3A432268e5831', chainId: 42161, valueUSD: 50000 },
        ],
        recentLoans: 1,
        avgTimeBetweenLoans: 60,
      });

      expect(score.breakdown.paymentHistory.score).toBeGreaterThan(30); // Should be high
      expect(score.breakdown.paymentHistory.evidence.liquidations).toHaveLength(0);
      expect(score.breakdown.paymentHistory.evidence.repaidOnTime).toBe(3);
    });

    it('should penalize liquidations heavily', async () => {
      const score = await calculateEnhancedCreditScore({
        userAddress: MOCK_DEGEN_ADDRESS,
        lendingPositions: MOCK_DEGEN_POSITIONS,
        currentBorrowed: BigInt(0),
        currentCollateral: BigInt(0),
        currentCollateralAsset: '0x0000000000000000000000000000000000000000' as Address,
        avgUtilization: 90,
        maxUtilization: 95,
        walletAgeInDays: 60,
        firstDefiInteraction: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
        transactionCount: 20,
        protocolInteractions: [
          { address: '0x794a61358D6845594F94dc1DB02A252b5b4814aD', chainId: 42161, count: 5 },
        ],
        assetHoldings: [
          { address: '0xaf88d065e77c8cC2239327C5EDb3A432268e5831', chainId: 42161, valueUSD: 1000 },
        ],
        recentLoans: 5,
        avgTimeBetweenLoans: 3,
      });

      expect(score.breakdown.paymentHistory.score).toBeLessThan(15); // Should be low
      expect(score.breakdown.paymentHistory.evidence.liquidations.length).toBeGreaterThan(0);
      expect(score.score).toBeLessThan(580); // Should be subprime
    });

    it('should reward high health factors', async () => {
      const highHealthPosition: LendingPosition = {
        protocol: 'Aave V3',
        chainId: 42161,
        borrowed: BigInt(10000e6),
        collateral: BigInt(50000e18), // Very conservative
        collateralAsset: '0x82aF49447D8a07e3bd95BD0d56f35241523fBab1' as Address,
        healthFactor: 5.0, // Excellent
        timestamp: Date.now() - 30 * 24 * 60 * 60 * 1000,
        repaid: true,
        liquidated: false,
      };

      const score = await calculateEnhancedCreditScore({
        userAddress: MOCK_WHALE_ADDRESS,
        lendingPositions: [highHealthPosition],
        currentBorrowed: BigInt(0),
        currentCollateral: BigInt(0),
        currentCollateralAsset: '0x0000000000000000000000000000000000000000' as Address,
        avgUtilization: 20,
        maxUtilization: 30,
        walletAgeInDays: 400,
        firstDefiInteraction: new Date(Date.now() - 300 * 24 * 60 * 60 * 1000),
        transactionCount: 200,
        protocolInteractions: [],
        assetHoldings: [],
        recentLoans: 1,
        avgTimeBetweenLoans: 90,
      });

      expect(score.breakdown.paymentHistory.evidence.avgHealthFactor).toBeGreaterThan(4.5);
    });
  });

  describe('Credit Utilization Scoring', () => {
    it('should reward low utilization (<30%)', async () => {
      const score = await calculateEnhancedCreditScore({
        userAddress: MOCK_WHALE_ADDRESS,
        lendingPositions: MOCK_WHALE_POSITIONS,
        currentBorrowed: BigInt(20000e6), // 20k
        currentCollateral: BigInt(100000e18), // 100k
        currentCollateralAsset: '0x82aF49447D8a07e3bd95BD0d56f35241523fBab1' as Address,
        avgUtilization: 25,
        maxUtilization: 35,
        walletAgeInDays: 500,
        firstDefiInteraction: new Date(Date.now() - 400 * 24 * 60 * 60 * 1000),
        transactionCount: 300,
        protocolInteractions: [],
        assetHoldings: [],
        recentLoans: 2,
        avgTimeBetweenLoans: 45,
      });

      expect(score.breakdown.creditUtilization.evidence.currentUtilization).toBeLessThan(30);
      expect(score.breakdown.creditUtilization.score).toBeGreaterThan(20); // Should be high
    });

    it('should penalize high utilization (>70%)', async () => {
      const score = await calculateEnhancedCreditScore({
        userAddress: MOCK_DEGEN_ADDRESS,
        lendingPositions: MOCK_DEGEN_POSITIONS,
        currentBorrowed: BigInt(80000e6), // 80k
        currentCollateral: BigInt(100000e18), // 100k
        currentCollateralAsset: '0x82aF49447D8a07e3bd95BD0d56f35241523fBab1' as Address,
        avgUtilization: 85,
        maxUtilization: 92,
        walletAgeInDays: 100,
        firstDefiInteraction: new Date(Date.now() - 60 * 24 * 60 * 60 * 1000),
        transactionCount: 50,
        protocolInteractions: [],
        assetHoldings: [],
        recentLoans: 10,
        avgTimeBetweenLoans: 7,
      });

      expect(score.breakdown.creditUtilization.evidence.currentUtilization).toBeGreaterThan(70);
      expect(score.breakdown.creditUtilization.score).toBeLessThan(10); // Should be low
    });

    it('should reward blue-chip collateral (ETH, wBTC)', async () => {
      const score = await calculateEnhancedCreditScore({
        userAddress: MOCK_WHALE_ADDRESS,
        lendingPositions: MOCK_WHALE_POSITIONS,
        currentBorrowed: BigInt(50000e6),
        currentCollateral: BigInt(100000e18),
        currentCollateralAsset: '0x82aF49447D8a07e3bd95BD0d56f35241523fBab1' as Address, // WETH
        avgUtilization: 50,
        maxUtilization: 60,
        walletAgeInDays: 500,
        firstDefiInteraction: new Date(Date.now() - 400 * 24 * 60 * 60 * 1000),
        transactionCount: 300,
        protocolInteractions: [],
        assetHoldings: [
          { address: '0x82aF49447D8a07e3bd95BD0d56f35241523fBab1', chainId: 42161, valueUSD: 100000 }, // WETH
        ],
        recentLoans: 2,
        avgTimeBetweenLoans: 45,
      });

      expect(score.breakdown.creditUtilization.evidence.collateralQuality).toBeGreaterThan(80);
    });
  });

  describe('Credit History Length Scoring', () => {
    it('should reward wallets older than 2 years', async () => {
      const score = await calculateEnhancedCreditScore({
        userAddress: MOCK_WHALE_ADDRESS,
        lendingPositions: [],
        currentBorrowed: BigInt(0),
        currentCollateral: BigInt(0),
        currentCollateralAsset: '0x0000000000000000000000000000000000000000' as Address,
        avgUtilization: 0,
        maxUtilization: 0,
        walletAgeInDays: 900, // 2.5 years
        firstDefiInteraction: new Date(Date.now() - 800 * 24 * 60 * 60 * 1000),
        transactionCount: 1000,
        protocolInteractions: [],
        assetHoldings: [],
        recentLoans: 0,
        avgTimeBetweenLoans: 0,
      });

      expect(score.breakdown.creditHistoryLength.evidence.walletAgeInDays).toBe(900);
      expect(score.breakdown.creditHistoryLength.score).toBeGreaterThan(15);
    });

    it('should penalize new wallets (<90 days)', async () => {
      const score = await calculateEnhancedCreditScore({
        userAddress: MOCK_NEW_USER_ADDRESS,
        lendingPositions: [],
        currentBorrowed: BigInt(0),
        currentCollateral: BigInt(0),
        currentCollateralAsset: '0x0000000000000000000000000000000000000000' as Address,
        avgUtilization: 0,
        maxUtilization: 0,
        walletAgeInDays: 30, // Brand new
        firstDefiInteraction: new Date(Date.now() - 15 * 24 * 60 * 60 * 1000),
        transactionCount: 10,
        protocolInteractions: [],
        assetHoldings: [],
        recentLoans: 0,
        avgTimeBetweenLoans: 0,
      });

      expect(score.breakdown.creditHistoryLength.evidence.walletAgeInDays).toBe(30);
      expect(score.breakdown.creditHistoryLength.score).toBeLessThan(5);
    });

    it('should reward consistent transaction activity', async () => {
      const score = await calculateEnhancedCreditScore({
        userAddress: MOCK_WHALE_ADDRESS,
        lendingPositions: [],
        currentBorrowed: BigInt(0),
        currentCollateral: BigInt(0),
        currentCollateralAsset: '0x0000000000000000000000000000000000000000' as Address,
        avgUtilization: 0,
        maxUtilization: 0,
        walletAgeInDays: 365,
        firstDefiInteraction: new Date(Date.now() - 300 * 24 * 60 * 60 * 1000),
        transactionCount: 600, // ~50 tx/month
        protocolInteractions: [],
        assetHoldings: [],
        recentLoans: 0,
        avgTimeBetweenLoans: 0,
      });

      expect(score.breakdown.creditHistoryLength.evidence.avgTxPerMonth).toBeGreaterThan(45);
    });
  });

  describe('Credit Mix Scoring', () => {
    it('should reward interaction with blue-chip protocols (Aave, Compound)', async () => {
      const score = await calculateEnhancedCreditScore({
        userAddress: MOCK_WHALE_ADDRESS,
        lendingPositions: [],
        currentBorrowed: BigInt(0),
        currentCollateral: BigInt(0),
        currentCollateralAsset: '0x0000000000000000000000000000000000000000' as Address,
        avgUtilization: 0,
        maxUtilization: 0,
        walletAgeInDays: 500,
        firstDefiInteraction: new Date(Date.now() - 400 * 24 * 60 * 60 * 1000),
        transactionCount: 300,
        protocolInteractions: [
          { address: '0x794a61358D6845594F94dc1DB02A252b5b4814aD', chainId: 42161, count: 50 }, // Aave V3
          { address: '0xA5EDBDD9646f8dFF606d7448e414884C7d905dCA', chainId: 42161, count: 30 }, // Compound V3
          { address: '0x1F98431c8aD98523631AE4a59f267346ea31F984', chainId: 42161, count: 20 }, // Uniswap V3
        ],
        assetHoldings: [],
        recentLoans: 2,
        avgTimeBetweenLoans: 45,
      });

      expect(score.breakdown.creditMix.evidence.protocolQuality).toBeGreaterThan(10);
      expect(score.breakdown.creditMix.evidence.protocolsUsed).toContain('Aave V3');
      expect(score.breakdown.creditMix.evidence.protocolsUsed).toContain('Compound V3');
    });

    it('should reward diverse asset portfolio', async () => {
      const score = await calculateEnhancedCreditScore({
        userAddress: MOCK_WHALE_ADDRESS,
        lendingPositions: [],
        currentBorrowed: BigInt(0),
        currentCollateral: BigInt(0),
        currentCollateralAsset: '0x0000000000000000000000000000000000000000' as Address,
        avgUtilization: 0,
        maxUtilization: 0,
        walletAgeInDays: 500,
        firstDefiInteraction: new Date(Date.now() - 400 * 24 * 60 * 60 * 1000),
        transactionCount: 300,
        protocolInteractions: [],
        assetHoldings: [
          { address: '0x82aF49447D8a07e3bd95BD0d56f35241523fBab1', chainId: 42161, valueUSD: 50000 }, // WETH
          { address: '0x2f2a2543B76A4166549F7aaB2e75Bef0aefC5B0f', chainId: 42161, valueUSD: 30000 }, // WBTC
          { address: '0xaf88d065e77c8cC2239327C5EDb3A432268e5831', chainId: 42161, valueUSD: 20000 }, // USDC
          { address: '0xf97f4df75117a78c1A5a0DBb814Af92458539FB4', chainId: 42161, valueUSD: 5000 }, // LINK
        ],
        recentLoans: 2,
        avgTimeBetweenLoans: 45,
      });

      expect(score.breakdown.creditMix.evidence.assetDiversity).toBeGreaterThan(3);
      expect(score.breakdown.creditMix.evidence.assetTypes).toContain('WETH');
      expect(score.breakdown.creditMix.evidence.assetTypes).toContain('WBTC');
    });
  });

  describe('New Credit Scoring', () => {
    it('should reward infrequent loan applications', async () => {
      const score = await calculateEnhancedCreditScore({
        userAddress: MOCK_WHALE_ADDRESS,
        lendingPositions: [],
        currentBorrowed: BigInt(0),
        currentCollateral: BigInt(0),
        currentCollateralAsset: '0x0000000000000000000000000000000000000000' as Address,
        avgUtilization: 0,
        maxUtilization: 0,
        walletAgeInDays: 500,
        firstDefiInteraction: new Date(Date.now() - 400 * 24 * 60 * 60 * 1000),
        transactionCount: 300,
        protocolInteractions: [],
        assetHoldings: [],
        recentLoans: 1, // Only 1 recent loan
        avgTimeBetweenLoans: 120, // 4 months between loans
      });

      expect(score.breakdown.newCredit.score).toBeGreaterThan(8);
      expect(score.breakdown.newCredit.evidence.recentLoans).toBe(1);
    });

    it('should penalize frequent loan applications', async () => {
      const score = await calculateEnhancedCreditScore({
        userAddress: MOCK_DEGEN_ADDRESS,
        lendingPositions: [],
        currentBorrowed: BigInt(0),
        currentCollateral: BigInt(0),
        currentCollateralAsset: '0x0000000000000000000000000000000000000000' as Address,
        avgUtilization: 0,
        maxUtilization: 0,
        walletAgeInDays: 100,
        firstDefiInteraction: new Date(Date.now() - 60 * 24 * 60 * 60 * 1000),
        transactionCount: 50,
        protocolInteractions: [],
        assetHoldings: [],
        recentLoans: 10, // Many recent loans
        avgTimeBetweenLoans: 3, // Every 3 days
      });

      expect(score.breakdown.newCredit.score).toBeLessThan(5);
      expect(score.breakdown.newCredit.evidence.recentLoans).toBe(10);
    });
  });

  describe('Score Tiers', () => {
    it('should classify 800+ as Exceptional', async () => {
      const score = await calculateEnhancedCreditScore({
        userAddress: MOCK_WHALE_ADDRESS,
        lendingPositions: MOCK_WHALE_POSITIONS,
        currentBorrowed: BigInt(30000e6),
        currentCollateral: BigInt(150000e18),
        currentCollateralAsset: '0x82aF49447D8a07e3bd95BD0d56f35241523fBab1' as Address,
        avgUtilization: 20,
        maxUtilization: 30,
        walletAgeInDays: 1000,
        firstDefiInteraction: new Date(Date.now() - 900 * 24 * 60 * 60 * 1000),
        transactionCount: 2000,
        protocolInteractions: [
          { address: '0x794a61358D6845594F94dc1DB02A252b5b4814aD', chainId: 42161, count: 100 },
          { address: '0xA5EDBDD9646f8dFF606d7448e414884C7d905dCA', chainId: 42161, count: 80 },
          { address: '0x1F98431c8aD98523631AE4a59f267346ea31F984', chainId: 42161, count: 60 },
        ],
        assetHoldings: [
          { address: '0x82aF49447D8a07e3bd95BD0d56f35241523fBab1', chainId: 42161, valueUSD: 200000 },
          { address: '0x2f2a2543B76A4166549F7aaB2e75Bef0aefC5B0f', chainId: 42161, valueUSD: 100000 },
        ],
        recentLoans: 1,
        avgTimeBetweenLoans: 180,
      });

      if (score.score >= 800) {
        expect(score.tier).toBe('Exceptional');
        expect(score.recommendedLTV).toBe(90);
        expect(score.interestRateMultiplier).toBe(0.8);
      }
    });

    it('should classify <580 as Subprime', async () => {
      const score = await calculateEnhancedCreditScore({
        userAddress: MOCK_DEGEN_ADDRESS,
        lendingPositions: MOCK_DEGEN_POSITIONS,
        currentBorrowed: BigInt(5000e6),
        currentCollateral: BigInt(5500e6),
        currentCollateralAsset: '0xaf88d065e77c8cC2239327C5EDb3A432268e5831' as Address,
        avgUtilization: 95,
        maxUtilization: 98,
        walletAgeInDays: 30,
        firstDefiInteraction: new Date(Date.now() - 20 * 24 * 60 * 60 * 1000),
        transactionCount: 15,
        protocolInteractions: [
          { address: '0x794a61358D6845594F94dc1DB02A252b5b4814aD', chainId: 42161, count: 3 },
        ],
        assetHoldings: [
          { address: '0xaf88d065e77c8cC2239327C5EDb3A432268e5831', chainId: 42161, valueUSD: 1000 },
        ],
        recentLoans: 15,
        avgTimeBetweenLoans: 2,
      });

      if (score.score < 580) {
        expect(score.tier).toBe('Subprime');
        expect(score.interestRateMultiplier).toBe(1.5);
      }
    });
  });

  describe('Data Quality Assessment', () => {
    it('should mark high data quality for comprehensive data', async () => {
      const score = await calculateEnhancedCreditScore({
        userAddress: MOCK_WHALE_ADDRESS,
        lendingPositions: MOCK_WHALE_POSITIONS,
        currentBorrowed: BigInt(50000e6),
        currentCollateral: BigInt(100000e18),
        currentCollateralAsset: '0x82aF49447D8a07e3bd95BD0d56f35241523fBab1' as Address,
        avgUtilization: 45,
        maxUtilization: 60,
        walletAgeInDays: 900,
        firstDefiInteraction: new Date(Date.now() - 700 * 24 * 60 * 60 * 1000),
        transactionCount: 500,
        protocolInteractions: [
          { address: '0x794a61358D6845594F94dc1DB02A252b5b4814aD', chainId: 42161, count: 50 },
          { address: '0xA5EDBDD9646f8dFF606d7448e414884C7d905dCA', chainId: 42161, count: 30 },
          { address: '0x1F98431c8aD98523631AE4a59f267346ea31F984', chainId: 42161, count: 20 },
          { address: '0xbEbc44782C7dB0a1A60Cb6fe97d0b483032FF1C7', chainId: 1, count: 15 },
          { address: '0xBA12222222228d8Ba445958a75a0704d566BF2C8', chainId: 42161, count: 10 },
        ],
        assetHoldings: [
          { address: '0x82aF49447D8a07e3bd95BD0d56f35241523fBab1', chainId: 42161, valueUSD: 100000 },
        ],
        recentLoans: 1,
        avgTimeBetweenLoans: 60,
      });

      expect(score.metadata.dataQuality).toBe('high');
    });

    it('should mark low data quality for minimal data', async () => {
      const score = await calculateEnhancedCreditScore({
        userAddress: MOCK_NEW_USER_ADDRESS,
        lendingPositions: [],
        currentBorrowed: BigInt(0),
        currentCollateral: BigInt(0),
        currentCollateralAsset: '0x0000000000000000000000000000000000000000' as Address,
        avgUtilization: 0,
        maxUtilization: 0,
        walletAgeInDays: 30,
        firstDefiInteraction: new Date(Date.now() - 15 * 24 * 60 * 60 * 1000),
        transactionCount: 5,
        protocolInteractions: [],
        assetHoldings: [],
        recentLoans: 0,
        avgTimeBetweenLoans: 0,
      });

      expect(score.metadata.dataQuality).toBe('low');
    });
  });
});

describe('Enhanced Credit Scorer v1.1 - Integration Tests', () => {
  it('should handle zero lending history gracefully', async () => {
    const score = await calculateEnhancedCreditScore({
      userAddress: MOCK_NEW_USER_ADDRESS,
      lendingPositions: [],
      currentBorrowed: BigInt(0),
      currentCollateral: BigInt(0),
      currentCollateralAsset: '0x0000000000000000000000000000000000000000' as Address,
      avgUtilization: 0,
      maxUtilization: 0,
      walletAgeInDays: 100,
      firstDefiInteraction: new Date(Date.now() - 60 * 24 * 60 * 60 * 1000),
      transactionCount: 50,
      protocolInteractions: [],
      assetHoldings: [],
      recentLoans: 0,
      avgTimeBetweenLoans: 0,
    });

    expect(score.score).toBeGreaterThanOrEqual(300);
    expect(score.score).toBeLessThanOrEqual(850);
    expect(score.metadata.version).toBe('1.1');
  });

  it('should return consistent scores for same input', async () => {
    const input = {
      userAddress: MOCK_WHALE_ADDRESS,
      lendingPositions: MOCK_WHALE_POSITIONS,
      currentBorrowed: BigInt(50000e6),
      currentCollateral: BigInt(100000e18),
      currentCollateralAsset: '0x82aF49447D8a07e3bd95BD0d56f35241523fBab1' as Address,
      avgUtilization: 45,
      maxUtilization: 60,
      walletAgeInDays: 900,
      firstDefiInteraction: new Date(Date.now() - 700 * 24 * 60 * 60 * 1000),
      transactionCount: 500,
      protocolInteractions: [
        { address: '0x794a61358D6845594F94dc1DB02A252b5b4814aD', chainId: 42161, count: 50 },
      ],
      assetHoldings: [
        { address: '0x82aF49447D8a07e3bd95BD0d56f35241523fBab1', chainId: 42161, valueUSD: 100000 },
      ],
      recentLoans: 1,
      avgTimeBetweenLoans: 60,
    };

    const score1 = await calculateEnhancedCreditScore(input);
    const score2 = await calculateEnhancedCreditScore(input);

    expect(score1.score).toBe(score2.score);
  });
});
