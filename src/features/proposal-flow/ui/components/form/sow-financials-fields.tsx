'use client'

import type { ProposalFormSchema } from '@/features/proposal-flow/schemas/form-schema'
import { PlusIcon, TrashIcon } from 'lucide-react'
import { useState } from 'react'
import { useFieldArray, useFormContext, useWatch } from 'react-hook-form'
import { HybridPopoverTooltip } from '@/shared/components/hybridPopoverTooltip'
import { Button } from '@/shared/components/ui/button'
import { FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/shared/components/ui/form'
import { Input } from '@/shared/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/components/ui/select'
import { Textarea } from '@/shared/components/ui/textarea'
import { SectionFinancialsSummary } from '@/shared/entities/proposals/components/section-financials-summary'

interface Props {
  index: number
  pricingMode: 'total' | 'breakdown'
}

export function SOWFinancialsFields({ index, pricingMode }: Props) {
  const form = useFormContext<ProposalFormSchema>()

  const { fields: costFields, append: appendCost, remove: removeCost } = useFieldArray({
    control: form.control,
    name: `project.data.sow.${index}.financials.costLines`,
  })

  const { fields: incentiveFields, append: appendIncentive, remove: removeIncentive } = useFieldArray({
    control: form.control,
    name: `project.data.sow.${index}.financials.incentives`,
  })

  const [openNotes, setOpenNotes] = useState<Set<string>>(() => new Set())

  const selectedScopes = useWatch({
    control: form.control,
    name: `project.data.sow.${index}.scopes`,
  })

  const sectionPrice = useWatch({
    control: form.control,
    name: `project.data.sow.${index}.financials.sectionPrice`,
  })
  const costLines = useWatch({
    control: form.control,
    name: `project.data.sow.${index}.financials.costLines`,
  })
  const incentives = useWatch({
    control: form.control,
    name: `project.data.sow.${index}.financials.incentives`,
  })

  const watchedFinancials = { sectionPrice, costLines, incentives }

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
    removeCost(lineIndex)
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
      {/* Section Price — inline on desktop */}
      <FormField
        name={`project.data.sow.${index}.financials.sectionPrice`}
        control={form.control}
        render={({ field }) => (
          <FormItem className="flex flex-col gap-1 lg:flex-row lg:items-center lg:gap-3">
            <FormLabel className="whitespace-nowrap shrink-0">Section Price</FormLabel>
            <FormControl>
              {!isBreakdown
                ? (
                    <HybridPopoverTooltip
                      content={(
                        <div>
                          <p>Disabled in total pricing mode</p>
                          <p className="text-xs text-muted-foreground">Change in proposal settings</p>
                        </div>
                      )}
                      side="right"
                    >
                      <span className="w-full lg:w-48">
                        <Input
                          type="text"
                          placeholder="$10,000"
                          disabled
                          className="pointer-events-none"
                          value={field.value == null ? '' : String(field.value)}
                        />
                      </span>
                    </HybridPopoverTooltip>
                  )
                : (
                    <Input
                      type="text"
                      placeholder="$10,000"
                      className="w-full lg:w-48"
                      value={field.value == null ? '' : String(field.value)}
                      onChange={(e) => {
                        const raw = e.target.value
                        field.onChange(raw.trim() === '' ? null : Number(raw.replace(/\D/g, '')))
                      }}
                    />
                  )}
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
                appendCost({
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

        {costFields.length === 0
          ? (
              <p className="py-3 text-center text-xs text-muted-foreground">
                No cost lines yet
              </p>
            )
          : (
              <div className="space-y-3">
                {costFields.map((field, lineIndex) => (
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

      {/* Section Incentives */}
      <div className="space-y-3">
        <div className="flex items-center justify-between border-t border-border/30 pt-3">
          <h5 className="text-sm font-semibold">Section Incentives</h5>
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="gap-1.5"
            onClick={() => {
              appendIncentive({
                id: crypto.randomUUID(),
                label: '',
                amount: 0,
                notes: '',
              })
            }}
          >
            <PlusIcon className="size-4" />
            Add incentive
          </Button>
        </div>

        {incentiveFields.length === 0
          ? (
              <p className="py-3 text-center text-xs text-muted-foreground">
                No section incentives
              </p>
            )
          : (
              <div className="space-y-3">
                {incentiveFields.map((field, incIndex) => (
                  <div
                    key={field.id}
                    className="rounded-lg border border-emerald-500/20 bg-emerald-500/5 p-3"
                  >
                    <div className="grid grid-cols-1 gap-3 lg:grid-cols-[2fr_1fr_auto]">
                      <FormField
                        name={`project.data.sow.${index}.financials.incentives.${incIndex}.label`}
                        control={form.control}
                        render={({ field: incField }) => (
                          <FormItem>
                            <FormLabel className="text-xs">Label</FormLabel>
                            <FormControl>
                              <Input {...incField} placeholder="Scope discount" />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        name={`project.data.sow.${index}.financials.incentives.${incIndex}.amount`}
                        control={form.control}
                        render={({ field: incField }) => (
                          <FormItem>
                            <FormLabel className="text-xs">Amount</FormLabel>
                            <FormControl>
                              <Input
                                type="text"
                                placeholder="$500"
                                value={incField.value === 0 ? '' : String(incField.value)}
                                onChange={(e) => {
                                  const numeric = Number(e.target.value.replace(/\D/g, ''))
                                  incField.onChange(numeric)
                                }}
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <div className="flex items-end">
                        <Button
                          type="button"
                          size="icon"
                          variant="ghost"
                          className="text-destructive hover:text-destructive"
                          onClick={() => removeIncentive(incIndex)}
                          aria-label="Remove incentive"
                        >
                          <TrashIcon className="size-4" />
                        </Button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
      </div>

      <SectionFinancialsSummary financials={watchedFinancials} pricingMode={pricingMode} />
    </div>
  )
}
