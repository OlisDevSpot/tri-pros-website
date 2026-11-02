'use client'

import type { SceneChangeSlot } from '@/features/trade-scenes/types'

import { CONTROLS_CLASSES } from '@/features/trade-scenes/constants/controls-classes'
import { CONTROLS_COPY } from '@/features/trade-scenes/constants/home-scene-copy'
import { MissingChip } from '@/features/trade-scenes/ui/components/controls/missing-chip'

interface MissingChipsProps {
  // The missing facts' slots.
  slots: readonly SceneChangeSlot[]
  onPick: (slot: SceneChangeSlot, value: string) => void
  // Any pick, Not sure included, hands focus back to the search.
  afterPick: () => void
}

// An empty search offers what is still missing.
export function MissingChips({ slots, onPick, afterPick }: MissingChipsProps) {
  return (
    <div className="pt-3.5">
      <div data-missing-title className={CONTROLS_CLASSES.groupTitle}>{CONTROLS_COPY.facts.missing}</div>
      <div className="flex flex-wrap items-center gap-1.5">
        {slots.map(slot => <MissingChip key={slot.id} slot={slot} onPick={value => onPick(slot, value)} afterPick={afterPick} />)}
      </div>
    </div>
  )
}
