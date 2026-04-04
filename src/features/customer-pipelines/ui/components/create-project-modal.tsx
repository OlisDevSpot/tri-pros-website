'use client'

import { Modal } from '@/shared/components/dialogs/modals/base-modal'

import { CreateProjectForm } from './create-project-form'

interface CreateProjectModalProps {
  isOpen: boolean
  onClose: () => void
  onSuccess?: () => void
  customerId: string
  customerName: string
  meetingId?: string
}

export function CreateProjectModal({
  customerId,
  customerName,
  isOpen,
  meetingId,
  onClose,
  onSuccess,
}: CreateProjectModalProps) {
  function handleSuccess() {
    onSuccess?.()
    onClose()
  }

  return (
    <Modal
      isOpen={isOpen}
      close={onClose}
      title={`New project — ${customerName}`}
      className="sm:max-w-lg"
    >
      <CreateProjectForm
        customerId={customerId}
        customerName={customerName}
        meetingId={meetingId}
        onSuccess={handleSuccess}
        onCancel={onClose}
      />
    </Modal>
  )
}
