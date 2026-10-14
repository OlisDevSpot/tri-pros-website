import type { ModalDescriptor, ModalLayersState } from '@/shared/lib/modal-layers'
import { create } from 'zustand'
import { closeAllModalLayers, closeModalLayer, EMPTY_MODAL_LAYERS, pushModalLayer } from '@/shared/lib/modal-layers'

interface ModalLayersActions {
  push: <P>(descriptor: ModalDescriptor<P>) => void
  close: (id: number) => void
  closeAll: () => void
}

export const useModalLayers = create<ModalLayersState & ModalLayersActions>()(set => ({
  ...EMPTY_MODAL_LAYERS,
  push: descriptor => set(state => pushModalLayer(state, descriptor)),
  close: id => set(state => closeModalLayer(state, id)),
  closeAll: () => set(state => closeAllModalLayers(state)),
}))
