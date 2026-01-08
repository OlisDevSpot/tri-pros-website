import { SignInGoogleButton } from '@/shared/components/buttons/auth/sign-in-google-button'
import { useAuthModalStore } from '@/shared/hooks/use-auth-modal-store'
import { Modal } from './base-modal'

export function SignInModal() {
  const { isOpen, close } = useAuthModalStore()

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
