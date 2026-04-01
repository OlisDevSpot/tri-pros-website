'use client'

import type { IntakeMode } from '@/shared/types/enums'
import type { LeadSourceFormConfig } from '@/shared/entities/lead-sources/schemas'
import { useState } from 'react'
import { IntakeShareLinks } from '@/features/intake/ui/components/intake-share-links'
import { IntakeFormView } from '@/features/intake/ui/views/intake-form-view'

const SUPER_ADMIN_FORM_CONFIG: LeadSourceFormConfig = {
  leadType: 'manual',
  mode: 'customer_only',
  showEmail: true,
  requireEmail: false,
  showNotes: true,
  showMeetingScheduler: true,
  requireMeetingScheduler: false,
  showMp3Upload: true,
  closedByOptions: [],
}

export function DashboardIntakeView() {
  const [mode, setMode] = useState<IntakeMode>('customer_only')

  return (
    <div className="mx-auto h-full w-full max-w-2xl overflow-y-auto p-6">
      <div className="mb-6 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Intake Form</h1>
          <p className="text-sm text-muted-foreground">Manually add a new customer lead.</p>
        </div>
        <IntakeShareLinks />
      </div>
      <IntakeFormView
        mode={mode}
        formConfig={SUPER_ADMIN_FORM_CONFIG}
        onModeChange={setMode}
      />
    </div>
  )
}
