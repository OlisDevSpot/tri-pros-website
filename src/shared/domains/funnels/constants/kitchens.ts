import type { FunnelSpec } from '@/shared/domains/funnels/types'

export const kitchensFunnel: FunnelSpec = {
  slug: 'kitchens',
  offer: 'showcase',
  title: 'Kitchen Showcase',
  theme: { accent: 'primary' },
  pixel: { contentCategory: 'kitchen' },
  // Linear funnel: no `flow` — the engine advances through `steps` in order.
  steps: [
    {
      id: 'hero',
      kind: 'info',
      content: {
        headline: 'Get a AAA-grade kitchen remodel — at a Showcase price.',
        subhead: 'See if your home qualifies for one of our Showcase kitchens.',
        scarcityLine: 'We\'re selecting 5 kitchens in your area.',
        cta: 'See if my kitchen qualifies →',
      },
    },
    {
      id: 'layout',
      kind: 'card-select',
      optionIds: ['l-shape', 'u-shape', 'galley', 'island', 'open', 'not-sure'],
      content: {
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
    },
    {
      id: 'ownership',
      kind: 'card-select',
      optionIds: ['own', 'rent'],
      content: {
        title: 'Do you own or rent your home?',
        subtitle: 'Showcase projects are available to homeowners.',
        options: {
          own: { label: 'I own my home' },
          rent: { label: 'I rent' },
        },
      },
    },
  ],
}
