'use client'

import { ContactFieldsReadout } from '@/features/campaigns-admin/ui/components/setup/contact-fields-readout'
import { SourcePolicyCard } from '@/features/campaigns-admin/ui/components/setup/source-policy-card'
import { SyncedCampaignsCard } from '@/features/campaigns-admin/ui/components/setup/synced-campaigns-card'

/**
 * Setup tab. Scrolls as the page (`page-scroll`) so its long per-source policy
 * table runs behind the phone dock. Top row pairs the two short reference
 * panels; the per-source policy table — the surface that grows — gets full
 * width below.
 */
export function CampaignsSetupView() {
  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4 page-scroll scrollbar-gutter-stable">
      <div className="grid gap-4 md:grid-cols-2">
        <SyncedCampaignsCard />
        <ContactFieldsReadout />
      </div>
      <SourcePolicyCard />
    </div>
  )
}
