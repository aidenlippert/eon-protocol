import { ethers } from 'ethers';
import { PrismaClient } from '@prisma/client';

/**
 * Blockchain Scanner for Chronos Protocol
 * Monitors ClaimManager contract for new claims and challenges
 */
export class ChronosScanner {
  private provider: ethers.WebSocketProvider;
  private claimManager: ethers.Contract;
  private db: PrismaClient;
  private currentBlock: number = 0;

  constructor(
    private config: {
      rpcUrl: string;
      claimManagerAddress: string;
      startBlock: number;
    }
  ) {
    this.provider = new ethers.WebSocketProvider(config.rpcUrl);
    this.db = new PrismaClient();

    // ClaimManager ABI (simplified)
    const abi = [
      'event ClaimSubmitted(uint256 indexed claimId, address indexed user, uint256 minBalance, uint256 startBlock, uint256 endBlock)',
      'event ClaimChallenged(uint256 indexed claimId, address indexed challenger)',
      'event ClaimFinalized(uint256 indexed claimId, bool accepted)',
      'function claims(uint256) view returns (address user, uint256 minBalance, uint256 startBlock, uint256 endBlock, bytes32 merkleRoot, uint96 stake, uint64 challengeDeadline, uint8 status)'
    ];

    this.claimManager = new ethers.Contract(
      config.claimManagerAddress,
      abi,
      this.provider
    );
  }

  /**
   * Start scanning blockchain for events
   */
  async start(): Promise<void> {
    console.log('🔍 Starting Chronos Scanner...');

    // Load checkpoint
    this.currentBlock = await this.loadCheckpoint();

    // Sync historical events
    await this.syncHistoricalEvents();

    // Listen for new events
    this.listenForEvents();

    console.log(`✅ Scanner running from block ${this.currentBlock}`);
  }

  /**
   * Sync historical events from last checkpoint
   */
  private async syncHistoricalEvents(): Promise<void> {
    const latestBlock = await this.provider.getBlockNumber();
    const BATCH_SIZE = 1000;

    console.log(`📚 Syncing blocks ${this.currentBlock} to ${latestBlock}`);

    for (let start = this.currentBlock; start < latestBlock; start += BATCH_SIZE) {
      const end = Math.min(start + BATCH_SIZE - 1, latestBlock);

      // Get ClaimSubmitted events
      const claimEvents = await this.claimManager.queryFilter(
        this.claimManager.filters.ClaimSubmitted(),
        start,
        end
      );

      for (const event of claimEvents) {
        await this.handleClaimSubmitted(event);
      }

      // Get ClaimChallenged events
      const challengeEvents = await this.claimManager.queryFilter(
        this.claimManager.filters.ClaimChallenged(),
        start,
        end
      );

      for (const event of challengeEvents) {
        await this.handleClaimChallenged(event);
      }

      // Get ClaimFinalized events
      const finalizedEvents = await this.claimManager.queryFilter(
        this.claimManager.filters.ClaimFinalized(),
        start,
        end
      );

      for (const event of finalizedEvents) {
        await this.handleClaimFinalized(event);
      }

      // Save checkpoint every 100 blocks
      if ((end - this.currentBlock) % 100 === 0) {
        await this.saveCheckpoint(end);
      }

      this.currentBlock = end;
      console.log(`  Synced up to block ${end}`);
    }
  }

  /**
   * Listen for new events in real-time
   */
  private listenForEvents(): void {
    // Listen for new claims
    this.claimManager.on('ClaimSubmitted', async (claimId, user, minBalance, startBlock, endBlock, event) => {
      console.log(`🆕 New claim: ${claimId} from ${user}`);
      await this.handleClaimSubmitted(event);
    });

    // Listen for challenges
    this.claimManager.on('ClaimChallenged', async (claimId, challenger, event) => {
      console.log(`⚔️  Claim ${claimId} challenged by ${challenger}`);
      await this.handleClaimChallenged(event);
    });

    // Listen for finalizations
    this.claimManager.on('ClaimFinalized', async (claimId, accepted, event) => {
      console.log(`✅ Claim ${claimId} finalized: ${accepted ? 'ACCEPTED' : 'REJECTED'}`);
      await this.handleClaimFinalized(event);
    });

    // Handle connection errors
    this.provider.on('error', (error) => {
      console.error('❌ Provider error:', error);
      this.reconnect();
    });
  }

  /**
   * Handle ClaimSubmitted event
   */
  private async handleClaimSubmitted(event: ethers.Log): Promise<void> {
    const parsed = this.claimManager.interface.parseLog({
      topics: event.topics as string[],
      data: event.data
    });

    if (!parsed) return;

    const { claimId, user, minBalance, startBlock, endBlock } = parsed.args;

    // Get full claim data
    const claim = await this.claimManager.claims(claimId);

    // Store in database
    await this.db.claim.create({
      data: {
        claimId: claimId.toString(),
        user: user.toLowerCase(),
        minBalance: minBalance.toString(),
        startBlock: Number(startBlock),
        endBlock: Number(endBlock),
        merkleRoot: claim.merkleRoot,
        stake: claim.stake.toString(),
        challengeDeadline: Number(claim.challengeDeadline),
        status: this.getStatusString(claim.status),
        blockNumber: event.blockNumber,
        transactionHash: event.transactionHash,
        createdAt: new Date()
      }
    });

    // Trigger validation
    await this.validateClaim(claimId.toString());
  }

  /**
   * Handle ClaimChallenged event
   */
  private async handleClaimChallenged(event: ethers.Log): Promise<void> {
    const parsed = this.claimManager.interface.parseLog({
      topics: event.topics as string[],
      data: event.data
    });

    if (!parsed) return;

    const { claimId, challenger } = parsed.args;

    // Update database
    await this.db.claim.update({
      where: { claimId: claimId.toString() },
      data: {
        status: 'CHALLENGED',
        challengedBy: challenger.toLowerCase(),
        challengedAt: new Date()
      }
    });
  }

  /**
   * Handle ClaimFinalized event
   */
  private async handleClaimFinalized(event: ethers.Log): Promise<void> {
    const parsed = this.claimManager.interface.parseLog({
      topics: event.topics as string[],
      data: event.data
    });

    if (!parsed) return;

    const { claimId, accepted } = parsed.args;

    // Update database
    await this.db.claim.update({
      where: { claimId: claimId.toString() },
      data: {
        status: accepted ? 'ACCEPTED' : 'REJECTED',
        finalizedAt: new Date()
      }
    });

    // Update reputation if accepted
    if (accepted) {
      const claim = await this.db.claim.findUnique({
        where: { claimId: claimId.toString() }
      });

      if (claim) {
        await this.updateReputation(claim.user, claim);
      }
    }
  }

  /**
   * Validate claim against blockchain history
   */
  private async validateClaim(claimId: string): Promise<boolean> {
    const claim = await this.db.claim.findUnique({
      where: { claimId }
    });

    if (!claim) return false;

    console.log(`🔍 Validating claim ${claimId}...`);

    // Calculate number of samples needed
    const durationBlocks = claim.endBlock - claim.startBlock;
    const samplesPerYear = 52; // Weekly sampling
    const yearInBlocks = 365 * 6500; // ~6500 blocks/day
    const requiredSamples = Math.ceil((durationBlocks * samplesPerYear) / yearInBlocks);

    // Query archive node for balance at each sample
    const sampleGap = Math.floor(durationBlocks / requiredSamples);
    let isValid = true;

    for (let i = 0; i < requiredSamples; i++) {
      const sampleBlock = claim.startBlock + (i * sampleGap);

      try {
        // Query balance at historical block
        const balance = await this.provider.getBalance(claim.user, sampleBlock);

        // Verify balance meets minimum
        if (balance < BigInt(claim.minBalance)) {
          console.log(`❌ Claim ${claimId} invalid at block ${sampleBlock}`);
          console.log(`   Expected: ${claim.minBalance}, Got: ${balance}`);
          isValid = false;
          break;
        }
      } catch (error) {
        console.error(`⚠️  Error querying block ${sampleBlock}:`, error);
        // Continue validation
      }
    }

    // Update validation result
    await this.db.claim.update({
      where: { claimId },
      data: {
        validated: true,
        validationResult: isValid,
        validatedAt: new Date()
      }
    });

    // If invalid and profitable, trigger challenge
    if (!isValid) {
      await this.considerChallenge(claimId);
    }

    return isValid;
  }

  /**
   * Determine if challenging is profitable
   */
  private async considerChallenge(claimId: string): Promise<void> {
    const claim = await this.db.claim.findUnique({
      where: { claimId }
    });

    if (!claim || claim.status !== 'PENDING') return;

    // Economic calculation
    const challengeStake = ethers.parseEther('0.2');
    const potentialReward = ethers.parseEther('0.3'); // 0.2 + 0.1
    const gasPrice = (await this.provider.getFeeData()).gasPrice || 0n;
    const estimatedGas = 200000n;
    const gasCost = gasPrice * estimatedGas;

    const expectedProfit = potentialReward - challengeStake - gasCost;
    const minProfit = ethers.parseEther('0.05'); // $75 at $1500 ETH

    console.log(`💰 Challenge economics for claim ${claimId}:`);
    console.log(`   Potential reward: ${ethers.formatEther(potentialReward)} ETH`);
    console.log(`   Challenge stake: ${ethers.formatEther(challengeStake)} ETH`);
    console.log(`   Gas cost: ${ethers.formatEther(gasCost)} ETH`);
    console.log(`   Expected profit: ${ethers.formatEther(expectedProfit)} ETH`);

    if (expectedProfit > minProfit) {
      console.log(`✅ Challenging claim ${claimId}...`);
      // This would be implemented in the Challenger module
      // await this.challenger.submitChallenge(claimId);
    } else {
      console.log(`⏭️  Skipping unprofitable challenge`);
    }
  }

  /**
   * Update user reputation after accepted claim
   */
  private async updateReputation(userAddress: string, claim: any): Promise<void> {
    // Calculate reputation metrics
    const durationDays = (claim.endBlock - claim.startBlock) / 6500;
    const ageMonths = Math.floor(durationDays / 30);

    await this.db.reputation.upsert({
      where: { userAddress },
      create: {
        userAddress,
        score: this.calculateScore(ageMonths, claim.minBalance),
        ageMonths,
        lastClaimId: claim.claimId,
        updatedAt: new Date()
      },
      update: {
        score: this.calculateScore(ageMonths, claim.minBalance),
        ageMonths,
        lastClaimId: claim.claimId,
        updatedAt: new Date()
      }
    });
  }

  /**
   * Calculate reputation score (0-1000)
   */
  private calculateScore(ageMonths: number, balance: string): number {
    // Age component (0-500 points)
    const ageScore = Math.min(500, ageMonths * 13.89); // 36 months = 500 points

    // Balance component (0-500 points)
    const balanceEth = Number(ethers.formatEther(balance));
    const balanceScore = Math.min(500, Math.log10(balanceEth + 1) * 100);

    return Math.floor(ageScore + balanceScore);
  }

  /**
   * Convert status number to string
   */
  private getStatusString(status: number): string {
    const statuses = ['PENDING', 'CHALLENGED', 'ACCEPTED', 'REJECTED'];
    return statuses[status] || 'UNKNOWN';
  }

  /**
   * Save checkpoint to database
   */
  private async saveCheckpoint(blockNumber: number): Promise<void> {
    await this.db.checkpoint.upsert({
      where: { id: 'scanner' },
      create: {
        id: 'scanner',
        blockNumber,
        timestamp: new Date()
      },
      update: {
        blockNumber,
        timestamp: new Date()
      }
    });
  }

  /**
   * Load last checkpoint from database
   */
  private async loadCheckpoint(): Promise<number> {
    const checkpoint = await this.db.checkpoint.findUnique({
      where: { id: 'scanner' }
    });

    return checkpoint?.blockNumber || this.config.startBlock;
  }

  /**
   * Reconnect to provider
   */
  private async reconnect(): Promise<void> {
    console.log('🔄 Reconnecting to provider...');

    try {
      await this.provider.destroy();
      this.provider = new ethers.WebSocketProvider(this.config.rpcUrl);

      // Recreate contract instance
      const abi = this.claimManager.interface.fragments;
      this.claimManager = new ethers.Contract(
        this.config.claimManagerAddress,
        abi,
        this.provider
      );

      // Restart listening
      this.listenForEvents();

      console.log('✅ Reconnected successfully');
    } catch (error) {
      console.error('❌ Reconnection failed:', error);
      setTimeout(() => this.reconnect(), 5000);
    }
  }

  /**
   * Stop scanner
   */
  async stop(): Promise<void> {
    console.log('🛑 Stopping scanner...');
    await this.provider.destroy();
    await this.db.$disconnect();
  }
}

// Main entry point
if (require.main === module) {
  const scanner = new ChronosScanner({
    rpcUrl: process.env.WS_RPC_URL || 'wss://eth-mainnet.g.alchemy.com/v2/YOUR_KEY',
    claimManagerAddress: process.env.CLAIM_MANAGER_ADDRESS || '0x...',
    startBlock: parseInt(process.env.START_BLOCK || '18000000')
  });

  scanner.start().catch(console.error);

  // Graceful shutdown
  process.on('SIGINT', async () => {
    await scanner.stop();
    process.exit(0);
  });
}
