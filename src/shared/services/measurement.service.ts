import type { LeadEventArgs } from '@/shared/services/meta-sync.service'

import { metaSyncService } from '@/shared/services/meta-sync.service'

export type FunnelLeadArgs = LeadEventArgs

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
  }
}

export type MeasurementService = ReturnType<typeof createMeasurementService>
export const measurementService = createMeasurementService()
