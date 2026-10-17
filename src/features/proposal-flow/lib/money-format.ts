import { formatAsDollars, numberToUSD } from '@/shared/lib/formatters'

// Whole dollars read cleaner, but once any amount shown together has cents every one shows them, so the figures still add up.
export function pickMoneyFormat(amounts: number[]): (value: number) => string {
  return amounts.some(amount => Math.round(amount * 100) % 100 !== 0) ? numberToUSD : formatAsDollars
}
