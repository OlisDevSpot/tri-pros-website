'use client'

import type { ProposalFormSchema } from '@/features/proposal-flow/schemas/form-schema'
import { PlusIcon, TrashIcon } from 'lucide-react'
import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import { useState } from 'react'
import { useFieldArray, useFormContext, useWatch } from 'react-hook-form'
import { HybridPopoverTooltip } from '@/shared/components/hybridPopoverTooltip'
import { Button } from '@/shared/components/ui/button'
import { AnimatedCollapsibleContent, Collapsible, CollapsibleTrigger } from '@/shared/components/ui/collapsible'
import { FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/shared/components/ui/form'
import { Input } from '@/shared/components/ui/input'
import { MoneyField } from '@/shared/components/ui/money-field'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/components/ui/select'
import { Textarea } from '@/shared/components/ui/textarea'
import { COLLAPSE_HEIGHT_VARIANTS, COLLAPSE_TRANSITION } from '@/shared/constants/motion'
import { SectionFinancialsSummary } from '@/shared/modules/proposals/core/components/section-financials-summary'

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
  const reduceMotion = useReducedMotion()
  const rowTransition = reduceMotion ? { duration: 0 } : COLLAPSE_TRANSITION

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
                        <MoneyField
                          placeholder="$10,000"
                          disabled
                          className="pointer-events-none"
                          value={field.value}
                          onChange={field.onChange}
                        />
                      </span>
                    </HybridPopoverTooltip>
                  )
                : (
                    <MoneyField
                      placeholder="$10,000"
                      className="w-full lg:w-48"
                      value={field.value}
                      onChange={field.onChange}
                    />
                  )}
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />

      {/* Cost Lines */}
      <div>
        <div className="flex items-center justify-between border-t border-border pt-3">
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

        {/* Every row carries its own gap, so an entering or leaving row grows or shrinks with it and nothing snaps. */}
        <AnimatePresence initial={false}>
          {costFields.map((field, lineIndex) => (
            <motion.div
              key={field.id}
              initial={COLLAPSE_HEIGHT_VARIANTS.initial}
              animate={COLLAPSE_HEIGHT_VARIANTS.animate}
              exit={COLLAPSE_HEIGHT_VARIANTS.exit}
              transition={rowTransition}
              className="overflow-hidden"
            >
              <div className="pt-3">
                <Collapsible
                  asChild
                  open={openNotes.has(field.id)}
                  onOpenChange={() => toggleNotes(field.id)}
                >
                  <div className="rounded-lg border border-border bg-card p-3">
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
                              <MoneyField
                                placeholder="$1,000"
                                value={lineField.value || null}
                                onChange={value => lineField.onChange(value ?? 0)}
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
                        <CollapsibleTrigger asChild>
                          <Button
                            type="button"
                            size="sm"
                            variant="ghost"
                            className="text-xs"
                          >
                            {openNotes.has(field.id) ? 'Hide notes' : 'Add notes'}
                          </Button>
                        </CollapsibleTrigger>
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
                    <AnimatedCollapsibleContent open={openNotes.has(field.id)}>
                      <div className="pt-3">
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
                      </div>
                    </AnimatedCollapsibleContent>
                  </div>
                </Collapsible>
              </div>
            </motion.div>
          ))}
          {costFields.length === 0 && (
            <motion.div
              key="empty"
              initial={COLLAPSE_HEIGHT_VARIANTS.initial}
              animate={COLLAPSE_HEIGHT_VARIANTS.animate}
              exit={COLLAPSE_HEIGHT_VARIANTS.exit}
              transition={rowTransition}
              className="overflow-hidden"
            >
              <div className="pt-3">
                <p className="py-3 text-center text-xs text-muted-foreground">
                  No cost lines yet
                </p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Section Incentives */}
      <div>
        <div className="flex items-center justify-between border-t border-border pt-3">
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

        <AnimatePresence initial={false}>
          {incentiveFields.map((field, incIndex) => (
            <motion.div
              key={field.id}
              initial={COLLAPSE_HEIGHT_VARIANTS.initial}
              animate={COLLAPSE_HEIGHT_VARIANTS.animate}
              exit={COLLAPSE_HEIGHT_VARIANTS.exit}
              transition={rowTransition}
              className="overflow-hidden"
            >
              <div className="pt-3">
                <div className="rounded-lg border border-status-success-dot/40 bg-status-success-bg p-3">
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
                            <MoneyField
                              placeholder="$500"
                              value={incField.value || null}
                              onChange={value => incField.onChange(value ?? 0)}
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
              </div>
            </motion.div>
          ))}
          {incentiveFields.length === 0 && (
            <motion.div
              key="empty"
              initial={COLLAPSE_HEIGHT_VARIANTS.initial}
              animate={COLLAPSE_HEIGHT_VARIANTS.animate}
              exit={COLLAPSE_HEIGHT_VARIANTS.exit}
              transition={rowTransition}
              className="overflow-hidden"
            >
              <div className="pt-3">
                <p className="py-3 text-center text-xs text-muted-foreground">
                  No section incentives
                </p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <SectionFinancialsSummary financials={watchedFinancials} priceDisplayMode={pricingMode} />
    </div>
  )
}
