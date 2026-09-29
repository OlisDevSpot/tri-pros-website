export const CHART_BAR_GAP = 2
const CATEGORY_GAP_SHARE = 0.2
const MAX_BAR_SIZE = 28

/**
 * Recharts only centres a bucket's bar group on its tick when given a numeric
 * `barSize`; with `maxBarSize` alone each capped bar sits centred in its own
 * slot, so a wide bucket (a single day, a short week) scatters its bars. Same
 * sizing as the percentage layout, so crowded periods render unchanged.
 */
export function groupedBarSize(plotWidth: number, bucketCount: number, seriesCount: number): number | undefined {
  if (plotWidth <= 0 || bucketCount === 0 || seriesCount === 0) {
    return undefined
  }
  const band = plotWidth / bucketCount
  const slot = Math.floor((band * (1 - 2 * CATEGORY_GAP_SHARE) - (seriesCount - 1) * CHART_BAR_GAP) / seriesCount)
  return Math.max(1, Math.min(MAX_BAR_SIZE, slot))
}
