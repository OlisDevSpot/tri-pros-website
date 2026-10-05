import type { DalReturn, ScopedContext } from '@/shared/dal/server/types'
import type { Customer } from '@/shared/db/schema/customers'
import type { EnrichmentRecord, LeadMeta } from '@/shared/entities/customers/schemas'
import type { IntakeCore } from '@/shared/services/providers/gohighlevel/lib/normalize-bina-lead'

import { dalError, dalSuccess } from '@/shared/dal/server/types'
import { buildFunnelLeadNote } from '@/shared/domains/funnels/lib/build-funnel-lead-note'
import { customerNoteCrud } from '@/shared/entities/customer-notes/dal/server/crud'
import { customerCrud } from '@/shared/entities/customers/dal/server/crud'
import { upsertFunnelEnrichment, upsertLeadAttribution } from '@/shared/entities/customers/dal/server/mutations'
import { getCustomerAttribution } from '@/shared/entities/customers/dal/server/queries'
import { getLeadSourceBySlug } from '@/shared/entities/lead-sources/dal/server/queries'
import { meetingCrud } from '@/shared/entities/meetings/dal/server/crud'
import { enrollLeadJob } from '@/shared/services/providers/upstash/jobs/enroll-lead'

interface IngestLeadInput {
  core: IntakeCore
  leadMeta?: LeadMeta
  note?: string | null
  meeting?: { ownerId: string } | null
  // Renter-gate + delayed-CAPI match keys captured at submit time.
  attributionExtra?: {
    ownership?: string | null
    contentCategory?: string | null
    clientIp?: string | null
    clientUserAgent?: string | null
  }
}

interface EnrichFunnelLeadInput {
  leadId: string
  enrichment: EnrichmentRecord
}

interface SetFunnelLeadAddressInput {
  leadId: string
  address: string
  city: string
  state: string
  zip: string
}

function createCustomerIntakeService() {
  return {
    async ingestLead(
      ctx: ScopedContext,
      input: IngestLeadInput,
    ): Promise<DalReturn<{ customer: Customer, meetingId: string | null }>> {
      const sourceResult = await getLeadSourceBySlug(input.core.leadSourceSlug)
      if (!sourceResult.success) {
        return sourceResult
      }
      if (!sourceResult.data) {
        return dalError({ type: 'not-found' })
      }
      const leadSourceId = sourceResult.data.id

      const created = await customerCrud.create(ctx, {
        name: input.core.name,
        phone: input.core.phone,
        email: input.core.email ?? null,
        address: input.core.address ?? null,
        city: input.core.city,
        state: input.core.state ?? 'CA',
        zip: input.core.zip || '',
        leadSourceId,
      })
      if (!created.success) {
        return created
      }
      const customer = created.data

      // Strict — ads reporting depends on it. The customer is already committed, so a failed write is surfaced for the caller to retry.
      if (input.leadMeta) {
        const attr = await upsertLeadAttribution({ customerId: customer.id, leadMeta: input.leadMeta, extra: input.attributionExtra })
        if (!attr.success) {
          return dalError({ type: 'precondition-failed', reason: 'attribution_write_failed' })
        }
      }

      // Best-effort: a dropped enqueue only means no auto-dial (admin can still "Enroll all") — never breaks ingest.
      const source = sourceResult.data
      if (source.voipCampaignsEnabled && source.voipAutoEnroll && source.defaultCampaignId) {
        void enrollLeadJob.dispatch({ customerId: customer.id })
      }

      if (input.note) {
        const noteResult = await customerNoteCrud.create(ctx, {
          customerId: customer.id,
          content: input.note,
        })
        if (!noteResult.success) {
          console.error('[customerIntake] note insert failed (customer kept)', noteResult.error)
        }
      }

      // Written once here so progressive enrichFunnelLead calls never duplicate it.
      const funnelNote = buildFunnelLeadNote(input.leadMeta)
      if (funnelNote) {
        const noteResult = await customerNoteCrud.create(ctx, {
          customerId: customer.id,
          content: funnelNote,
        })
        if (!noteResult.success) {
          console.error('[customerIntake] funnel intake note failed (lead kept)', noteResult.error)
        }
      }

      let meetingId: string | null = null
      if (input.meeting) {
        const scheduledFor = input.leadMeta?.scheduledFor
        if (!scheduledFor) {
          return dalError({ type: 'precondition-failed', reason: 'missing_scheduled_for' })
        }
        const meetingResult = await meetingCrud.create(ctx, {
          ownerId: input.meeting.ownerId,
          customerId: customer.id,
          meetingType: 'Fresh',
          scheduledFor,
        })
        if (!meetingResult.success) {
          // Customer + note already committed; surface so the caller can message.
          return dalError({ type: 'precondition-failed', reason: 'meeting_create_failed' })
        }
        meetingId = meetingResult.data.id
      }

      return dalSuccess({ customer, meetingId })
    },

    // The leadId is the capability (no session on the funnel); the funnel-kind check lives in the DAL upsert.
    async enrichFunnelLead(
      _ctx: ScopedContext,
      input: EnrichFunnelLeadInput,
    ): Promise<DalReturn<{ ok: true }>> {
      const merged = await upsertFunnelEnrichment(input)
      if (!merged.success) {
        return merged
      }
      if (!merged.data.matched) {
        return dalError({ type: 'precondition-failed', reason: 'not_a_funnel_lead' })
      }
      return dalSuccess({ ok: true })
    },

    // Same capability model as enrichFunnelLead; the partial update intentionally fires the geocode-invalidation hook.
    async setFunnelLeadAddress(
      ctx: ScopedContext,
      input: SetFunnelLeadAddressInput,
    ): Promise<DalReturn<{ ok: true }>> {
      const attr = await getCustomerAttribution(input.leadId)
      if (!attr.success) {
        return attr
      }
      if (attr.data?.kind !== 'funnel') {
        return dalError({ type: 'precondition-failed', reason: 'not_a_funnel_lead' })
      }
      const updated = await customerCrud.update(ctx, {
        id: input.leadId,
        data: {
          address: input.address,
          city: input.city,
          state: input.state,
          zip: input.zip,
        },
      })
      if (!updated.success) {
        return updated
      }
      return dalSuccess({ ok: true })
    },
  }
}

export const customerIntakeService = createCustomerIntakeService()
