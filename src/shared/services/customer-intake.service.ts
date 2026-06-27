import type { DalReturn, ScopedContext } from '@/shared/dal/server/types'
import type { Customer } from '@/shared/db/schema/customers'
import type { EnrichmentRecord, LeadMeta } from '@/shared/entities/customers/schemas'
import type { IntakeCore } from '@/shared/services/providers/gohighlevel/lib/normalize-bina-lead'

import { dalError, dalSuccess } from '@/shared/dal/server/types'
import { buildFunnelLeadNote } from '@/shared/domains/funnels/lib/build-funnel-lead-note'
import { customerCrud } from '@/shared/entities/customers/dal/server/crud'
import { addCustomerNote, mergeFunnelEnrichment } from '@/shared/entities/customers/dal/server/mutations'
import { getLeadSourceBySlug } from '@/shared/entities/lead-sources/dal/server/queries'
import { meetingCrud } from '@/shared/entities/meetings/dal/server/crud'
import { enrollLeadJob } from '@/shared/services/providers/upstash/jobs/enroll-lead'

// ---------------------------------------------------------------------------
// customerIntakeService — channel-agnostic lead ingestion (DRY across the Bina
// webhook + the public intake form). PURE ORCHESTRATION: zero raw db.*, zero
// provider parsing. Composes customerCrud.create (canonical entity create) +
// addCustomerNote + meetingCrud.create.
//
// Standardizes both channels on customerCrud.create (the legacy
// createCustomerFromWebhook is retired — see queries.ts migration note).
//
// see docs/codebase-conventions/service-architecture.md
// ---------------------------------------------------------------------------

interface IngestLeadInput {
  core: IntakeCore
  leadMeta?: LeadMeta
  note?: string | null
  // When present, create a Meeting owned by `ownerId` using
  // leadMeta.scheduledFor. Caller resolves the owner (session / fallback).
  meeting?: { ownerId: string } | null
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
      // ── Resolve lead source slug → id ──────────────────────────────────────
      const sourceResult = await getLeadSourceBySlug(input.core.leadSourceSlug)
      if (!sourceResult.success) {
        return sourceResult
      }
      if (!sourceResult.data) {
        return dalError({ type: 'not-found' })
      }
      const leadSourceId = sourceResult.data.id

      // ── 1. Create customer (canonical DAL; fires create hooks if defined) ───
      const created = await customerCrud.create(ctx, {
        name: input.core.name,
        phone: input.core.phone,
        email: input.core.email ?? null,
        address: input.core.address ?? null,
        city: input.core.city,
        state: input.core.state ?? 'CA',
        zip: input.core.zip || '',
        leadSourceId,
        leadMetaJSON: input.leadMeta ?? null,
      })
      if (!created.success) {
        return created
      }
      const customer = created.data

      // ── Auto-enroll (best-effort, fire-and-forget) ─────────────────────────
      // Source-anchored policy gates here; enrollLeadJob is a dumb executor.
      // A dropped enqueue only means the lead isn't auto-dialed (admin can still
      // "Enroll all"), so best-effort `dispatch` — never breaks ingest.
      // see docs/superpowers/specs/2026-06-17-source-anchored-setup-auto-enroll-design.md
      const voipPolicy = sourceResult.data.voipConfigJSON?.campaigns
      if (voipPolicy?.enabled && voipPolicy.autoEnroll && voipPolicy.defaultCampaignId) {
        void enrollLeadJob.dispatch({ customerId: customer.id })
      }

      // ── 2. Optional note (best-effort — never rolls back the customer) ──────
      if (input.note) {
        const noteResult = await addCustomerNote({
          customerId: customer.id,
          content: input.note,
          authorId: null,
        })
        if (!noteResult.success) {
          console.error('[customerIntake] note insert failed (customer kept)', noteResult.error)
        }
      }

      // ── 2b. Single funnel-intake note at creation time (best-effort) ─────────
      // Fires once here so progressive enrichFunnelLead calls never duplicate it.
      const funnelNote = buildFunnelLeadNote(input.leadMeta)
      if (funnelNote) {
        const noteResult = await addCustomerNote({
          customerId: customer.id,
          content: funnelNote,
          authorId: null,
        })
        if (!noteResult.success) {
          console.error('[customerIntake] funnel intake note failed (lead kept)', noteResult.error)
        }
      }

      // ── 3. Optional meeting ────────────────────────────────────────────────
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

    // Guarded enrichment patch for an already-created funnel lead. The leadId is
    // the capability; the funnel-kind check + the atomic source.enrichment merge
    // both live in the DAL mutation (single jsonb_set statement — no race-prone
    // read-modify-write here). Best-effort from each progressive step; a zero-row
    // match means the lead isn't a funnel lead.
    // see ../entities/customers/dal/server/mutations.ts#mergeFunnelEnrichment
    async enrichFunnelLead(
      _ctx: ScopedContext,
      input: EnrichFunnelLeadInput,
    ): Promise<DalReturn<{ ok: true }>> {
      const merged = await mergeFunnelEnrichment(input)
      if (!merged.success) {
        return merged
      }
      if (!merged.data.matched) {
        return dalError({ type: 'precondition-failed', reason: 'not_a_funnel_lead' })
      }
      return dalSuccess({ ok: true })
    },

    // Guarded address patch for an already-created funnel lead. Same capability
    // model as enrichFunnelLead: the leadId is the capability and we refuse any
    // non-funnel customer. The partial update triggers the existing geocode-
    // invalidation hook (desired). Relies on the committed phone fix so a partial
    // update doesn't null the phone.
    async setFunnelLeadAddress(
      ctx: ScopedContext,
      input: SetFunnelLeadAddressInput,
    ): Promise<DalReturn<{ ok: true }>> {
      const existing = await customerCrud.getById(ctx, { id: input.leadId })
      if (!existing.success) {
        return existing
      }
      const customer = existing.data
      if (!customer || customer.leadMetaJSON?.source?.kind !== 'funnel') {
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
