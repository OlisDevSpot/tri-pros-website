import type { MultiplierTier } from '@/shared/modules/proposals/core/lib/financials'

/** Tier → className map used everywhere a multiplier is rendered. */
export const MULTIPLIER_STYLES: Record<MultiplierTier, string> = {
  danger: 'text-status-danger-fg',
  healthy: 'text-status-success-fg',
  excellent: 'text-status-success-fg [text-shadow:0_0_12px_var(--status-success-dot),0_0_4px_color-mix(in_oklch,var(--status-success-dot)_40%,transparent)]',
  unknown: 'text-muted-foreground',
}
