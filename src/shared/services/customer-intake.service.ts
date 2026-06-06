import type { DalReturn, ScopedContext } from '@/shared/dal/server/types'
import type { Customer } from '@/shared/db/schema/customers'
import type { LeadMeta } from '@/shared/entities/customers/schemas'
import type { IntakeCore } from '@/shared/services/providers/gohighlevel/lib/normalize-bina-lead'

import { dalError, dalSuccess } from '@/shared/dal/server/types'
import { customerCrud } from '@/shared/entities/customers/dal/server/crud'
import { addCustomerNote } from '@/shared/entities/customers/dal/server/mutations'
import { getLeadSourceBySlug } from '@/shared/entities/lead-sources/dal/server/queries'
import { meetingCrud } from '@/shared/entities/meetings/dal/server/crud'

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
  }
}

export const customerIntakeService = createCustomerIntakeService()
