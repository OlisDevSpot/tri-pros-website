'use client'

import type { IntakeMode } from '@/shared/constants/enums'
import type { LeadSourceFormConfig } from '@/shared/entities/lead-sources/schemas'
import { useState } from 'react'
import { IntakeShareLinks } from '@/features/intake/ui/components/intake-share-links'
import { IntakeFormView } from '@/features/intake/ui/views/intake-form-view'
import { Label } from '@/shared/components/ui/label'
import { Separator } from '@/shared/components/ui/separator'
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
    <div className="mx-auto flex h-full w-full max-w-3xl flex-col overflow-hidden">
      {/* Header */}
      <div className="shrink-0 pb-4">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Intake Form</h1>
            <p className="text-sm text-muted-foreground">Manually add a new customer lead.</p>
          </div>
          <IntakeShareLinks />
        </div>
      </div>

      {/* Card: toggle + scrollable fields + pinned submit */}
      <div className="flex flex-1 flex-col min-h-0 rounded-xl border border-border bg-card p-4 shadow-sm sm:p-6">
        {/* Pinned toggle */}
        <div className="shrink-0 flex items-center gap-3 pb-4">
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
        <Separator className="shrink-0" />

        <IntakeFormView
          mode={mode}
          formConfig={SUPER_ADMIN_FORM_CONFIG}
        />
      </div>
    </div>
  )
}
