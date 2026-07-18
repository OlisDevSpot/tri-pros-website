import type { MultiplierTier } from '@/shared/entities/proposals/lib/financials'

/** Tier → className map used everywhere a multiplier is rendered. see ../DOCS.md#margin-multiplier-tiers */
export const MULTIPLIER_STYLES: Record<MultiplierTier, string> = {
  danger: 'text-red-600 dark:text-red-400',
  healthy: 'text-emerald-600 dark:text-emerald-400',
  excellent: 'text-emerald-600 dark:text-emerald-300 [text-shadow:0_0_12px_oklch(0.7_0.18_155),0_0_4px_oklch(0.7_0.18_155_/_0.4)]',
  unknown: 'text-muted-foreground',
}
