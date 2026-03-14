'use client'

import type { ScopeOrAddon } from '@/shared/services/notion/lib/scopes/schema'
import type { Trade } from '@/shared/services/notion/lib/trades/schema'
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/shared/components/ui/accordion'
import { Badge } from '@/shared/components/ui/badge'
import { Checkbox } from '@/shared/components/ui/checkbox'
import { Label } from '@/shared/components/ui/label'

interface Props {
  trades: Trade[]
  scopes: ScopeOrAddon[]
  selectedScopeIds: number[]
  onChange: (ids: number[]) => void
}

export function ProjectScopePicker({ trades, scopes, selectedScopeIds, onChange }: Props) {
  const toggleScope = (scopeId: number) => {
    if (selectedScopeIds.includes(scopeId)) {
      onChange(selectedScopeIds.filter(id => id !== scopeId))
    }
    else {
      onChange([...selectedScopeIds, scopeId])
    }
  }

  // Group scopes by trade using relatedTrade (Notion ID)
  const scopesByTrade = new Map<string, ScopeOrAddon[]>()
  for (const scope of scopes) {
    const tradeId = scope.relatedTrade
    if (!scopesByTrade.has(tradeId)) {
      scopesByTrade.set(tradeId, [])
    }
    scopesByTrade.get(tradeId)!.push(scope)
  }

  return (
    <fieldset className="space-y-4">
      <legend className="text-lg font-semibold text-foreground">Scopes</legend>
      <p className="text-sm text-muted-foreground">
        Select the scopes of work for this project.
        {selectedScopeIds.length > 0 && ` (${selectedScopeIds.length} selected)`}
      </p>

      <Accordion type="multiple" className="w-full">
        {trades.map((trade) => {
          const tradeScopes = scopesByTrade.get(trade.id) ?? []
          if (tradeScopes.length === 0) {
            return null
          }

          const selectedInTrade = tradeScopes.filter(s => selectedScopeIds.includes(Number(s.id))).length

          return (
            <AccordionItem key={trade.id} value={trade.id}>
              <AccordionTrigger className="text-sm">
                <span className="flex items-center gap-2">
                  {trade.name}
                  {selectedInTrade > 0 && (
                    <Badge variant="secondary" className="text-xs">
                      {selectedInTrade}
                    </Badge>
                  )}
                </span>
              </AccordionTrigger>
              <AccordionContent>
                <div className="space-y-2 pl-2">
                  {tradeScopes.map(scope => (
                    <div key={scope.id} className="flex items-center gap-2">
                      <Checkbox
                        id={`scope-${scope.id}`}
                        checked={selectedScopeIds.includes(Number(scope.id))}
                        onCheckedChange={() => toggleScope(Number(scope.id))}
                      />
                      <Label htmlFor={`scope-${scope.id}`} className="cursor-pointer text-sm">
                        {scope.name}
                        {scope.entryType === 'Addon' && (
                          <Badge variant="outline" className="ml-2 text-[10px]">Addon</Badge>
                        )}
                      </Label>
                    </div>
                  ))}
                </div>
              </AccordionContent>
            </AccordionItem>
          )
        })}
      </Accordion>
    </fieldset>
  )
}
