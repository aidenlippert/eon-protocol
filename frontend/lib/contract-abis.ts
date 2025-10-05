/**
 * @title Contract ABIs
 * @notice Minimal ABIs for deployed contracts (only functions we need to read)
 */

// CreditRegistry - User credit records and history
export const CREDIT_REGISTRY_ABI = [
  // Read user profile
  'function getUserProfile(address user) view returns (tuple(uint256 totalLoans, uint256 totalRepaid, uint256 activeLoanCount, uint256 totalLiquidations, uint256 lastActivityTimestamp))',

  // Get user's loan history
  'function getUserLoans(address user) view returns (uint256[] memory)',

  // Get loan details
  'function getLoan(uint256 loanId) view returns (tuple(address borrower, uint256 principal, uint256 collateral, address collateralToken, uint256 startTime, uint256 endTime, bool active, bool repaid, bool liquidated))',

  // Events for indexing
  'event LoanRegistered(address indexed user, uint256 indexed loanId, uint256 principal, uint256 timestamp)',
  'event RepaymentRegistered(address indexed user, uint256 indexed loanId, uint256 amount, uint256 timestamp)',
  'event LiquidationRegistered(address indexed user, uint256 indexed loanId, uint256 timestamp)',
] as const;

// ScoreOracle - Credit score calculation and storage
export const SCORE_ORACLE_ABI = [
  // Get user's current credit score
  'function getScore(address user) view returns (uint16)',

  // Get detailed score breakdown
  'function getScoreBreakdown(address user) view returns (tuple(uint16 score, uint8 paymentScore, uint8 utilizationScore, uint8 historyScore, uint8 mixScore, uint8 inquiryScore, uint256 lastUpdated))',

  // Check if user has score
  'function hasScore(address user) view returns (bool)',

  // Events
  'event ScoreUpdated(address indexed user, uint16 oldScore, uint16 newScore, uint256 timestamp)',
] as const;

// CreditVault - Lending pool with collateral
export const CREDIT_VAULT_ABI = [
  // Get user's collateral balance
  'function userCollateral(address user) view returns (uint256)',

  // Get specific loan details
  'function getLoan(uint256 loanId) view returns (tuple(address borrower, uint256 principal, uint256 collateralAmount, address collateralToken, uint256 aprBps, uint256 startTimestamp, bool active, uint256 graceStart))',

  // Calculate current debt for loan
  'function calculateDebt(uint256 loanId) view returns (uint256)',

  // Get health factor for user
  'function getUserHealthFactor(address user) view returns (uint256)',

  // Get loan by index (for iteration)
  'function loans(uint256 loanId) view returns (address borrower, uint256 principal, uint256 collateralAmount, address collateralToken, uint256 aprBps, uint256 startTimestamp, bool active, uint256 graceStart)',

  // Get next loan ID (to know total loans)
  'function nextLoanId() view returns (uint256)',

  // Events
  'event LoanCreated(uint256 indexed loanId, address indexed borrower, uint256 principal, uint256 collateral, address collateralToken)',
  'event LoanRepaid(uint256 indexed loanId, address indexed borrower, uint256 amount, uint256 remaining)',
  'event LoanLiquidated(uint256 indexed loanId, address indexed borrower, address indexed liquidator, uint256 collateralSeized)',
  'event CollateralDeposited(address indexed user, address indexed token, uint256 amount, uint256 usdValue)',
  'event CollateralWithdrawn(address indexed user, address indexed token, uint256 amount, uint256 usdValue)',
] as const;
