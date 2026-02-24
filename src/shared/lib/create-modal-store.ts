import { create } from 'zustand'

export interface ModalDescriptor<P = any> {
  accessor: string
  Component: React.ComponentType<P>
  props?: P
}

interface ModalState {
  isOpen: boolean
  modal: ModalDescriptor | null
}

interface ModalActions {
  open: () => void
  close: () => void
  setModal: <P>(modal: ModalDescriptor<P>) => void
}

export type ModalStore = ModalState & ModalActions

export function createModalStore() {
  return create<ModalStore>()(set => ({
    isOpen: false,
    open: () => set({ isOpen: true }),
    close: () => set({ isOpen: false }),
    modal: null,
    setModal: modal => set({ modal }),
  }))
}
