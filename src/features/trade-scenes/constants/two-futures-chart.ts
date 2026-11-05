import type { ChartConfig } from '@/shared/components/ui/chart'

import { BENEFITS_COPY } from '@/features/trade-scenes/constants/home-scene-copy'

export const TWO_FUTURES_CHART_CONFIG = {
  without: { label: `${BENEFITS_COPY.futures.without}${BENEFITS_COPY.futures.theBuild}`, color: 'var(--chart-5)' },
  with: { label: `${BENEFITS_COPY.futures.with}${BENEFITS_COPY.futures.theBuild}`, color: 'var(--primary)' },
} as const satisfies ChartConfig

export const TWO_FUTURES_CHART = {
  barSize: { wide: 22, portrait: 9 },
  barGap: 3,
  barRadius: 4,
  // Room over the tallest column, so the last year's pair never touches the readout.
  headroom: 1.25,
  // The bracket stands clear of the With column by a share of its width.
  bracket: { gapShare: 0.3, width: 6, stroke: 2, radius: 4 },
  // Now stays half-lit as the reference; the picked year is the one lit.
  opacity: { lit: 1, now: 0.7, rest: 0.34 },
  // Phone: four years carry a label, plus the picked one.
  labelledOnPhone: [1, 2, 5, 10] as readonly number[],
} as const
