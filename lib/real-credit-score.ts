/**
 * Real Credit Score utilities
 * FICO-based scoring adapted for on-chain data
 */

/**
 * Get recommended Loan-to-Value ratio based on credit score
 * Higher scores = higher LTV allowed
 */
export function getRecommendedLTV(score: number): number {
  if (score >= 800) return 90; // Exceptional
  if (score >= 740) return 80; // Very Good
  if (score >= 670) return 70; // Good
  if (score >= 580) return 60; // Fair
  return 50; // Subprime
}

/**
 * Get interest rate multiplier based on credit score
 * Lower scores = higher rates (higher multiplier)
 */
export function getInterestRateMultiplier(score: number): number {
  if (score >= 800) return 1.0;   // Exceptional - base rate
  if (score >= 740) return 1.1;   // Very Good - 10% premium
  if (score >= 670) return 1.25;  // Good - 25% premium
  if (score >= 580) return 1.4;   // Fair - 40% premium
  return 1.5;                      // Subprime - 50% premium
}

/**
 * Get grace period in hours based on credit score
 */
export function getGracePeriod(score: number): number {
  if (score >= 800) return 72;  // 3 days
  if (score >= 740) return 48;  // 2 days
  if (score >= 670) return 36;  // 1.5 days
  if (score >= 580) return 24;  // 1 day
  return 12;                     // 12 hours
}

/**
 * Get score tier name
 */
export function getScoreTier(score: number): string {
  if (score >= 800) return 'Exceptional';
  if (score >= 740) return 'Very Good';
  if (score >= 670) return 'Good';
  if (score >= 580) return 'Fair';
  return 'Subprime';
}
