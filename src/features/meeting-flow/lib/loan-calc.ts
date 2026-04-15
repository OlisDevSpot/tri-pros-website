/**
 * Simple loan amortization calculation.
 * Returns the monthly payment for a fixed-rate installment loan.
 */
export function calculateMonthlyPayment(
  principal: number,
  annualRate: number,
  termMonths: number,
): number {
  if (annualRate === 0) {
    return principal / termMonths
  }
  const monthlyRate = annualRate / 100 / 12
  return (principal * monthlyRate) / (1 - (1 + monthlyRate) ** -termMonths)
}

/**
 * Format a number as a USD currency string (no cents unless non-zero).
 */
export function formatCurrency(value: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value)
}
