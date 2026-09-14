import type { Meeting } from '@/shared/db/schema'

import { createCrudDal } from '@/shared/dal/server/lib/create-crud-dal'
import { OUTCOME_PIPELINE_MAP } from '@/shared/domains/pipelines/lib/outcome-pipeline-map'
import { clearMeetingGCalFields } from '@/shared/entities/meetings/dal/server/google-calendar'
import { addParticipant } from '@/shared/entities/meetings/dal/server/participants'
import { resolveMeetingOwnerId } from '@/shared/entities/meetings/lib/resolve-owner'
import { meetingServerSpec } from '@/shared/entities/meetings/lib/server-spec'
import { getSystemOwnerId } from '@/shared/entities/users/dal/server/system'
import { deleteMeetingEventJob } from '@/shared/services/providers/upstash/jobs/delete-meeting-event'
import { graduateFromCampaignJob } from '@/shared/services/providers/upstash/jobs/graduate-from-campaign'
import { metaCapiEventJob } from '@/shared/services/providers/upstash/jobs/meta-capi-event'
import { notifyMeetingTimeChangedJob } from '@/shared/services/providers/upstash/jobs/notify-meeting-time-changed'
import { syncMeetingToGcalJob } from '@/shared/services/providers/upstash/jobs/sync-meeting-to-gcal'
import { ably } from '@/shared/services/providers/upstash/realtime'

/**
 * Stable CRUD handlers for meetings. Hooks live here (config factory), not
 * on the spec — see ../DOCS.md for the sanctioned service-orchestration note.
 */
export const meetingCrud = createCrudDal(meetingServerSpec, () => ({
  hooks: {
    // ── HOOK CAVEAT (afterCommit / sub-plan C DEFERRED) ──────────────────────
    // These `after`-hook side-effects run INLINE, which is safe on the naked path
    // (no tx threaded → the write autocommits before the hook fires). There is no
    // post-commit phase: sub-plan C (`afterCommit`) is deferred, and this inline
    // model is the accepted contract, not an interim state.
    //   • create.after: syncMeetingToGcalJob, graduateFromCampaignJob, metaCapiEventJob (dispatches)
    //   • create.after: addParticipant(...) — DB write on raw `db` (off any ambient tx)
    //   • update.after: syncMeetingToGcalJob, notifyMeetingTimeChangedJob (dispatches) + ably.publish
    // ⚠️ If a future orchestrator threads a tx into meetingCrud.* (via `withTx`),
    // the dispatches above fire PRE-COMMIT and won't roll back, and addParticipant
    // writes outside that tx. That call site must handle it (see `withTx` in
    // helpers.ts). Revisit C only if cross-entity atomicity here becomes a real need.
    create: {
      // see ../../DOCS.md#meeting-owner-is-creator
      // Authenticated callers: ownerId is ALWAYS server-resolved — prevents wire
      // clients from POSTing { ownerId: <someone-else> } and creating a meeting
      // owned by another user. Resolution branches on the `own Meeting`
      // capability (CASL), never on input and never on a role string: agents /
      // super-admin own their meetings; dispatchers create unassigned
      // (system-owned) ones — see ../../lib/resolve-owner.ts. SYSTEM_CONTEXT callers
      // (orchestrators like customers.createFromIntake) have ctx.session ===
      // null and supply ownerId explicitly — the hook passes their value
      // through unchanged.
      async before(input, ctx) {
        if (!ctx.session) {
          return input
        }
        return { ...input, ownerId: await resolveMeetingOwnerId(ctx) }
      },
      // Merged from lifecycle.ts onCreated + onDuplicated (identical behavior).
      // Uses row.ownerId (not ctx.session.user.id) so the participant follows
      // the meeting's actual owner — correct for both the authed UI path
      // (row.ownerId === session.user.id by virtue of the before hook) and
      // the SYSTEM_CONTEXT orchestrator path. The GCal push is enqueued as a
      // QStash job — strict dispatch so a missed enqueue fails the mutation
      // rather than silently dropping the event.
      // see docs/codebase-conventions/service-architecture.md#background-side-effects-via-qstash-jobs
      async after(row: Meeting, _ctx) {
        const systemOwnerId = await getSystemOwnerId()
        // info@ cannot attend — a system-owned (unassigned, dispatcher-booked)
        // meeting has no owner participant. see ../../DOCS.md#system-account-not-a-person
        if (row.ownerId !== systemOwnerId) {
          await addParticipant(row.id, row.ownerId, 'owner')
        }

        if (row.scheduledFor) {
          await syncMeetingToGcalJob.dispatchOrThrow({ meetingId: row.id })
        }

        // Graduation handoff (voip-campaigns decision #12): a booked meeting
        // means JustCall's conversion job is done — stop dialing by unenrolling
        // the customer from any active campaign. Idempotent + no-op if never
        // enrolled. dispatchOrThrow: stopping a live dial is not cosmetic.
        if (row.customerId) {
          await graduateFromCampaignJob.dispatchOrThrow({ customerId: row.customerId })

          // Meta measurement: appointment-set = meeting created (design spec
          // 2026-07-26 §2). Cosmetic criticality → best-effort dispatch, like
          // the funnel Lead twin. All guards (funnel-origin, renter gate,
          // once-per-lead) live in measurement.trackAppointmentSet.
          void metaCapiEventJob.dispatch({
            event: 'Schedule',
            args: { customerId: row.customerId, occurredAtIso: new Date().toISOString() },
          })
        }
      },
    },
    update: {
      // see ../../DOCS.md#meeting-pipeline-storage-vs-derived
      before(data) {
        if (data.meetingOutcome) {
          const pipeline = OUTCOME_PIPELINE_MAP[data.meetingOutcome]
          if (pipeline != null) {
            return { ...data, pipeline }
          }
        }
        return data
      },
      // Merged from lifecycle.ts onUpdated.
      // Reads row.ownerId (not ctx.session.user.id) for parity with create.after —
      // SYSTEM_CONTEXT callers (e.g., inbound GCal sync, the new pipeline-stage
      // transition path that uses buildUserContext) must not crash here.
      // excludeUserId on the notification is optional — SYSTEM_CONTEXT means
      // no "actor" to exclude (notify all participants).
      //
      // Side-effect taxonomy:
      // - GCal sync + time-changed push → QStash jobs, dispatchOrThrow.
      //   Critical work; silent loss is the bug class this refactor closed.
      //   Parallelized via Promise.all to share the dispatch round-trip.
      // - Ably publish → inline await. Ephemeral realtime fan-out; routing
      //   through QStash would add 100-300ms of delay and defeat the point.
      // see docs/codebase-conventions/service-architecture.md#background-side-effects-via-qstash-jobs
      async after(row: Meeting, ctx, meta) {
        const { previousRow, input: data } = meta

        // GCal-affecting fields on a meeting:
        // - scheduledFor → event start/end time
        // - meetingType → event title prefix and color (Fresh/Rehash/Project)
        // - agentNotes → event description body
        // - projectId → event title prefix flips to "Project:" + color flips
        const gcalFieldChanged = 'scheduledFor' in data
          || 'meetingType' in data
          || 'agentNotes' in data
          || 'projectId' in data
        const timeChanged = previousRow.scheduledFor !== row.scheduledFor

        const dispatches: Promise<unknown>[] = []
        if (gcalFieldChanged) {
          dispatches.push(syncMeetingToGcalJob.dispatchOrThrow({ meetingId: row.id }))
        }
        if (timeChanged) {
          dispatches.push(notifyMeetingTimeChangedJob.dispatchOrThrow({
            meetingId: row.id,
            oldScheduledFor: previousRow.scheduledFor,
            newScheduledFor: row.scheduledFor,
            excludeUserId: ctx.session?.user.id,
          }))
        }
        if (dispatches.length > 0) {
          await Promise.all(dispatches)
        }

        await ably.channels.get(`meeting:${row.id}`).publish('meeting.updated', {
          fields: Object.keys(data),
        })

        // GCal-removed-on-cancel: a meeting whose outcome BECOMES `cancelled`
        // (any path — Reschedule action or a direct "Cancelled" selection) is no
        // longer on the shared calendar; the row is kept. The gcalEventId null
        // guard + one-time transition check prevent re-dispatch. see ../../DOCS.md#gcal-removed-on-cancel
        if (
          previousRow.meetingOutcome !== 'cancelled'
          && row.meetingOutcome === 'cancelled'
          && row.gcalEventId
        ) {
          await deleteMeetingEventJob.dispatchOrThrow({ gcalEventId: row.gcalEventId })
          await clearMeetingGCalFields(row.id)
        }
      },
    },
    delete: {
      // One-way GCal cleanup: deleting a meeting in-app deletes its event on
      // the centralized info@ calendar. The reverse direction is intentionally
      // NOT symmetric — cancelling an event in GCal clears the meeting's GCal
      // linkage fields (`clearMeetingGCalFields` in performInboundSync) but
      // leaves the meeting row intact, so an accidental GCal-side delete
      // doesn't destroy app data.
      //
      // G4: the row is prefetched by the engine and handed in — no raw db
      // read here (unlike the old spec.hooks.delete.before, which had to
      // SELECT gcalEventId itself before the row was gone).
      // The Google API call itself runs inside a QStash job — strict dispatch
      // so a failed enqueue surfaces to the deleting agent rather than
      // silently leaving an orphan event.
      // Failure mode: if the QStash dispatch itself succeeds but the eventual
      // job execution fails (auth, network, 5xx), QStash retries automatically;
      // the handler is idempotent (provider swallows 404/410 from already-gone
      // events). A future orphan-sweeper script can clean residue from cases
      // where every QStash retry exhausts.
      // see docs/codebase-conventions/service-architecture.md#background-side-effects-via-qstash-jobs
      async before(row: Meeting) {
        if (row.gcalEventId) {
          await deleteMeetingEventJob.dispatchOrThrow({ gcalEventId: row.gcalEventId })
        }
      },
    },
  },
  // see ../../DOCS.md#duplicate-copies-setup-only
  // Copy full row minus PK. Exclude derived/outcome/calendar fields AND the
  // sit-specific state (flowStateJSON, projectId): a duplicate is a fresh sit,
  // not a continuation — only reschedule carries flow state forward.
  // Routed through createImpl — `overrides` stamps ownerId, create.after adds participant.
  duplicate: {
    exclude: [
      'createdAt',
      'updatedAt',
      'meetingOutcome',
      'pipeline',
      'flowStateJSON',
      'agentNotes',
      'projectId',
      'gcalEventId',
      'gcalEtag',
      'gcalSyncedAt',
    ],
    // The create.before hook forces ownerId from session for authed callers
    // and passes input through for SYSTEM_CONTEXT — so this override is a
    // sane default that loses to before-hook on the authed path. Falls back
    // to source.ownerId so a SYSTEM_CONTEXT duplicate doesn't crash.
    overrides: (source, ctx) => ({
      ownerId: ctx.session?.user.id ?? source.ownerId,
    }),
  },
}))
