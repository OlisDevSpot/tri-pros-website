import type { HomeSystemId, SceneTargets, SystemPart, SystemPartId, SystemPartRow, SystemPartStory } from '@/features/trade-scenes/types'
import type { AssemblyId } from '@/shared/modules/construction/core/constants/assembly-ids'
import type { RoofForm } from '@/shared/modules/construction/core/constants/roof-forms'
import type { ResolvedPart } from '@/shared/modules/construction/core/types'

import { SYSTEM_PART_DETAILS, SYSTEM_PART_LABELS } from '@/features/trade-scenes/constants/home-scene-copy'
import { SYSTEM_PARTS } from '@/features/trade-scenes/constants/system-parts'
import { homeRoofForm } from '@/features/trade-scenes/lib/home-roof-form'

interface SystemStory {
  leak: boolean
  airGaps: boolean
  form: RoofForm
}

const STORY_KEY = { 'leak': 'leak', 'air-gaps': 'airGaps' } as const satisfies Record<SystemPartStory, keyof SystemStory>

export function systemStory(targets: SceneTargets): SystemStory {
  const airSealing = targets.assemblies['roof-attic']?.parts.find(part => part.id === 'air-sealing')
  return { leak: targets.leak.reachesInside > 0, airGaps: airSealing?.condition === 'absent', form: homeRoofForm(targets.assemblies['roof-attic']?.form) }
}

// A shared system part is drawn in each of its systems, so it shows in one only while the story it tells there holds.
export function systemPartsShown(system: HomeSystemId, parts: Readonly<Partial<Record<AssemblyId, readonly ResolvedPart[]>>>, story: SystemStory): SystemPart[] {
  return (SYSTEM_PARTS as readonly SystemPart<string>[]).filter((entry) => {
    if (!entry.systems.includes(system))
      return false
    if (entry.roofForms !== undefined && !entry.roofForms.includes(story.form))
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
const PIECE_DETAILS: Partial<Record<SystemPartId, string>> = SYSTEM_PART_DETAILS

// A shown system part as its system's list and pins name it: a whole part as it resolved, a piece by its own label, on
// the condition of the part it is drawn on, with the detail it has of its own.
export function systemPartRows(system: HomeSystemId, targets: SceneTargets): SystemPartRow[] {
  const parts = Object.fromEntries(Object.entries(targets.assemblies).map(([id, assembly]) => [id, assembly.parts]))
  return systemPartsShown(system, parts, systemStory(targets)).map((entry) => {
    const resolved = targets.assemblies[entry.assembly]!.parts.find(part => part.id === entry.part)!
    const label = PIECE_LABELS[entry.id]
    const row = label === undefined ? { ...resolved, id: entry.id } : { ...resolved, id: entry.id, label, detail: PIECE_DETAILS[entry.id] ?? '' }
    return entry.listed === false ? { ...row, listed: false } : row
  })
}
