import { createContext } from 'react'

export interface ModalLayerValue {
  isOpen: boolean
  close: () => void
}

export const ModalLayerContext = createContext<ModalLayerValue | null>(null)
