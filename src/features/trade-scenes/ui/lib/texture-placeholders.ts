import { DataTexture, SRGBColorSpace } from 'three'

function pixel(r: number, g: number, b: number): DataTexture {
  const texture = new DataTexture(new Uint8Array([r, g, b, 255]), 1, 1)
  texture.needsUpdate = true
  return texture
}

// Bound until a surface's maps arrive, so its program never changes when they do: a white map, a flat normal and full
// roughness leave the flat colour exactly as it was.
const map = pixel(255, 255, 255)
map.colorSpace = SRGBColorSpace

export const TEXTURE_PLACEHOLDERS = {
  map,
  normalMap: pixel(128, 128, 255),
  roughnessMap: pixel(255, 255, 255),
} as const
