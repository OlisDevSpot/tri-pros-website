import type { EntityServerSpec } from '@/shared/dal/server/types'

import { eq, inArray } from 'drizzle-orm'
import { z } from 'zod'

import { dalVerifySuccess } from '@/shared/dal/server/lib/helpers'
import { SYSTEM_CONTEXT } from '@/shared/dal/server/types'
import { db } from '@/shared/db'
import {
  customers,
  insertCustomerSchema,
  meetings,
  proposals,
  selectCustomerSchema,
} from '@/shared/db/schema'
import { CUSTOMER } from '@/shared/entities/customers/lib/constants'
import { customerVisibility } from '@/shared/entities/customers/lib/visibility'
import { meetingCrud } from '@/shared/entities/meetings/dal/server/crud'
import { propagateCustomerChangeJob } from '@/shared/services/providers/upstash/jobs/propagate-customer-change'

// Updates allow `createdAt` (super-admin-only via CASL field gate) — legacy
// Notion imports land with import-day timestamps and lead-source stats by
// range stay misleading until the super-admin corrects them. The base insert
// schema omits `createdAt`, so re-add it here for the update surface.
// see ../DOCS.md — created-date field gate is enforced by abilities.ts.
const updateCustomerSchema = insertCustomerSchema
  .partial()
  .extend({ createdAt: z.string().datetime().optional() })

export const customerSchemas = {
  insert: insertCustomerSchema,
  update: updateCustomerSchema,
}

export const customerServerSpec = {
  entityName: CUSTOMER,
  caslSubject: CUSTOMER,
  visibility: customerVisibility,
  table: customers,
  schemas: {
    insert: insertCustomerSchema,
    update: updateCustomerSchema,
    select: selectCustomerSchema,
  },
  // see ../DOCS.md#three-jsonb-profiles + ../DOCS.md#lead-attribution-fields —
  // agents fill these progressively; partial updates must deep-merge, not overwrite.
  // Wired by createCrudDal.updateImpl (since 7bc34a7).
  update: {
    jsonbMergeColumns: [
      customers.customerProfileJSON,
      customers.propertyProfileJSON,
      customers.financialProfileJSON,
      customers.leadMetaJSON,
    ] as const,
  },
  hooks: {
    update: {
      // see ../DOCS.md#geocoding-stored-on-customer — when any address
      // component changes, invalidate the cached lat/lng/geocodedAt so the
      // map surfaces re-geocode on next read. Guard: skip if the caller is
      // explicitly setting latitude or longitude in the same update (e.g.,
      // a geocode write-back path) — otherwise we'd stomp their own write.
      async before(data, _ctx) {
        const addressKeys = ['address', 'city', 'state', 'zip'] as const
        const addressChanged = addressKeys.some(
          k => k in data && (data as Record<string, unknown>)[k] !== undefined,
        )
        if (!addressChanged) {
          return data
        }
        const coordsBeingSet
          = ('latitude' in data && (data as Record<string, unknown>).latitude !== undefined)
            || ('longitude' in data && (data as Record<string, unknown>).longitude !== undefined)
        if (coordsBeingSet) {
          return data
        }
        return {
          ...data,
          latitude: null,
          longitude: null,
          geocodedAt: null,
        }
      },
      // Propagate every customer update to the customer's downstream
      // projections — today: GCal events for the customer's meetings (name,
      // address, phone, email are rendered into the event summary/location/
      // description). No field filter on purpose: `propagateCustomerChange`
      // short-circuits inside the job handler when the customer has zero
      // meetings with gcalEventId, so the cost on irrelevant updates is one
      // QStash enqueue + one cheap DB read inside the job. Field-CASL on
      // crud.update already restricts agents to JSON profile columns, so the
      // vast majority of writes won't reach the system-calendar-auth path.
      //
      // Strict dispatch: a missed enqueue means every synced GCal event
      // continues rendering stale customer data with no recovery hook —
      // surface as a 500 instead.
      //
      // @migration(ably-realtime-kernel) — when the Ably realtime kernel
      // lands, also publish a `customer:<row.id>` channel event inline (NOT
      // via QStash — ephemeral realtime fan-out is the same exception as
      // meeting.updated in meetings/lib/server-spec.ts):
      //   await ably.channels.get(`customer:${row.id}`).publish(
      //     'customer.updated', { fields: Object.keys(meta.input) })
      //
      // see docs/codebase-conventions/service-architecture.md#background-side-effects-via-qstash-jobs
      async after(row, _ctx, _meta) {
        await propagateCustomerChangeJob.dispatchOrThrow({ customerId: row.id })
      },
    },
    delete: {
      // The schema's FK behavior for meetings.customerId and proposals.meetingId
      // is `set null` on parent delete — without this hook, deleting a customer
      // would orphan rows that surface in lists with no owner. Manually delete
      // proposals → meetings before the customer row is removed. customer_notes
      // and projects cascade via schema FKs.
      //
      // Meeting deletes go through `meetingCrud.delete` so each meeting's
      // `delete` hook fires — that hook is responsible for one-way GCal event
      // cleanup. SYSTEM_CONTEXT because the caller has already passed
      // `delete:Customer` (super-admin manage:all) at the tRPC layer; the
      // cascade should not be re-gated by per-row participation.
      //
      // No transaction wraps the cascade: meetingCrud.delete is not tx-aware,
      // and the original "atomic cascade" comment was tolerant of partial
      // failure anyway. Partial failure mode: some meetings deleted (with their
      // GCal events) before a later failure leaves the rest plus the customer
      // intact — retry is a clean no-op for already-deleted meetings.
      //
      // Proposals are still cleared with a raw `db.delete` because the proposal
      // delete hook (if any) wouldn't cascade to GCal — only meetings do.
      // When proposalServerSpec grows a delete hook with cross-system effects,
      // revisit and route through proposalCrud.delete per row.
      async before(id, _ctx) {
        const customerId = String(id)
        const customerMeetings = await db
          .select({ id: meetings.id })
          .from(meetings)
          .where(eq(meetings.customerId, customerId))

        if (customerMeetings.length === 0) {
          return
        }

        const meetingIds = customerMeetings.map(m => m.id)
        await db.delete(proposals).where(inArray(proposals.meetingId, meetingIds))

        for (const m of customerMeetings) {
          dalVerifySuccess(await meetingCrud.delete(SYSTEM_CONTEXT, { id: m.id }))
        }
      },
    },
  },
} satisfies EntityServerSpec<typeof customers>
