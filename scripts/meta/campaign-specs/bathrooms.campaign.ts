import { SERVICE_AREA_ZIPS } from '@/shared/constants/company/service-area-zips'
import { defineCampaign } from './lib/define-campaign.js'

export const bathroomsCampaign = defineCampaign({
  key: 'bathrooms-leads',
  name: 'TPR — Bathrooms — Leads',
  objective: 'OUTCOME_LEADS',
  funnelSlug: 'bathrooms',
  landingBaseUrl: 'https://bathrooms.triprosremodeling.com/',
  adSet: {
    key: 'service-area-35-70',
    name: 'Service-Area ZIPs · 35–70',
    dailyBudgetCents: 5_800, // $58/day ≈ $1,750/mo
    ageMin: 35,
    ageMax: 70,
    optimizationEvent: 'LEAD',
    geoZips: [...SERVICE_AREA_ZIPS],
  },
  ads: [
    {
      key: 'spa-bathroom-01',
      headline: 'Turn Your Bathroom Into a Retreat',
      primaryText:
        'Outdated tub? Cramped layout? Southern California homeowners trust Tri Pros Remodeling to '
        + 'rebuild bathrooms that feel like a daily upgrade — licensed, insured, and local. '
        + 'Answer a few quick questions to book your free in-home design consultation.',
      imageFile: 'spa-bathroom-01.jpg',
      ctaType: 'LEARN_MORE',
    },
    {
      key: 'before-after-01',
      headline: 'Real SoCal Bathrooms, Remodeled by Tri Pros',
      primaryText:
        'From tired to stunning — design, permits, and build handled by one licensed local team. '
        + 'Your bathroom could be next. Tell us about your project and book a free in-home consultation.',
      imageFile: 'before-after-01.jpg',
      ctaType: 'GET_QUOTE',
    },
  ],
})
