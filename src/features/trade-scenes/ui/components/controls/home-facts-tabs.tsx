'use client'

import type { TradeSceneInputs } from '@/features/trade-scenes/types'

import { Fragment } from 'react'
import { useShallow } from 'zustand/react/shallow'

import { FACTS_TABS } from '@/features/trade-scenes/constants/facts-tabs'
import { CONTROLS_COPY } from '@/features/trade-scenes/constants/home-scene-copy'
import { UNDERLINE_TAB_TRIGGER_CLASS } from '@/features/trade-scenes/constants/panel-layout'
import { FACTS_TAB_ICONS } from '@/features/trade-scenes/constants/scene-control-icons'
import { useSceneVisibleArea } from '@/features/trade-scenes/contexts/scene-visible-area-context'
import { HOME_FACTS, missingFacts } from '@/features/trade-scenes/lib/missing-facts'
import { useSceneInputs } from '@/shared/components/scene/contexts/scene-inputs-context'
import { TabsList, TabsTrigger } from '@/shared/components/ui/tabs'
import { toneClasses } from '@/shared/constants/status-tones'
import { cn } from '@/shared/lib/utils'

// Beside the title on landscape, centred on its line. A narrow stage has no room for them there once every count
// shows, so there, as on portrait, they take a row of their own at the top of the body; portrait drops their icons.
// A tab that holds no facts yet is coming, and says so in place of a count.
export function HomeFactsTabs() {
  const { shape } = useSceneVisibleArea()
  const missing = useSceneInputs(useShallow((state: TradeSceneInputs) => missingFacts(state)))
  const portrait = shape === 'portrait'
  const inHead = shape === 'landscape'
  const attention = toneClasses('attention')

  return (
    <TabsList
      variant="underline"
      aria-label={CONTROLS_COPY.sections.facts}
      className={inHead ? 'ml-4.5 w-auto gap-5.5 self-center border-b-0' : cn('mt-1.5 shrink-0', portrait ? 'gap-0' : 'gap-5.5')}
    >
      {FACTS_TABS.map((tab, index) => {
        const Icon = FACTS_TAB_ICONS[tab]
        const name = CONTROLS_COPY.facts.tabs[tab]
        const soon = !HOME_FACTS.some(fact => fact.tab === tab)
        const count = HOME_FACTS.filter(fact => fact.tab === tab && missing.includes(fact.id)).length
        return (
          <Fragment key={tab}>
            {/* Portrait steps 12 apart rather than 16, so a 390 phone fits all four with every count showing; a narrower
                phone closes the steps rather than wrap the row or run it past the window. */}
            {portrait && index > 0 && <span aria-hidden data-tab-step className="w-3 min-w-1.5 shrink" />}
            <TabsTrigger
              value={tab}
              aria-label={soon ? CONTROLS_COPY.facts.soonName(name) : CONTROLS_COPY.facts.tabName(name, count)}
              // In the head, the top padding matches the underline's 2 px, so the label sits on the title's line. Portrait's
              // Lot, a short name and a dot, is held to the 40 px floor.
              className={cn(UNDERLINE_TAB_TRIGGER_CLASS, inHead && 'mb-0 min-h-10.5 pt-0.5', portrait && 'min-w-10')}
            >
              {!portrait && <Icon aria-hidden />}
              <span data-tab-label>{name}</span>
              {soon
                ? (
                    <span
                      aria-hidden
                      className={cn(
                        'rounded-full border border-dashed border-muted-foreground text-muted-foreground',
                        portrait ? 'size-1.75' : 'px-1.25 text-xs leading-3.75 font-bold tracking-[.06em] uppercase',
                      )}
                    >
                      {!portrait && CONTROLS_COPY.facts.soon}
                    </span>
                  )
                : count > 0 && (
                  <span aria-hidden className={cn('inline-grid h-4.5 min-w-4.5 place-items-center rounded-full px-1.25 text-xs font-bold', attention.wash, attention.text)}>
                    {count}
                  </span>
                )}
            </TabsTrigger>
          </Fragment>
        )
      })}
    </TabsList>
  )
}
