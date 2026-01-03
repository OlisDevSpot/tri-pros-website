export function getLoanValues(principal: number, rate: number, months: number) {
  const monthlyRate = rate / 12

  const monthly = (principal * (monthlyRate / (1 - (1 + monthlyRate) ** -months)))
  const annually = monthly * 12

  return {
    monthly,
    monthlyFormatted: monthly.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 2 }),
    annually,
    annuallyFormatted: annually.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 2 }),
  }
}
