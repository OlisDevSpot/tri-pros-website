/** A blank cell is "not entered" (null), which analytics treats differently from $0. */
export function parseDollarsToCents(text: string): number | null | 'invalid' {
  const cleaned = text.trim().replace(/^\$/, '').replace(/,/g, '').trim()
  if (cleaned === '') {
    return null
  }
  if (!/^\d+(?:\.\d{1,2})?$/.test(cleaned)) {
    return 'invalid'
  }
  return Math.round(Number(cleaned) * 100)
}

export function formatCentsForInput(cents: number): string {
  return (cents / 100).toFixed(cents % 100 === 0 ? 0 : 2)
}
