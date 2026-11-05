'use client'

import type { SceneChangeSlot } from '@/features/trade-scenes/types'

import { CONTROLS_COPY, PROFILE_COPY } from '@/features/trade-scenes/constants/home-scene-copy'
import { ControlsChip } from '@/features/trade-scenes/ui/components/controls/controls-chip'
import { ValueMenu } from '@/features/trade-scenes/ui/components/controls/value-menu'

interface MissingChipProps {
  slot: SceneChangeSlot
  onPick: (value: string) => void
  afterPick?: () => void
}

// A missing fact, opening the same menu it opens everywhere else. A fact the rep may not know shows Not sure checked, as
// it is while missing. Not sure is the value already held, and the menu sends no pick for the value it holds, so it never
// writes.
export function MissingChip({ slot, onPick, afterPick }: MissingChipProps) {
  return (
    <ValueMenu
      label={slot.name}
      options={slot.offersNotSure ? [...slot.options, { value: '', label: PROFILE_COPY.unknown }] : slot.options}
      value={slot.offersNotSure ? '' : null}
      onPick={onPick}
      afterPick={afterPick}
      trigger={(
        <ControlsChip data-missing-chip={slot.id} variant="miss" keyLabel={slot.name} caret>
          {CONTROLS_COPY.facts.missing}
        </ControlsChip>
      )}
    />
  )
}
