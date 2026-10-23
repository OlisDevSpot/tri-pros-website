import { formatAsDollars } from '@/shared/lib/formatters'

export function formatLedgerAmount(amount: number) {
  return amount < 0 ? `−${formatAsDollars(Math.abs(amount))}` : formatAsDollars(Math.abs(amount))
}
