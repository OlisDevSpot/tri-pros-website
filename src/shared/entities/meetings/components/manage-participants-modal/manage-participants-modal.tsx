'use client'

import { Modal } from '@/shared/components/dialogs/modals/base-modal'
import { ParticipantPickerContent } from '@/shared/entities/meetings/components/participant-picker/participant-picker-content'

interface ManageParticipantsModalProps {
  /**
   * Accepted as an array for caller ergonomics (many call-sites carry a bulk
   * target shape from older designs), but the modal currently operates on the
   * first meeting only. No caller uses multi-meeting today. When bulk returns
   * it will live in the hook, not the modal shell.
   */
  meetingIds: string[]
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess?: () => void
}

export function ManageParticipantsModal({
  meetingIds,
  open,
  onOpenChange,
  onSuccess: _onSuccess,
}: ManageParticipantsModalProps) {
  const meetingId = meetingIds[0] ?? ''

  return (
    <Modal
      close={() => onOpenChange(false)}
      description="Assign owner, co-owner, and helpers for this meeting."
      isOpen={open}
      title="Manage participants"
      className="sm:max-w-xl"
    >
      {meetingId !== ''
        ? <ParticipantPickerContent meetingId={meetingId} variant="modal" />
        : <p className="py-6 text-center text-sm text-muted-foreground">No meeting selected.</p>}
    </Modal>
  )
}
