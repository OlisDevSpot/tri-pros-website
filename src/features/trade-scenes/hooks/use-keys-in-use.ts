'use client'

import { useSyncExternalStore } from 'react'

// Set by the first key the stage handles and never cleared, so the keycaps stay for the rest of the page's life.
let inUse = false
const listeners = new Set<() => void>()

function subscribe(listener: () => void) {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

function readInUse(): boolean {
  return inUse
}

function markInUse() {
  if (inUse) {
    return
  }
  inUse = true
  for (const listener of listeners) {
    listener()
  }
}

export function useKeysInUse(): [inUse: boolean, markInUse: () => void] {
  return [useSyncExternalStore(subscribe, readInUse, () => false), markInUse]
}
