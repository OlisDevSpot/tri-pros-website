import type { CardSelectStep } from '@/shared/domains/funnels/types'
import { cardOptions, img } from '@/shared/domains/funnels/lib/card-options'

/**
 * Importable prebuilt step (Seam A). Spread + override `content` to customize
 * per funnel. Funnel-agnostic by design: the home-type options and their
 * imagery live under /funnels/common/home-type/* (scope 'common') so every
 * funnel reuses this step verbatim rather than redefining it.
 */
export const HOME_TYPE_STEP: CardSelectStep = {
  id: 'homeType',
  kind: 'card-select',
  content: {
    title: 'What kind of home is it?',
    options: cardOptions('common', 'home-type', [
      img('single-family', 'Single-family'),
      img('condo', 'Condo'),
      img('mobile-home', 'Mobile home'),
      img('commercial', 'Commercial'),
    ]),
  },
}
