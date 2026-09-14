'use client'

import { SPECIALTIES_COPY } from '@/features/meeting-flow/constants/specialties-copy'
import { TRADE_OUTCOMES } from '@/features/meeting-flow/constants/trade-outcomes'
import { TRADE_PHOTOS } from '@/features/meeting-flow/constants/trade-photos'
import { useTradeSelection } from '@/features/meeting-flow/contexts/trade-selection-context'
import { formatSelectionSummary } from '@/features/meeting-flow/lib/format-selection-summary'
import { countSelection, findTradeSelection, itemCount, orphanItems, selectedItemIds } from '@/features/meeting-flow/lib/trade-selection'
import { OrphanItemChips } from '@/features/meeting-flow/ui/components/trade-sheet/orphan-item-chips'
import { OutcomeLine } from '@/features/meeting-flow/ui/components/trade-sheet/outcome-line'
import { PairingCard } from '@/features/meeting-flow/ui/components/trade-sheet/pairing-card'
import { ReasonChipGroup } from '@/features/meeting-flow/ui/components/trade-sheet/reason-chip-group'
import { ScopeTileGroup } from '@/features/meeting-flow/ui/components/trade-sheet/scope-tile-group'
import { TradeNoteField } from '@/features/meeting-flow/ui/components/trade-sheet/trade-note-field'
import { TradePhoto } from '@/features/meeting-flow/ui/components/trade-sheet/trade-photo'
import { TradeSheetHeader } from '@/features/meeting-flow/ui/components/trade-sheet/trade-sheet-header'
import { ErrorState } from '@/shared/components/states/error-state'
import { LoadingState } from '@/shared/components/states/loading-state'
import { Button } from '@/shared/components/ui/button'

interface TradeSheetBodyProps {
  tradeId: string
  focusScopeId: string | null
}

/** Everything the agent edits for one trade. Re-renders on toggles; children take primitive props and reconcile in place. */
export function TradeSheetBody({ tradeId, focusScopeId }: TradeSheetBodyProps) {
  const { selections, catalog } = useTradeSelection()

  if (catalog.isLoading) {
    return <LoadingState description={SPECIALTIES_COPY.catalogLoading.description} title={SPECIALTIES_COPY.catalogLoading.title} />
  }

  if (catalog.error) {
    return (
      <div className="flex flex-col items-center gap-3">
        <ErrorState description={SPECIALTIES_COPY.catalogError.description} title={SPECIALTIES_COPY.catalogError.title} />
        <Button size="sm" variant="outline" onClick={catalog.refetch}>{SPECIALTIES_COPY.retry}</Button>
      </div>
    )
  }

  const trade = catalog.tradesById.get(tradeId)
  const group = catalog.scopesByTrade.get(tradeId)
  const selection = findTradeSelection(selections, tradeId)
  const tradeName = trade?.name ?? selection?.tradeName ?? ''
  const slug = trade?.slug

  return (
    <div className="flex flex-col gap-5">
      <TradeSheetHeader inCatalog={trade !== undefined} summary={formatSelectionSummary(countSelection(selection, group))} />
      <TradePhoto label={tradeName} photo={slug ? TRADE_PHOTOS[slug] : undefined} />
      <OutcomeLine text={slug ? TRADE_OUTCOMES[slug] : undefined} />
      <ScopeTileGroup
        emptyText={group && group.addons.length > 0 ? SPECIALTIES_COPY.sheet.noScopesAddonsOnly : SPECIALTIES_COPY.sheet.noScopes}
        focusScopeId={focusScopeId}
        scopes={group?.scopes ?? []}
        selectedIds={selectedItemIds(selection)}
        tradeId={tradeId}
      />
      <OrphanItemChips items={orphanItems(selection, group)} tradeId={tradeId} />
      <ReasonChipGroup selectedReasons={selection?.painPoints ?? []} tradeId={tradeId} />
      <TradeNoteField note={selection?.notes ?? ''} tradeId={tradeId} tradeName={tradeName} />
      {slug && <PairingCard selected={itemCount(selection) > 0} slug={slug} />}
    </div>
  )
}
