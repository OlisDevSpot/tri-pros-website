/**
 * Canonical amortized monthly payment — the ONE implementation app-wide.
 * `annualRatePercent` is a PERCENT number (9.99 means 9.99% APR).
 * 0% APR → straight principal/term. Non-positive principal or term → 0.
 */
export function amortizedMonthlyPayment(
  principal: number,
  annualRatePercent: number,
  termMonths: number,
): number {
  if (principal <= 0 || termMonths <= 0) {
    return 0
  }
  if (annualRatePercent === 0) {
    return principal / termMonths
  }
  const monthlyRate = annualRatePercent / 100 / 12
  return (principal * monthlyRate) / (1 - (1 + monthlyRate) ** -termMonths)
}

/**
 * Loan display values for finance options.
 * NOTE: `annualRateFraction` is a DECIMAL FRACTION (0.0999 means 9.99% APR) —
 * that is how `finance_options.interestRate` is stored. Converted here, once.
 */
export function getLoanValues(principal: number, annualRateFraction: number, months: number) {
  const monthly = amortizedMonthlyPayment(principal, annualRateFraction * 100, months)
  const annually = monthly * 12

  return {
    monthly,
    monthlyFormatted: monthly.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 2 }),
    annually,
    annuallyFormatted: annually.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 2 }),
  }
}
