import type { HomeownerQuote } from '@/features/meeting-flow/types'
import type { TradeScopeGroup } from '@/shared/modules/construction/core/lib/build-catalog-index'
import type { Trade } from '@/shared/modules/construction/core/schemas'
import type { PortfolioProject } from '@/shared/modules/projects/core/types'

export interface PickHomeownerQuotesOptions {
  scopesByTrade: ReadonlyMap<string, TradeScopeGroup>
  tradesById: ReadonlyMap<string, Pick<Trade, 'name'>>
  /** The meeting's trades: their projects come first. */
  preferredTradeIds: ReadonlySet<string>
  limit: number
  maxLength: number
}

/**
 * Portfolio rows to the homeowner quotes the Performance slide can show. A row needs a hero
 * image and a quote no longer than `maxLength`: the slide never clamps words, so a long quote is
 * skipped. Projects in the meeting's trades come first, most matching scopes first, then
 * portfolio order.
 */
export function pickHomeownerQuotes(rows: PortfolioProject[], options: PickHomeownerQuotesOptions): HomeownerQuote[] {
  const tradeOfScope = new Map<string, string>()
  for (const [tradeId, group] of options.scopesByTrade) {
    for (const entry of [...group.scopes, ...group.addons]) {
      tradeOfScope.set(entry.id, tradeId)
    }
  }

  const candidates: { order: number, preferredHits: number, quote: HomeownerQuote }[] = []
  rows.forEach((row, order) => {
    const text = unquote(row.project.homeownerQuote ?? '')
    if (!row.heroImage || text.length === 0 || text.length > options.maxLength) {
      return
    }

    const hits = new Map<string, number>()
    for (const scopeId of row.scopeIds) {
      const tradeId = tradeOfScope.get(scopeId)
      if (tradeId) {
        hits.set(tradeId, (hits.get(tradeId) ?? 0) + 1)
      }
    }

    let topTradeId: string | null = null
    let preferredHits = 0
    for (const [tradeId, count] of hits) {
      if (topTradeId === null || count > (hits.get(topTradeId) ?? 0)) {
        topTradeId = tradeId
      }
      if (options.preferredTradeIds.has(tradeId)) {
        preferredHits += count
      }
    }

    candidates.push({
      order,
      preferredHits,
      quote: {
        id: row.project.id,
        text,
        shortName: shortName(row.project.homeownerName),
        city: row.project.city,
        trade: topTradeId ? options.tradesById.get(topTradeId)?.name ?? null : null,
        image: row.heroImage.url,
      },
    })
  })

  return candidates
    .sort((a, b) => b.preferredHits - a.preferredHits || a.order - b.order)
    .slice(0, options.limit)
    .map(candidate => candidate.quote)
}

/**
 * Some stored quotes carry their own quotation marks; the slide draws its own. Only a matched
 * wrapping pair comes off — a quote mark inside the text, like `…our "dream kitchen"`, stays.
 */
function unquote(text: string): string {
  const trimmed = text.trim()
  const curly = /^\u201C([\s\S]*)\u201D$/.exec(trimmed)
  if (curly) {
    return curly[1].trim()
  }
  const straight = /^"([\s\S]*)"$/.exec(trimmed)
  if (straight) {
    return straight[1].trim()
  }
  return trimmed
}

/** First name and last initial. Words without a letter (a marker, an emoji) are not names. */
function shortName(name: string | null): string | null {
  const words = (name ?? '').trim().split(/\s+/).filter(word => /\p{L}/u.test(word))
  const [first, ...rest] = words
  if (!first) {
    return null
  }
  const last = rest.at(-1)
  if (!last) {
    return first
  }
  // The last word can carry a non-letter marker before the name, e.g. "(Smith)".
  const initial = /\p{L}/u.exec(last)?.[0]
  return initial ? `${first} ${initial.toUpperCase()}.` : first
}
