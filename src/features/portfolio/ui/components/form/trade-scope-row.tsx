'use client'

import type { Trade } from '@/shared/services/notion/lib/trades/schema'
import { TrashIcon } from 'lucide-react'
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
  const scopesQuery = useGetScopes(
    { query: tradeId, filterProperty: 'relatedTrade' },
    { enabled: !!tradeId },
  )

  const availableTrades = allTrades.filter(
    t => t.id === tradeId || !usedTradeIds.has(t.id),
  )

  return (
    <div className="flex items-center gap-2">
      <Select
        value={tradeId}
        onValueChange={(val) => {
          onTradeChange(val)
          onScopesChange([])
        }}
      >
        <SelectTrigger className="w-48 shrink-0">
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
        <MultiSelectTrigger className="flex-1" disabled={!tradeId || scopesQuery.isLoading}>
          <MultiSelectValue placeholder={scopesQuery.isLoading ? 'Loading...' : 'Select scopes'} />
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
