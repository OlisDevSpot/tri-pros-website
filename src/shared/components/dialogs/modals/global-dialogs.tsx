'use client'

import { usePathname } from 'next/navigation'
import { useEffect } from 'react'
import { useAuthModalStore } from '@/shared/hooks/use-auth-modal-store'
import { useModalStore } from '@/shared/hooks/use-modal-store'

export function GlobalDialogs() {
  const baseModal = useModalStore(state => state.modal)
  const { modal: authModal } = useAuthModalStore()
  const pathname = usePathname()

  // The store outlives client navigation, so a modal opened on one page would otherwise stay open over the next.
  useEffect(() => {
    useModalStore.getState().close()
  }, [pathname])

  return (
    <>
      {baseModal && <baseModal.Component {...baseModal.props} />}
      {authModal && <authModal.Component {...authModal.props} />}
    </>
  )
}
