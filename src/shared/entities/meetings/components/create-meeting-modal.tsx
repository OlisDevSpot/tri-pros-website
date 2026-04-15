'use client'

import type { MeetingType } from '@/shared/constants/enums/meetings'
import type { TradeSelection } from '@/shared/entities/meetings/schemas'

import { Modal } from '@/shared/components/dialogs/modals/base-modal'

import { CreateMeetingForm } from './create-meeting-form'

interface CreateMeetingModalProps {
  isOpen: boolean
  onClose: () => void
  onSuccess?: () => void
  customerId: string
  customerName: string
  /** Pass to enable edit mode */
  editMeetingId?: string
  initialValues?: {
    meetingType?: MeetingType
    scheduledFor?: Date
    tradeSelections?: TradeSelection[]
  }
}

export function CreateMeetingModal({
  customerId,
  customerName,
  editMeetingId,
  initialValues,
  isOpen,
  onClose,
  onSuccess,
}: CreateMeetingModalProps) {
  const isEditMode = !!editMeetingId
  const title = isEditMode
    ? `Edit meeting — ${customerName}`
    : `New meeting — ${customerName}`

  function handleSuccess() {
    onSuccess?.()
    onClose()
  }

  return (
    <Modal
      isOpen={isOpen}
      close={onClose}
      title={title}
    >
      <CreateMeetingForm
        customerId={customerId}
        customerName={customerName}
        editMeetingId={editMeetingId}
        initialValues={initialValues}
        onSuccess={handleSuccess}
        onCancel={onClose}
      />
    </Modal>
  )
}
