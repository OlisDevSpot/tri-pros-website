import { create } from 'zustand'

interface ModalState {
  isOpen: boolean
  modal: {
    Element: React.ReactNode
    accessor: string
  } | null
}

interface ModalActions {
  open: () => void
  close: () => void
  setModal: (modal: ModalState['modal']) => void
}

export type ModalStore = ModalState & ModalActions

export function createModalStore() {
  return create<ModalStore>()(set => ({
    isOpen: false,
    open: () => set({ isOpen: true }),
    close: () => set({ isOpen: false }),
    onOpen: () => set({ isOpen: true }),
    onClose: () => set({ isOpen: false }),
    modal: null,
    setModal: modal => set({ modal }),
  }))
}
