import { SERVICE_AREA_ZIPS } from '@/shared/constants/company/service-area-zips'
import { defineCampaign } from './lib/define-campaign.js'

// Ad copy implements the Showcase offer — vocabulary, framing, and CTA rules
// are canonical in docs/marketing/showcase-offer.md. Read it before editing.
export const kitchensCampaign = defineCampaign({
  key: 'kitchens-leads',
  name: 'TPR — Kitchen Showcase — Leads',
  objective: 'OUTCOME_LEADS',
  funnelSlug: 'kitchens',
  landingBaseUrl: 'https://kitchens.triprosremodeling.com/',
  adSet: {
    key: 'service-area-35-70',
    name: 'Service-Area ZIPs · 35–65+',
    dailyBudgetCents: 5_800, // $58/day ≈ $1,750/mo
    ageMin: 35,
    ageMax: 65, // Meta max — 65 means "65+" (unbounded upper bucket)
    optimizationEvent: 'LEAD', // graduate to 'SCHEDULE' once the CAPI event flows with volume
    geoZips: [...SERVICE_AREA_ZIPS],
  },
  ads: [
    {
      key: 'showcase-casting-01',
      headline: 'We’re Selecting 5 Kitchens in Your Area',
      primaryText:
        'Get a AAA-grade kitchen remodel — at a Showcase price. '
        + 'Tri Pros Remodeling is selecting 5 kitchens in your area to be featured in our showcase. '
        + 'If selected, your kitchen gets our best-of-the-best work — quality that has to photograph beautifully. '
        + 'Homeowners only. See if your home qualifies.',
      description: 'See if your home qualifies.',
      imageFile: 'dream-kitchen-01.jpg',
      ctaType: 'APPLY_NOW',
    },
    {
      key: 'showcase-proof-01',
      headline: 'Your Kitchen Could Be Next — 5 Spots',
      primaryText:
        'This is the standard every Showcase kitchen is held to — AAA-grade, built to be photographed. '
        + 'We’re selecting 5 kitchens in your area this month for a Showcase-priced remodel, '
        + 'featured in our portfolio. See if your home qualifies.',
      description: 'AAA-grade, at a Showcase price.',
      imageFile: 'before-after-01.jpg',
      ctaType: 'APPLY_NOW',
    },
  ],
})
