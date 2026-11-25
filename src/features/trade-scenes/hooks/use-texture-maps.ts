'use client'

import type { Texture } from 'three'
import type { TextureBinding } from '@/features/trade-scenes/lib/texture-binding'
import type { TextureMapChoice, TextureSetId } from '@/features/trade-scenes/types'
import type { TextureStore } from '@/features/trade-scenes/ui/lib/texture-store'

import { useThree } from '@react-three/fiber'
import { useEffect, useLayoutEffect, useReducer, useState } from 'react'

import { TEXTURE_SETS } from '@/features/trade-scenes/constants/material-textures'
import { useTextureStore } from '@/features/trade-scenes/contexts/texture-store-context'
import { nextTextureBinding } from '@/features/trade-scenes/lib/texture-binding'
import { textureMapUrls } from '@/features/trade-scenes/lib/texture-map-urls'
import { TEXTURE_PLACEHOLDERS } from '@/features/trade-scenes/ui/lib/texture-placeholders'

interface TextureMaps {
  map: Texture
  normalMap: Texture
  roughnessMap: Texture
  ready: boolean
}

interface BoundUrls {
  color: string
  normal: string
  roughness: string
  tileMetres: number
}

interface Shown {
  binding: TextureBinding
  urls: BoundUrls | null
}

function noChange(): void {}

const prefetched = new Set<string>()

function urlsOf(set: TextureSetId, map: TextureMapChoice): BoundUrls & { sibling: string | null } {
  return { ...textureMapUrls(set, map), tileMetres: TEXTURE_SETS[set].tileMetres }
}

function hold(store: TextureStore, { color, normal, roughness, tileMetres }: BoundUrls, onChange: () => void): () => void {
  const releases = [color, normal, roughness].map(url => store.acquire({ url, tileMetres }, onChange))
  return () => releases.forEach(release => release())
}

function mapsOf(store: TextureStore, { color, normal, roughness }: BoundUrls): readonly [Texture, Texture, Texture] | null {
  const map = store.get(color)
  const normalMap = store.get(normal)
  const roughnessMap = store.get(roughness)
  return map && normalMap && roughnessMap ? [map, normalMap, roughnessMap] : null
}

// Binds a set's maps to one material. Nothing loads until `enabled` has been true once (a system first opened), and from
// then on the maps stay held. A new pick keeps the shown maps bound until all of the new ones have arrived, so a blend change
// never flashes flat colour; until anything has arrived, the 1×1 placeholders keep the material's program as it will be.
export function useTextureMaps(set: TextureSetId, map: TextureMapChoice, enabled: boolean): TextureMaps {
  const gl = useThree(state => state.gl)
  const store = useTextureStore()
  const [opened, setOpened] = useState(enabled)
  if (enabled && !opened) {
    setOpened(true)
  }
  const [, arrived] = useReducer((count: number) => count + 1, 0)
  const { color, normal, roughness, tileMetres, sibling } = urlsOf(set, map)

  // Taken in the commit, so a map lingering after its last release is held again before its linger can run out.
  useLayoutEffect(() => {
    if (!opened || store === null) {
      return
    }
    return hold(store, { color, normal, roughness, tileMetres }, arrived)
  }, [opened, store, color, normal, roughness, tileMetres])

  const wantedReady = opened && store !== null && mapsOf(store, { color, normal, roughness, tileMetres }) !== null
  const [shown, setShown] = useState<Shown>({ binding: { shown: null, wanted: color }, urls: null })
  const next = nextTextureBinding(shown.binding, color, wantedReady)
  if (next.state.shown !== shown.binding.shown || next.state.wanted !== shown.binding.wanted) {
    setShown({ binding: next.state, urls: next.state.shown === shown.binding.shown ? shown.urls : { color, normal, roughness, tileMetres } })
  }

  // The bound maps hold themselves, so a pick moving on cannot free them from under the material; a new binding's release
  // is this hold's cleanup. Uploading here keeps a late arrival from stalling the frame that first draws it.
  const bound = shown.urls
  useLayoutEffect(() => {
    if (bound === null || store === null) {
      return
    }
    mapsOf(store, bound)?.forEach(texture => gl.initTexture(texture))
    return hold(store, bound, noChange)
  }, [bound, store, gl])

  // The other of an own/grey pair sits in the HTTP cache for a live colour pick; it is transcoded only once it is bound.
  useEffect(() => {
    if (!wantedReady || sibling === null || prefetched.has(sibling)) {
      return
    }
    prefetched.add(sibling)
    fetch(sibling, { priority: 'low' }).then(response => response.arrayBuffer()).catch(() => prefetched.delete(sibling))
  }, [wantedReady, sibling])

  const maps = bound === null || store === null ? null : mapsOf(store, bound)
  return maps === null
    ? { ...TEXTURE_PLACEHOLDERS, ready: false }
    : { map: maps[0], normalMap: maps[1], roughnessMap: maps[2], ready: true }
}

// Holds sets' maps without binding them, so a surface about to show (the other layer of a Today ⇄ Build toggle) finds them
// already there.
export function useTextureHold(requests: readonly { set: TextureSetId, map: TextureMapChoice }[]): void {
  const store = useTextureStore()
  const held = requests.map(({ set, map }) => urlsOf(set, map))
  const key = held.map(({ color, tileMetres }) => `${color}@${tileMetres}`).join(' ')
  useEffect(() => {
    if (store === null) {
      return
    }
    const releases = held.map(urls => hold(store, urls, noChange))
    return () => releases.forEach(release => release())
    // Keyed on the urls, so a caller's inline list does not release and reacquire every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, store])
}
