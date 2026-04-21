'use client'

import type { LeadSourceFormConfig } from '@/shared/entities/lead-sources/schemas'

import { useEffect, useState } from 'react'

import { Button } from '@/shared/components/ui/button'
import { Label } from '@/shared/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/shared/components/ui/select'
import { Switch } from '@/shared/components/ui/switch'
import { intakeModes } from '@/shared/constants/enums'
import { useLeadSourceActions } from '@/shared/entities/lead-sources/hooks/use-lead-source-actions'
import { cn } from '@/shared/lib/utils'

interface FormConfigEditorProps {
  leadSourceId: string
  initial: LeadSourceFormConfig
}

const MODE_LABEL: Record<typeof intakeModes[number], string> = {
  customer_only: 'Customer only',
  customer_and_meeting: 'Customer + meeting',
}

export function FormConfigEditor({ leadSourceId, initial }: FormConfigEditorProps) {
  const { updateLeadSource } = useLeadSourceActions()
  const [draft, setDraft] = useState<LeadSourceFormConfig>(initial)

  // Reset draft when switching sources.
  useEffect(() => {
    setDraft(initial)
  }, [initial, leadSourceId])

  const isMeetingMode = draft.mode === 'customer_and_meeting'
  const isDirty = JSON.stringify(draft) !== JSON.stringify(initial)

  const save = () => {
    updateLeadSource.mutate({ id: leadSourceId, formConfigJSON: draft })
  }

  const revert = () => {
    setDraft(initial)
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-center justify-between">
        <h3 className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
          Form configuration
        </h3>
        <div className={cn('flex items-center gap-2', !isDirty && 'invisible')}>
          <Button
            size="sm"
            variant="ghost"
            className="h-7 text-xs"
            onClick={revert}
            disabled={updateLeadSource.isPending}
          >
            Revert
          </Button>
          <Button
            size="sm"
            className="h-7 text-xs"
            onClick={save}
            disabled={updateLeadSource.isPending}
          >
            {updateLeadSource.isPending ? 'Saving…' : 'Save changes'}
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
        <Field label="Form mode">
          <Select
            value={draft.mode ?? 'customer_only'}
            onValueChange={v => setDraft(d => ({ ...d, mode: v as LeadSourceFormConfig['mode'] }))}
          >
            <SelectTrigger className="h-9">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {intakeModes.map(m => (
                <SelectItem key={m} value={m}>
                  {MODE_LABEL[m]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>

        <Toggle
          label="Show email field"
          checked={draft.showEmail}
          onChange={v => setDraft(d => ({ ...d, showEmail: v }))}
        />
        <Toggle
          label="Require email"
          checked={draft.requireEmail}
          onChange={v => setDraft(d => ({ ...d, requireEmail: v }))}
          disabled={!draft.showEmail}
        />
        <Toggle
          label="Show notes field"
          checked={draft.showNotes}
          onChange={v => setDraft(d => ({ ...d, showNotes: v }))}
        />

        {isMeetingMode && (
          <>
            <Toggle
              label="Show meeting scheduler"
              checked={draft.showMeetingScheduler ?? false}
              onChange={v => setDraft(d => ({ ...d, showMeetingScheduler: v }))}
            />
            <Toggle
              label="Require scheduler"
              checked={draft.requireMeetingScheduler ?? false}
              onChange={v => setDraft(d => ({ ...d, requireMeetingScheduler: v }))}
              disabled={!draft.showMeetingScheduler}
            />
            <Toggle
              label="Show MP3 upload"
              checked={draft.showMp3Upload ?? false}
              onChange={v => setDraft(d => ({ ...d, showMp3Upload: v }))}
            />
          </>
        )}
      </div>
    </div>
  )
}

function Field({ label, children }: { label: string, children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label className="text-xs font-medium text-muted-foreground">{label}</Label>
      {children}
    </div>
  )
}

interface ToggleProps {
  label: string
  checked: boolean
  disabled?: boolean
  onChange: (v: boolean) => void
}

function Toggle({ label, checked, disabled, onChange }: ToggleProps) {
  return (
    <label className={cn('flex items-center justify-between gap-3 rounded-md border border-border/60 bg-background/40 px-3 py-2.5', disabled && 'opacity-50')}>
      <span className="text-sm text-foreground">{label}</span>
      <Switch checked={checked} onCheckedChange={onChange} disabled={disabled} />
    </label>
  )
}
