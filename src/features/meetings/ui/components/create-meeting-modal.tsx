'use client'

import { Modal } from '@/shared/components/dialogs/modals/base-modal'
import { CreateMeetingForm } from './create-meeting-form'

interface CreateMeetingModalProps {
  isOpen: boolean
  onClose: () => void
  onSuccess?: () => void
  customerId: string
  customerName: string
}

export function CreateMeetingModal({
  customerId,
  customerName,
  isOpen,
  onClose,
  onSuccess,
}: CreateMeetingModalProps) {
  function handleSuccess() {
    onSuccess?.()
    onClose()
  }

  return (
    <Modal
      isOpen={isOpen}
      close={onClose}
      title={`New meeting — ${customerName}`}
    >
      <CreateMeetingForm
        customerId={customerId}
        customerName={customerName}
        onSuccess={handleSuccess}
        onCancel={onClose}
      />
    </Modal>
  )
}
