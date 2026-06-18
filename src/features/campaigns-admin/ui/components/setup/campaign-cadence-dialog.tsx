'use client'

import type { VoipCampaign } from '@/shared/db/schema/voip-campaigns'
import type { SmsCadence, SmsCadenceMessage } from '@/shared/entities/voip-campaigns/schemas/sms-cadence'

import { LoaderCircleIcon, PlusIcon } from 'lucide-react'
import { useEffect, useState } from 'react'

import { useCampaignMutations } from '@/features/campaigns-admin/hooks/use-campaign-mutations'
import { CadenceMessageRow } from '@/features/campaigns-admin/ui/components/setup/cadence-message-row'
import { Button } from '@/shared/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/shared/components/ui/dialog'
import { Label } from '@/shared/components/ui/label'
import { Switch } from '@/shared/components/ui/switch'
import { smsCadenceSchema } from '@/shared/entities/voip-campaigns/schemas/sms-cadence'

interface CampaignCadenceDialogProps {
  campaign: VoipCampaign | null
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function CampaignCadenceDialog({
  campaign,
  open,
  onOpenChange,
}: CampaignCadenceDialogProps) {
  const { setCampaignSmsCadence } = useCampaignMutations()

  const [draft, setDraft] = useState<SmsCadence>(
    () => campaign?.smsCadence ?? smsCadenceSchema.parse({}),
  )
  const [messageKeys, setMessageKeys] = useState<string[]>([])

  // Re-seed whenever the dialog opens or a different campaign is selected.
  useEffect(() => {
    if (open) {
      const seeded = campaign?.smsCadence ?? smsCadenceSchema.parse({})
      // eslint-disable-next-line react-hooks-extra/no-direct-set-state-in-use-effect
      setDraft(seeded)
      // eslint-disable-next-line react-hooks-extra/no-direct-set-state-in-use-effect
      setMessageKeys(seeded.messages.map(() => crypto.randomUUID()))
    }
    // Only re-seed on open/campaign change -- intentionally omit 'draft'
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [campaign?.id, open])

  const isPending = setCampaignSmsCadence.isPending
  const dirty = JSON.stringify(draft) !== JSON.stringify(campaign?.smsCadence ?? smsCadenceSchema.parse({}))

  // Guard: intercept any close attempt while there are unsaved changes.
  function guardedClose() {
    // Fix 3: prevent Esc/overlay close while a save is in flight.
    if (isPending) {
      return
    }
    if (dirty) {
      // eslint-disable-next-line no-alert
      if (!window.confirm('Discard unsaved cadence changes?')) {
        return
      }
    }
    onOpenChange(false)
  }

  function handleOpenChange(next: boolean) {
    if (!next) {
      guardedClose()
    }
    else {
      onOpenChange(true)
    }
  }

  function updateMessage(index: number, patch: Partial<SmsCadenceMessage>) {
    setDraft(prev => ({
      ...prev,
      messages: prev.messages.map((m, i) => (i === index ? { ...m, ...patch } : m)),
    }))
  }

  function removeMessage(index: number) {
    setDraft(prev => ({
      ...prev,
      messages: prev.messages.filter((_, i) => i !== index),
    }))
    setMessageKeys(prev => prev.filter((_, i) => i !== index))
  }

  function addMessage() {
    setDraft(prev => ({
      ...prev,
      messages: [
        ...prev.messages,
        {
          afterAttempts: prev.messages.at(-1)?.afterAttempts ?? 1,
          body: '',
        },
      ],
    }))
    setMessageKeys(prev => [...prev, crypto.randomUUID()])
  }

  function handleSave() {
    if (!campaign) {
      return
    }
    setCampaignSmsCadence.mutate(
      { campaignId: campaign.id, smsCadence: draft },
      { onSuccess: () => onOpenChange(false) },
    )
  }

  const messageCount = draft.messages.length

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent
        className="flex max-h-[90dvh] flex-col gap-0 p-0 sm:max-w-lg"
        onEscapeKeyDown={(e) => {
          // Route Esc through the same unsaved-changes guard.
          e.preventDefault()
          guardedClose()
        }}
        onInteractOutside={(e) => {
          e.preventDefault()
          guardedClose()
        }}
      >
        {/* Header */}
        <DialogHeader className="shrink-0 border-b px-6 py-4">
          <DialogTitle>
            SMS cadence
            {' — '}
            {campaign?.ctCampaignName ?? ''}
          </DialogTitle>
          <DialogDescription>
            Configure the automated SMS ladder. Messages send in order as call attempts accumulate.
          </DialogDescription>
        </DialogHeader>

        {/* Switches */}
        <div className="shrink-0 space-y-3 border-b px-6 py-4">
          <div className="flex items-center justify-between gap-4">
            <Label htmlFor="cadence-enabled" className="cursor-pointer text-sm font-normal">
              Enable SMS cadence for this campaign
            </Label>
            <Switch
              id="cadence-enabled"
              checked={draft.enabled}
              onCheckedChange={checked => setDraft(prev => ({ ...prev, enabled: checked }))}
            />
          </div>
          <div className="flex items-center justify-between gap-4">
            <Label htmlFor="cadence-one-per-day" className="cursor-pointer text-sm font-normal">
              Limit to 1&nbsp;SMS/day per lead
            </Label>
            <Switch
              id="cadence-one-per-day"
              checked={draft.oneSmsPerDay}
              onCheckedChange={checked => setDraft(prev => ({ ...prev, oneSmsPerDay: checked }))}
            />
          </div>
        </div>

        {/* Scrollable ladder */}
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-6 py-2">
          {messageCount === 0
            ? (
                <p className="py-6 text-sm text-muted-foreground">“No messages yet. Add an opener — it sends after the first dial attempt.”</p>
              )
            : draft.messages.map((m, i) => (
                <CadenceMessageRow
                  key={messageKeys[i] ?? crypto.randomUUID()}
                  index={i}
                  message={m}
                  showThresholdWarning={i > 0 && m.afterAttempts < draft.messages[i - 1]!.afterAttempts}
                  onChange={patch => updateMessage(i, patch)}
                  onRemove={() => removeMessage(i)}
                />
              ))}
        </div>

        {/* Add row + counter */}
        <div className="shrink-0 border-t px-6 py-3">
          <div className="flex items-center gap-3">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              disabled={messageCount >= 5}
              onClick={addMessage}
              className="gap-1.5"
            >
              <PlusIcon aria-hidden="true" className="size-4" />
              Add message
            </Button>
            <span className="ml-auto tabular-nums text-xs text-muted-foreground">
              {messageCount}
              &nbsp;/&nbsp;5
            </span>
          </div>
        </div>

        {/* Footer */}
        <DialogFooter className="shrink-0 border-t px-6 py-4">
          <Button type="button" variant="outline" disabled={isPending} onClick={guardedClose}>
            Cancel
          </Button>
          <Button
            type="button"
            disabled={!dirty || isPending}
            onClick={handleSave}
          >
            {isPending
              ? (
                  <>
                    <LoaderCircleIcon aria-hidden="true" className="mr-2 size-4 animate-spin" />
                    Saving…
                  </>
                )
              : 'Save cadence'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
