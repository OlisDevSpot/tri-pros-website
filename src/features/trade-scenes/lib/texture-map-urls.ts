import type { TextureMapChoice, TextureSetId } from '@/features/trade-scenes/types'

import { TEXTURE_SETS } from '@/features/trade-scenes/constants/material-textures'

const TEXTURE_ROOT = '/scenes/textures'

export function textureMapUrls(set: TextureSetId, map: TextureMapChoice) {
  const base = `${TEXTURE_ROOT}/${set}`
  const file = map === 'own' ? 'c' : map === 'grey' ? 'g' : `c-${map.blend}`
  const other = map === 'own' ? 'grey' : map === 'grey' ? 'own' : null
  return {
    color: `${base}/${file}.ktx2`,
    normal: `${base}/n.ktx2`,
    roughness: `${base}/r.ktx2`,
    // A live colour pick flips between own and grey, so the other file is fetched ahead.
    sibling: other !== null && TEXTURE_SETS[set].maps.includes(other) ? `${base}/${other === 'own' ? 'c' : 'g'}.ktx2` : null,
  }
}
