'use client'

import type { MeetingScopeEntry, MeetingScopes } from '@/shared/entities/meetings/schemas'
import type { Trade } from '@/shared/services/notion/lib/trades/schema'
import { PlusIcon, Trash2Icon } from 'lucide-react'
import { Button } from '@/shared/components/ui/button'
import { Label } from '@/shared/components/ui/label'
import {
  MultiSelect,
  MultiSelectContent,
  MultiSelectGroup,
  MultiSelectItem,
  MultiSelectTrigger,
  MultiSelectValue,
} from '@/shared/components/ui/multi-select'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/shared/components/ui/select'
import { useGetScopes } from '@/shared/services/notion/dal/scopes/hooks/queries/use-get-scopes'
import { useGetAllTrades } from '@/shared/services/notion/dal/trades/hooks/queries/use-get-trades'

interface ScopeRowProps {
  entry: MeetingScopeEntry
  index: number
  allTrades: Trade[]
  usedTradeIds: Set<string>
  onUpdate: (index: number, updated: MeetingScopeEntry) => void
  onRemove: (index: number) => void
}

function ScopeRow({ entry, index, allTrades, usedTradeIds, onUpdate, onRemove }: ScopeRowProps) {
  const scopesQuery = useGetScopes(
    { query: entry.trade.id, filterProperty: 'relatedTrade' },
    { enabled: !!entry.trade.id },
  )

  const availableScopes = scopesQuery.data ?? []
  const selectedScopeIds = entry.scopes.map(s => s.id)

  function handleTradeChange(tradeId: string) {
    const trade = allTrades.find(t => t.id === tradeId)
    if (!trade) {
      return
    }
    onUpdate(index, { trade: { id: trade.id, label: trade.name }, scopes: [] })
  }

  function handleScopesChange(scopeIds: string[]) {
    const scopes = scopeIds.map((id) => {
      const found = availableScopes.find(s => s.id === id)
      return { id, label: found?.name ?? id }
    })
    onUpdate(index, { ...entry, scopes })
  }

  const availableTradesForRow = allTrades.filter(
    t => t.id === entry.trade.id || !usedTradeIds.has(t.id),
  )

  return (
    <div className="flex items-start gap-2">
      <div className="flex-1 min-w-0">
        <Select value={entry.trade.id} onValueChange={handleTradeChange}>
          <SelectTrigger className="w-full">
            <SelectValue placeholder="Select trade" />
          </SelectTrigger>
          <SelectContent>
            {availableTradesForRow.map(trade => (
              <SelectItem key={trade.id} value={trade.id}>
                {trade.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="flex-1 min-w-0">
        <MultiSelect
          values={selectedScopeIds}
          onValuesChange={handleScopesChange}
        >
          <MultiSelectTrigger className="w-full" disabled={!entry.trade.id}>
            <MultiSelectValue placeholder="Select scopes" />
          </MultiSelectTrigger>
          <MultiSelectContent search={{ placeholder: 'Search scopes...' }}>
            <MultiSelectGroup>
              {availableScopes.map(scope => (
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
        className="shrink-0 text-muted-foreground hover:text-destructive"
        onClick={() => onRemove(index)}
      >
        <Trash2Icon className="size-4" />
        <span className="sr-only">Remove row</span>
      </Button>
    </div>
  )
}

interface MeetingScopePickerProps {
  value: MeetingScopes
  onChange: (scopes: MeetingScopes) => void
}

export function MeetingScopesPicker({ value, onChange }: MeetingScopePickerProps) {
  const tradesQuery = useGetAllTrades()
  const allTrades = tradesQuery.data ?? []

  const usedTradeIds = new Set(value.map(e => e.trade.id).filter(Boolean))

  function handleUpdate(index: number, updated: MeetingScopeEntry) {
    const next = [...value]
    next[index] = updated
    onChange(next)
  }

  function handleRemove(index: number) {
    onChange(value.filter((_, i) => i !== index))
  }

  function handleAdd() {
    onChange([...value, { trade: { id: '', label: '' }, scopes: [] }])
  }

  return (
    <div className="space-y-2">
      {value.length > 0 && (
        <div className="flex items-center gap-2 mb-1">
          <Label className="flex-1 text-xs text-muted-foreground">Trade</Label>
          <Label className="flex-1 text-xs text-muted-foreground">Scopes</Label>
          <div className="w-9 shrink-0" />
        </div>
      )}

      <div className="space-y-2">
        {value.map((entry, index) => (
          <ScopeRow
            // eslint-disable-next-line react/no-array-index-key
            key={`${entry.trade.id || 'empty'}-${index}`}
            entry={entry}
            index={index}
            allTrades={allTrades}
            usedTradeIds={usedTradeIds}
            onUpdate={handleUpdate}
            onRemove={handleRemove}
          />
        ))}
      </div>

      <Button
        type="button"
        variant="outline"
        size="sm"
        className="w-full"
        onClick={handleAdd}
        disabled={tradesQuery.isLoading}
      >
        <PlusIcon className="size-4" />
        Add trade
      </Button>
    </div>
  )
}
