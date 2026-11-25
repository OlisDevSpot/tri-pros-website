import { FEET_PER_METRE } from '@/features/trade-scenes/constants/layout-grid'
import { formatAsCount } from '@/shared/lib/formatters'

export function formatFeet(metres: number): string {
  return `${formatAsCount(Math.round(metres * FEET_PER_METRE))} ft`
}

export function formatSquareFeet(m2: number): string {
  return `${formatAsCount(Math.round(m2 * FEET_PER_METRE * FEET_PER_METRE))} sq ft`
}
