'use client'

import type { LeadSourceFormConfig } from '@/shared/entities/lead-sources/schemas'

import { useState } from 'react'

import { Button } from '@/shared/components/ui/button'
import { Input } from '@/shared/components/ui/input'
import { Label } from '@/shared/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/shared/components/ui/select'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/shared/components/ui/sheet'
import { Switch } from '@/shared/components/ui/switch'
import { intakeModes } from '@/shared/constants/enums'
import { useLeadSourceActions } from '@/shared/entities/lead-sources/hooks/use-lead-source-actions'

interface NewLeadSourceSheetProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onCreated?: (id: string) => void
}

const DEFAULT_CONFIG: LeadSourceFormConfig = {
  mode: 'customer_only',
  showEmail: true,
  requireEmail: false,
  showNotes: true,
  showMeetingScheduler: false,
  requireMeetingScheduler: false,
  showMp3Upload: false,
}

const MODE_LABEL: Record<typeof intakeModes[number], string> = {
  customer_only: 'Customer only',
  customer_and_meeting: 'Customer + meeting',
}

export function NewLeadSourceSheet({ open, onOpenChange, onCreated }: NewLeadSourceSheetProps) {
  const { createLeadSource } = useLeadSourceActions()
  const [name, setName] = useState('')
  const [config, setConfig] = useState<LeadSourceFormConfig>(DEFAULT_CONFIG)

  const reset = () => {
    setName('')
    setConfig(DEFAULT_CONFIG)
  }

  const submit = () => {
    if (!name.trim()) {
      return
    }
    createLeadSource.mutate(
      { name: name.trim(), formConfigJSON: config },
      {
        onSuccess: (created) => {
          reset()
          onOpenChange(false)
          onCreated?.(created.id)
        },
      },
    )
  }

  const isMeetingMode = config.mode === 'customer_and_meeting'

  const handleOpenChange = (v: boolean) => {
    if (!v) {
      reset()
    }
    onOpenChange(v)
  }

  return (
    <Sheet open={open} onOpenChange={handleOpenChange}>
      <SheetContent side="right" className="flex w-full flex-col gap-0 sm:max-w-md">
        <SheetHeader className="border-b border-border/40 px-6 py-5">
          <SheetTitle>New lead source</SheetTitle>
          <SheetDescription>
            Creates an inactive lead source with a fresh intake URL. Activate once the partner is ready to send leads.
          </SheetDescription>
        </SheetHeader>

        <div className="flex flex-1 flex-col gap-5 overflow-y-auto px-6 py-5">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="new-source-name" className="text-xs font-medium text-muted-foreground">
              Name
            </Label>
            <Input
              id="new-source-name"
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="Home Depot"
              autoFocus
              autoComplete="off"
            />
            <p className="text-[11px] text-muted-foreground">
              Slug auto-generated from the name. The intake URL token is generated on save.
            </p>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label className="text-xs font-medium text-muted-foreground">Form mode</Label>
            <Select
              value={config.mode ?? 'customer_only'}
              onValueChange={v => setConfig(c => ({ ...c, mode: v as LeadSourceFormConfig['mode'] }))}
            >
              <SelectTrigger>
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
          </div>

          <ToggleRow
            label="Show email field"
            checked={config.showEmail}
            onChange={v => setConfig(c => ({ ...c, showEmail: v }))}
          />
          <ToggleRow
            label="Require email"
            checked={config.requireEmail}
            onChange={v => setConfig(c => ({ ...c, requireEmail: v }))}
            disabled={!config.showEmail}
          />
          <ToggleRow
            label="Show notes field"
            checked={config.showNotes}
            onChange={v => setConfig(c => ({ ...c, showNotes: v }))}
          />
          {isMeetingMode && (
            <>
              <ToggleRow
                label="Show meeting scheduler"
                checked={config.showMeetingScheduler ?? false}
                onChange={v => setConfig(c => ({ ...c, showMeetingScheduler: v }))}
              />
              <ToggleRow
                label="Require scheduler"
                checked={config.requireMeetingScheduler ?? false}
                onChange={v => setConfig(c => ({ ...c, requireMeetingScheduler: v }))}
                disabled={!config.showMeetingScheduler}
              />
              <ToggleRow
                label="Show MP3 upload"
                checked={config.showMp3Upload ?? false}
                onChange={v => setConfig(c => ({ ...c, showMp3Upload: v }))}
              />
            </>
          )}
        </div>

        <div className="flex items-center justify-end gap-2 border-t border-border/40 px-6 py-4">
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={createLeadSource.isPending}>
            Cancel
          </Button>
          <Button onClick={submit} disabled={!name.trim() || createLeadSource.isPending}>
            {createLeadSource.isPending ? 'Creating…' : 'Create lead source'}
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  )
}

function ToggleRow({
  label,
  checked,
  onChange,
  disabled,
}: {
  label: string
  checked: boolean
  onChange: (v: boolean) => void
  disabled?: boolean
}) {
  return (
    <label className="flex items-center justify-between gap-3">
      <span className="text-sm text-foreground">{label}</span>
      <Switch checked={checked} onCheckedChange={onChange} disabled={disabled} />
    </label>
  )
}
