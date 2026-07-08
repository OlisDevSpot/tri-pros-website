import { SERVICE_AREA_ZIPS } from '@/shared/constants/company/service-area-zips'
import { defineCampaign } from './lib/define-campaign.js'

// Ad copy implements the Showcase offer — vocabulary, framing, and CTA rules
// are canonical in docs/marketing/showcase-offer.md. Read it before editing.
export const bathroomsCampaign = defineCampaign({
  key: 'bathrooms-leads',
  name: 'TPR — Bathroom Showcase — Leads',
  objective: 'OUTCOME_LEADS',
  funnelSlug: 'bathrooms',
  landingBaseUrl: 'https://bathrooms.triprosremodeling.com/',
  adSet: {
    key: 'service-area-35-70',
    name: 'Service-Area ZIPs · 35–65+',
    dailyBudgetCents: 5_800, // $58/day ≈ $1,750/mo
    ageMin: 35,
    ageMax: 65, // Meta max — 65 means "65+" (unbounded upper bucket)
    optimizationEvent: 'LEAD',
    geoZips: [...SERVICE_AREA_ZIPS],
  },
  ads: [
    {
      key: 'showcase-casting-01',
      headline: 'We’re Selecting 5 Bathrooms in Your Area',
      primaryText:
        'A bathroom you’ll actually love — at a Showcase price. '
        + 'Tri Pros Remodeling is selecting 5 bathrooms in your area to be featured in our showcase. '
        + 'If selected, you get our best-of-the-best work at a Showcase price. '
        + 'Homeowners only. See if your home qualifies.',
      description: 'See if your home qualifies.',
      imageFile: 'spa-bathroom-01.jpg',
      ctaType: 'APPLY_NOW',
    },
    {
      key: 'showcase-proof-01',
      headline: 'Your Bathroom Could Be Next — 5 Spots',
      primaryText:
        'From dated to Showcase-grade. Every bathroom we select gets AAA-quality work — '
        + 'because it has to photograph beautifully. '
        + 'We’re selecting 5 bathrooms in your area this month. See if your home qualifies.',
      description: 'AAA-grade, at a Showcase price.',
      imageFile: 'before-after-01.jpg',
      ctaType: 'APPLY_NOW',
    },
  ],
})
