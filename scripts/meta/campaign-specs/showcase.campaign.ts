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
  adSets: [
    {
      key: 'kitchens',
      name: 'Kitchens · Service-Area ZIPs · 35+',
      funnelSlug: 'kitchens',
      landingBaseUrl: 'https://kitchens.triprosremodeling.com/',
      dailyBudgetCents: 5_800, // $58/day ≈ $1,750/mo
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
            'We\'re Selecting 5 Kitchens in Your Area',
            '5 Kitchen Showcase Spots — See If You Qualify',
            'Is Your Kitchen One of the 5?',
          ],
          primaryTexts: [
            '🏠 We\'re selecting 5 kitchens in your area to feature in our showcase.\n\n'
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
          ctaType: 'APPLY_NOW',
        },
        {
          key: 'kitchens-story-reel-01',
          format: 'video',
          videoFile: 'reel-08.mp4',
          thumbnailFile: 'reel-08-thumb.jpg',
          headlines: [
            'What Every Showcase Kitchen Includes',
            'Showcase-Grade Work, Guaranteed',
          ],
          primaryTexts: [
            'What every Showcase kitchen gets:\n'
            + '✅ AAA-grade materials\n'
            + '✅ Beautiful AND functional\n'
            + '✅ Built to be photographed\n\n'
            + 'We\'re selecting 5 kitchens in your area for our showcase. '
            + 'Homeowners only. See if your home qualifies.',
            'Watch what a Showcase kitchen looks like from start to finish. '
            + 'Every home we select gets our best-of-the-best work at a Showcase price — '
            + 'because the result is featured in our showcase. '
            + '5 kitchens in your area. See if yours qualifies.',
            'Think your kitchen could carry a showcase? 👀\n\n'
            + 'We\'re selecting 5 kitchens in your area — AAA-grade remodels at a Showcase price, '
            + 'featured in our portfolio.\n\nHomeowners only. See if your home qualifies.',
          ],
          descriptions: ['Showcase-grade work, guaranteed.'],
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
            + 'We\'re selecting 5 kitchens in your area this month for a Showcase-priced remodel, '
            + 'featured in our portfolio. See if your home qualifies.',
            'From dated to designed-to-be-photographed. 📸\n\n'
            + 'Every kitchen we select for the Showcase gets our best-of-the-best work — at a Showcase price. '
            + '5 spots in your area this month.\n\n'
            + 'See if your home qualifies.',
            'This is the standard every Showcase kitchen is held to — AAA-grade, built to be photographed. '
            + 'We\'re selecting 5 kitchens in your area this month for a Showcase-priced remodel, '
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
            + 'We\'re selecting 5 kitchens for our next Showcase round — AAA-grade remodels at a '
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
            'We\'re Selecting 5 Kitchens in Your Area',
          ],
          primaryTexts: [
            'Would your home make the cut? 👀\n\n'
            + 'We\'re selecting 5 kitchens in your area to remodel at a Showcase price and feature '
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
    {
      key: 'bathrooms',
      name: 'Bathrooms · Service-Area ZIPs · 35+',
      funnelSlug: 'bathrooms',
      landingBaseUrl: 'https://bathrooms.triprosremodeling.com/',
      dailyBudgetCents: 5_800, // $58/day ≈ $1,750/mo
      ageMin: 35,
      ageMax: 65, // Meta max — 65 means "65+"
      optimizationEvent: 'LEAD',
      geoZips: [...SERVICE_AREA_ZIPS],
      ads: [
        {
          key: 'bathrooms-casting-reel-01',
          format: 'video',
          videoFile: 'reel-11.mp4',
          thumbnailFile: 'reel-11-thumb.jpg',
          headlines: [
            'We\'re Selecting 5 Bathrooms in Your Area',
            '5 Bathroom Showcase Spots — See If You Qualify',
            'Is Your Bathroom One of the 5?',
          ],
          primaryTexts: [
            '🛁 We\'re selecting 5 bathrooms in your area for our next Showcase.\n\n'
            + 'If your home qualifies, you get:\n'
            + '✅ A AAA-grade bathroom remodel\n'
            + '✅ At a Showcase price\n'
            + '✅ Featured in our portfolio\n\n'
            + 'Homeowners only. See if you qualify.',
            'A bathroom you\'ll actually love — at a Showcase price. '
            + 'Tri Pros Remodeling is selecting 5 bathrooms in your area to be featured in our showcase. '
            + 'If selected, you get our best-of-the-best work at a Showcase price. '
            + 'Homeowners only. See if your home qualifies.',
            'Could your bathroom be one of the 5? 👀\n\n'
            + 'We\'re choosing 5 homes in your area to feature in our bathroom showcase — '
            + 'best-of-the-best work, built to photograph beautifully, at a Showcase price.\n\n'
            + 'Homeowners only. See if your home qualifies.',
          ],
          descriptions: ['See if your home qualifies.'],
          ctaType: 'APPLY_NOW',
        },
        {
          key: 'bathrooms-story-reel-01',
          format: 'video',
          videoFile: 'reel-12.mp4',
          thumbnailFile: 'reel-12-thumb.jpg',
          headlines: [
            'What Every Showcase Bathroom Includes',
            'Showcase-Grade Work, Guaranteed',
          ],
          primaryTexts: [
            'What every Showcase bathroom gets:\n'
            + '✅ AAA-grade materials\n'
            + '✅ Spa feel, everyday function\n'
            + '✅ Built to be photographed\n\n'
            + 'We\'re selecting 5 bathrooms in your area for our showcase. '
            + 'Homeowners only. See if your home qualifies.',
            'Watch what a Showcase bathroom looks like from start to finish. '
            + 'Every home we select gets our best-of-the-best work at a Showcase price — '
            + 'because the result is featured in our showcase. '
            + '5 bathrooms in your area. See if yours qualifies.',
            'Think your bathroom could carry a showcase? 👀\n\n'
            + 'We\'re selecting 5 bathrooms in your area — AAA-grade remodels at a Showcase price, '
            + 'featured in our portfolio.\n\nHomeowners only. See if your home qualifies.',
          ],
          descriptions: ['Showcase-grade work, guaranteed.'],
          ctaType: 'APPLY_NOW',
        },
        {
          key: 'bathrooms-before-after-01',
          headlines: [
            'Your Bathroom Could Be Next — 5 Spots',
            'This Is Showcase-Grade. Yours Could Be Too.',
          ],
          primaryTexts: [
            'This is the standard every Showcase bathroom is held to:\n'
            + '✅ AAA-grade materials\n'
            + '✅ Spa feel, everyday function\n'
            + '✅ Built to be photographed\n\n'
            + 'We\'re selecting 5 bathrooms in your area this month for a Showcase-priced remodel, '
            + 'featured in our portfolio. See if your home qualifies.',
            'From dated to Showcase-grade. 📸\n\n'
            + 'Every bathroom we select gets AAA-quality work — because it has to photograph beautifully. '
            + '5 spots in your area this month.\n\n'
            + 'See if your home qualifies.',
            'From dated to Showcase-grade. Every bathroom we select gets AAA-quality work — '
            + 'because it has to photograph beautifully. '
            + 'We\'re selecting 5 bathrooms in your area this month. See if your home qualifies.',
          ],
          descriptions: ['AAA-grade, at a Showcase price.'],
          imageFile: 'before-after-card-01.jpg',
          ctaType: 'APPLY_NOW',
        },
        {
          key: 'bathrooms-portfolio-carousel-01',
          format: 'carousel',
          primaryTexts: [
            'Real Tri Pros bathrooms. Real homes in your area. 👀\n\n'
            + 'We\'re selecting 5 bathrooms for our next Showcase round — AAA-grade remodels at a '
            + 'Showcase price, featured in our portfolio.\n\n'
            + 'Homeowners only. Swipe through, then see if your home qualifies.',
          ],
          ctaType: 'APPLY_NOW',
          cards: [
            { imageFile: 'carousel-01.jpg', headline: 'Every Showcase bathroom is held to this standard' },
            { imageFile: 'carousel-02.jpg', headline: 'AAA-grade materials, spa-level feel' },
            { imageFile: 'carousel-03.jpg', headline: 'Built to be photographed' },
            { imageFile: 'carousel-04.jpg', headline: 'See if your home qualifies', description: '5 bathrooms. Your area.' },
          ],
        },
        {
          key: 'bathrooms-hero-01',
          headlines: [
            'Would Your Home Make the Cut?',
            'We\'re Selecting 5 Bathrooms in Your Area',
          ],
          primaryTexts: [
            'Would your home make the cut? 👀\n\n'
            + 'We\'re selecting 5 bathrooms in your area to remodel at a Showcase price and feature '
            + 'in our portfolio.\n\nHomeowners only. See if your home qualifies.',
            'Some bathrooms are built to be photographed. Yours could be one of them.\n\n'
            + 'Tri Pros Remodeling is selecting 5 bathrooms in your area for AAA-grade, '
            + 'Showcase-priced remodels. See if your home qualifies.',
            'The Showcase list is open:\n'
            + '✅ 5 bathrooms in your area\n'
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
