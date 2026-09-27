import { formatAsDollars } from '@/shared/lib/formatters'

// A true minus sign reads better in large display figures than a hyphen.
const MINUS = '−'

export function formatMoney(value: number): string {
  const rounded = Math.round(value)
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
