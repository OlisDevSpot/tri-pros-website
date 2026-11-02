import type { StoreApi } from 'zustand/vanilla'

import { createStore } from 'zustand/vanilla'

export function createSceneInputs<T extends object>(defaults: T): StoreApi<T> {
  return createStore<T>(() => defaults)
}
