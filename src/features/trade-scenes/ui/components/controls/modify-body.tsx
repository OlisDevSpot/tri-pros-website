'use client'

import type { RefObject } from 'react'
import type { AppliedSceneChange, SceneChangeSlot, TradeSceneInputs } from '@/features/trade-scenes/types'

import { useState } from 'react'

import { CONTROLS_CLASSES } from '@/features/trade-scenes/constants/controls-classes'
import { CONTROLS_COPY } from '@/features/trade-scenes/constants/home-scene-copy'
import { useSceneControls } from '@/features/trade-scenes/contexts/scene-controls-context'
import { useApplySceneChange } from '@/features/trade-scenes/hooks/use-apply-scene-change'
import { useSceneTargets } from '@/features/trade-scenes/hooks/use-scene-targets'
import { currentYear } from '@/features/trade-scenes/lib/current-year'
import { sceneChangeSlots } from '@/features/trade-scenes/lib/scene-change-slots'
import { searchSceneChanges } from '@/features/trade-scenes/lib/search-scene-changes'
import { CollapseRegion } from '@/features/trade-scenes/ui/components/controls/collapse-region'
import { MissingChips } from '@/features/trade-scenes/ui/components/controls/missing-chips'
import { ModifyResults } from '@/features/trade-scenes/ui/components/controls/modify-results'
import { ModifySearchRow } from '@/features/trade-scenes/ui/components/controls/modify-search-row'
import { useSceneInputs } from '@/shared/components/scene/contexts/scene-inputs-context'

interface ModifyBodyProps {
  // The window clears the field on Escape and hands focus back to it.
  inputRef: RefObject<HTMLInputElement | null>
}

// A search for one change. The panel under the field holds the missing facts or the results and shuts when it has
// neither, so an empty search with nothing missing is the field alone.
export function ModifyBody({ inputRef }: ModifyBodyProps) {
  const { query, setQuery } = useSceneControls()
  const state = useSceneInputs((inputs: TradeSceneInputs) => inputs)
  const targets = useSceneTargets()
  const applyChange = useApplySceneChange()
  const [applied, setApplied] = useState<AppliedSceneChange>(null)
  const slots = sceneChangeSlots(state, targets, currentYear())
  const results = searchSceneChanges(slots, query)
  // An add-on no pick can take yet is listed for its reason only, so Enter passes over it.
  const lead = results.find(({ slot }) => slot.unavailable === null) ?? null
  const searching = query.trim() !== ''
  const missing = slots.filter(slot => slot.isFact && slot.current === null)

  // Focus goes back to the field, so the next word can be typed straight away.
  const focusSearch = () => inputRef.current!.focus()
  const apply = (slot: SceneChangeSlot, value: string) => {
    if (value !== slot.current) {
      applyChange(slot.change(value))
      setApplied(last => ({ id: slot.id, count: (last?.count ?? 0) + 1 }))
    }
    focusSearch()
  }
  const onQuery = (next: string) => {
    setApplied(null)
    setQuery(next)
  }
  const onEnter = () => {
    if (lead === null) {
      return
    }
    const { slot, hit } = lead
    if (hit !== null && hit !== slot.current) {
      apply(slot, hit)
    }
  }

  const content = searching
    ? <ModifyResults query={query.trim()} results={results} leadId={lead?.slot.id ?? null} applied={applied} onApply={apply} onBillEntered={focusSearch} />
    : missing.length > 0 && <MissingChips slots={missing} onPick={apply} afterPick={focusSearch} />
  // Everything the panel draws from, so the copy it holds for its shut is the one last shown.
  const contentKey = searching
    ? JSON.stringify([query.trim(), applied, results.map(({ slot, hit }) => [slot.id, slot.current, hit])])
    : missing.length > 0 ? JSON.stringify(missing.map(slot => slot.id)) : null

  return (
    <>
      <ModifySearchRow inputRef={inputRef} query={query} onQuery={onQuery} onEnter={onEnter} />
      <CollapseRegion contentKey={contentKey}>
        {content && (
          <div className="flex min-h-0 flex-col border-t border-border">
            <div className={CONTROLS_CLASSES.body}>{content}</div>
          </div>
        )}
      </CollapseRegion>
      <p data-modify-status role="status" className="sr-only">
        {searching && (results.length > 0 ? CONTROLS_COPY.modify.matches(results.length) : CONTROLS_COPY.modify.noResults(query.trim()))}
      </p>
    </>
  )
}
