// see ../../DOCS.md#margin-multiplier-tiers
export type MultiplierTier = 'danger' | 'healthy' | 'excellent' | 'unknown'

export function getMultiplierTier(value: number | null): MultiplierTier {
  if (value == null) {
    return 'unknown'
  }
  if (value < 2) {
    return 'danger'
  }
  if (value >= 3) {
    return 'excellent'
  }
  return 'healthy'
}

export function formatMultiplier(value: number | null): string {
  if (value == null) {
    return '—'
  }
  return `${value.toFixed(2)}x`
}
