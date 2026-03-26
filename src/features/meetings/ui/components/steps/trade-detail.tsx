'use client'

import type { TradeSelection } from '@/shared/entities/meetings/schemas'
import { useState } from 'react'
import { ScopeCard } from '@/features/meetings/ui/components/steps/scope-card'
import { AccordionContent, AccordionItem, AccordionTrigger } from '@/shared/components/ui/accordion'
import { Checkbox } from '@/shared/components/ui/checkbox'
import { Label } from '@/shared/components/ui/label'
import { Textarea } from '@/shared/components/ui/textarea'
import { meetingPainTypes } from '@/shared/constants/enums'
import { useGetScopes } from '@/shared/services/notion/dal/scopes/hooks/queries/use-get-scopes'

interface TradeDetailProps {
  selection: TradeSelection
  index: number
  onChange: (updated: TradeSelection) => void
}

export function TradeDetail({ selection, index, onChange }: TradeDetailProps) {
  const scopesQuery = useGetScopes(
    { query: selection.tradeId, filterProperty: 'relatedTrade' },
    { enabled: !!selection.tradeId },
  )

  const availableScopes = scopesQuery.data?.filter(s => s.entryType === 'Scope') ?? []
  const [localNotes, setLocalNotes] = useState(selection.notes ?? '')

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

  function handleNotesBlur() {
    if (localNotes !== (selection.notes ?? '')) {
      onChange({ ...selection, notes: localNotes })
    }
  }

  const selectedPainPoints = selection.painPoints ?? []
  const selectedScopes = selection.selectedScopes ?? []
  const selectedScopeIds = new Set(selectedScopes.map(s => s.id))

  // Build summary parts for the trigger
  const summaryParts: string[] = []
  if (selectedScopes.length > 0) {
    summaryParts.push(`${selectedScopes.length} scope${selectedScopes.length !== 1 ? 's' : ''}`)
  }
  if (selectedPainPoints.length > 0) {
    summaryParts.push(`${selectedPainPoints.length} pain point${selectedPainPoints.length !== 1 ? 's' : ''}`)
  }
  if (localNotes.trim()) {
    summaryParts.push('has notes')
  }

  return (
    <AccordionItem
      value={selection.tradeId}
      className="overflow-hidden rounded-xl border border-border/50 bg-card shadow-sm last:border-b"
    >
      <AccordionTrigger className="px-5 py-4 hover:no-underline hover:bg-muted/30 data-[state=open]:bg-muted/20 transition-colors">
        <div className="flex w-full items-center justify-between gap-3 pr-3">
          <div className="flex items-start gap-3">
            <span className="w-6 shrink-0 pt-0.5 text-xl font-light leading-tight tabular-nums text-muted-foreground/40">
              {String(index + 1).padStart(2, '0')}
            </span>
            <div className="space-y-1 text-left">
              <p className="text-base font-semibold leading-snug tracking-tight">
                {selection.tradeName}
              </p>
              <div className="flex flex-wrap items-center gap-1.5 text-xs font-normal text-muted-foreground">
                {summaryParts.length > 0
                  ? summaryParts.map((part, i) => (
                      <span key={part} className="flex items-center gap-1.5">
                        {i > 0 && <span className="text-muted-foreground/40">·</span>}
                        <span>{part}</span>
                      </span>
                    ))
                  : <span className="italic text-muted-foreground/60">Not configured yet</span>}
              </div>
              {selectedScopes.length > 0 && (
                <div className="flex flex-wrap gap-1 pt-0.5">
                  {selectedScopes.map(scope => (
                    <span
                      key={scope.id}
                      className="inline-flex items-center rounded-md border border-primary/15 bg-primary/8 px-2 py-0.5 text-[11px] font-medium text-primary"
                    >
                      {scope.label}
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </AccordionTrigger>

      <AccordionContent className="px-5 pb-5 pt-3">
        <div className="space-y-5">
          {/* Scopes — visual cards */}
          {availableScopes.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Specific Work Needed
              </p>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                {availableScopes.map(scope => (
                  <ScopeCard
                    key={scope.id}
                    scope={scope}
                    isSelected={selectedScopeIds.has(scope.id)}
                    onToggle={handleScopeToggle}
                  />
                ))}
              </div>
            </div>
          )}

          {scopesQuery.isLoading && (
            <p className="text-xs text-muted-foreground">Loading scopes...</p>
          )}

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

          {/* Notes */}
          <div className="space-y-1.5">
            <Label htmlFor={`notes-${selection.tradeId}`} className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Notes (optional)
            </Label>
            <Textarea
              id={`notes-${selection.tradeId}`}
              value={localNotes}
              onChange={e => setLocalNotes(e.target.value)}
              onBlur={handleNotesBlur}
              placeholder={`Additional context for ${selection.tradeName}...`}
              rows={2}
              className="resize-none text-sm"
            />
          </div>
        </div>
      </AccordionContent>
    </AccordionItem>
  )
}
