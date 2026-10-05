'use client'

import type { JSX } from 'react'

import { useRef, useState } from 'react'

import { DateTimePicker } from '@/shared/components/date-time-picker'
import { Button } from '@/shared/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/shared/components/ui/dialog'
import { Label } from '@/shared/components/ui/label'
import { Textarea } from '@/shared/components/ui/textarea'

export interface RescheduleResult {
  confirmed: boolean
  newScheduledFor: string
  reason: string
}

interface Pending {
  meetingId: string
  resolve: (value: RescheduleResult) => void
}

interface RescheduleDialogViewProps {
  onCancel: () => void
  onConfirm: () => void
  onDateChange: (d: Date | undefined) => void
  onReasonChange: (v: string) => void
  open: boolean
  reason: string
  scheduledFor: Date | undefined
}

function isFuture(d: Date | undefined): d is Date {
  return !!d && d.getTime() > Date.now()
}

/**
 * Module-level presentational component — a stable type identity across
 * renders so the Dialog/Textarea subtree is never unmounted mid-edit.
 * (Defining this component inline inside the hook, as a fresh arrow function
 * each call, would give `<RescheduleDialog />` a new element type on every
 * `reason`/`scheduledFor` change, forcing React to unmount+remount the whole
 * Dialog/Textarea subtree — losing cursor position and re-firing autoFocus.)
 */
function RescheduleDialogView({
  onCancel,
  onConfirm,
  onDateChange,
  onReasonChange,
  open,
  reason,
  scheduledFor,
}: RescheduleDialogViewProps) {
  const canSave = isFuture(scheduledFor) && reason.trim().length > 0

  return (
    <Dialog open={open} onOpenChange={next => !next && onCancel()}>
      {/* aria-describedby=undefined: no description by design (Radix would warn otherwise) */}
      <DialogContent aria-describedby={undefined}>
        <DialogHeader>
          <DialogTitle>Reschedule meeting</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label>New date & time</Label>
            <DateTimePicker
              value={scheduledFor}
              onChange={onDateChange}
              placeholder="Pick the new date & time"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="reschedule-note">Note</Label>
            <Textarea
              id="reschedule-note"
              className="field-sizing-fixed min-h-24 resize-none text-sm"
              value={reason}
              onChange={e => onReasonChange(e.target.value)}
              placeholder="e.g. Homeowner asked to move to next week; confirmed new slot by phone."
              rows={4}
            />
          </div>
        </div>
        <DialogFooter className="pt-2">
          <Button onClick={onCancel} variant="outline">Cancel</Button>
          <Button disabled={!canSave} onClick={onConfirm}>Reschedule</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

/**
 * Datetime + note capture for the Reschedule action. Mirrors useOutcomeReason's
 * promise pattern: requestReschedule(meetingId) resolves once the agent confirms
 * a future date + non-empty note, or cancels. Reason is required and the new
 * date must be in the future — confirm is disabled until both hold.
 *
 * The returned dialog component is created once (via ref) so its identity
 * stays stable across renders — including every keystroke/date change — while
 * still rendering the latest pending/date/reason state (read through
 * `stateRef` at call time). See RescheduleDialogView above for why identity
 * stability matters here.
 */
export function useReschedule(): [
  () => JSX.Element,
  (meetingId: string) => Promise<RescheduleResult>,
] {
  const [pending, setPending] = useState<Pending | null>(null)
  const [scheduledFor, setScheduledFor] = useState<Date | undefined>(undefined)
  const [reason, setReason] = useState('')

  // Always mirrors the latest state so the stable dialog component below
  // (created once) reads fresh values instead of ones captured at creation.
  const stateRef = useRef({ pending, scheduledFor, reason })
  stateRef.current = { pending, scheduledFor, reason }

  const requestReschedule = (meetingId: string) => {
    setScheduledFor(undefined)
    setReason('')
    return new Promise<RescheduleResult>((resolve) => {
      setPending({ meetingId, resolve })
    })
  }

  const dialogRef = useRef<(() => JSX.Element) | null>(null)
  if (!dialogRef.current) {
    dialogRef.current = function RescheduleDialog() {
      const { pending: currentPending, reason: currentReason, scheduledFor: currentScheduledFor } = stateRef.current

      const handleCancel = () => {
        stateRef.current.pending?.resolve({ confirmed: false, newScheduledFor: '', reason: '' })
        setPending(null)
      }

      const handleConfirm = () => {
        const cur = stateRef.current
        if (!cur.pending || !isFuture(cur.scheduledFor) || !cur.reason.trim()) {
          return
        }
        cur.pending.resolve({
          confirmed: true,
          newScheduledFor: cur.scheduledFor.toISOString(),
          reason: cur.reason.trim(),
        })
        setPending(null)
      }

      return (
        <RescheduleDialogView
          onCancel={handleCancel}
          onConfirm={handleConfirm}
          onDateChange={setScheduledFor}
          onReasonChange={setReason}
          open={currentPending !== null}
          reason={currentReason}
          scheduledFor={currentScheduledFor}
        />
      )
    }
  }

  return [dialogRef.current, requestReschedule]
}
