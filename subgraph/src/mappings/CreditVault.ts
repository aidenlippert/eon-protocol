import { BigInt, BigDecimal } from '@graphprotocol/graph-ts';
import {
  LoanCreated,
  LoanRepaid,
  LoanLiquidated,
  GracePeriodStarted,
} from '../../generated/CreditVault/CreditVault';
import { Loan } from '../../generated/schema';

// Event: LoanCreated(uint256 indexed loanId, address indexed borrower, uint256 principalUsd18, uint256 collateralAmount)
export function handleLoanCreated(event: LoanCreated): void {
  let loan = Loan.load(event.params.loanId.toString());
  if (loan == null) return; // Loan should exist from CreditRegistry.LoanRegistered

  // Update vault-specific data
  loan.collateralAmount = event.params.collateralAmount;
  loan.save();
}

// Event: LoanRepaid(uint256 indexed loanId, address indexed borrower, uint256 amountUsd18)
export function handleLoanRepaid(event: LoanRepaid): void {
  let loan = Loan.load(event.params.loanId.toString());
  if (loan == null) return;

  // Update repayment timestamp (vault confirmation)
  loan.repaidAt = event.block.timestamp;
  loan.updatedAt = event.block.timestamp;
  loan.save();
}

// Event: LoanLiquidated(uint256 indexed loanId, address indexed borrower, address indexed liquidator, uint256 collateralAmount)
export function handleLoanLiquidated(event: LoanLiquidated): void {
  let loan = Loan.load(event.params.loanId.toString());
  if (loan == null) return;

  // Update liquidation details (vault confirmation)
  loan.liquidatedAt = event.block.timestamp;
  loan.liquidator = event.params.liquidator;
  loan.updatedAt = event.block.timestamp;
  loan.save();
}

// Event: GracePeriodStarted(uint256 indexed loanId, uint256 timestamp)
export function handleGracePeriodStarted(event: GracePeriodStarted): void {
  let loan = Loan.load(event.params.loanId.toString());
  if (loan == null) return;

  // Record grace period start
  loan.graceStart = event.params.timestamp;
  loan.updatedAt = event.block.timestamp;
  loan.save();
}
