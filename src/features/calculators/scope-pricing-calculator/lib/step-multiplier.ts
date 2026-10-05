export function stepMultiplier(current: number, delta: number, floor: number): number {
  return Math.max(floor, Math.round((current + delta) * 100) / 100)
}
