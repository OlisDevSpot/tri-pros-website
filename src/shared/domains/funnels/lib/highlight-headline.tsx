import type { ReactNode } from 'react'

/**
 * Wraps each `highlightWords` phrase found in `headline` in a primary-colored
 * span. Exact, case-sensitive substring match; non-overlapping. Returns the
 * headline unchanged when no words are given.
 */
export function renderHighlightedHeadline(headline: string, highlightWords?: string[]): ReactNode {
  if (!highlightWords || highlightWords.length === 0) {
    return headline
  }
  const escaped = highlightWords.map(w => w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
  const parts = headline.split(new RegExp(`(${escaped.join('|')})`, 'g'))
  return parts.map((part, i) =>
    highlightWords.includes(part)
      ? <span key={i} className="text-primary">{part}</span>
      : part,
  )
}
