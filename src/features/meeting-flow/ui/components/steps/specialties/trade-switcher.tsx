'use client'

import type { Trade } from '@/shared/services/providers/notion/lib/trades/schema'
import { CheckIcon, ChevronDownIcon } from 'lucide-react'
import { useState } from 'react'
import { SPECIALTIES_COPY } from '@/features/meeting-flow/constants/specialties-copy'
import { useTradeCatalogContext } from '@/features/meeting-flow/contexts/trade-catalog-context'
import { useTradeSelections } from '@/features/meeting-flow/contexts/trade-selections-context'
import { useTradeStage } from '@/features/meeting-flow/contexts/trade-stage-context'
import { formatCount } from '@/features/meeting-flow/lib/format-count'
import { groupTradesForSwitcher } from '@/features/meeting-flow/lib/group-trades-for-switcher'
import { isTradeSelected } from '@/features/meeting-flow/lib/trade-selection'
import { TradeThumb } from '@/features/meeting-flow/ui/components/trade-thumb'
import { Button } from '@/shared/components/ui/button'
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/shared/components/ui/command'
import { Popover, PopoverContent, PopoverTrigger } from '@/shared/components/ui/popover'

interface TradeSwitcherProps {
  trade: Trade
}

/**
 * The trade on stage as a combobox (cmdk): type to filter, arrows and Enter, Escape closes the popover
 * before anything else (Radix marks the event, `useMeetingFlowKeys` skips it). Heads the work group.
 */
export function TradeSwitcher({ trade }: TradeSwitcherProps) {
  const [open, setOpen] = useState(false)
  const { catalog } = useTradeCatalogContext()
  const selections = useTradeSelections()
  const { showTrade } = useTradeStage()
  const groups = groupTradesForSwitcher(catalog.trades, selections)

  function handleSelect(tradeId: string) {
    setOpen(false)
    showTrade(tradeId)
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button aria-label={`${SPECIALTIES_COPY.work.switchLabel}: ${trade.name}`} className="h-auto min-h-15 w-full justify-between gap-3 py-1.5 pr-3.5 pl-1.5 text-left" variant="outline">
          <span className="flex min-w-0 items-center gap-3">
            <TradeThumb className="size-11" trade={trade} />
            <span className="flex min-w-0 flex-col">
              <span className="text-[13px] font-normal text-muted-foreground">{SPECIALTIES_COPY.work.tradeLabel}</span>
              <span className="truncate font-sans text-lg font-semibold">{trade.name}</span>
            </span>
          </span>
          <ChevronDownIcon aria-hidden className="size-5 text-muted-foreground" />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-(--radix-popover-trigger-width) p-0">
        <Command>
          <CommandInput className="h-11 text-base" placeholder={SPECIALTIES_COPY.work.filterPlaceholder} />
          <CommandList className="max-h-[min(540px,60vh)]">
            <CommandEmpty>{SPECIALTIES_COPY.work.noMatches}</CommandEmpty>
            {groups.map(group => (
              <CommandGroup key={group.key} heading={group.label}>
                {group.trades.map((option) => {
                  const kinds = catalog.scopesByTrade.get(option.id)?.scopes.length ?? 0
                  const meta = isTradeSelected(selections, option.id)
                    ? SPECIALTIES_COPY.work.onYourProject
                    : kinds > 0 ? formatCount(kinds, SPECIALTIES_COPY.units.kind) : SPECIALTIES_COPY.showcase.scopesToDefine
                  return (
                    <CommandItem key={option.id} className="min-h-13 gap-3" value={`${option.name} ${option.id}`} onSelect={() => handleSelect(option.id)}>
                      <TradeThumb trade={option} />
                      <span className="flex min-w-0 flex-1 flex-col">
                        <span className="text-sm font-semibold">{option.name}</span>
                        <span className="text-[13px] text-muted-foreground">{meta}</span>
                      </span>
                      {option.id === trade.id && <CheckIcon aria-hidden className="size-4" />}
                    </CommandItem>
                  )
                })}
              </CommandGroup>
            ))}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}
