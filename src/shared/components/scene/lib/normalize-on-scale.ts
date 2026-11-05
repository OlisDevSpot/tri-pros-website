export function normalizeOnScale(value: number, scale: { min: number, max: number }): number {
  const span = scale.max - scale.min
  if (span <= 0) {
    return 0
  }
  return Math.min(Math.max((value - scale.min) / span, 0), 1)
}
