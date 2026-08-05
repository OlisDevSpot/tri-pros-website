'use client'

import type { JSX } from 'react'
import type { MeetingOutcome } from '@/shared/constants/enums'

import { useState } from 'react'

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
import { Textarea } from '@/shared/components/ui/textarea'
import { MEETING_OUTCOME_LABELS } from '@/shared/entities/meetings/constants/status-colors'

interface PendingReason {
  outcome: MeetingOutcome
  resolve: (value: { confirmed: boolean, reason: string }) => void
}

/**
 * Reason-capture modal for non-positive meeting outcomes. Mirrors useConfirm's
 * promise pattern: requestReason(outcome) resolves once the agent confirms with
 * a non-empty reason or cancels. Reason is required — confirm is disabled until
 * the textarea is non-empty.
 */
export function useOutcomeReason(): [
  () => JSX.Element,
  (outcome: MeetingOutcome) => Promise<{ confirmed: boolean, reason: string }>,
] {
  const [pending, setPending] = useState<PendingReason | null>(null)
  const [reason, setReason] = useState('')

  const requestReason = (outcome: MeetingOutcome) => {
    setReason('')
    return new Promise<{ confirmed: boolean, reason: string }>((resolve) => {
      setPending({ outcome, resolve })
    })
  }

  const handleClose = () => {
    pending?.resolve({ confirmed: false, reason: '' })
    setPending(null)
  }

  const handleConfirm = () => {
    const trimmed = reason.trim()
    if (!trimmed) {
      return
    }
    pending?.resolve({ confirmed: true, reason: trimmed })
    setPending(null)
  }

  const OutcomeReasonDialog = () => (
    <Dialog open={pending !== null} onOpenChange={open => !open && handleClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {pending ? `Why "${MEETING_OUTCOME_LABELS[pending.outcome]}"?` : ''}
          </DialogTitle>
          <DialogDescription>
            Add a short note explaining this outcome. It will be saved to the customer's timeline.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-2">
          <Label className="sr-only" htmlFor="outcome-reason">Reason</Label>
          <Textarea
            autoFocus
            className="min-h-[96px] resize-none text-sm"
            id="outcome-reason"
            onChange={e => setReason(e.target.value)}
            placeholder="e.g. Homeowner postponed until spring; no rep available for the slot…"
            value={reason}
          />
        </div>
        <DialogFooter className="pt-2">
          <Button onClick={handleClose} variant="outline">Cancel</Button>
          <Button disabled={!reason.trim()} onClick={handleConfirm}>Save outcome</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )

  return [OutcomeReasonDialog, requestReason]
}
