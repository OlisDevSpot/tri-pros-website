import type { ModalDescriptor } from '@/shared/lib/create-modal-store'

import { useModalStore } from '@/shared/hooks/use-modal-store'

// A plain function, not a hook: an opener that subscribed to the store re-rendered on every modal open and close.
export function openModal<P>(modal: ModalDescriptor<P>) {
  const { setModal, open } = useModalStore.getState()
  setModal(modal)
  open()
}
