'use client'

import { Modal } from '@/shared/components/dialogs/modals/base-modal'

import { CreateProjectForm } from './create-project-form'

interface CreateProjectModalProps {
  isOpen: boolean
  onClose: () => void
  /** Called with the proposalId that should be set to 'approved' after project creation. */
  onSuccess?: (selectedProposalId: string) => void
  customerId: string
  customerName: string
  /** The proposal that triggered the modal (default selection). */
  proposalId: string
  meetingId?: string
}

export function CreateProjectModal({
  customerId,
  customerName,
  isOpen,
  meetingId,
  onClose,
  onSuccess,
  proposalId,
}: CreateProjectModalProps) {
  function handleSuccess(selectedProposalId: string) {
    onSuccess?.(selectedProposalId)
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
        proposalId={proposalId}
        meetingId={meetingId}
        onSuccess={handleSuccess}
        onCancel={onClose}
      />
    </Modal>
  )
}
