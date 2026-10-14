import type { ModalDescriptor } from '@/shared/lib/modal-layers'

import { useModalLayers } from '@/shared/hooks/use-modal-layers'

// A plain function, not a hook: an opener that subscribed to the store re-rendered on every modal open and close.
export function openModal<P>(modal: ModalDescriptor<P>) {
  useModalLayers.getState().push(modal)
}
