'use client'

import type { TradeSelection } from '@/shared/entities/meetings/schemas'
import { Badge } from '@/shared/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/components/ui/card'

interface ClosingScopeCardProps {
  selection: TradeSelection
}

export function ClosingScopeCard({ selection }: ClosingScopeCardProps) {
  const hasScopes = selection.selectedScopes.length > 0
  const hasPainPoints = selection.painPoints.length > 0

  return (
    <Card className="border-border/60">
      <CardHeader className="pb-2 pt-4">
        <div className="flex items-center justify-between gap-2">
          <CardTitle className="text-sm font-semibold">{selection.tradeName}</CardTitle>
          <span className="text-muted-foreground text-xs">
            {selection.selectedScopes.length === 0
              ? 'No scopes selected'
              : `${selection.selectedScopes.length} scope${selection.selectedScopes.length > 1 ? 's' : ''}`}
          </span>
        </div>
      </CardHeader>

      <CardContent className="space-y-3 pb-4">
        {hasScopes
          ? (
              <ul className="space-y-1">
                {selection.selectedScopes.map(scope => (
                  <li className="flex items-start gap-2 text-sm" key={scope.id}>
                    <span className="text-muted-foreground mt-0.5 shrink-0">•</span>
                    <span>{scope.label}</span>
                  </li>
                ))}
              </ul>
            )
          : (
              <p className="text-muted-foreground text-xs italic">No scopes selected for this trade.</p>
            )}

        {hasPainPoints && (
          <div className="flex flex-wrap gap-1.5 pt-1">
            {selection.painPoints.map(pain => (
              <Badge className="text-xs" key={pain} variant="secondary">
                {pain}
              </Badge>
            ))}
          </div>
        )}

        {selection.notes && (
          <p className="text-muted-foreground border-border/40 border-t pt-2 text-xs">
            {selection.notes}
          </p>
        )}
      </CardContent>
    </Card>
  )
}
