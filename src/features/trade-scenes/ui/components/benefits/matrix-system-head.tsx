'use client'

import type { MouseEvent } from 'react'
import type { HomeSystemId } from '@/features/trade-scenes/types'

import { CONTROLS_CLASSES } from '@/features/trade-scenes/constants/controls-classes'
import { BENEFITS_COPY, HOME_SYSTEM_LABELS } from '@/features/trade-scenes/constants/home-scene-copy'
import { cn } from '@/shared/lib/utils'

interface MatrixSystemHeadProps {
  system: HomeSystemId
  // The picked upgrades' names, in the Upgrades list's order.
  upgrades: string[]
  // How many benefits the row holds, as its name reads it.
  count: string
  pressed: boolean
  disabled: boolean
  portrait: boolean
  onPick: (event: MouseEvent<HTMLButtonElement>) => void
}

// The phone's column has room for the name alone, on up to two lines.
export function MatrixSystemHead({ system, upgrades, count, pressed, disabled, portrait, onPick }: MatrixSystemHeadProps) {
  const { matrix } = BENEFITS_COPY
  const label = HOME_SYSTEM_LABELS[system]

  return (
    <button
      type="button"
      data-matrix-system={system}
      aria-pressed={pressed}
      aria-label={matrix.headName(label, disabled ? matrix.noChange : count)}
      disabled={disabled}
      onClick={onPick}
      className={cn(CONTROLS_CLASSES.matrixHead, 'grid h-11 min-w-0 content-center gap-px text-left', portrait ? 'pr-0 pl-0.5' : 'px-2')}
    >
      {/* Tightened on the phone so the longest name, Foundation, fits the column the cells' 40 px floor leaves. */}
      <span className={cn('leading-tight font-bold', portrait ? 'line-clamp-2 text-xs tracking-tight' : 'truncate text-sm', disabled && 'text-muted-foreground')}>{label}</span>
      {!portrait && (
        <span data-matrix-upgrades className="truncate text-xs leading-tight text-muted-foreground">
          {upgrades.length > 0 ? upgrades.join(matrix.upgradesJoin) : matrix.noChange}
        </span>
      )}
    </button>
  )
}
