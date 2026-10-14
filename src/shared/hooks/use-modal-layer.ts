import type { ModalLayerValue } from '@/shared/components/dialogs/modals/contexts/modal-layer-context'
import { use } from 'react'
import { ModalLayerContext } from '@/shared/components/dialogs/modals/contexts/modal-layer-context'

/** The open state and close of the layer this modal was opened in, so a modal open twice closes the right copy. */
export function useModalLayer(): ModalLayerValue {
  const value = use(ModalLayerContext)
  if (!value) {
    throw new Error('useModalLayer: this modal must be opened through openModal')
  }
  return value
}
