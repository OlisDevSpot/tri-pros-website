'use client'

import type { JSX } from 'react'
import type { MeetingOutcome } from '@/shared/constants/enums'

import { useRef, useState } from 'react'

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

interface OutcomeReasonDialogViewProps {
  onCancel: () => void
  onConfirm: () => void
  onReasonChange: (value: string) => void
  open: boolean
  outcome: MeetingOutcome | null
  reason: string
}

/**
 * Module-level presentational component — a stable type identity across
 * renders so the Dialog/Textarea subtree is never unmounted mid-edit.
 * (Defining this component inline inside the hook, as a fresh arrow function
 * each call, would give `<OutcomeReasonDialog />` a new element type on
 * every `reason` keystroke, forcing React to unmount+remount the whole
 * Dialog/Textarea subtree — losing cursor position and re-firing autoFocus.)
 */
function OutcomeReasonDialogView({
  onCancel,
  onConfirm,
  onReasonChange,
  open,
  outcome,
  reason,
}: OutcomeReasonDialogViewProps) {
  return (
    <Dialog open={open} onOpenChange={next => !next && onCancel()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {outcome ? `Why "${MEETING_OUTCOME_LABELS[outcome]}"?` : ''}
          </DialogTitle>
          <DialogDescription>
            Add a short note explaining this outcome. It will be saved to the customer's timeline.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-2">
          <Label className="sr-only" htmlFor="outcome-reason">Reason</Label>
          <Textarea
            autoFocus
            // field-sizing-fixed overrides the base Textarea's field-sizing-content,
            // so the min-height holds instead of the box collapsing to one line as
            // you type; resize-none keeps it stable and it scrolls when content grows.
            className="field-sizing-fixed min-h-24 resize-none text-sm"
            id="outcome-reason"
            onChange={e => onReasonChange(e.target.value)}
            placeholder="e.g. Homeowner postponed until spring; no rep available for the slot…"
            rows={4}
            value={reason}
          />
        </div>
        <DialogFooter className="pt-2">
          <Button onClick={onCancel} variant="outline">Cancel</Button>
          <Button disabled={!reason.trim()} onClick={onConfirm}>Save outcome</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

/**
 * Reason-capture modal for non-positive meeting outcomes. Mirrors useConfirm's
 * promise pattern: requestReason(outcome) resolves once the agent confirms with
 * a non-empty reason or cancels. Reason is required — confirm is disabled until
 * the textarea is non-empty.
 *
 * The returned dialog component is created once (via ref) so its identity
 * stays stable across renders — including every `reason` keystroke — while
 * still rendering the latest pending/reason state (read through `stateRef`
 * at call time). See OutcomeReasonDialogView above for why identity stability
 * matters here.
 */
export function useOutcomeReason(): [
  () => JSX.Element,
  (outcome: MeetingOutcome) => Promise<{ confirmed: boolean, reason: string }>,
] {
  const [pending, setPending] = useState<PendingReason | null>(null)
  const [reason, setReason] = useState('')

  // Always mirrors the latest state so the stable dialog component below
  // (created once) reads fresh values instead of ones captured at creation.
  const stateRef = useRef({ pending, reason })
  stateRef.current = { pending, reason }

  const requestReason = (outcome: MeetingOutcome) => {
    setReason('')
    return new Promise<{ confirmed: boolean, reason: string }>((resolve) => {
      setPending({ outcome, resolve })
    })
  }

  const dialogRef = useRef<(() => JSX.Element) | null>(null)
  if (!dialogRef.current) {
    dialogRef.current = function OutcomeReasonDialog() {
      const { pending: currentPending, reason: currentReason } = stateRef.current

      const handleCancel = () => {
        stateRef.current.pending?.resolve({ confirmed: false, reason: '' })
        setPending(null)
      }

      const handleConfirm = () => {
        const trimmed = stateRef.current.reason.trim()
        if (!trimmed) {
          return
        }
        stateRef.current.pending?.resolve({ confirmed: true, reason: trimmed })
        setPending(null)
      }

      return (
        <OutcomeReasonDialogView
          onCancel={handleCancel}
          onConfirm={handleConfirm}
          onReasonChange={setReason}
          open={currentPending !== null}
          outcome={currentPending?.outcome ?? null}
          reason={currentReason}
        />
      )
    }
  }

  return [dialogRef.current, requestReason]
}
