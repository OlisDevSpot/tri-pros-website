'use client'

import type { ProposalFormSchema } from '@/features/proposal-flow/schemas/form-schema'
import { PlusIcon } from 'lucide-react'
import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import { useState } from 'react'
import { useFieldArray, useFormContext, useFormState, useWatch } from 'react-hook-form'
import { SOW_PRICING_FIGURE, SOW_PRICING_ROW } from '@/features/proposal-flow/constants/sow-pricing-grid'
import { pricingRowsWithErrors } from '@/features/proposal-flow/lib/pricing-rows-with-errors'
import { SowCostLineRow } from '@/features/proposal-flow/ui/components/form/sow-cost-line-row'
import { SowIncentiveRow } from '@/features/proposal-flow/ui/components/form/sow-incentive-row'
import { SowPricingSummaryRow } from '@/features/proposal-flow/ui/components/form/sow-pricing-summary-row'
import { HybridPopoverTooltip } from '@/shared/components/hybridPopoverTooltip'
import { Button } from '@/shared/components/ui/button'
import { FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/shared/components/ui/form'
import { MoneyField } from '@/shared/components/ui/money-field'
import { COLLAPSE_HEIGHT_VARIANTS, COLLAPSE_TRANSITION } from '@/shared/constants/motion'
import { formatAsDollars } from '@/shared/lib/formatters'
import { cn } from '@/shared/lib/utils'
import { MULTIPLIER_STYLES } from '@/shared/modules/proposals/core/constants/multiplier-styles'
import { computeSectionFinancials, formatMultiplier } from '@/shared/modules/proposals/core/lib/financials'

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

  const { disabled, errors } = useFormState({ control: form.control })
  const reduceMotion = useReducedMotion()
  const rowTransition = reduceMotion ? { duration: 0 } : COLLAPSE_TRANSITION

  const errorRows = pricingRowsWithErrors(errors.project?.data?.sow?.[index]?.financials)
  const [incentivesOpen, setIncentivesOpen] = useState(errorRows.incentives)
  const [costLinesOpen, setCostLinesOpen] = useState(errorRows.costLines)
  const [openNotes, setOpenNotes] = useState<Set<string>>(() => new Set())

  // A new error reveals its row; adjusting during render avoids a frame with the error hidden.
  const [seenErrors, setSeenErrors] = useState(errorRows)
  if (seenErrors.incentives !== errorRows.incentives || seenErrors.costLines !== errorRows.costLines) {
    setSeenErrors(errorRows)
    if (errorRows.incentives) {
      setIncentivesOpen(true)
    }
    if (errorRows.costLines) {
      setCostLinesOpen(true)
    }
  }

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

  const section = computeSectionFinancials({ title: '', financials: { sectionPrice, costLines, incentives } })

  const canAddCostLine = selectedScopes.length > 0
  const isBreakdown = pricingMode === 'breakdown'
  const showOutputs = isBreakdown && section.price != null && section.hasCostLines

  function setNotesOpen(fieldId: string, open: boolean) {
    setOpenNotes((prev) => {
      const next = new Set(prev)
      if (open) {
        next.add(fieldId)
      }
      else {
        next.delete(fieldId)
      }
      return next
    })
  }

  function removeCostLine(lineIndex: number, fieldId: string) {
    removeCost(lineIndex)
    setNotesOpen(fieldId, false)
  }

  return (
    <div className="space-y-1">
      <FormField
        name={`project.data.sow.${index}.financials.sectionPrice`}
        control={form.control}
        render={({ field }) => (
          <FormItem className={cn(SOW_PRICING_ROW, 'px-2')}>
            <FormLabel className="whitespace-nowrap">Section starting price</FormLabel>
            <div>
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
                        <span className="block w-full">
                          <MoneyField
                            placeholder="$10,000"
                            disabled
                            className="pointer-events-none w-full pr-3 text-right"
                            value={field.value}
                            onChange={field.onChange}
                          />
                        </span>
                      </HybridPopoverTooltip>
                    )
                  : (
                      <MoneyField
                        placeholder="$10,000"
                        className="w-full pr-3 text-right"
                        disabled={field.disabled}
                        value={field.value}
                        onChange={field.onChange}
                      />
                    )}
              </FormControl>
              <FormMessage />
            </div>
          </FormItem>
        )}
      />

      <SowPricingSummaryRow
        label="Section Incentives"
        count={incentiveFields.length}
        total={section.incentives === 0 ? '$0' : `−${formatAsDollars(section.incentives)}`}
        open={incentivesOpen}
        onOpenChange={setIncentivesOpen}
      >
        <AnimatePresence initial={false}>
          {incentiveFields.map((field, incentiveIndex) => (
            <motion.div
              key={field.id}
              initial={COLLAPSE_HEIGHT_VARIANTS.initial}
              animate={COLLAPSE_HEIGHT_VARIANTS.animate}
              exit={COLLAPSE_HEIGHT_VARIANTS.exit}
              transition={rowTransition}
              className="overflow-hidden"
            >
              <SowIncentiveRow
                index={index}
                incentiveIndex={incentiveIndex}
                disabled={disabled}
                onRemove={() => removeIncentive(incentiveIndex)}
              />
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
              <p className="py-3 text-center text-xs text-muted-foreground">No section incentives</p>
            </motion.div>
          )}
        </AnimatePresence>
        <div className="px-2 py-2">
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="gap-1.5"
            disabled={disabled}
            onClick={() => {
              appendIncentive({ id: crypto.randomUUID(), label: '', amount: 0, notes: '' })
            }}
          >
            <PlusIcon className="size-4" />
            Add incentive
          </Button>
        </div>
      </SowPricingSummaryRow>

      {isBreakdown && (
        <div className={cn(SOW_PRICING_ROW, 'border-t border-border-strong px-2')}>
          <span className="font-semibold">Section final price</span>
          <span className={cn(SOW_PRICING_FIGURE, 'font-sans text-lg font-bold')}>
            {formatAsDollars(section.netPrice ?? 0)}
          </span>
        </div>
      )}

      <div className="mt-2 space-y-1 border-t border-border pt-2">
        <SowPricingSummaryRow
          label="Cost Lines"
          count={costFields.length}
          total={formatAsDollars(section.jobCost)}
          open={costLinesOpen}
          onOpenChange={setCostLinesOpen}
        >
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
                <SowCostLineRow
                  index={index}
                  lineIndex={lineIndex}
                  scopes={selectedScopes}
                  notesOpen={openNotes.has(field.id)}
                  onNotesOpenChange={open => setNotesOpen(field.id, open)}
                  disabled={disabled}
                  onRemove={() => removeCostLine(lineIndex, field.id)}
                />
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
                <p className="py-3 text-center text-xs text-muted-foreground">No cost lines yet</p>
              </motion.div>
            )}
          </AnimatePresence>
          <div className="flex items-center gap-2 px-2 py-2">
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="gap-1.5"
              disabled={disabled || !canAddCostLine}
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
            {!canAddCostLine && (
              <span className="text-xs text-muted-foreground">Pick scopes for this section first</span>
            )}
          </div>
        </SowPricingSummaryRow>

        {showOutputs && (
          <>
            <div className={cn(SOW_PRICING_ROW, 'px-2 text-sm')}>
              <span className="font-medium">Margin</span>
              <span className={cn(SOW_PRICING_FIGURE, 'font-medium')}>
                {section.margin == null ? '—' : formatAsDollars(section.margin)}
              </span>
            </div>
            <div className={cn(SOW_PRICING_ROW, 'px-2 text-sm')}>
              <span className="font-medium">Multiplier</span>
              <span className={cn(SOW_PRICING_FIGURE, 'font-bold', MULTIPLIER_STYLES[section.tier])}>
                {formatMultiplier(section.multiplier)}
              </span>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
