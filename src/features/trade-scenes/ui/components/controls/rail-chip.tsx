'use client'

import { Toolbar } from 'radix-ui'

import { CONTROLS_CLASSES } from '@/features/trade-scenes/constants/controls-classes'
import { CONTROLS_COPY } from '@/features/trade-scenes/constants/home-scene-copy'

interface RailChipProps {
  // A system or a yard; focus finds the chip again by it.
  id: string
  label: string
  // The build changes what the chip stands for.
  changed: boolean
  pressed: boolean
  onPress: () => void
}

// One chip on the Areas rail, for a system or a yard alike.
export function RailChip({ id, label, changed, pressed, onPress }: RailChipProps) {
  return (
    <Toolbar.Button
      data-rail-chip={id}
      // The dot is drawn only; the name says it.
      aria-label={changed ? CONTROLS_COPY.systems.changedByBuild(label) : undefined}
      aria-pressed={pressed}
      onClick={onPress}
      className={CONTROLS_CLASSES.railChip}
    >
      {changed && <span aria-hidden data-build-dot className="size-1.5 shrink-0 rounded-full bg-primary" />}
      {label}
    </Toolbar.Button>
  )
}
