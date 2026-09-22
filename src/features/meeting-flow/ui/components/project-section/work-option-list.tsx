'use client'

import type { TradeSelection } from '@/shared/entities/meetings/schemas'
import type { Scope } from '@/shared/modules/construction/core/schemas'
import { CheckIcon } from 'lucide-react'
import { useId, useMemo } from 'react'
import { useTradeEdits } from '@/features/meeting-flow/hooks/use-trade-edits'
import { diffIds, selectedItemIds } from '@/features/meeting-flow/lib/trade-selection'
import { ToggleGroup, ToggleGroupItem } from '@/shared/components/ui/toggle-group'

interface WorkOptionListProps {
  entry: TradeSelection
  label: string
  scopes: Scope[]
  onBeforeRemove: () => void
}

/**
 * The "Mirror" option rows the owner picked (spec D8): full-width 44px rows, label left, checkbox square right,
 * pressed fill. A vertical `ToggleGroup`, so Radix owns pressed state, roving focus and `aria-pressed`. Never moves the stage.
 */
export function WorkOptionList({ entry, label, scopes, onBeforeRemove }: WorkOptionListProps) {
  const { toggleWork } = useTradeEdits()
  const labelId = useId()
  const selectedScopes = entry?.selectedScopes
  const selectedIds = useMemo(() => selectedItemIds(selectedScopes), [selectedScopes])

  function handleValueChange(next: string[]) {
    const { added, removed } = diffIds(selectedIds, next)
    for (const id of [...added, ...removed]) {
      const scope = scopes.find(entryScope => entryScope.id === id)
      if (scope) {
        toggleWork(entry.tradeId, entry, { id: scope.id, label: scope.name }, onBeforeRemove)
      }
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <p className="font-sans text-xs font-semibold tracking-[0.06em] text-muted-foreground uppercase" id={labelId}>{label}</p>
      <ToggleGroup aria-labelledby={labelId} className="flex w-full flex-col gap-1" orientation="vertical" type="multiple" value={selectedIds} onValueChange={handleValueChange}>
        {scopes.map(scope => (
          <ToggleGroupItem
            key={scope.id}
            className="group h-auto min-h-11 w-full flex-none justify-between gap-2 rounded-md border border-border bg-card py-2 pr-2 pl-3 text-left text-[15px] font-normal whitespace-normal motion-safe:transition-colors motion-safe:duration-200 first:rounded-md last:rounded-md hover:bg-muted hover:text-foreground data-[state=on]:border-primary/45 data-[state=on]:bg-primary/8 data-[state=on]:text-foreground"
            value={scope.id}
          >
            <span>{scope.name}</span>
            <span aria-hidden className="grid size-[22px] shrink-0 place-items-center rounded-[3px] border-[1.5px] border-muted-foreground text-transparent group-data-[state=on]:border-foreground group-data-[state=on]:bg-foreground group-data-[state=on]:text-background">
              <CheckIcon className="size-3.5" />
            </span>
          </ToggleGroupItem>
        ))}
      </ToggleGroup>
    </div>
  )
}
