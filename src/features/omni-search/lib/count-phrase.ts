/** "1 customer", "3 customers". */
export function countPhrase(count: number, [one, many]: readonly [string, string]): string {
  return `${count} ${count === 1 ? one : many}`
}
