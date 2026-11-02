'use client'

import type { TradeSceneInputs } from '@/features/trade-scenes/types'

import { useReducedMotion } from 'motion/react'
import { Toolbar } from 'radix-ui'

import { CONTROLS_COPY } from '@/features/trade-scenes/constants/home-scene-copy'
import { CONTROLS_SECTION_ICONS } from '@/features/trade-scenes/constants/scene-control-icons'
import { CONTROLS_EASE_CSS, SCENE_LAYOUT } from '@/features/trade-scenes/constants/scene-layout'
import { SCENE_SHORTCUT_KEYS } from '@/features/trade-scenes/constants/scene-shortcuts'
import { useSceneLoad } from '@/features/trade-scenes/contexts/scene-load-context'
import { useSceneVisibleArea } from '@/features/trade-scenes/contexts/scene-visible-area-context'
import { missingFacts } from '@/features/trade-scenes/lib/missing-facts'
import { BuildToggle } from '@/features/trade-scenes/ui/components/controls/build-toggle'
import { ControlsRecenter } from '@/features/trade-scenes/ui/components/controls/controls-recenter'
import { ControlsSectionButton } from '@/features/trade-scenes/ui/components/controls/controls-section-button'
import { ProposedTint } from '@/features/trade-scenes/ui/components/controls/proposed-tint'
import { useSceneInputs } from '@/shared/components/scene/contexts/scene-inputs-context'
import { toneClasses } from '@/shared/constants/status-tones'
import { cn } from '@/shared/lib/utils'

interface SceneControlsProps {
  // The window the section buttons open.
  windowId: string
  // Systems opens no window but the rail.
  railId: string
}

// Centred on the stage at max-content, so a name opening widens it evenly and a narrow stage never squeezes it into its
// right half. Above the window's layer: the window treats a press here as its own, never a press outside.
export function SceneControls({ windowId, railId }: SceneControlsProps) {
  const { shape } = useSceneVisibleArea()
  const missing = useSceneInputs((state: TradeSceneInputs) => missingFacts(state).length)
  // The stage is inert until the scene is live, so the group only needs to look loading.
  const loading = useSceneLoad(state => state.phase !== 'live')
  const reduceMotion = useReducedMotion()
  const portrait = shape === 'portrait'
  const { groupBottom } = SCENE_LAYOUT.controls
  const divider = !portrait && <Toolbar.Separator className="mx-0.75 h-5.5 w-px shrink-0 bg-border" />

  return (
    <>
      <ProposedTint />
      <Toolbar.Root
        data-scene-controls
        aria-label={CONTROLS_COPY.label}
        style={{ bottom: portrait ? groupBottom.portrait : groupBottom.wide, transition: reduceMotion ? 'none' : `opacity 300ms ${CONTROLS_EASE_CSS}` }}
        className={cn(
          'absolute left-1/2 z-30 flex w-max -translate-x-1/2 items-center gap-0.5 border bg-card p-1.25 shadow-lg',
          portrait ? 'rounded-[26px]' : 'rounded-full',
          loading && 'opacity-60',
        )}
      >
        <ControlsSectionButton section="facts" icon={CONTROLS_SECTION_ICONS.facts} windowId={windowId} label={missing > 0 ? CONTROLS_COPY.factsMissing(missing) : undefined}>
          {missing > 0 && (
            <span aria-hidden data-missing-dot className={cn('pointer-events-none absolute top-2.25 left-6.5 size-2 rounded-full ring-2 ring-card', toneClasses('attention').dot)} />
          )}
        </ControlsSectionButton>
        <ControlsSectionButton section="systems" icon={CONTROLS_SECTION_ICONS.systems} windowId={railId} />
        <ControlsSectionButton section="modify" icon={CONTROLS_SECTION_ICONS.modify} windowId={windowId} keyShortcut={SCENE_SHORTCUT_KEYS.modify} />
        {divider}
        <BuildToggle />
        {divider}
        <ControlsSectionButton section="benefits" icon={CONTROLS_SECTION_ICONS.benefits} windowId={windowId} />
        <ControlsRecenter />
      </Toolbar.Root>
    </>
  )
}
