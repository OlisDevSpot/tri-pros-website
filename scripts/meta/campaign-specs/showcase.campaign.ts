import { SERVICE_AREA_ZIPS } from '@/shared/constants/company/service-area-zips'
import { defineCampaign } from './lib/define-campaign.js'

// Ad copy implements the Showcase offer — vocabulary, framing, and CTA rules
// are canonical in docs/marketing/showcase-offer.md. Read it before editing.
// Structure doctrine (campaign = offer, ad set = product, 5 distinct concepts
// per ad set): scripts/meta/DOCS.md#campaign-as-offer.
export const showcaseCampaign = defineCampaign({
  key: 'showcase',
  name: 'TPR — Showcase — Leads',
  objective: 'OUTCOME_LEADS',
  // CBO (Advantage Campaign Budget) — the offer's total daily spend, distributed
  // by Meta across the ad sets below. Throttled to $75 during the kitchens
  // creative rebuild (2026-08-09); staged ramp toward the $166 ceiling follows
  // as new creative proves out. See the optimization-round-1 epic.
  dailyBudgetCents: 7_500, // $75/day
  adSets: [
    {
      key: 'kitchens',
      name: 'Kitchens · Service-Area ZIPs · 35+',
      funnelSlug: 'kitchens',
      landingBaseUrl: 'https://kitchens.triprosremodeling.com/',
      ageMin: 35,
      ageMax: 65, // Meta max — 65 means "65+"
      optimizationEvent: 'LEAD',
      geoZips: [...SERVICE_AREA_ZIPS],
      ads: [
        {
          key: 'kitchens-casting-reel-01',
          format: 'video',
          videoFile: 'reel-07.mp4',
          thumbnailFile: 'reel-07-thumb.jpg',
          headlines: [
            'We’re Remodeling 5 Kitchens — No Commission',
            '5 Kitchen Showcase Spots — See If You Qualify',
            'Is Your Kitchen One of the 5?',
          ],
          primaryTexts: [
            '🏠 This round, we’re remodeling 5 kitchens in your area — and skipping the commission.\n\n'
            + 'If your home qualifies, you get:\n'
            + '✅ A full kitchen remodel, built to last\n'
            + '✅ No-commission Showcase pricing\n'
            + '✅ Your before-and-after featured in our portfolio\n\n'
            + 'Homeowners only. See if your home qualifies.',
            'Not every kitchen makes the cut — but yours might. '
            + 'Tri Pros Remodeling is choosing 5 kitchens in your area for a full remodel at no-commission Showcase pricing. '
            + 'The trade is simple: you get a kitchen you’ll actually love, and we film the before-and-after for our portfolio. '
            + 'Homeowners only. See if your home qualifies.',
            'Could your kitchen be one of the 5? 👀\n\n'
            + 'We’re choosing 5 homes in your area for a full kitchen remodel — no commission, Showcase pricing — '
            + 'and featuring the before-and-after in our portfolio.\n\n'
            + 'Homeowners only. See if your home qualifies.',
          ],
          descriptions: ['See if your home qualifies.'],
          ctaType: 'APPLY_NOW',
        },
        {
          key: 'kitchens-story-reel-01',
          format: 'video',
          videoFile: 'reel-08.mp4',
          thumbnailFile: 'reel-08-thumb.jpg',
          headlines: [
            'Only 5 Kitchens This Round — No Commission',
            'A Full Kitchen Remodel, No Commission',
          ],
          primaryTexts: [
            'Here’s a rare one for homeowners. 👀\n\n'
            + 'We’re choosing 5 kitchens in your area for a full remodel at no-commission Showcase pricing:\n'
            + '✅ A kitchen you’ll actually love\n'
            + '✅ No commission — we skip it\n'
            + '✅ Before-and-after featured in our portfolio\n\n'
            + 'Only 5 spots. Homeowners only. See if your home qualifies.',
            'Watch how a Showcase kitchen comes together. '
            + 'Every home we select gets a full remodel at no-commission Showcase pricing — '
            + 'because the before-and-after is featured in our portfolio. '
            + 'Only 5 kitchens in your area this round. See if yours qualifies.',
            'Think your kitchen could carry a Showcase? 👀\n\n'
            + '5 kitchens in your area — full remodel, no commission, featured in our portfolio.\n\n'
            + 'Homeowners only. See if your home qualifies.',
          ],
          descriptions: ['No-commission Showcase pricing.'],
          ctaType: 'APPLY_NOW',
        },
        {
          key: 'kitchens-before-after-01',
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
          imageFile: 'before-after-card-01.jpg',
          ctaType: 'APPLY_NOW',
        },
        {
          key: 'kitchens-portfolio-carousel-01',
          format: 'carousel',
          primaryTexts: [
            'Real Tri Pros kitchens. Real homes in your area. 👀\n\n'
            + 'We’re selecting 5 kitchens for our next Showcase round — AAA-grade remodels at a '
            + 'Showcase price, featured in our portfolio.\n\n'
            + 'Homeowners only. Swipe through, then see if your home qualifies.',
          ],
          ctaType: 'APPLY_NOW',
          cards: [
            { imageFile: 'carousel-01.jpg', headline: 'Every Showcase kitchen is held to this standard' },
            { imageFile: 'carousel-02.jpg', headline: 'AAA-grade materials, everyday function' },
            { imageFile: 'carousel-03.jpg', headline: 'Built to be photographed' },
            { imageFile: 'carousel-04.jpg', headline: 'See if your home qualifies', description: '5 kitchens. Your area.' },
          ],
        },
        {
          key: 'kitchens-hero-01',
          headlines: [
            'Would Your Home Make the Cut?',
            'We’re Selecting 5 Kitchens in Your Area',
          ],
          primaryTexts: [
            'Would your home make the cut? 👀\n\n'
            + 'We’re selecting 5 kitchens in your area to remodel at a Showcase price and feature '
            + 'in our portfolio.\n\nHomeowners only. See if your home qualifies.',
            'Some kitchens are built to be photographed. Yours could be one of them.\n\n'
            + 'Tri Pros Remodeling is selecting 5 kitchens in your area for AAA-grade, '
            + 'Showcase-priced remodels. See if your home qualifies.',
            'The Showcase list is open:\n'
            + '✅ 5 kitchens in your area\n'
            + '✅ AAA-grade remodel at a Showcase price\n'
            + '✅ Featured in our portfolio\n\n'
            + 'Homeowners only. See if your home qualifies.',
          ],
          descriptions: ['See if your home qualifies.'],
          imageFile: 'hero-card-01.jpg',
          ctaType: 'LEARN_MORE',
        },
      ],
    },
  ],
})
