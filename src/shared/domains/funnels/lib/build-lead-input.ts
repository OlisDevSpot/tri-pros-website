import type { PiiFormData } from '@/shared/domains/funnels/schemas/pii.schema'
import type { FunnelAnswers, FunnelContext, ZipAnswer } from '@/shared/domains/funnels/types'
import { getTradeFacts } from '@/shared/domains/funnels/constants/trade-facts'
import { buildLeadEnrichment } from '@/shared/domains/funnels/lib/build-lead-enrichment'
import { getFunnel } from '@/shared/domains/funnels/lib/registry'
import { readFbCookies } from '@/shared/domains/funnels/lib/tracking/fire-pixel'

function zipAnswer(answers: FunnelAnswers): Partial<ZipAnswer> {
  const a = answers.zip
  return a && typeof a === 'object' && !Array.isArray(a) ? (a as ZipAnswer) : {}
}

export function buildLeadInput(args: { ctx: FunnelContext, pii: PiiFormData, answers: FunnelAnswers }) {
  const { ctx, pii, answers } = args
  const zipData = zipAnswer(answers)
  const campaign = ctx.utm.campaign ?? ctx.utm.source ?? `funnel:${ctx.slug}`
  const { fbp, fbc } = readFbCookies()
  const enrichment = buildLeadEnrichment(getFunnel(ctx.slug), answers)

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
      interestedTradesRaw: [getTradeFacts(ctx.slug).name],
      originCampaign: campaign,
      source: {
        kind: 'funnel' as const,
        offer: ctx.offer,
        funnelSlug: ctx.slug,
        utm: ctx.utm,
        meta: { fbp, fbc },
        enrichment,
        // Submission = agreement (no checkbox). Captured at submit time, client-side.
        consent: { agreed: true as const, at: new Date().toISOString() },
      },
    },
  }
}
