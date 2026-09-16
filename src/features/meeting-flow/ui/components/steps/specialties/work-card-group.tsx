'use client'

import type { Trade } from '@/shared/services/providers/notion/lib/trades/schema'
import { useMemo } from 'react'
import { SPECIALTIES_COPY } from '@/features/meeting-flow/constants/specialties-copy'
import { useTradeCatalogContext } from '@/features/meeting-flow/contexts/trade-catalog-context'
import { useTradeSelections } from '@/features/meeting-flow/contexts/trade-selections-context'
import { useTradeStage } from '@/features/meeting-flow/contexts/trade-stage-context'
import { useTradeEdits } from '@/features/meeting-flow/hooks/use-trade-edits'
import { formatCount } from '@/features/meeting-flow/lib/format-count'
import { selectScopeMedia } from '@/features/meeting-flow/lib/select-scope-media'
import { diffIds, findTradeSelection, selectedItemIds } from '@/features/meeting-flow/lib/trade-selection'
import { WorkCard } from '@/features/meeting-flow/ui/components/steps/specialties/work-card'
import { ToggleGroup } from '@/shared/components/ui/toggle-group'

interface WorkCardGroupProps {
  trade: Trade
}

/**
 * The stage trade's kinds of work. Adding one puts its project photo on stage; unticking the only one takes
 * the trade off the project with Undo (`useTradeEdits`). Cards take stable props, so a toggle re-renders the
 * group and the Radix items, never the cards' content.
 */
export function WorkCardGroup({ trade }: WorkCardGroupProps) {
  const { catalog, projects } = useTradeCatalogContext()
  const selections = useTradeSelections()
  const { showMedia } = useTradeStage()
  const { toggleWork } = useTradeEdits()

  const scopes = catalog.scopesByTrade.get(trade.id)?.scopes
  const entry = findTradeSelection(selections, trade.id)
  const selectedIds = useMemo(() => selectedItemIds(entry), [entry])
  const mediaByScope = useMemo(
    () => new Map((scopes ?? []).map(scope => [scope.id, selectScopeMedia(scope, projects)])),
    [scopes, projects],
  )

  if (!scopes || scopes.length === 0) {
    return <p className="text-sm text-muted-foreground">{SPECIALTIES_COPY.work.noWork(trade.name)}</p>
  }

  function handleValueChange(next: string[]) {
    const { added, removed } = diffIds(selectedIds, next)
    for (const id of [...added, ...removed]) {
      const scope = scopes?.find(entryScope => entryScope.id === id)
      if (!scope) {
        continue
      }
      toggleWork(trade.id, entry, { id: scope.id, label: scope.name })
      const media = mediaByScope.get(id)
      if (added.includes(id) && media) {
        showMedia(media.key)
      }
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <p className="text-[13px] text-muted-foreground">{`${formatCount(scopes.length, SPECIALTIES_COPY.units.kind)} · ${SPECIALTIES_COPY.work.tapToAdd}`}</p>
      <ToggleGroup
        aria-label={SPECIALTIES_COPY.work.groupLabel(trade.name)}
        className="grid w-full grid-cols-2 items-stretch gap-3 @min-[40rem]/specialties:grid-cols-3 @4xl/specialties:grid-cols-2"
        type="multiple"
        value={selectedIds}
        onValueChange={handleValueChange}
      >
        {scopes.map(scope => (
          <WorkCard key={scope.id} media={mediaByScope.get(scope.id) ?? null} name={scope.name} scopeId={scope.id} />
        ))}
      </ToggleGroup>
    </div>
  )
}
