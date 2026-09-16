'use client'

import type { ScopeOrAddon } from '@/shared/services/providers/notion/lib/scopes/schema'
import { SPECIALTIES_COPY } from '@/features/meeting-flow/constants/specialties-copy'
import { SCOPE_PHOTOS } from '@/features/meeting-flow/constants/trade-photos'
import { useTradeActions } from '@/features/meeting-flow/contexts/trade-actions-context'
import { diffIds } from '@/features/meeting-flow/lib/trade-selection'
import { ScopeTile } from '@/features/meeting-flow/ui/components/trade-sheet/scope-tile'
import { ToggleGroup } from '@/shared/components/ui/toggle-group'

interface ScopeTileGroupProps {
  tradeId: string
  scopes: ScopeOrAddon[]
  selectedIds: string[]
  emptyText: string
}

/**
 * `ToggleGroup type="multiple"`: Radix owns pressed state, roving focus, and
 * `aria-pressed`. `onValueChange` hands back the whole array; the diff is the
 * one id the user touched, and only that item's pressed state changes.
 */
export function ScopeTileGroup({ tradeId, scopes, selectedIds, emptyText }: ScopeTileGroupProps) {
  const { toggleItem } = useTradeActions()

  function handleValueChange(next: string[]) {
    const { added, removed } = diffIds(selectedIds, next)
    for (const id of [...added, ...removed]) {
      const scope = scopes.find(entry => entry.id === id)
      if (scope) {
        toggleItem(tradeId, { id: scope.id, label: scope.name })
      }
    }
  }

  return (
    <section className="flex flex-col gap-2">
      <h3 id={`scopes-${tradeId}`} className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
        {SPECIALTIES_COPY.sheet.work}
      </h3>
      {scopes.length === 0
        ? <p className="text-base text-muted-foreground">{emptyText}</p>
        : (
            <ToggleGroup
              aria-labelledby={`scopes-${tradeId}`}
              className="grid w-full grid-cols-2 items-stretch gap-2 sm:grid-cols-3"
              type="multiple"
              value={selectedIds}
              onValueChange={handleValueChange}
            >
              {scopes.map(scope => (
                <ScopeTile
                  key={scope.id}
                  id={scope.id}
                  mode="toggle"
                  name={scope.name}
                  photo={SCOPE_PHOTOS[scope.name]}
                  unit={scope.unitOfPricing}
                />
              ))}
            </ToggleGroup>
          )}
    </section>
  )
}
