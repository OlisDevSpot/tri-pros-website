import type { CardSelectStep } from '@/shared/domains/funnels/types'

/**
 * Importable prebuilt step (Seam A). Spread + override `content` to customize
 * per funnel. Funnel-agnostic by design: the home-type options and their
 * imagery live under /funnels/common/home-type/* so every funnel reuses this
 * step verbatim rather than redefining it.
 */
export const HOME_TYPE_STEP: CardSelectStep = {
  id: 'homeType',
  kind: 'card-select',
  optionIds: ['single-family', 'condo', 'mobile-home', 'commercial'],
  content: {
    title: 'What kind of home is it?',
    options: {
      'single-family': { label: 'Single-family', asset: { kind: 'image', src: '/funnels/common/home-type/single-family.webp', alt: 'Single-family home' } },
      'condo': { label: 'Condo', asset: { kind: 'image', src: '/funnels/common/home-type/condo.webp', alt: 'Condo building' } },
      'mobile-home': { label: 'Mobile home', asset: { kind: 'image', src: '/funnels/common/home-type/mobile-home.webp', alt: 'Mobile home' } },
      'commercial': { label: 'Commercial', asset: { kind: 'image', src: '/funnels/common/home-type/commercial.webp', alt: 'Commercial building' } },
    },
  },
}
