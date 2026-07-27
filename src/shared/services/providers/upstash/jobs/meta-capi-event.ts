import type { AppointmentSetArgs, FunnelLeadArgs } from '@/shared/services/measurement.service'
import { measurementService } from '@/shared/services/measurement.service'

import { createJob } from '../lib/create-job'

/**
 * Durable server-side CAPI dispatch. "Cosmetic" criticality — a dropped event
 * degrades Meta optimization but is not a data-integrity bug — so call sites
 * use `void metaCapiEventJob.dispatch(...)`. QStash still gives durable enqueue
 * + retries; Meta dedupes on event_id so a retry double-send is harmless.
 *
 * Phase 1 handles 'Lead'; Schedule shipped 2026-07 (appointment-set).
 * Contact / MeetingComplete / ProposalSent / Purchase remain phase-2.
 */
export type MetaCapiEventPayload
  = | { event: 'Lead', args: FunnelLeadArgs }
    | { event: 'Schedule', args: AppointmentSetArgs }

export const metaCapiEventJob = createJob(
  'meta-capi-event',
  async (payload: MetaCapiEventPayload) => {
    if (payload.event === 'Lead') {
      await measurementService.trackFunnelLead(payload.args)
    }
    else if (payload.event === 'Schedule') {
      await measurementService.trackAppointmentSet(payload.args)
    }
  },
)
