import { currentYear } from '@/features/trade-scenes/lib/current-year'

// A year is labelled by the calendar year it ends in; the first is today's.
export function yearLabel(year: number, now: number = currentYear()): string {
  return year === 1 ? 'Now' : String(now + year)
}
