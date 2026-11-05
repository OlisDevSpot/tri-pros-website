import type { Object3D } from 'three'
import type { ScenePinRegistry } from '@/shared/components/scene/types'

// Anchors live in a plain map because the projector reads them every frame; only the id list is observable, so React
// re-renders when a pin appears or goes, never while the camera moves.
export function createScenePinRegistry(): ScenePinRegistry {
  const anchors = new Map<string, Object3D>()
  const elements = new Map<string, HTMLElement>()
  const listeners = new Set<() => void>()
  let ids: readonly string[] = []

  function publish() {
    ids = [...anchors.keys()]
    listeners.forEach(listener => listener())
  }

  return {
    anchors,
    elements,
    subscribe(listener) {
      listeners.add(listener)
      return () => {
        listeners.delete(listener)
      }
    },
    getIds: () => ids,
    register(id, node) {
      anchors.set(id, node)
      publish()
    },
    unregister(id, node) {
      // A remounted anchor registers before the old one's cleanup runs; only the owner may remove it.
      if (anchors.get(id) !== node) {
        return
      }
      anchors.delete(id)
      elements.get(id)?.removeAttribute('data-anchored')
      publish()
    },
  }
}
