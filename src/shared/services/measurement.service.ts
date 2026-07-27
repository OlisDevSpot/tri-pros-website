import type { FunnelAnswers } from '@/shared/domains/funnels/types'
import type { LeadEventArgs } from '@/shared/services/meta-sync.service'

import { ROOTS } from '@/shared/config/roots'
import { firesLeadOptimization } from '@/shared/domains/funnels/lib/tracking/lead-qualification'
import { getCustomerForMeasurement, markMetaScheduleSent } from '@/shared/entities/customers/dal/server/measurement'
import { getLeadById } from '@/shared/entities/leads/dal/server/queries'
import { toE164 } from '@/shared/lib/phone'
import { metaSyncService } from '@/shared/services/meta-sync.service'
import { deriveFbc } from '@/shared/services/providers/meta/lib/derive-fbc'

export type FunnelLeadArgs = LeadEventArgs

export interface AppointmentSetArgs {
  customerId: string
  occurredAtIso: string
}

/**
 * Internal orchestrator for the Meta measurement loop. Phase 1 forwards the
 * funnel Lead straight to meta-sync (all data is in hand at submit time, so no
 * DAL read is needed). Phase 2 grows here: CRM-half events (Contact/Meeting/
 * Proposal/Purchase) read entities via DAL to assemble user_data + value, then
 * call the corresponding meta-sync method.
 */
function createMeasurementService() {
  return {
    async trackFunnelLead(args: FunnelLeadArgs): Promise<void> {
      await metaSyncService.trackLead(args)
    },
    /**
     * CRM appointment-set (meeting created) → Meta `Schedule`, server-only.
     * Guards: funnel-originated customers only; once per lead ever
     * (customers.metaScheduleSentAt — Meta dedup is only 48h); renter gate
     * (renters never fire conversion events; missing/unknown ownership fires,
     * matching firesLeadOptimization semantics). event_time = the meeting-
     * creation moment, never backdated. see design spec 2026-07-26 §2.
     */
    async trackAppointmentSet(args: AppointmentSetArgs): Promise<void> {
      const row = await getCustomerForMeasurement(args.customerId)
      if (!row || row.attributionKind !== 'funnel' || row.metaScheduleSentAt) {
        return
      }
      const lead = row.leadId ? await getLeadById(row.leadId) : null
      if (lead && !firesLeadOptimization(lead.answersJSON as unknown as FunnelAnswers)) {
        return // renter — traffic events only, never conversion events
      }
      const source = row.captureJSON?.source
      const funnel = source?.kind === 'funnel' ? source : undefined
      const nowMs = Date.now()
      const sent = await metaSyncService.trackSchedule({
        eventId: `appt-set-${row.id}`,
        eventTime: Math.floor(Date.parse(args.occurredAtIso) / 1000),
        phone: toE164(row.phone),
        email: row.email,
        city: row.city,
        state: row.state,
        zip: row.zip,
        externalId: row.id,
        fbp: funnel?.meta?.fbp ?? lead?.fbp ?? null,
        fbc: deriveFbc({
          fbc: funnel?.meta?.fbc,
          fbclid: funnel?.utm.fbclid ?? lead?.fbclid ?? undefined,
          nowMs,
        }),
        clientIp: lead?.clientIp ?? null,
        clientUserAgent: lead?.clientUserAgent ?? null,
        eventSourceUrl: row.funnelSlug ? ROOTS.subdomainUrl(row.funnelSlug) : null,
        contentCategory: lead?.trade ?? null,
        contentName: row.funnelSlug,
      })
      if (sent) {
        await markMetaScheduleSent(args.customerId, new Date().toISOString())
      }
    },
  }
}

export type MeasurementService = ReturnType<typeof createMeasurementService>
export const measurementService = createMeasurementService()
