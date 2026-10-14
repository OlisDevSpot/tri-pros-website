import type { ComponentType } from 'react'
import { MODAL_LAYER_CAP } from '@/shared/constants/modal-layers'

export interface ModalDescriptor<P = any> {
  accessor: string
  Component: ComponentType<P>
  props?: P
}

export interface ModalLayer extends ModalDescriptor {
  id: number
  isOpen: boolean
}

/** Open layers always form a prefix of `layers`: a close also closes everything above it. */
export interface ModalLayersState {
  layers: ModalLayer[]
  nextId: number
}

export const EMPTY_MODAL_LAYERS: ModalLayersState = { layers: [], nextId: 1 }

// A closed layer stays mounted until the next push so its exit animation can play.
export function pushModalLayer(state: ModalLayersState, descriptor: ModalDescriptor): ModalLayersState {
  const open = state.layers.filter(layer => layer.isOpen)
  const layer: ModalLayer = { ...descriptor, id: state.nextId, isOpen: true }
  if (open.length < MODAL_LAYER_CAP) {
    return { layers: [...open, layer], nextId: state.nextId + 1 }
  }
  // The global, not `node:process`: this module is bundled for the client.
  // eslint-disable-next-line node/prefer-global/process
  if (process.env.NODE_ENV !== 'production') {
    console.warn(`openModal: ${MODAL_LAYER_CAP} layers are open; "${descriptor.accessor}" replaces the top one`)
  }
  return { layers: [...open.slice(0, -1), layer], nextId: state.nextId + 1 }
}

// Returning the same object when nothing changes keeps zustand from notifying, so a stale close re-renders nothing.
export function closeModalLayer(state: ModalLayersState, id: number): ModalLayersState {
  const index = state.layers.findIndex(layer => layer.id === id)
  if (index === -1 || !state.layers[index].isOpen) {
    return state
  }
  return {
    ...state,
    layers: state.layers.map((layer, i) => (i >= index && layer.isOpen ? { ...layer, isOpen: false } : layer)),
  }
}

export function closeAllModalLayers(state: ModalLayersState): ModalLayersState {
  if (!state.layers.some(layer => layer.isOpen)) {
    return state
  }
  return { ...state, layers: state.layers.map(layer => (layer.isOpen ? { ...layer, isOpen: false } : layer)) }
}
