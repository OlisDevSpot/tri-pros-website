import { formatAsDollars } from '@/shared/lib/formatters'

// A true minus sign reads better in large display figures than a hyphen.
export const MINUS = '−'

export function formatMoney(value: number): string {
  // Math.round can land on -0 (straight from -0, or from any small negative like -0.3); treat it as +0 so it never prints as "-$0".
  const rounded = Math.round(value) || 0
  return rounded < 0 ? `${MINUS}${formatAsDollars(-rounded)}` : formatAsDollars(rounded)
}

export function roundMoney(value: number): string {
  const size = Math.abs(value)
  const step = size >= 10000 ? 1000 : size >= 1000 ? 100 : 1
  return formatMoney(Math.round(value / step) * step)
}

export function signedMoney(value: number): string {
  return value > 0 ? `+${roundMoney(value)}` : roundMoney(value)
}
