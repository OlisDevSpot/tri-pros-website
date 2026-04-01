'use client'

import type { Trade } from '@/shared/services/notion/lib/trades/schema'
import { TrashIcon } from 'lucide-react'
import { useEffect, useRef } from 'react'
import { Button } from '@/shared/components/ui/button'
import { MultiSelect, MultiSelectContent, MultiSelectGroup, MultiSelectItem, MultiSelectTrigger, MultiSelectValue } from '@/shared/components/ui/multi-select'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/components/ui/select'
import { useGetScopes } from '@/shared/services/notion/dal/scopes/hooks/queries/use-get-scopes'

interface Props {
  tradeId: string
  selectedScopeIds: string[]
  allTrades: Trade[]
  usedTradeIds: Set<string>
  onTradeChange: (tradeId: string) => void
  onScopesChange: (scopeIds: string[]) => void
  onDelete: () => void
}

export function TradeScopeRow({
  tradeId,
  selectedScopeIds,
  allTrades,
  usedTradeIds,
  onTradeChange,
  onScopesChange,
  onDelete,
}: Props) {
  const scopeTriggerRef = useRef<HTMLButtonElement>(null)
  const shouldAutoOpenScopes = useRef(false)

  const scopesQuery = useGetScopes(
    { query: tradeId, filterProperty: 'relatedTrade' },
    { enabled: !!tradeId },
  )

  useEffect(() => {
    if (shouldAutoOpenScopes.current && scopesQuery.isSuccess && scopesQuery.data?.length) {
      shouldAutoOpenScopes.current = false
      scopeTriggerRef.current?.click()
    }
  }, [scopesQuery.isSuccess, scopesQuery.data])

  const availableTrades = allTrades.filter(
    t => t.id === tradeId || !usedTradeIds.has(t.id),
  )

  return (
    <div className="flex items-start gap-2">
      <div className="flex flex-col gap-2 min-w-0 flex-1 sm:flex-row">
        <Select
          value={tradeId}
          onValueChange={(val) => {
            onTradeChange(val)
            onScopesChange([])
            shouldAutoOpenScopes.current = true
          }}
        >
          <SelectTrigger className="w-full sm:w-48 sm:shrink-0">
            <SelectValue placeholder="Select trade" />
          </SelectTrigger>
          <SelectContent>
            {availableTrades.map(trade => (
              <SelectItem key={trade.id} value={trade.id}>
                {trade.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <MultiSelect
          values={selectedScopeIds}
          onValuesChange={onScopesChange}
        >
          <MultiSelectTrigger ref={scopeTriggerRef} className="w-full sm:flex-1" disabled={!tradeId || scopesQuery.isLoading}>
            <MultiSelectValue placeholder={scopesQuery.isLoading ? 'Loading...' : 'Select scopes'} overflowBehavior="cutoff" />
          </MultiSelectTrigger>
          <MultiSelectContent
            search={{
              emptyMessage: 'No scopes found',
              placeholder: 'Search scopes...',
            }}
          >
            <MultiSelectGroup>
              {scopesQuery.data?.map(scope => (
                <MultiSelectItem key={scope.id} value={scope.id}>
                  {scope.name}
                </MultiSelectItem>
              ))}
            </MultiSelectGroup>
          </MultiSelectContent>
        </MultiSelect>
      </div>

      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="h-9 w-9 shrink-0 text-muted-foreground hover:text-destructive"
        onClick={onDelete}
      >
        <TrashIcon className="h-4 w-4" />
      </Button>
    </div>
  )
}
