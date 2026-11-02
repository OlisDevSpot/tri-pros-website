import type { StoreApi } from 'zustand/vanilla'
import type { SceneLoadPhase, SceneLoadState } from '@/features/trade-scenes/types'

import { SCENE_LOAD_PHASES } from '@/features/trade-scenes/constants/scene-load'
import { createSceneInputs } from '@/shared/components/scene/lib/create-scene-inputs'

export function createSceneLoad(): StoreApi<SceneLoadState> {
  return createSceneInputs<SceneLoadState>({ phase: 'paper', ready: false })
}

export function advanceSceneLoad(store: StoreApi<SceneLoadState>, to: SceneLoadPhase) {
  if (SCENE_LOAD_PHASES.indexOf(to) > SCENE_LOAD_PHASES.indexOf(store.getState().phase)) {
    store.setState({ phase: to })
  }
}

export function finishDrawIn(store: StoreApi<SceneLoadState>) {
  advanceSceneLoad(store, 'waiting')
  if (store.getState().ready) {
    advanceSceneLoad(store, 'handover')
  }
}

export function markSceneReady(store: StoreApi<SceneLoadState>) {
  store.setState({ ready: true })
  if (store.getState().phase === 'waiting') {
    advanceSceneLoad(store, 'handover')
  }
}
