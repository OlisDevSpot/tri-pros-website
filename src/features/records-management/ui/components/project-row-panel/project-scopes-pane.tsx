'use client'

import type { ProjectRow } from '@/shared/modules/projects/core/lib/columns-registry'

import { useMemo } from 'react'

import { ExpandedRowPanel } from '@/shared/components/data-table/ui/expanded-row-panel'
import { useConstructionCatalog } from '@/shared/modules/construction/core/hooks/use-construction-catalog'
import { resolveScopes } from '@/shared/modules/construction/core/lib/resolve-catalog-ids'

export function ProjectScopesPane({ project }: { project: ProjectRow }) {
  const catalog = useConstructionCatalog()
  const trades = useMemo(() => {
    const scopesByTrade = new Map<string, string[]>()
    for (const scope of resolveScopes(project.scopeIds, catalog).found) {
      scopesByTrade.set(scope.tradeId, [...(scopesByTrade.get(scope.tradeId) ?? []), scope.name])
    }
    return [...scopesByTrade].map(([tradeId, scopes]) => ({ tradeId, name: catalog.tradesById.get(tradeId)?.name ?? 'Unknown trade', scopes }))
  }, [project.scopeIds, catalog])

  return (
    <ExpandedRowPanel.Pane title="Trades and scopes" isLoading={catalog.isLoading}>
      {trades.length === 0
        ? <p className="text-sm text-muted-foreground">No scopes recorded</p>
        : (
            <ul className="flex flex-col gap-2">
              {trades.map(trade => (
                <li key={trade.tradeId}>
                  <span className="text-sm font-medium">{trade.name}</span>
                  <span className="block text-xs text-muted-foreground">{trade.scopes.join(', ')}</span>
                </li>
              ))}
            </ul>
          )}
    </ExpandedRowPanel.Pane>
  )
}
