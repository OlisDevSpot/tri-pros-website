import type { LeadStepTimelineEntry } from '@/shared/db/schema'
import type { FunnelUtm } from '@/shared/domains/funnels/types'
import { appendDraftStep, createDraftLead } from '@/shared/entities/leads/dal/server/mutations'

export interface CaptureDraftStepInput {
  draftId: string | null
  funnelSlug: string
  trade: string | null
  answers: Record<string, unknown>
  entry: LeadStepTimelineEntry
  utm: FunnelUtm | null
  fbp: string | null
  clientIp: string | null
  clientUserAgent: string | null
}

/**
 * Draft-lead capture orchestration (append-or-create). Keeps the tRPC router
 * thin and DAL-free per the layering convention (ADR-0003). The DAL owns blob
 * versioning; this service owns the "append to existing draft, else mint a
 * fresh one" branch.
 */
function createLeadsService() {
  return {
    async captureDraftStep(input: CaptureDraftStepInput): Promise<{ draftId: string }> {
      if (input.draftId) {
        const found = await appendDraftStep(input.draftId, { answers: input.answers, entry: input.entry })
        if (found) {
          return { draftId: input.draftId }
        }
        // Draft pruned or bogus id — fall through and mint a fresh one.
      }
      const { id } = await createDraftLead({
        funnelSlug: input.funnelSlug,
        trade: input.trade,
        answers: input.answers,
        firstEntry: input.entry,
        fbclid: input.utm?.fbclid ?? null,
        fbp: input.fbp,
        utm: input.utm,
        clientIp: input.clientIp,
        clientUserAgent: input.clientUserAgent,
      })
      return { draftId: id }
    },
  }
}

export type LeadsService = ReturnType<typeof createLeadsService>
export const leadsService = createLeadsService()
