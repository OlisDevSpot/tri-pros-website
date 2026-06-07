'use client'

import { CloudtalkSyncCard } from '@/features/campaigns-admin/ui/components/setup/cloudtalk-sync-card'
import { ContactAttributesReadout } from '@/features/campaigns-admin/ui/components/setup/contact-attributes-readout'

export function CampaignsSetupView() {
  return (
    <div className="grid grid-cols-1 gap-4 overflow-y-auto lg:grid-cols-3">
      <div className="lg:col-span-2">
        <CloudtalkSyncCard />
      </div>
      <div className="lg:col-span-1">
        <ContactAttributesReadout />
      </div>
    </div>
  )
}
