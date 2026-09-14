export function formatCount(n: number, unit: readonly [string, string]): string {
  return `${n} ${n === 1 ? unit[0] : unit[1]}`
}
