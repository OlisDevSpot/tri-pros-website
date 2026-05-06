'use client'

import type { ProposalFormSchema } from '@/features/proposal-flow/schemas/form-schema'
import { PlusIcon, TrashIcon } from 'lucide-react'
import { useState } from 'react'
import { useFieldArray, useFormContext, useWatch } from 'react-hook-form'
import { Button } from '@/shared/components/ui/button'
import { FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/shared/components/ui/form'
import { Input } from '@/shared/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/components/ui/select'
import { Textarea } from '@/shared/components/ui/textarea'
import {
  computeSectionCost,
  computeSectionMargin,
  computeSectionMultiplier,
  formatMultiplier,
} from '@/shared/entities/proposals/lib/compute-sow-financials'
import { formatAsDollars } from '@/shared/lib/formatters'

interface Props {
  index: number
  pricingMode: 'total' | 'breakdown'
}

export function SOWFinancialsFields({ index, pricingMode }: Props) {
  const form = useFormContext<ProposalFormSchema>()

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: `project.data.sow.${index}.financials.costLines`,
  })

  const [openNotes, setOpenNotes] = useState<Set<string>>(() => new Set())

  const selectedScopes = useWatch({
    control: form.control,
    name: `project.data.sow.${index}.scopes`,
  })

  // Watch only the financials subtree so TipTap keystrokes (which update
  // contentJSON/html) don't re-render the cost-line editor.
  const sectionPrice = useWatch({
    control: form.control,
    name: `project.data.sow.${index}.financials.sectionPrice`,
  })
  const costLines = useWatch({
    control: form.control,
    name: `project.data.sow.${index}.financials.costLines`,
  })

  const synthSection = { financials: { sectionPrice, costLines } }
  const sectionCost = computeSectionCost(synthSection)
  const sectionMargin = computeSectionMargin(synthSection)
  const sectionMultiplier = computeSectionMultiplier(synthSection)

  const canAddCostLine = selectedScopes.length > 0
  const isBreakdown = pricingMode === 'breakdown'

  function toggleNotes(fieldId: string) {
    setOpenNotes((prev) => {
      const next = new Set(prev)
      if (next.has(fieldId)) {
        next.delete(fieldId)
      }
      else {
        next.add(fieldId)
      }
      return next
    })
  }

  function removeCostLine(lineIndex: number, fieldId: string) {
    remove(lineIndex)
    setOpenNotes((prev) => {
      if (!prev.has(fieldId)) {
        return prev
      }
      const next = new Set(prev)
      next.delete(fieldId)
      return next
    })
  }

  return (
    <div className="space-y-4 px-3 pb-4 pt-2 lg:px-4 lg:pb-5">
      {/* Section Price */}
      <FormField
        name={`project.data.sow.${index}.financials.sectionPrice`}
        control={form.control}
        render={({ field }) => (
          <FormItem className="w-48">
            <FormLabel>
              Section Price
              {!isBreakdown && (
                <span className="ml-2 text-xs text-muted-foreground">(disabled in total mode)</span>
              )}
            </FormLabel>
            <FormControl>
              <Input
                type="text"
                placeholder="$10,000"
                disabled={!isBreakdown}
                value={field.value == null ? '' : String(field.value)}
                onChange={(e) => {
                  const raw = e.target.value
                  field.onChange(raw.trim() === '' ? null : Number(raw.replace(/\D/g, '')))
                }}
              />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />

      {/* Cost Lines */}
      <div className="space-y-3">
        <div className="flex items-center justify-between border-t border-border/30 pt-3">
          <h5 className="text-sm font-semibold">Cost Lines</h5>
          <div className="flex items-center gap-2">
            {!canAddCostLine && (
              <span className="text-xs text-muted-foreground">Pick scopes for this section first</span>
            )}
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="gap-1.5"
              disabled={!canAddCostLine}
              onClick={() => {
                append({
                  id: crypto.randomUUID(),
                  label: '',
                  amount: 0,
                  relatedScopeId: selectedScopes[0]?.id ?? '',
                  notes: '',
                })
              }}
            >
              <PlusIcon className="size-4" />
              Add cost line
            </Button>
          </div>
        </div>

        {fields.length === 0
          ? (
              <p className="py-3 text-center text-xs text-muted-foreground">
                No cost lines yet
              </p>
            )
          : (
              <div className="space-y-3">
                {fields.map((field, lineIndex) => (
                  <div
                    key={field.id}
                    className="rounded-lg border border-border/30 bg-card p-3 space-y-3"
                  >
                    <div className="grid grid-cols-1 gap-3 lg:grid-cols-[2fr_1fr_1.5fr_auto]">
                      <FormField
                        name={`project.data.sow.${index}.financials.costLines.${lineIndex}.label`}
                        control={form.control}
                        render={({ field: lineField }) => (
                          <FormItem>
                            <FormLabel className="text-xs">Label</FormLabel>
                            <FormControl>
                              <Input {...lineField} placeholder="Labor" />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        name={`project.data.sow.${index}.financials.costLines.${lineIndex}.amount`}
                        control={form.control}
                        render={({ field: lineField }) => (
                          <FormItem>
                            <FormLabel className="text-xs">Amount</FormLabel>
                            <FormControl>
                              <Input
                                type="text"
                                placeholder="$1,000"
                                value={lineField.value === 0 ? '' : String(lineField.value)}
                                onChange={(e) => {
                                  const numeric = Number(e.target.value.replace(/\D/g, ''))
                                  lineField.onChange(numeric)
                                }}
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        name={`project.data.sow.${index}.financials.costLines.${lineIndex}.relatedScopeId`}
                        control={form.control}
                        render={({ field: lineField }) => (
                          <FormItem>
                            <FormLabel className="text-xs">Related Scope</FormLabel>
                            <FormControl>
                              <Select value={lineField.value} onValueChange={lineField.onChange}>
                                <SelectTrigger className="w-full">
                                  <SelectValue placeholder="Select scope" />
                                </SelectTrigger>
                                <SelectContent>
                                  {selectedScopes.map(scope => (
                                    <SelectItem key={scope.id} value={scope.id}>
                                      {scope.label}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <div className="flex items-end gap-1">
                        <Button
                          type="button"
                          size="sm"
                          variant="ghost"
                          className="text-xs"
                          onClick={() => toggleNotes(field.id)}
                        >
                          {openNotes.has(field.id) ? 'Hide notes' : 'Add notes'}
                        </Button>
                        <Button
                          type="button"
                          size="icon"
                          variant="ghost"
                          className="text-destructive hover:text-destructive"
                          onClick={() => removeCostLine(lineIndex, field.id)}
                          aria-label="Remove cost line"
                        >
                          <TrashIcon className="size-4" />
                        </Button>
                      </div>
                    </div>
                    {openNotes.has(field.id) && (
                      <FormField
                        name={`project.data.sow.${index}.financials.costLines.${lineIndex}.notes`}
                        control={form.control}
                        render={({ field: lineField }) => (
                          <FormItem>
                            <FormLabel className="text-xs">Notes</FormLabel>
                            <FormControl>
                              <Textarea
                                {...lineField}
                                value={lineField.value ?? ''}
                                placeholder="Additional context for this cost line"
                                rows={2}
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    )}
                  </div>
                ))}
              </div>
            )}
      </div>

      {/* Derived totals */}
      <div className="rounded-lg bg-muted/30 px-4 py-3 space-y-1.5 text-sm">
        <div className="flex items-center justify-between">
          <span className="text-muted-foreground">Total Cost</span>
          <span className="font-medium tabular-nums">{formatAsDollars(sectionCost)}</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-muted-foreground">Margin</span>
          <span className="font-medium tabular-nums">
            {sectionMargin == null ? '—' : formatAsDollars(sectionMargin)}
          </span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-muted-foreground">Multiplier</span>
          <span className="font-semibold tabular-nums">{formatMultiplier(sectionMultiplier)}</span>
        </div>
      </div>
    </div>
  )
}
