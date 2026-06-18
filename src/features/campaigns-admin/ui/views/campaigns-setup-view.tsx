'use client'

import { ContactAttributesReadout } from '@/features/campaigns-admin/ui/components/setup/contact-attributes-readout'
import { SourcePolicyCard } from '@/features/campaigns-admin/ui/components/setup/source-policy-card'
import { SyncedCampaignsCard } from '@/features/campaigns-admin/ui/components/setup/synced-campaigns-card'

/**
 * Setup tab. Owns its own vertical scroll (min-h-0 flex-1 + overflow-y-auto —
 * the same chain the Leads tab uses) so long source lists scroll instead of
 * overflowing the shell. Top row pairs the two short reference panels; the
 * per-source policy table — the surface that grows — gets full width below.
 */
export function CampaignsSetupView() {
  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto overscroll-contain pr-1">
      <div className="grid gap-4 md:grid-cols-2">
        <SyncedCampaignsCard />
        <ContactAttributesReadout />
      </div>
      <SourcePolicyCard />
    </div>
  )
}
