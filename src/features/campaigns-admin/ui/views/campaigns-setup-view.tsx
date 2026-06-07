'use client'

import { CloudtalkSyncCard } from '@/features/campaigns-admin/ui/components/setup/cloudtalk-sync-card'
import { ContactAttributesReadout } from '@/features/campaigns-admin/ui/components/setup/contact-attributes-readout'

export function CampaignsSetupView() {
  return (
    <div className="flex max-w-3xl flex-col gap-4 overflow-y-auto">
      <CloudtalkSyncCard />
      <ContactAttributesReadout />
    </div>
  )
}
