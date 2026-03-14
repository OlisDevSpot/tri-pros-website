'use client'

import type { ShowroomProjectScope, ShowroomProjectTrade } from '@/shared/entities/projects/types'
import { Search, SlidersHorizontal, X } from 'lucide-react'
import { Badge } from '@/shared/components/ui/badge'
import { Button } from '@/shared/components/ui/button'
import { Input } from '@/shared/components/ui/input'
import { Popover, PopoverContent, PopoverTrigger } from '@/shared/components/ui/popover'
import { ScrollArea } from '@/shared/components/ui/scroll-area'
import { Separator } from '@/shared/components/ui/separator'

interface Props {
  trades: ShowroomProjectTrade[]
  scopes: ShowroomProjectScope[]
  selectedTradeIds: number[]
  selectedScopeIds: number[]
  searchQuery: string
  activeFilterCount: number
  onTradeChange: (ids: number[]) => void
  onScopeChange: (ids: number[]) => void
  onSearchChange: (query: string) => void
  onClear: () => void
}

export function ShowroomFilterBar({
  trades,
  scopes,
  selectedTradeIds,
  selectedScopeIds,
  searchQuery,
  activeFilterCount,
  onTradeChange,
  onScopeChange,
  onSearchChange,
  onClear,
}: Props) {
  const toggleTrade = (tradeId: number) => {
    if (selectedTradeIds.includes(tradeId)) {
      onTradeChange(selectedTradeIds.filter(id => id !== tradeId))
    }
    else {
      onTradeChange([...selectedTradeIds, tradeId])
    }
  }

  const toggleScope = (scopeId: number) => {
    if (selectedScopeIds.includes(scopeId)) {
      onScopeChange(selectedScopeIds.filter(id => id !== scopeId))
    }
    else {
      onScopeChange([...selectedScopeIds, scopeId])
    }
  }

  return (
    <div className="space-y-4">
      {/* Search + scope filter row */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search projects..."
            value={searchQuery}
            onChange={e => onSearchChange(e.target.value)}
            className="pl-9"
          />
        </div>

        {scopes.length > 0 && (
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" size="sm" className="gap-2">
                <SlidersHorizontal className="h-4 w-4" />
                <span className="hidden sm:inline">Scopes</span>
                {selectedScopeIds.length > 0 && (
                  <Badge variant="secondary" className="ml-1 h-5 w-5 rounded-full p-0 text-xs flex items-center justify-center">
                    {selectedScopeIds.length}
                  </Badge>
                )}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-64 p-0" align="start">
              <ScrollArea className="h-64">
                <div className="p-2 space-y-1">
                  {scopes.map(scope => (
                    <button
                      key={scope.id}
                      onClick={() => toggleScope(scope.id)}
                      className={`w-full text-left px-3 py-1.5 rounded-md text-sm transition-colors ${
                        selectedScopeIds.includes(scope.id)
                          ? 'bg-primary/10 text-primary font-medium'
                          : 'hover:bg-muted text-foreground'
                      }`}
                    >
                      {scope.label}
                    </button>
                  ))}
                </div>
              </ScrollArea>
            </PopoverContent>
          </Popover>
        )}

        {activeFilterCount > 0 && (
          <Button variant="ghost" size="sm" onClick={onClear} className="gap-1 text-muted-foreground">
            <X className="h-3 w-3" />
            Clear
          </Button>
        )}
      </div>

      {/* Trade pills */}
      {trades.length > 0 && (
        <>
          <Separator />
          <div className="flex flex-wrap gap-2">
            {trades.map(trade => (
              <button
                key={trade.id}
                onClick={() => toggleTrade(trade.id)}
                className={`rounded-full px-4 py-1.5 text-sm font-medium transition-colors ${
                  selectedTradeIds.includes(trade.id)
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-muted text-muted-foreground hover:bg-muted/80'
                }`}
              >
                {trade.label}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  )
}
