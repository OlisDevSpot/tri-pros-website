// Pure rule: the lead's primary (first) interested trade, trimmed/deduped.
// Shared by CT attribute building and SMS {{primary_trade}} rendering. No I/O.

export function pickPrimaryTrade(interestedTradesRaw?: string[]): string {
  const trades = (interestedTradesRaw ?? []).map(t => t.trim()).filter(Boolean)
  return trades[0] ?? ''
}
