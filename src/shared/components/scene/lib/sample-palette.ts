// The CPU twin of the shader's palette lookup, used by DOM legends so a swatch tracks the paint's colours (the shader's form shading darkens it slightly).
export function samplePalette(stops: readonly (readonly [number, number, number])[], t: number): [number, number, number] {
  const scaled = Math.min(Math.max(t, 0), 1) * (stops.length - 1)
  const index = Math.min(Math.floor(scaled), stops.length - 2)
  const f = scaled - index
  const a = stops[index]
  const b = stops[index + 1]
  return [a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f, a[2] + (b[2] - a[2]) * f]
}
