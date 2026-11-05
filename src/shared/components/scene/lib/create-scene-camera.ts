import type { StoreApi } from 'zustand/vanilla'
import type { SceneCameraState } from '@/shared/components/scene/types'

import { createSceneInputs } from '@/shared/components/scene/lib/create-scene-inputs'

export function createSceneCamera(): StoreApi<SceneCameraState> {
  return createSceneInputs<SceneCameraState>({ moved: false, recenters: 0, tapMark: null })
}

export function recenterCamera(store: StoreApi<SceneCameraState>) {
  store.setState(state => ({ moved: false, recenters: state.recenters + 1 }))
}
