export function heightOnRows(rows: readonly (readonly [z: number, y: number])[], z: number): number {
  const last = rows.length - 1
  if (z <= rows[0][0]) {
    return rows[0][1]
  }
  if (z >= rows[last][0]) {
    return rows[last][1]
  }
  const next = rows.findIndex(([rowZ]) => rowZ > z)
  const [z0, y0] = rows[next - 1]
  const [z1, y1] = rows[next]
  return y0 + (y1 - y0) * (z - z0) / (z1 - z0)
}
