'use client'

import { useAuthModalStore } from '@/shared/hooks/use-auth-modal-store'
import { useModalStore } from '@/shared/hooks/use-modal-store'

export function GlobalDialogs() {
  const { modal: baseModal } = useModalStore()
  const { modal: authModal } = useAuthModalStore()

  return (
    <>
      {baseModal && <baseModal.Element />}
      {authModal && <authModal.Element />}
    </>
  )
}
