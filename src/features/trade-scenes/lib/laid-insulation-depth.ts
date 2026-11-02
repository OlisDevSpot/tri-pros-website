import { HOUSE, INSULATION_DEPTH, LOW_SLOPE } from '@/features/trade-scenes/constants/home-geometry'

// How deep the attic insulation lies, in metres; under a flat roof it must fit the joist space with an air gap above.
export function laidInsulationDepth(material: string | null, lowSlope: boolean): number {
  if (material === null) {
    return 0
  }
  const laid = INSULATION_DEPTH[material] ?? HOUSE.joistDepth
  return lowSlope ? Math.min(laid, LOW_SLOPE.joistSpace - 0.03) : laid
}
