'use client'

import type { TradeSelection } from '@/shared/entities/meetings/schemas'
import { Badge } from '@/shared/components/ui/badge'
import { Checkbox } from '@/shared/components/ui/checkbox'
import { Label } from '@/shared/components/ui/label'
import { Textarea } from '@/shared/components/ui/textarea'
import { meetingPainTypes } from '@/shared/constants/enums'
import { useGetScopes } from '@/shared/services/notion/dal/scopes/hooks/queries/use-get-scopes'

interface TradeDetailProps {
  selection: TradeSelection
  onChange: (updated: TradeSelection) => void
}

export function TradeDetail({ selection, onChange }: TradeDetailProps) {
  const scopesQuery = useGetScopes(
    { query: selection.tradeId, filterProperty: 'relatedTrade' },
    { enabled: !!selection.tradeId },
  )

  const availableScopes = scopesQuery.data ?? []

  function handlePainPointToggle(pain: string) {
    const current = selection.painPoints ?? []
    const next = current.includes(pain)
      ? current.filter(p => p !== pain)
      : [...current, pain]
    onChange({ ...selection, painPoints: next })
  }

  function handleScopeToggle(scopeId: string) {
    const current = selection.selectedScopes ?? []
    const exists = current.some(s => s.id === scopeId)

    if (exists) {
      onChange({ ...selection, selectedScopes: current.filter(s => s.id !== scopeId) })
    }
    else {
      const scope = availableScopes.find(s => s.id === scopeId)
      if (!scope) {
        return
      }
      onChange({
        ...selection,
        selectedScopes: [...current, { id: scope.id, label: scope.name }],
      })
    }
  }

  function handleNotesChange(notes: string) {
    onChange({ ...selection, notes })
  }

  const selectedPainPoints = selection.painPoints ?? []
  const selectedScopeIds = new Set((selection.selectedScopes ?? []).map(s => s.id))

  return (
    <div className="space-y-5 rounded-xl border border-primary/20 bg-primary/5 p-4">
      <div className="flex items-center gap-2">
        <span className="text-sm font-semibold text-primary">{selection.tradeName}</span>
        {selectedPainPoints.length > 0 && (
          <Badge variant="secondary" className="text-xs">
            {`${selectedPainPoints.length} pain${selectedPainPoints.length === 1 ? '' : 's'}`}
          </Badge>
        )}
        {selectedScopeIds.size > 0 && (
          <Badge variant="secondary" className="text-xs">
            {`${selectedScopeIds.size} scope${selectedScopeIds.size === 1 ? '' : 's'}`}
          </Badge>
        )}
      </div>

      {/* Pain Points */}
      <div className="space-y-2">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Pain Points
        </p>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          {meetingPainTypes.map(pain => (
            <label
              key={pain}
              className="flex cursor-pointer items-start gap-2.5 rounded-lg border border-border/50 bg-card p-2.5 transition-colors hover:bg-muted/40"
            >
              <Checkbox
                checked={selectedPainPoints.includes(pain)}
                onCheckedChange={() => handlePainPointToggle(pain)}
                className="mt-0.5 shrink-0"
              />
              <span className="text-xs leading-snug">{pain}</span>
            </label>
          ))}
        </div>
      </div>

      {/* Scopes */}
      {availableScopes.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Specific Work Needed
          </p>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {availableScopes.map(scope => (
              <label
                key={scope.id}
                className="flex cursor-pointer items-start gap-2.5 rounded-lg border border-border/50 bg-card p-2.5 transition-colors hover:bg-muted/40"
              >
                <Checkbox
                  checked={selectedScopeIds.has(scope.id)}
                  onCheckedChange={() => handleScopeToggle(scope.id)}
                  className="mt-0.5 shrink-0"
                />
                <span className="text-xs leading-snug">{scope.name}</span>
              </label>
            ))}
          </div>
        </div>
      )}

      {scopesQuery.isLoading && (
        <p className="text-xs text-muted-foreground">Loading scopes...</p>
      )}

      {/* Notes */}
      <div className="space-y-1.5">
        <Label htmlFor={`notes-${selection.tradeId}`} className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Notes (optional)
        </Label>
        <Textarea
          id={`notes-${selection.tradeId}`}
          value={selection.notes ?? ''}
          onChange={e => handleNotesChange(e.target.value)}
          placeholder={`Additional context for ${selection.tradeName}...`}
          rows={2}
          className="resize-none text-sm"
        />
      </div>
    </div>
  )
}
