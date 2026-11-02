import type { AnimationClip, Group } from 'three'

import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'

export interface LoadedGltf {
  scene: Group
  animations: AnimationClip[]
}

interface Entry {
  promise: Promise<LoadedGltf | null>
  failed: boolean
}

const entries = new Map<string, Entry>()
let listening = false

// useLoader would cache a rejected promise forever; a model that failed while offline must get another try on reconnect.
function evictFailedOnReconnect() {
  if (listening || typeof window === 'undefined') {
    return
  }
  listening = true
  window.addEventListener('online', () => {
    entries.forEach((entry, url) => {
      if (entry.failed) {
        entries.delete(url)
      }
    })
  })
}

// A failed load resolves to null instead of rejecting: R3F reports every error a boundary catches inside the canvas
// as an uncaught window error, and a missing model is an expected case, not an exception.
export function loadGltfAsset(url: string): Promise<LoadedGltf | null> {
  evictFailedOnReconnect()
  const cached = entries.get(url)
  if (cached) {
    return cached.promise
  }
  const loader = new GLTFLoader()
  loader.setMeshoptDecoder(MeshoptDecoder)
  const entry: Entry = {
    promise: loader.loadAsync(url).then(gltf => ({ scene: gltf.scene, animations: gltf.animations }) as LoadedGltf | null).catch(() => null),
    failed: false,
  }
  void entry.promise.then((loaded) => {
    entry.failed = loaded === null
  })
  entries.set(url, entry)
  return entry.promise
}
