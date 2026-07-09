import { SERVICE_AREA_ZIPS } from '@/shared/constants/company/service-area-zips'
import { defineCampaign } from './lib/define-campaign.js'

// Ad copy implements the Showcase offer — vocabulary, framing, and CTA rules
// are canonical in docs/marketing/showcase-offer.md. Read it before editing.
// Multiple primaryTexts per ad = Meta text options (reduces creative fatigue).
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
      headlines: [
        'We’re Selecting 5 Kitchens in Your Area',
        '5 Kitchen Showcase Spots — See If You Qualify',
      ],
      primaryTexts: [
        '🏠 We’re selecting 5 kitchens in your area to feature in our showcase.\n\n'
        + 'If your home qualifies, you get:\n'
        + '✅ A AAA-grade kitchen remodel\n'
        + '✅ At a Showcase price\n'
        + '✅ Featured in our portfolio\n\n'
        + 'Homeowners only. See if your home qualifies.',
        'Get a AAA-grade kitchen remodel — at a Showcase price. '
        + 'Tri Pros Remodeling is selecting 5 kitchens in your area to be featured in our showcase. '
        + 'If selected, your kitchen gets our best-of-the-best work — quality that has to photograph beautifully. '
        + 'Homeowners only. See if your home qualifies.',
        'Could your kitchen be one of the 5? 👀\n\n'
        + 'Tri Pros Remodeling is choosing 5 homes in your area for AAA-grade kitchen remodels at a '
        + 'Showcase price — quality built to be photographed, featured in our showcase.\n\n'
        + 'Homeowners only. See if your home qualifies.',
      ],
      descriptions: ['See if your home qualifies.'],
      imageFile: 'dream-kitchen-01.jpg',
      ctaType: 'APPLY_NOW',
    },
    {
      key: 'showcase-proof-01',
      headlines: [
        'Your Kitchen Could Be Next — 5 Spots',
        'This Is Showcase-Grade. Yours Could Be Too.',
      ],
      primaryTexts: [
        'This is the standard every Showcase kitchen is held to:\n'
        + '✅ AAA-grade materials\n'
        + '✅ Beautiful AND functional\n'
        + '✅ Built to be photographed\n\n'
        + 'We’re selecting 5 kitchens in your area this month for a Showcase-priced remodel, '
        + 'featured in our portfolio. See if your home qualifies.',
        'From dated to designed-to-be-photographed. 📸\n\n'
        + 'Every kitchen we select for the Showcase gets our best-of-the-best work — at a Showcase price. '
        + '5 spots in your area this month.\n\n'
        + 'See if your home qualifies.',
        'This is the standard every Showcase kitchen is held to — AAA-grade, built to be photographed. '
        + 'We’re selecting 5 kitchens in your area this month for a Showcase-priced remodel, '
        + 'featured in our portfolio. See if your home qualifies.',
      ],
      descriptions: ['AAA-grade, at a Showcase price.'],
      imageFile: 'before-after-01.jpg',
      ctaType: 'APPLY_NOW',
    },
  ],
})
