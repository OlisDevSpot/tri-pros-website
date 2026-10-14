'use client'

import { usePathname } from 'next/navigation'
import { useEffect } from 'react'
import { ModalLayerView } from '@/shared/components/dialogs/modals/modal-layer-view'
import { useModalLayers } from '@/shared/hooks/use-modal-layers'

export function GlobalDialogs() {
  const layers = useModalLayers(state => state.layers)
  const pathname = usePathname()

  // The store outlives client navigation, so a modal opened on one page would otherwise stay open over the next.
  useEffect(() => {
    useModalLayers.getState().closeAll()
  }, [pathname])

  return (
    <>
      {layers.map(layer => <ModalLayerView key={layer.id} layer={layer} />)}
    </>
  )
}
