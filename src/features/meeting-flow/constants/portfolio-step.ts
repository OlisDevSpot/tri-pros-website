import type { PortfolioMatchKind } from '@/features/meeting-flow/types'

export const PORTFOLIO_SECTION_LABELS: Record<PortfolioMatchKind, string> = {
  scope: 'For your project',
  trade: 'For your project',
  fallback: 'From our portfolio',
  none: 'Other projects',
}

export const PORTFOLIO_COPY = {
  noMatches: 'No finished projects match these scopes yet.',
  empty: 'No portfolio projects to show yet',
  errorTitle: 'The portfolio did not load',
  retry: 'Try again',
  loading: 'Loading portfolio',
  startCue: 'Tap or press Space',
  nextCue: 'Next:',
  nextPhoto: 'Next photo',
  allProjects: (count: number) => `All ${count}`,
  listTitle: 'Projects',
} as const

/** When nothing matches the meeting's scopes or trades, this many projects lead instead. */
export const FALLBACK_MATCH_COUNT = 3

/** Project details fetched ahead of the one on screen, so ↓ lands on loaded photos. */
export const PREFETCH_AHEAD = 2

export const PROJECT_LIST_ROW_COUNT = 3
