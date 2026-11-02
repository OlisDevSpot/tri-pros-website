'use client'

import type { TradeSceneInputs } from '@/features/trade-scenes/types'

import { Fragment } from 'react'

import { HOME_PROFILE_CHOICES } from '@/features/trade-scenes/constants/home-profile-choices'
import { CONTROLS_COPY, HOME_MATERIAL_LABELS, YEAR_BUILT_LABELS } from '@/features/trade-scenes/constants/home-scene-copy'
import { useSceneVisibleArea } from '@/features/trade-scenes/contexts/scene-visible-area-context'
import { useApplySceneChange } from '@/features/trade-scenes/hooks/use-apply-scene-change'
import { useSceneTargets } from '@/features/trade-scenes/hooks/use-scene-targets'
import { eraCodeLine } from '@/features/trade-scenes/lib/era-code-line'
import { fromChoice, toChoice } from '@/features/trade-scenes/lib/profile-choice'
import { ChoicePill } from '@/features/trade-scenes/ui/components/controls/choice-pill'
import { useSceneInputs } from '@/shared/components/scene/contexts/scene-inputs-context'
import { toneClasses } from '@/shared/constants/status-tones'
import { cn } from '@/shared/lib/utils'

// The year sets today's materials from the era's code; a material set by hand keeps its pick, and the line says which,
// with Use code to put them back.
export function YearBuiltCardBody() {
  const property = useSceneInputs((state: TradeSceneInputs) => state.property)
  const home = useSceneTargets().home
  const applyChange = useApplySceneChange()
  const { shape } = useSceneVisibleArea()
  const { era, guessed, codes, kept } = eraCodeLine({ property, home })
  const { options, labels } = HOME_PROFILE_CHOICES.yearBuilt

  return (
    // On the phone the pill wraps to two rows, which a full radius would turn into a lozenge.
    <div className={cn('grid gap-2.5 rounded-xl border border-border bg-input-background p-3', shape === 'portrait' && '*:data-[slot=toggle-group]:rounded-[18px]')}>
      <ChoicePill
        label={CONTROLS_COPY.systems.yearBuilt}
        value={toChoice(property.yearBuilt)}
        options={options}
        labels={labels}
        onChange={choice => applyChange({ kind: 'property', patch: { yearBuilt: fromChoice(choice) } })}
      />
      <p data-era-line className="flex flex-wrap items-center gap-x-2.5 gap-y-1.5 text-xs text-muted-foreground">
        <span>
          {CONTROLS_COPY.systems.eraLine(YEAR_BUILT_LABELS[era], guessed)}
          {' '}
          {codes.map((code, index) => (
            <Fragment key={code}>
              {index > 0 && CONTROLS_COPY.systems.valueJoin}
              <b className="font-bold text-foreground">{code}</b>
            </Fragment>
          ))}
        </span>
        {kept.length > 0 && (
          <>
            <span data-era-kept className={cn('font-bold', toneClasses('attention').text)}>
              {CONTROLS_COPY.systems.kept(kept.map(id => HOME_MATERIAL_LABELS[id]).join(CONTROLS_COPY.systems.keptJoin), kept.length)}
            </span>
            <button
              type="button"
              onClick={() => applyChange({ kind: 'era-code' })}
              // The 32 px line reaches 40 past its edge, so the link keeps its target without opening the line up.
              className="relative cursor-pointer rounded-md px-1 py-2 font-bold text-primary outline-none after:absolute after:inset-x-0 after:-inset-y-1 hover:underline hover:underline-offset-2 focus-visible:ring-[3px] focus-visible:ring-ring/50"
            >
              {CONTROLS_COPY.systems.useCode}
            </button>
          </>
        )}
      </p>
    </div>
  )
}
