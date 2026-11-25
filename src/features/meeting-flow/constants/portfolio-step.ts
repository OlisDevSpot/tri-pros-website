import type { PortfolioMatchKind } from '@/shared/modules/projects/core/types'

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

export const PROJECT_LIST_ROW_COUNT = 3
