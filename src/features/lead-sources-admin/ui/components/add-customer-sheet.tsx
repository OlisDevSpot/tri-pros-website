'use client'

import type { IntakeMode } from '@/shared/constants/enums'
import type { LeadSourceFormConfig } from '@/shared/entities/lead-sources/schemas'

import { useEffect, useState } from 'react'

import { IntakeFormView } from '@/features/intake/ui/views/intake-form-view'
import { Label } from '@/shared/components/ui/label'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/shared/components/ui/sheet'
import { Switch } from '@/shared/components/ui/switch'

/**
 * Super-admin config: every optional field is visible so the super-admin
 * has full control over what they record. Partner-facing URLs use each
 * lead source's own formConfigJSON; this sheet is strictly the in-dashboard
 * manual-add path.
 */
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

interface AddCustomerSheetProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  /**
   * When present, the submission is attributed to this lead source and the
   * sheet title calls it out. When absent, the router defaults to the
   * `manual` lead source.
   */
  leadSourceSlug?: string
  leadSourceName?: string
}

export function AddCustomerSheet({
  open,
  onOpenChange,
  leadSourceSlug,
  leadSourceName,
}: AddCustomerSheetProps) {
  const [mode, setMode] = useState<IntakeMode>('customer_only')
  const isMeetingMode = mode === 'customer_and_meeting'

  // Reset mode whenever the sheet closes so every opening starts from the
  // same baseline — prevents stale toggle state leaking across sessions.
  useEffect(() => {
    if (!open) {
      setMode('customer_only')
    }
  }, [open])

  const titleSuffix = leadSourceName ? ` · ${leadSourceName}` : ''
  const descriptionTarget = leadSourceName ?? 'Manual'

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="flex w-full flex-col gap-0 sm:max-w-xl">
        <SheetHeader className="border-b border-border/40 px-6 py-5">
          <SheetTitle>
            {`Add customer${titleSuffix}`}
          </SheetTitle>
          <SheetDescription>
            {`Attribution: ${descriptionTarget}. Toggle meeting mode to also schedule a first meeting.`}
          </SheetDescription>
        </SheetHeader>

        <div className="flex flex-1 flex-col gap-4 overflow-hidden px-6 py-4">
          <label className="flex items-center gap-3">
            <Switch
              checked={isMeetingMode}
              onCheckedChange={checked =>
                setMode(checked ? 'customer_and_meeting' : 'customer_only')}
            />
            <Label className="text-sm font-medium">
              {isMeetingMode ? 'Customer + meeting' : 'Customer only'}
            </Label>
          </label>

          <div className="flex flex-1 flex-col min-h-0">
            <IntakeFormView
              key={`${leadSourceSlug ?? 'manual'}-${mode}`}
              mode={mode}
              formConfig={SUPER_ADMIN_FORM_CONFIG}
              leadSourceSlug={leadSourceSlug}
            />
          </div>
        </div>
      </SheetContent>
    </Sheet>
  )
}
