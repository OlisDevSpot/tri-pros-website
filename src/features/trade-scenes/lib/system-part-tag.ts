import type { SystemPartId, SystemPartTagData } from '@/features/trade-scenes/types'

interface SystemPartTagOptions {
  overFront?: boolean
}

type SystemPartTag = Readonly<SystemPartTagData & { scenePart: SystemPartId }>

const TAGS = new Map<string, SystemPartTag>()

// The `userData` of a group whose meshes draw one system part. A group's userData is one object, so this always goes on a
// group of its own, never merged into a thermal or fade tag. Cached, so a re-render hands R3F the same object.
export function systemPartTag(id: SystemPartId, { overFront = false }: SystemPartTagOptions = {}): SystemPartTag {
  const key = overFront ? `${id} over-front` : id
  let tag = TAGS.get(key)
  if (!tag) {
    tag = Object.freeze(overFront ? { scenePart: id, overFront: true as const } : { scenePart: id })
    TAGS.set(key, tag)
  }
  return tag
}
