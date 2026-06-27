import type { CardSelectStep } from '@/shared/domains/funnels/types'
import { cardOptions, img } from '@/shared/domains/funnels/lib/card-options'

/**
 * Importable prebuilt step (Seam A). Spread + override `content` to customize
 * per funnel. Funnel-agnostic by design: the "when would you start" options and
 * their imagery live under /funnels/common/timeline/* (scope 'common') so every
 * funnel reuses this step verbatim rather than redefining it. Keep `id` as
 * 'timeline' — funnel `enrichment` maps reference it by that step id.
 */
export const TIMELINE_STEP: CardSelectStep = {
  id: 'timeline',
  kind: 'card-select',
  content: {
    title: 'When would you want to start?',
    options: cardOptions('common', 'timeline', [
      img('asap', 'ASAP'),
      img('1-3', '1–3 months'),
      img('3-6', '3–6 months'),
      img('exploring', 'Just exploring'),
    ]),
  },
}
