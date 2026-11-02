'use client'

import type { AnimationClip, Group, Material } from 'three'

import { use, useEffect, useMemo } from 'react'
import { Mesh } from 'three'
import { clone } from 'three/examples/jsm/utils/SkeletonUtils.js'

import { loadGltfAsset } from '@/shared/components/scene/lib/load-gltf-asset'

export interface GltfAsset {
  scene: Group
  animations: AnimationClip[]
  // The clone's own materials, listed so they can be recoloured and disposed whatever is on the meshes at the time.
  materials: Material[]
}

// The loader caches by URL, so two residents sharing one model (or a remount) share the cached geometry and textures.
// Each use therefore gets its own clone of the scene with its own materials: it can be recoloured and disposed
// without touching anyone else, and only those cloned materials are disposed on unmount. Geometry and textures
// stay with the cache. Null means the model could not load.
export function useGltfAsset(url: string): GltfAsset | null {
  const loaded = use(loadGltfAsset(url))

  const owned = useMemo(() => {
    if (!loaded) {
      return null
    }
    const scene = clone(loaded.scene) as Group
    const materials: Material[] = []
    scene.traverse((object) => {
      if (object instanceof Mesh) {
        const own = Array.isArray(object.material) ? object.material.map(m => m.clone()) : object.material.clone()
        materials.push(...(Array.isArray(own) ? own : [own]))
        object.material = own
      }
    })
    return { scene, animations: loaded.animations, materials }
  }, [loaded])

  useEffect(() => () => {
    owned?.materials.forEach(material => material.dispose())
  }, [owned])

  return owned
}
