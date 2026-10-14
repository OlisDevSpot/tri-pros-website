'use client'

import type { ModalLayer } from '@/shared/lib/modal-layers'
import { memo, useMemo } from 'react'
import { ModalLayerContext } from '@/shared/components/dialogs/modals/contexts/modal-layer-context'
import { useModalLayers } from '@/shared/hooks/use-modal-layers'

interface Props {
  layer: ModalLayer
}

function ModalLayerViewImpl({ layer }: Props) {
  const { id, isOpen, Component, props } = layer
  const value = useMemo(() => ({ isOpen, close: () => useModalLayers.getState().close(id) }), [id, isOpen])

  return (
    <ModalLayerContext value={value}>
      <Component {...props} />
    </ModalLayerContext>
  )
}

// The stack keeps unchanged layers as the same objects, so a push or a close above re-renders only the layers it touched.
export const ModalLayerView = memo(ModalLayerViewImpl)
