'use client'

import type { TradeSceneInputs } from '@/features/trade-scenes/types'

import { ArrowLeftRightIcon } from 'lucide-react'
import { useReducedMotion } from 'motion/react'
import { Toolbar } from 'radix-ui'

import { BUILD_SWITCH_COPY, CONTROLS_COPY } from '@/features/trade-scenes/constants/home-scene-copy'
import { CONTROLS_EASE_CSS } from '@/features/trade-scenes/constants/scene-layout'
import { SCENE_SHORTCUT_KEYS } from '@/features/trade-scenes/constants/scene-shortcuts'
import { useSceneControls } from '@/features/trade-scenes/contexts/scene-controls-context'
import { useSceneVisibleArea } from '@/features/trade-scenes/contexts/scene-visible-area-context'
import { keycapLabel } from '@/features/trade-scenes/lib/keycap-label'
import { Keycap } from '@/features/trade-scenes/ui/components/keycap'
import { useSceneInputs } from '@/shared/components/scene/contexts/scene-inputs-context'
import { cn } from '@/shared/lib/utils'

// One button for both sides. The two names share one grid cell, so it is as wide as the longer and never changes size
// when it flips: nothing beside it in the group moves.
export function BuildToggle() {
  const view = useSceneInputs((state: TradeSceneInputs) => state.view)
  const { flip } = useSceneControls()
  const { shape } = useSceneVisibleArea()
  const reduceMotion = useReducedMotion()
  const proposed = view === 'proposed'
  const ease = (ms: number) => (reduceMotion ? '0ms' : `${ms}ms ${CONTROLS_EASE_CSS}`)

  return (
    <Toolbar.Button
      data-build-toggle
      aria-pressed={proposed}
      aria-label={CONTROLS_COPY.toggleName(proposed)}
      aria-keyshortcuts={SCENE_SHORTCUT_KEYS.build}
      onClick={flip}
      style={{ transition: `background-color ${ease(220)}, color ${ease(220)}, box-shadow ${ease(220)}` }}
      className={cn(
        'relative inline-flex h-11 shrink-0 cursor-pointer items-center rounded-full text-sm font-bold whitespace-nowrap outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50 [&_svg]:size-4',
        shape === 'portrait' ? 'gap-1.5 pr-3 pl-2.5' : 'gap-2 pr-4 pl-3',
        proposed
          ? 'bg-primary text-primary-foreground hover:bg-primary-hover pressed:brightness-85'
          : 'bg-muted text-foreground inset-ring inset-ring-border-strong hover:bg-secondary-hover pressed:bg-press',
      )}
    >
      <span className={cn('inline-flex', proposed && 'rotate-180')} style={{ transition: `transform ${ease(350)}` }}>
        <ArrowLeftRightIcon aria-hidden />
      </span>
      <span className="grid">
        {(['existing', 'proposed'] as const).map(side => (
          <span
            key={side}
            style={{ transition: `opacity ${ease(180)}, transform ${ease(280)}` }}
            className={cn('col-start-1 row-start-1', side === view ? 'opacity-100' : 'translate-y-1.75 opacity-0')}
          >
            {BUILD_SWITCH_COPY.compact[side]}
          </span>
        ))}
      </span>
      {/* Raised off the pill's curve into the group's padding, so the cap never sits on the name. */}
      <Keycap keyLabel={keycapLabel(SCENE_SHORTCUT_KEYS.build)} className="-top-1.5 -right-1" />
    </Toolbar.Button>
  )
}
