import { useModalStore } from '@/shared/hooks/use-modal-store'
import { Modal } from './base-modal'

export function TemplatesModal() {
  const { isOpen, close } = useModalStore()

  return (
    <Modal
      isOpen={isOpen}
      close={close}
      title="Templates"
      description="Sign in to your account"
    >
      TEMPLATES!
    </Modal>
  )
}
