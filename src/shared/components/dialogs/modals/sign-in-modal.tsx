import { SignInGoogleButton } from '@/shared/components/buttons/auth/sign-in-google-button'
import { useModalLayer } from '@/shared/hooks/use-modal-layer'
import { Modal } from './base-modal'

export function SignInModal() {
  const { isOpen, close } = useModalLayer()

  return (
    <Modal
      isOpen={isOpen}
      close={close}
      title="Sign in"
      description="Sign in to your account"
    >
      <SignInGoogleButton />
    </Modal>
  )
}
