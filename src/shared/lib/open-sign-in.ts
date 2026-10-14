import { SignInModal } from '@/shared/components/dialogs/modals/sign-in-modal'
import { openModal } from '@/shared/lib/open-modal'

export function openSignIn() {
  openModal({ accessor: 'SignIn', Component: SignInModal })
}
