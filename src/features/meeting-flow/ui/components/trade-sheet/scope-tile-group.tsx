'use client'

import type { ScopeOrAddon } from '@/shared/services/providers/notion/lib/scopes/schema'
import { useEffect, useRef } from 'react'
import { SPECIALTIES_COPY } from '@/features/meeting-flow/constants/specialties-copy'
import { SCOPE_PHOTOS } from '@/features/meeting-flow/constants/trade-photos'
import { useTradeSelection } from '@/features/meeting-flow/contexts/trade-selection-context'
import { diffIds } from '@/features/meeting-flow/lib/trade-selection'
import { ScopeTile } from '@/features/meeting-flow/ui/components/trade-sheet/scope-tile'
import { ToggleGroup } from '@/shared/components/ui/toggle-group'

interface ScopeTileGroupProps {
  tradeId: string
  scopes: ScopeOrAddon[]
  selectedIds: string[]
  focusScopeId: string | null
  emptyText: string
}

/**
 * `ToggleGroup type="multiple"`: Radix owns pressed state, roving focus, and
 * `aria-pressed`. `onValueChange` hands back the whole array; the diff is the
 * one id the user touched, and only that item's pressed state changes.
 */
export function ScopeTileGroup({ tradeId, scopes, selectedIds, focusScopeId, emptyText }: ScopeTileGroupProps) {
  const { toggleItem } = useTradeSelection()
  const groupRef = useRef<HTMLDivElement>(null)

  // The body is keyed on the trade id, so this runs once per open. The host
  // cancelled Radix's own autofocus when a focus scope was requested.
  useEffect(() => {
    if (!focusScopeId) {
      return
    }
    const tile = groupRef.current?.querySelector<HTMLElement>(`[data-scope-id="${CSS.escape(focusScopeId)}"]`)
    tile?.scrollIntoView({ block: 'center' })
    tile?.focus()
  }, [focusScopeId])

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
    <section aria-labelledby={`scopes-${tradeId}`} className="flex flex-col gap-2">
      <h3 id={`scopes-${tradeId}`} className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
        {SPECIALTIES_COPY.sheet.work}
      </h3>
      {scopes.length === 0
        ? <p className="text-base text-muted-foreground">{emptyText}</p>
        : (
            <ToggleGroup
              ref={groupRef}
              className="grid w-full grid-cols-2 gap-2 sm:grid-cols-3"
              type="multiple"
              value={selectedIds}
              onValueChange={handleValueChange}
            >
              {scopes.map(scope => (
                <ScopeTile
                  key={scope.id}
                  focused={scope.id === focusScopeId}
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
