'use client'

import type { LeadSourceFormConfig } from '@/shared/entities/lead-sources/schemas'
import type { IntakeMode } from '@/shared/types/enums'
import { useState } from 'react'
import { IntakeShareLinks } from '@/features/intake/ui/components/intake-share-links'
import { IntakeFormView } from '@/features/intake/ui/views/intake-form-view'
import { Label } from '@/shared/components/ui/label'
import { Switch } from '@/shared/components/ui/switch'

const SUPER_ADMIN_FORM_CONFIG: LeadSourceFormConfig = {
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
  const isMeetingMode = mode === 'customer_and_meeting'

  return (
    <div className="mx-auto flex h-full w-full max-w-2xl flex-col overflow-hidden px-6">
      {/* Pinned header + mode toggle */}
      <div className="shrink-0 space-y-4 pb-6 pt-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Intake Form</h1>
            <p className="text-sm text-muted-foreground">Manually add a new customer lead.</p>
          </div>
          <IntakeShareLinks />
        </div>
        <div className="flex items-center gap-3 rounded-lg border p-4">
          <Switch
            id="intake-mode-toggle"
            checked={isMeetingMode}
            onCheckedChange={checked =>
              setMode(checked ? 'customer_and_meeting' : 'customer_only')}
          />
          <Label htmlFor="intake-mode-toggle" className="text-sm font-medium">
            {isMeetingMode ? 'Customer + Meeting' : 'Customer Only'}
          </Label>
        </div>
      </div>

      {/* Form: scrollable fields + pinned submit */}
      <IntakeFormView
        mode={mode}
        formConfig={SUPER_ADMIN_FORM_CONFIG}
      />
    </div>
  )
}
