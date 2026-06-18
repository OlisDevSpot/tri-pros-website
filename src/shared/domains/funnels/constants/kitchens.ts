import type { FunnelSpec, StepId } from '@/shared/domains/funnels/types'

const STEP_ORDER: StepId[] = ['hero', 'layout', 'ownership']

export const kitchensFunnel: FunnelSpec = {
  slug: 'kitchens',
  theme: { accent: 'primary' },
  pixel: { contentCategory: 'kitchen' },
  steps: [
    { id: 'hero', kind: 'info' },
    { id: 'layout', kind: 'card-select', field: 'layout', optionIds: ['l-shape', 'u-shape', 'galley', 'island', 'open', 'not-sure'] },
    { id: 'ownership', kind: 'card-select', field: 'ownership', optionIds: ['own', 'rent'] },
  ],
  // Linear for kitchen; engine supports branching for other funnels.
  flow: (_answers, currentStepId) => {
    const i = STEP_ORDER.indexOf(currentStepId)
    return i >= 0 && i < STEP_ORDER.length - 1 ? STEP_ORDER[i + 1] : null
  },
  content: {
    // ── existing hero fields (keep the foundation's copy) ──
    title: 'Kitchen Showcase',
    headline: 'Get a AAA-grade kitchen remodel — at a Showcase price.',
    subhead: 'See if your home qualifies for one of our Showcase kitchens.',
    scarcityLine: 'We\'re selecting 5 kitchens in your area.',
    // ── per-step copy (NEW) ──
    steps: {
      // Hero copy comes from the funnel-level fields above; this entry only
      // supplies the hero CTA label.
      hero: { title: 'Kitchen Showcase', cta: 'See if my kitchen qualifies →' },
      layout: {
        title: 'Which best describes your kitchen?',
        options: {
          'l-shape': { label: 'L-shaped' },
          'u-shape': { label: 'U-shaped' },
          'galley': { label: 'Galley' },
          'island': { label: 'Has an island' },
          'open': { label: 'Open-concept' },
          'not-sure': { label: 'Not sure' },
        },
      },
      ownership: {
        title: 'Do you own or rent your home?',
        subtitle: 'Showcase projects are available to homeowners.',
        options: {
          own: { label: 'I own my home' },
          rent: { label: 'I rent' },
        },
      },
    },
  },
}
