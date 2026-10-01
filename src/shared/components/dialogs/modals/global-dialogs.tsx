'use client'

import { useAuthModalStore } from '@/shared/hooks/use-auth-modal-store'
import { useModalStore } from '@/shared/hooks/use-modal-store'

export function GlobalDialogs() {
  const baseModal = useModalStore(state => state.modal)
  const { modal: authModal } = useAuthModalStore()

  return (
    <>
      {baseModal && <baseModal.Component {...baseModal.props} />}
      {authModal && <authModal.Component {...authModal.props} />}
    </>
  )
}
