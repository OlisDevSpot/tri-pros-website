import type { SystemPartId } from '@/features/trade-scenes/types'

const TAGS = new Map<SystemPartId, Readonly<{ scenePart: SystemPartId }>>()

// The `userData` of a group whose meshes draw one system part. A group's userData is one object, so this always goes on a
// group of its own, never merged into a thermal or fade tag. Cached, so a re-render hands R3F the same object.
export function systemPartTag(id: SystemPartId): Readonly<{ scenePart: SystemPartId }> {
  let tag = TAGS.get(id)
  if (!tag) {
    tag = Object.freeze({ scenePart: id })
    TAGS.set(id, tag)
  }
  return tag
}
