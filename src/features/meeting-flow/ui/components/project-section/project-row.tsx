'use client'

import type { TradeSelection } from '@/shared/entities/meetings/schemas'
import { ChevronDownIcon, EyeIcon } from 'lucide-react'
import { memo } from 'react'
import { SPECIALTIES_COPY } from '@/features/meeting-flow/constants/specialties-copy'
import { TRADE_PAIRINGS } from '@/features/meeting-flow/constants/trade-pairings'
import { useTradeCatalogContext } from '@/features/meeting-flow/contexts/trade-catalog-context'
import { useTradeStage } from '@/features/meeting-flow/contexts/trade-stage-context'
import { useTradeEdits } from '@/features/meeting-flow/hooks/use-trade-edits'
import { formatWorkSummary } from '@/features/meeting-flow/lib/format-work-summary'
import { orphanItems } from '@/features/meeting-flow/lib/trade-selection'
import { OrphanItemChips } from '@/features/meeting-flow/ui/components/project-section/orphan-item-chips'
import { ReasonPicker } from '@/features/meeting-flow/ui/components/project-section/reason-picker'
import { TradeNoteField } from '@/features/meeting-flow/ui/components/project-section/trade-note-field'
import { WorkOptionList } from '@/features/meeting-flow/ui/components/project-section/work-option-list'
import { TradeThumb } from '@/features/meeting-flow/ui/components/trade-thumb'
import { Badge } from '@/shared/components/ui/badge'
import { Button } from '@/shared/components/ui/button'
import { AnimatedCollapsibleContent, Collapsible, CollapsibleTrigger } from '@/shared/components/ui/collapsible'
import { cn } from '@/shared/lib/utils'

interface ProjectRowProps {
  entry: TradeSelection
  expanded: boolean
  onStage: boolean
  pairedOnProject: boolean
  onExpandedChange: (tradeId: string, open: boolean) => void
  onBeforeRemove: (tradeId: string) => void
}

/**
 * One trade on the project, collapsed to a summary a rep can read at a glance (work, reasons). Expanded: the
 * option rows, orphans, reasons, note, "Show on stage" and "Remove from project" (Undo via toast). Memoized:
 * an edit to another trade leaves `entry` identical, so this row skips it.
 */
function ProjectRowImpl({ entry, expanded, onStage, pairedOnProject, onExpandedChange, onBeforeRemove }: ProjectRowProps) {
  const { catalog } = useTradeCatalogContext()
  const { showTrade } = useTradeStage()
  const { removeWithUndo } = useTradeEdits()
  const trade = catalog.tradesById.get(entry.tradeId)
  const group = catalog.scopesByTrade.get(entry.tradeId)
  const pairing = trade ? TRADE_PAIRINGS[trade.slug] : undefined
  const paired = pairing ? catalog.tradesBySlug.get(pairing.pairedSlug) : undefined
  const tradeName = trade?.name ?? entry.tradeName

  function handleRemove() {
    onBeforeRemove(entry.tradeId)
    removeWithUndo(entry)
  }

  return (
    <Collapsible className={cn('rounded-md border bg-card', onStage && 'border-primary/50')} open={expanded} onOpenChange={open => onExpandedChange(entry.tradeId, open)}>
      <CollapsibleTrigger asChild>
        <Button className="h-auto w-full justify-start gap-3 rounded-md px-3 py-2.5 text-left font-normal whitespace-normal hover:bg-muted/60" data-project-row-trigger data-trade-id={entry.tradeId} variant="ghost">
          <TradeThumb className="size-11" trade={trade} />
          <span className="flex min-w-0 flex-1 flex-col gap-0.5">
            <span className="flex flex-wrap items-center gap-2 text-[15px] font-semibold">
              {tradeName}
              {onStage && (
                <Badge className="gap-1" variant="secondary">
                  <EyeIcon aria-hidden className="size-3" />
                  {SPECIALTIES_COPY.panel.onStage}
                </Badge>
              )}
              {!trade && <Badge variant="outline">{SPECIALTIES_COPY.panel.notInCatalog}</Badge>}
            </span>
            <span className="text-[13px]">{formatWorkSummary(entry)}</span>
            <span className="truncate text-[13px] text-muted-foreground">{entry.painPoints.length > 0 ? entry.painPoints.join(' · ') : SPECIALTIES_COPY.panel.noReason}</span>
          </span>
          <ChevronDownIcon aria-hidden className={cn('size-4 shrink-0 text-muted-foreground motion-safe:transition-transform', expanded && 'rotate-180')} />
        </Button>
      </CollapsibleTrigger>
      <AnimatedCollapsibleContent className="flex flex-col gap-4 border-t px-3 pt-3 pb-1" open={expanded}>
        {group && group.scopes.length > 0 && <WorkOptionList entry={entry} label={SPECIALTIES_COPY.panel.work} scopes={group.scopes} />}
        {group && group.addons.length > 0 && <WorkOptionList entry={entry} label={SPECIALTIES_COPY.panel.addons} scopes={group.addons} />}
        <OrphanItemChips entry={entry} items={orphanItems(entry, group)} />
        <ReasonPicker reasons={entry.painPoints} tradeId={entry.tradeId} />
        <TradeNoteField note={entry.notes ?? ''} tradeId={entry.tradeId} tradeName={tradeName} />
        <div className="-mx-2 flex items-center justify-between">
          {onStage || !trade
            ? <span />
            : (
                <Button className="h-11 gap-1.5 px-2 font-semibold" variant="ghost" onClick={() => showTrade(entry.tradeId)}>
                  <EyeIcon aria-hidden className="size-4" />
                  {SPECIALTIES_COPY.panel.showOnStage}
                </Button>
              )}
          <Button className="h-11 px-2 font-semibold text-destructive hover:text-destructive" variant="ghost" onClick={handleRemove}>
            {SPECIALTIES_COPY.panel.remove}
          </Button>
        </div>
      </AnimatedCollapsibleContent>
      {paired && pairing && !pairedOnProject && (
        <div className="flex items-center justify-between gap-2 border-t border-dashed py-0.5 pr-1 pl-3">
          <p className="text-[13px] text-muted-foreground">{SPECIALTIES_COPY.panel.pairsWith(paired.name, pairing.reason)}</p>
          <Button className="h-11 shrink-0 px-2 font-semibold" variant="ghost" onClick={() => showTrade(paired.id)}>
            {SPECIALTIES_COPY.panel.show}
          </Button>
        </div>
      )}
    </Collapsible>
  )
}

export const ProjectRow = memo(ProjectRowImpl)
