// Three's sRGB decode, so the ratio is taken in the linear light a shader multiplies in.
const linear = (channel: number) => channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4

const channels = (hex: string) => [0, 2, 4].map(at => linear(Number.parseInt(hex.slice(1 + at, 3 + at), 16) / 255))

// The per-channel factor that turns `fresh` into `worn`, for a texture in its own colours: at the material's mean colour it
// reproduces the flat wear shift, lightening included, so a channel may run past 1. A black channel has nothing to scale.
export function wearShift(fresh: string, worn: string): readonly [number, number, number] {
  const from = channels(fresh)
  const to = channels(worn)
  const [r, g, b] = from.map((channel, i) => channel === 0 ? 1 : to[i] / channel)
  return [r, g, b]
}
