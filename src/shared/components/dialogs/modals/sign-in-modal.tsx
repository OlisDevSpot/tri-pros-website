import { SignInGoogle } from '@/shared/auth/forms/sign-in-google'
import { useAuthModalStore } from '@/shared/hooks/use-auth-modal-store'
import { Modal } from './base-modal'

export function SignInModal() {
  const { isOpen, close } = useAuthModalStore()

  return (
    <Modal isOpen={isOpen} close={close} title="Sign in" description="Sign in to your account">
      <SignInGoogle />
    </Modal>
  )
}
