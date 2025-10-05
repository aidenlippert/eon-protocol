import { BigInt, Bytes, store } from '@graphprotocol/graph-ts';
import {
  LoanRegistered,
  RepaymentRegistered,
  LiquidationRegistered,
  CollateralDataRecorded,
  KYCVerified,
} from '../../generated/CreditRegistry/CreditRegistry';
import { User, Loan, Repayment, Liquidation, CollateralData, KYCStatus, ProtocolStats } from '../../generated/schema';

// Helper: Load or create user
function loadOrCreateUser(address: Bytes, timestamp: BigInt): User {
  let user = User.load(address.toHexString());
  if (user == null) {
    user = new User(address.toHexString());
    user.firstSeen = timestamp;
    user.totalLoans = 0;
    user.activeLoans = 0;
    user.repaidLoans = 0;
    user.liquidatedLoans = 0;
    user.totalBorrowed = BigInt.zero();
    user.totalRepaid = BigInt.zero();
    user.totalCollateral = BigInt.zero();
    user.currentScore = 0;
    user.currentTier = 'Bronze';
  }
  user.lastSeen = timestamp;
  user.save();
  return user;
}

// Helper: Load or create protocol stats
function loadOrCreateProtocolStats(): ProtocolStats {
  let stats = ProtocolStats.load('global');
  if (stats == null) {
    stats = new ProtocolStats('global');
    stats.totalUsers = 0;
    stats.totalLoans = 0;
    stats.totalBorrowed = BigInt.zero();
    stats.totalRepaid = BigInt.zero();
    stats.totalCollateral = BigInt.zero();
    stats.activeLoans = 0;
    stats.averageScore = 0;
    stats.updatedAt = BigInt.zero();
  }
  return stats;
}

// Event: LoanRegistered(address indexed borrower, uint256 indexed loanId, uint256 principalUsd18, uint256 timestamp, address indexed lender)
export function handleLoanRegistered(event: LoanRegistered): void {
  let user = loadOrCreateUser(event.params.borrower, event.params.timestamp);

  // Create loan entity
  let loan = new Loan(event.params.loanId.toString());
  loan.borrower = user.id;
  loan.lender = event.params.lender;
  loan.principalUsd18 = event.params.principalUsd18;
  loan.collateralUsd18 = BigInt.zero(); // Will be updated by CollateralDataRecorded
  loan.collateralToken = Bytes.empty();
  loan.collateralAmount = BigInt.zero();
  loan.repaidUsd18 = BigInt.zero();
  loan.status = 'Active';
  loan.aprBps = 0; // Will be set by CreditVault event
  loan.borrowerScore = user.currentScore || 0;
  loan.borrowerTier = user.currentTier || 'Bronze';
  loan.createdAt = event.params.timestamp;
  loan.createdAtBlock = event.block.number;
  loan.updatedAt = event.params.timestamp;
  loan.healthFactor = BigInt.fromI32(2).toBigDecimal(); // Default to 2.0
  loan.graceStart = BigInt.zero();
  loan.save();

  // Update user stats
  user.totalLoans = user.totalLoans + 1;
  user.activeLoans = user.activeLoans + 1;
  user.totalBorrowed = user.totalBorrowed.plus(event.params.principalUsd18);
  user.save();

  // Update protocol stats
  let stats = loadOrCreateProtocolStats();
  stats.totalLoans = stats.totalLoans + 1;
  stats.activeLoans = stats.activeLoans + 1;
  stats.totalBorrowed = stats.totalBorrowed.plus(event.params.principalUsd18);
  stats.updatedAt = event.params.timestamp;
  stats.save();
}

// Event: RepaymentRegistered(address indexed borrower, uint256 indexed loanId, uint256 amountUsd18, uint256 timestamp, address indexed payer)
export function handleRepaymentRegistered(event: RepaymentRegistered): void {
  let loan = Loan.load(event.params.loanId.toString());
  if (loan == null) return;

  // Create repayment entity
  let repaymentId = event.transaction.hash.toHexString() + '-' + event.logIndex.toString();
  let repayment = new Repayment(repaymentId);
  repayment.loan = loan.id;
  repayment.payer = event.params.payer;
  repayment.amountUsd18 = event.params.amountUsd18;
  repayment.timestamp = event.params.timestamp;
  repayment.blockNumber = event.block.number;
  repayment.transactionHash = event.transaction.hash;
  repayment.save();

  // Update loan
  loan.repaidUsd18 = loan.repaidUsd18.plus(event.params.amountUsd18);
  loan.updatedAt = event.params.timestamp;

  // Check if fully repaid
  if (loan.repaidUsd18.ge(loan.principalUsd18)) {
    loan.status = 'Repaid';
    loan.repaidAt = event.params.timestamp;

    // Update user stats
    let user = User.load(loan.borrower);
    if (user != null) {
      user.activeLoans = user.activeLoans - 1;
      user.repaidLoans = user.repaidLoans + 1;
      user.totalRepaid = user.totalRepaid.plus(event.params.amountUsd18);
      user.save();
    }

    // Update protocol stats
    let stats = loadOrCreateProtocolStats();
    stats.activeLoans = stats.activeLoans - 1;
    stats.totalRepaid = stats.totalRepaid.plus(event.params.amountUsd18);
    stats.updatedAt = event.params.timestamp;
    stats.save();
  }

  loan.save();
}

// Event: LiquidationRegistered(address indexed borrower, uint256 indexed loanId, uint256 recoveredUsd18, uint256 timestamp, address indexed liquidator)
export function handleLiquidationRegistered(event: LiquidationRegistered): void {
  let loan = Loan.load(event.params.loanId.toString());
  if (loan == null) return;

  // Create liquidation entity
  let liquidationId = event.params.loanId.toString() + '-' + event.params.timestamp.toString();
  let liquidation = new Liquidation(liquidationId);
  liquidation.loan = loan.id;
  liquidation.borrower = event.params.borrower;
  liquidation.liquidator = event.params.liquidator;
  liquidation.collateralAmount = loan.collateralAmount;
  liquidation.recoveredUsd18 = event.params.recoveredUsd18;
  liquidation.timestamp = event.params.timestamp;
  liquidation.blockNumber = event.block.number;
  liquidation.transactionHash = event.transaction.hash;
  liquidation.save();

  // Update loan
  loan.status = 'Liquidated';
  loan.liquidatedAt = event.params.timestamp;
  loan.liquidator = event.params.liquidator;
  loan.recoveredUsd18 = event.params.recoveredUsd18;
  loan.updatedAt = event.params.timestamp;
  loan.save();

  // Update user stats
  let user = User.load(loan.borrower);
  if (user != null) {
    user.activeLoans = user.activeLoans - 1;
    user.liquidatedLoans = user.liquidatedLoans + 1;
    user.save();
  }

  // Update protocol stats
  let stats = loadOrCreateProtocolStats();
  stats.activeLoans = stats.activeLoans - 1;
  stats.updatedAt = event.params.timestamp;
  stats.save();
}

// Event: CollateralDataRecorded(uint256 indexed loanId, address indexed collateralToken, uint256 collateralValueUsd18, uint16 userScore)
export function handleCollateralDataRecorded(event: CollateralDataRecorded): void {
  let loan = Loan.load(event.params.loanId.toString());
  if (loan == null) return;

  // Update loan collateral info
  loan.collateralUsd18 = event.params.collateralValueUsd18;
  loan.collateralToken = event.params.collateralToken;
  loan.save();

  // Create collateral data entity
  let collateralData = new CollateralData(event.params.loanId.toString());
  collateralData.loan = loan.id;
  collateralData.collateralToken = event.params.collateralToken;
  collateralData.collateralValueUsd18 = event.params.collateralValueUsd18;
  collateralData.userScoreAtBorrow = event.params.userScore;
  collateralData.timestamp = event.block.timestamp;
  collateralData.save();

  // Update user total collateral
  let user = User.load(loan.borrower);
  if (user != null) {
    user.totalCollateral = user.totalCollateral.plus(event.params.collateralValueUsd18);
    user.save();
  }

  // Update protocol stats
  let stats = loadOrCreateProtocolStats();
  stats.totalCollateral = stats.totalCollateral.plus(event.params.collateralValueUsd18);
  stats.save();
}

// Event: KYCVerified(address indexed user, bytes32 credentialHash, uint256 expiresAt)
export function handleKYCVerified(event: KYCVerified): void {
  let user = loadOrCreateUser(event.params.user, event.block.timestamp);

  // Create or update KYC status
  let kycStatus = KYCStatus.load(event.params.user.toHexString());
  if (kycStatus == null) {
    kycStatus = new KYCStatus(event.params.user.toHexString());
    kycStatus.user = user.id;
  }
  kycStatus.verified = true;
  kycStatus.credentialHash = event.params.credentialHash;
  kycStatus.verifiedAt = event.block.timestamp;
  kycStatus.expiresAt = event.params.expiresAt;
  kycStatus.save();

  user.kycStatus = kycStatus.id;
  user.save();
}
