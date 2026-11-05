import type { HomeSystemId, SceneTargets, SystemPart, SystemPartId, SystemPartRow, SystemPartStory } from '@/features/trade-scenes/types'
import type { AssemblyId } from '@/shared/modules/construction/core/constants/assembly-ids'
import type { ResolvedPart } from '@/shared/modules/construction/core/types'

import { SYSTEM_PART_LABELS } from '@/features/trade-scenes/constants/home-scene-copy'
import { SYSTEM_PARTS } from '@/features/trade-scenes/constants/system-parts'

export interface SystemStory {
  leak: boolean
  airGaps: boolean
}

const STORY_KEY = { 'leak': 'leak', 'air-gaps': 'airGaps' } as const satisfies Record<SystemPartStory, keyof SystemStory>

export function systemStory(targets: SceneTargets): SystemStory {
  const airSealing = targets.assemblies['roof-attic']?.parts.find(part => part.id === 'air-sealing')
  return { leak: targets.leak.reachesInside > 0, airGaps: airSealing?.condition === 'absent' }
}

// A shared system part is drawn in each of its systems, so it shows in one only while the story it tells there holds.
export function systemPartsShown(system: HomeSystemId, parts: Readonly<Partial<Record<AssemblyId, readonly ResolvedPart[]>>>, story: SystemStory): SystemPart[] {
  return (SYSTEM_PARTS as readonly SystemPart<string>[]).filter((entry) => {
    if (!entry.systems.includes(system))
      return false
    const resolved = parts[entry.assembly]?.find(part => part.id === entry.part)
    if (resolved === undefined || resolved.condition === 'absent')
      return false
    const told = entry.story?.[system]
    if (told !== undefined)
      return story[STORY_KEY[told]]
    return entry.drawnFor === undefined || entry.drawnFor(resolved)
  }) as SystemPart[]
}

const PIECE_LABELS: Partial<Record<SystemPartId, string>> = SYSTEM_PART_LABELS

// A shown system part as its system's list and pins name it: a whole part as it resolved, a piece by its own label, on
// the condition of the part it is drawn on, with no detail of its own.
export function systemPartRows(system: HomeSystemId, targets: SceneTargets): SystemPartRow[] {
  const parts = Object.fromEntries(Object.entries(targets.assemblies).map(([id, assembly]) => [id, assembly.parts]))
  return systemPartsShown(system, parts, systemStory(targets)).map((entry) => {
    const resolved = targets.assemblies[entry.assembly]!.parts.find(part => part.id === entry.part)!
    const label = PIECE_LABELS[entry.id]
    return label === undefined ? { ...resolved, id: entry.id } : { ...resolved, id: entry.id, label, detail: '' }
  })
}
