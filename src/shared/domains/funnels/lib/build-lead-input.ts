import type { PiiFormData } from '@/shared/domains/funnels/schemas/pii.schema'
import type { FunnelAnswers, FunnelContext, ZipAnswer } from '@/shared/domains/funnels/types'

// trade slug → canonical Notion trade name (CT/SMS uniformity)
const TRADE_NAME: Record<string, string> = {
  'kitchens': 'Kitchen Renovation',
  'bathrooms': 'Bathroom Renovation',
  'complete-interior': 'Complete Interior Remodel',
}

function zipAnswer(answers: FunnelAnswers): Partial<ZipAnswer> {
  const a = answers.zip
  return a && typeof a === 'object' && !Array.isArray(a) ? (a as ZipAnswer) : {}
}

export function buildLeadInput(args: { ctx: FunnelContext, pii: PiiFormData, answers: FunnelAnswers }) {
  const { ctx, pii, answers } = args
  const zipData = zipAnswer(answers)
  const campaign = ctx.utm.campaign ?? ctx.utm.source ?? `funnel:${ctx.slug}`

  return {
    name: `${pii.firstName.trim()} ${pii.lastName.trim()}`.trim(),
    phone: pii.phone,
    // city is required by createFromIntake (min 1); the qualified ZIP gate
    // guarantees a resolved city, but never drop a real lead on the rare
    // unresolved case.
    city: zipData.city || 'Unknown',
    state: zipData.state ?? 'CA',
    zip: zipData.zip ?? '',
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
