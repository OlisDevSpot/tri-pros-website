import { HUNG_DUCT_MATERIALS } from '@/features/trade-scenes/constants/home-details'

const HUNG: readonly (string | null)[] = HUNG_DUCT_MATERIALS

// Whether the ducts are ones put in to current code.
export function hungDuctMaterial(material: string | null): boolean {
  return HUNG.includes(material)
}

// Under a flat roof every duct lies in the joist space; there is nothing to hang it from.
export function ductsHang(material: string | null, lowSlope: boolean): boolean {
  return !lowSlope && hungDuctMaterial(material)
}
