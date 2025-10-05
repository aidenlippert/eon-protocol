import { BigInt } from '@graphprotocol/graph-ts';
import { ScoreComputed } from '../../generated/ScoreOracle/ScoreOracle';
import { User, ScoreSnapshot, ProtocolStats } from '../../generated/schema';

// Event: ScoreComputed(address indexed user, uint16 score, string tier)
export function handleScoreComputed(event: ScoreComputed): void {
  // Load or create user
  let user = User.load(event.params.user.toHexString());
  if (user == null) {
    user = new User(event.params.user.toHexString());
    user.firstSeen = event.block.timestamp;
    user.totalLoans = 0;
    user.activeLoans = 0;
    user.repaidLoans = 0;
    user.liquidatedLoans = 0;
    user.totalBorrowed = BigInt.zero();
    user.totalRepaid = BigInt.zero();
    user.totalCollateral = BigInt.zero();
  }

  // Update user score
  user.currentScore = event.params.score;
  user.currentTier = event.params.tier;
  user.lastSeen = event.block.timestamp;
  user.save();

  // Create score snapshot
  let snapshotId = event.params.user.toHexString() + '-' + event.block.timestamp.toString();
  let snapshot = new ScoreSnapshot(snapshotId);
  snapshot.user = user.id;
  snapshot.score = event.params.score;
  snapshot.tier = event.params.tier;

  // Note: Individual factor scores (s1-s7) would need to be emitted in event
  // For now, set to 0 or calculate proportionally
  snapshot.s1PaymentHistory = 0;
  snapshot.s2CreditUtilization = 0;
  snapshot.s3AccountAge = 0;
  snapshot.s4IdentityTrust = 0;
  snapshot.s5AssetDiversity = 0;
  snapshot.s6ProtocolMix = 0;
  snapshot.s7ActivityControl = 0;

  snapshot.timestamp = event.block.timestamp;
  snapshot.blockNumber = event.block.number;
  snapshot.transactionHash = event.transaction.hash;
  snapshot.save();

  // Update protocol average score
  let stats = ProtocolStats.load('global');
  if (stats != null) {
    // Simple running average (could be improved with proper calculation)
    stats.averageScore = event.params.score;
    stats.updatedAt = event.block.timestamp;
    stats.save();
  }
}
