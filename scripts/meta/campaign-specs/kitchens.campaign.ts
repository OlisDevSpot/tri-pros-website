import { SERVICE_AREA_ZIPS } from '@/shared/constants/company/service-area-zips'
import { defineCampaign } from './lib/define-campaign.js'

export const kitchensCampaign = defineCampaign({
  key: 'kitchens-leads',
  name: 'TPR — Kitchens — Leads',
  objective: 'OUTCOME_LEADS',
  funnelSlug: 'kitchens',
  landingBaseUrl: 'https://kitchens.triprosremodeling.com/',
  adSet: {
    key: 'service-area-35-70',
    name: 'Service-Area ZIPs · 35–70',
    dailyBudgetCents: 5_800, // $58/day ≈ $1,750/mo
    ageMin: 35,
    ageMax: 70,
    optimizationEvent: 'LEAD', // graduate to 'SCHEDULE' once the CAPI event flows with volume
    geoZips: [...SERVICE_AREA_ZIPS],
  },
  ads: [
    {
      key: 'dream-kitchen-01',
      headline: 'Your Dream Kitchen, Built by Local Pros',
      primaryText:
        'Southern California homeowners: see what your kitchen could become. '
        + 'Tri Pros Remodeling designs and builds kitchens around how your family actually lives — '
        + 'licensed, insured, and local. Answer a few quick questions to book your free in-home design consultation.',
      imageFile: 'dream-kitchen-01.jpg',
      ctaType: 'LEARN_MORE',
    },
    {
      key: 'before-after-01',
      headline: 'Real SoCal Kitchens, Remodeled by Tri Pros',
      primaryText:
        'This is what happens when a licensed local team handles everything — design, permits, build. '
        + 'Your kitchen could be next. Tell us about your project and book a free in-home consultation.',
      imageFile: 'before-after-01.jpg',
      ctaType: 'GET_QUOTE',
    },
  ],
})
