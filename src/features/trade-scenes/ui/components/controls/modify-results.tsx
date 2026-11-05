'use client'

import type { AppliedSceneChange, SceneChangeResult, SceneChangeSlot } from '@/features/trade-scenes/types'

import { CONTROLS_COPY } from '@/features/trade-scenes/constants/home-scene-copy'
import { ModifyResultRow } from '@/features/trade-scenes/ui/components/controls/modify-result-row'

interface ModifyResultsProps {
  query: string
  results: readonly SceneChangeResult[]
  // The row Enter applies, if one.
  leadId: string | null
  // So its row flashes.
  applied: AppliedSceneChange
  onApply: (slot: SceneChangeSlot, value: string) => void
  onBillEntered: () => void
}

export function ModifyResults({ query, results, leadId, applied, onApply, onBillEntered }: ModifyResultsProps) {
  if (results.length === 0) {
    return <p data-no-results className="py-4 text-xs text-muted-foreground">{CONTROLS_COPY.modify.noResults(query)}</p>
  }
  return (
    <div className="pt-3.5">
      {results.map(({ slot, hit }) => (
        <ModifyResultRow
          key={slot.id}
          slot={slot}
          hit={hit}
          lead={slot.id === leadId}
          flash={applied?.id === slot.id ? applied.count : 0}
          onApply={value => onApply(slot, value)}
          onBillEntered={onBillEntered}
        />
      ))}
    </div>
  )
}
