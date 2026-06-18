import type { PiiFormData } from '@/shared/domains/funnels/schemas/pii.schema'
import type { FunnelAnswers, FunnelContext, LocationAnswer } from '@/shared/domains/funnels/types'

// trade slug → canonical Notion trade name (CT/SMS uniformity)
const TRADE_NAME: Record<string, string> = {
  'kitchens': 'Kitchen Renovation',
  'bathrooms': 'Bathroom Renovation',
  'complete-interior': 'Complete Interior Remodel',
}

function locationAnswer(answers: FunnelAnswers): Partial<LocationAnswer> {
  const a = answers.location
  return a && typeof a === 'object' && !Array.isArray(a) ? (a as LocationAnswer) : {}
}

export function buildLeadInput(args: { ctx: FunnelContext, pii: PiiFormData, answers: FunnelAnswers }) {
  const { ctx, pii, answers } = args
  const loc = locationAnswer(answers)
  const campaign = ctx.utm.campaign ?? ctx.utm.source ?? `funnel:${ctx.slug}`

  return {
    name: pii.name,
    phone: pii.phone,
    email: pii.email,
    city: pii.city,
    state: loc.state ?? 'CA',
    zip: loc.zip ?? '',
    mode: 'customer_only' as const,
    leadSourceSlug: 'branded-meta-ads',
    leadMetaJSON: {
      interestedTradesRaw: [TRADE_NAME[ctx.slug] ?? ctx.slug],
      originCampaign: campaign,
      source: {
        kind: 'funnel' as const,
        offer: ctx.offer,
        funnelSlug: ctx.slug,
        utm: ctx.utm,
      },
    },
  }
}
