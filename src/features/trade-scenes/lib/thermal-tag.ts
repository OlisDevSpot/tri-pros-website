import type { HomeThermalZone, OWN_PAINT } from '@/features/trade-scenes/constants/home-thermal-zones'

export interface ThermalTagData {
  thermalZone?: HomeThermalZone | typeof OWN_PAINT
  thermalPart?: string
}

const TAGS = new Map<string, Readonly<ThermalTagData>>()

// The `userData` a group (never a mesh: the ghost writes to a mesh's own userData, and this object is shared) carries for
// the thermal camera. Cached, so a re-render hands R3F the same object and it never rewrites the group's userData.
export function thermalTag(zone: HomeThermalZone | typeof OWN_PAINT | null, part: string | null = null): Readonly<ThermalTagData> {
  const key = `${zone ?? ''}|${part ?? ''}`
  let tag = TAGS.get(key)
  if (!tag) {
    tag = { ...(zone ? { thermalZone: zone } : {}), ...(part ? { thermalPart: part } : {}) }
    TAGS.set(key, tag)
  }
  return tag
}
