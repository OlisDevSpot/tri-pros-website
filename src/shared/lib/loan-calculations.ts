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
 * Balance left on an amortized loan after `monthsPaid` payments. Same PERCENT
 * convention as `amortizedMonthlyPayment`. Clamped to [0, principal]; paid off → 0.
 */
export function remainingBalance(
  principal: number,
  annualRatePercent: number,
  termMonths: number,
  monthsPaid: number,
): number {
  if (principal <= 0 || termMonths <= 0 || monthsPaid >= termMonths) {
    return 0
  }
  const k = Math.max(0, monthsPaid)
  if (annualRatePercent === 0) {
    return principal * (1 - k / termMonths)
  }
  const monthlyRate = annualRatePercent / 100 / 12
  const payment = amortizedMonthlyPayment(principal, annualRatePercent, termMonths)
  const growth = (1 + monthlyRate) ** k
  const balance = principal * growth - (payment * (growth - 1)) / monthlyRate
  return Math.min(principal, Math.max(0, balance))
}

/**
 * Months until a balance is paid off at a fixed payment. Same PERCENT
 * convention. `null` when it never pays off: no payment, or a payment that
 * doesn't cover the interest. Fractional months are kept.
 */
export function monthsToPayOff(balance: number, annualRatePercent: number, payment: number): number | null {
  if (balance <= 0) {
    return 0
  }
  if (payment <= 0) {
    return null
  }
  if (annualRatePercent === 0) {
    return balance / payment
  }
  const monthlyRate = annualRatePercent / 100 / 12
  if (payment <= balance * monthlyRate) {
    return null
  }
  return -Math.log(1 - (monthlyRate * balance) / payment) / Math.log(1 + monthlyRate)
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
