import type { ChartConfig } from '@/shared/components/ui/chart'

import { STORY_COPY } from '@/features/calculators/remodel-roi-calculator/constants/story-copy'

export const PATHS_CHART_CONFIG = {
  now: { label: STORY_COPY.paths.now, color: 'var(--primary)' },
  wait: { label: STORY_COPY.paths.wait, color: 'var(--warning)' },
} satisfies ChartConfig

export const MONTHLY_TREND_CHART_CONFIG = {
  monthlyNow: PATHS_CHART_CONFIG.now,
  monthlyWait: PATHS_CHART_CONFIG.wait,
} satisfies ChartConfig

export const HOME_VALUE_CHART_CONFIG = {
  valueNow: PATHS_CHART_CONFIG.now,
  valueWait: PATHS_CHART_CONFIG.wait,
} satisfies ChartConfig

export const PAY_FOR_ITSELF_CHART_CONFIG = {
  benefit: { label: 'Ahead of waiting', color: 'var(--primary)' },
} satisfies ChartConfig

export const MONTHLY_BREAKDOWN_CHART_CONFIG = {
  nowBills: { label: 'Bills', color: 'color-mix(in oklab, var(--muted-foreground) 35%, transparent)' },
  nowLoan: { label: 'Project loan', color: 'var(--primary)' },
  waitBills: { label: 'Bills', color: 'color-mix(in oklab, var(--muted-foreground) 35%, transparent)' },
  waitRepairs: { label: 'Repairs', color: 'color-mix(in oklab, var(--warning) 40%, transparent)' },
  waitLoan: { label: 'Replacement loans', color: 'var(--warning)' },
} satisfies ChartConfig

export const COST_OF_WAITING_CHART_CONFIG = {
  today: { label: 'Price today', color: 'color-mix(in oklab, var(--muted-foreground) 40%, transparent)' },
  price: { label: 'Price when it gives out', color: 'var(--warning)' },
  repairs: { label: 'Repairs until then', color: 'color-mix(in oklab, var(--warning) 40%, transparent)' },
} satisfies ChartConfig
