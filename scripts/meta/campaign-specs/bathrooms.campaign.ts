import { SERVICE_AREA_ZIPS } from '@/shared/constants/company/service-area-zips'
import { defineCampaign } from './lib/define-campaign.js'

// Ad copy implements the Showcase offer — vocabulary, framing, and CTA rules
// are canonical in docs/marketing/showcase-offer.md. Read it before editing.
// Multiple primaryTexts per ad = Meta text options (reduces creative fatigue).
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
      headlines: [
        'We’re Selecting 5 Bathrooms in Your Area',
        '5 Bathroom Showcase Spots — See If You Qualify',
      ],
      primaryTexts: [
        '🛁 We’re selecting 5 bathrooms in your area for our next Showcase.\n\n'
        + 'If your home qualifies, you get:\n'
        + '✅ A AAA-grade bathroom remodel\n'
        + '✅ At a Showcase price\n'
        + '✅ Featured in our portfolio\n\n'
        + 'Homeowners only. See if you qualify.',
        'A bathroom you’ll actually love — at a Showcase price. '
        + 'Tri Pros Remodeling is selecting 5 bathrooms in your area to be featured in our showcase. '
        + 'If selected, you get our best-of-the-best work at a Showcase price. '
        + 'Homeowners only. See if your home qualifies.',
        'Could your bathroom be one of the 5? 👀\n\n'
        + 'We’re choosing 5 homes in your area to feature in our bathroom showcase — '
        + 'best-of-the-best work, built to photograph beautifully, at a Showcase price.\n\n'
        + 'Homeowners only. See if your home qualifies.',
      ],
      descriptions: ['See if your home qualifies.'],
      imageFile: 'spa-bathroom-01.jpg',
      ctaType: 'APPLY_NOW',
    },
    {
      key: 'showcase-proof-01',
      headlines: [
        'Your Bathroom Could Be Next — 5 Spots',
        'This Is Showcase-Grade. Yours Could Be Too.',
      ],
      primaryTexts: [
        'This is the standard every Showcase bathroom is held to:\n'
        + '✅ AAA-grade materials\n'
        + '✅ Spa feel, everyday function\n'
        + '✅ Built to be photographed\n\n'
        + 'We’re selecting 5 bathrooms in your area this month for a Showcase-priced remodel, '
        + 'featured in our portfolio. See if your home qualifies.',
        'From dated to Showcase-grade. 📸\n\n'
        + 'Every bathroom we select gets AAA-quality work — because it has to photograph beautifully. '
        + '5 spots in your area this month.\n\n'
        + 'See if your home qualifies.',
        'From dated to Showcase-grade. Every bathroom we select gets AAA-quality work — '
        + 'because it has to photograph beautifully. '
        + 'We’re selecting 5 bathrooms in your area this month. See if your home qualifies.',
      ],
      descriptions: ['AAA-grade, at a Showcase price.'],
      imageFile: 'before-after-01.jpg',
      ctaType: 'APPLY_NOW',
    },
  ],
})
