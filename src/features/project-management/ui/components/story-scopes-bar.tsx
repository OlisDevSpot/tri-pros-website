'use client'

import { Badge } from '@/shared/components/ui/badge'

interface NamedItem {
  id: string
  name: string
}

interface Props {
  trades: NamedItem[]
  scopes: NamedItem[]
}

export function StoryScopesBar({ trades, scopes }: Props) {
  if (trades.length === 0 && scopes.length === 0) {
    return null
  }

  return (
    <section className="sticky top-0 z-10 border-b bg-background/80 backdrop-blur-md">
      <div className="mx-auto max-w-7xl overflow-x-auto px-4 py-3 sm:px-6 lg:px-8">
        <div className="flex items-center gap-2">
          {trades.map(trade => (
            <Badge key={`trade-${trade.id}`} variant="default" className="shrink-0">
              {trade.name}
            </Badge>
          ))}
          {scopes.length > 0 && trades.length > 0 && (
            <div className="mx-1 h-4 w-px shrink-0 bg-border" />
          )}
          {scopes.map(scope => (
            <Badge key={`scope-${scope.id}`} variant="outline" className="shrink-0">
              {scope.name}
            </Badge>
          ))}
        </div>
      </div>
    </section>
  )
}
