import type { PortfolioMatch, PortfolioMatchSection } from '@/features/meeting-flow/types'
import { PORTFOLIO_SECTION_LABELS } from '@/features/meeting-flow/constants/portfolio-step'

/** Consecutive kinds with the same label share a section; `index` stays the list position so numbers and jumps agree. */
export function groupPortfolioMatches(matches: PortfolioMatch[]): PortfolioMatchSection[] {
  const sections: PortfolioMatchSection[] = []
  matches.forEach((match, index) => {
    const label = PORTFOLIO_SECTION_LABELS[match.kind]
    const last = sections.at(-1)
    if (last?.label === label) {
      last.items.push({ match, index })
    }
    else {
      sections.push({ label, items: [{ match, index }] })
    }
  })
  return sections
}
