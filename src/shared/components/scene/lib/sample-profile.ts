export function sampleProfile(widths: readonly number[], t: number): number {
  if (widths.length === 0) {
    return 0
  }
  if (widths.length === 1) {
    return widths[0]
  }
  const scaled = Math.min(Math.max(t, 0), 1) * (widths.length - 1)
  const index = Math.min(Math.floor(scaled), widths.length - 2)
  return widths[index] + (widths[index + 1] - widths[index]) * (scaled - index)
}
