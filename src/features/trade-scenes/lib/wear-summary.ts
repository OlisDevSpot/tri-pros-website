import type { CoveringWear, PaintWear } from '@/features/trade-scenes/types'
import type { PaintWearLevel, RoofType } from '@/shared/modules/construction/core/constants/enums'
import type { ResolvedHomeMaterial } from '@/shared/modules/construction/core/types'

import { COVERING_WEAR_KINDS_BY_ROOF } from '@/features/trade-scenes/constants/covering-wear'
import { COVERING_WEAR_LABELS, PAINT_WEAR_LABELS, PAINT_WEAR_LEVEL_LABELS } from '@/features/trade-scenes/constants/home-scene-copy'
import { coveringWearInForce } from '@/features/trade-scenes/lib/covering-wear-in-force'
import { paintWearInForce } from '@/features/trade-scenes/lib/paint-wear-in-force'
import { wearInForce } from '@/shared/modules/construction/core/lib/resolve-home-materials'

export function wearSummary<K extends string>(levels: Partial<Record<K, PaintWearLevel>>, labels: Record<K, string>): string {
  const set = (Object.keys(labels) as K[]).flatMap((kind) => {
    const level = levels[kind]
    return level && level !== 'none' ? [`${labels[kind]} ${PAINT_WEAR_LEVEL_LABELS[level].toLowerCase()}`] : []
  })
  return set.length === 0 ? PAINT_WEAR_LEVEL_LABELS.none : set.join(' · ')
}

// The levels in force are the ones the fold's fields show, so a poor paint with nothing recorded reads what it starts at. New
// paint and a missing material show no fields, so they have no fold.
export function wearFoldSummary(material: ResolvedHomeMaterial | undefined, recorded: Partial<PaintWear> | Partial<CoveringWear>, kind: 'paint' | 'covering', roofType: RoofType): string | null {
  if (!material || wearInForce(material) === 'new') {
    return null
  }
  if (kind === 'paint') {
    return wearSummary(paintWearInForce(material, recorded as Partial<PaintWear>), PAINT_WEAR_LABELS)
  }
  const levels = coveringWearInForce(material, recorded as Partial<CoveringWear>, roofType)
  const labels = Object.fromEntries(COVERING_WEAR_KINDS_BY_ROOF[roofType].map(coverKind => [coverKind, COVERING_WEAR_LABELS[coverKind]]))
  return wearSummary(levels, labels as Record<keyof CoveringWear, string>)
}
