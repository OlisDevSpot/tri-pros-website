import type { SurfaceTexture, SystemLit } from '@/features/trade-scenes/types'

import { STUCCO_TEXTURE } from '@/features/trade-scenes/constants/material-textures'
import { WEAR_LOOKS } from '@/features/trade-scenes/constants/wear-looks'
import { systemPartTag } from '@/features/trade-scenes/lib/system-part-tag'

type SystemPartTag = ReturnType<typeof systemPartTag>

interface WallSkinLook {
  bare: boolean
  color: string
  // Plaster under `color`, which stays the paint (or the bare coat) it is tinted by; undefined on a siding home.
  texture: SurfaceTexture | undefined
  tag: SystemPartTag
  finish: SystemPartTag
  // The peeling's bare patches, in a colour apart from the skin's own so they read on it.
  peeled: string
}

// Every body surface the paint coats (the walls, the gables, the parapets, the raised foundation's skirt, the garage) is the
// wall's skin, and its finish and its paint share that one face: with the finish picked up close it shows its bare base coat
// under the finish's tag, otherwise the paint's colour under the paint's. The paint's wear marks are the finish's story, so
// they go under `finish`, lit on the bare coat and dimmed under a Paint pick.
export function wallSkinLook(lit: SystemLit | null, paintColor: string, stucco: boolean): WallSkinLook {
  const texture = stucco ? STUCCO_TEXTURE : undefined
  const { bareStucco, bareOnCoat } = WEAR_LOOKS.paint.peeling
  const finish = systemPartTag(lit?.shown.has('siding') ? 'siding' : 'stucco')
  const bare = lit?.system === 'walls' && lit.emphasized === finish.scenePart
  return bare
    ? { bare, color: bareStucco, texture, tag: finish, finish, peeled: bareOnCoat }
    : { bare, color: paintColor, texture, tag: systemPartTag('paint'), finish, peeled: bareStucco }
}
