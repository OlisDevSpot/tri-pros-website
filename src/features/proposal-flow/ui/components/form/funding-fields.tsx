import type { ProposalFormSchema } from '@/features/proposal-flow/schemas/form-schema'
import type { IncentiveType } from '@/shared/modules/proposals/core/schemas'
import { ChevronDownIcon, PlusIcon, TrashIcon } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useFieldArray, useFormContext, useFormState, useWatch } from 'react-hook-form'
import { FUNDING_EYEBROW } from '@/features/proposal-flow/constants/funding-ledger'
import { useEditLoading } from '@/features/proposal-flow/contexts/edit-loading-context'
import { formatProjectType } from '@/features/proposal-flow/lib/format-project-type'
import { getProposalAggregates } from '@/features/proposal-flow/lib/get-proposal-aggregates'
import { LoadingValue } from '@/features/proposal-flow/ui/components/edit-page/loading-value'
import { DateTimePicker } from '@/shared/components/date-time-picker'
import { Button } from '@/shared/components/ui/button'
import { AnimatedCollapsibleContent, Collapsible, CollapsibleTrigger } from '@/shared/components/ui/collapsible'
import { FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/shared/components/ui/form'
import { Input } from '@/shared/components/ui/input'
import { MoneyField } from '@/shared/components/ui/money-field'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/components/ui/select'
import { Textarea } from '@/shared/components/ui/textarea'
import { useConfirm } from '@/shared/hooks/use-confirm'
import { computeFinalTcp, computeTotalDiscounts, computeTotalSectionIncentives } from '@/shared/modules/proposals/core/lib/financials'
import { incentiveTypes } from '@/shared/modules/proposals/core/schemas'
import { FundingHero } from './funding-hero'
import { FundingLedger } from './funding-ledger'
import { IncentiveCollapsibleHeader } from './incentive-collapsible-header'

interface Props {
  pricingMode: 'total' | 'breakdown'
}

export function FundingFields({ pricingMode }: Props) {
  const form = useFormContext<ProposalFormSchema>()
  const loading = useEditLoading()

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: 'funding.incentives',
  })

  const [openIncentives, setOpenIncentives] = useState<Set<number>>(() => new Set())
  const { disabled } = useFormState({ control: form.control })

  const [DeleteConfirmDialog, confirmDelete] = useConfirm({
    title: 'Delete Incentive',
    message: 'Are you sure you want to delete this incentive? This action cannot be undone.',
  })

  const funding = useWatch({ control: form.control, name: 'funding' })
  const incentives = useWatch({ control: form.control, name: 'funding.incentives' })
  const sow = useWatch({ control: form.control, name: 'project.data.sow' })
  const miscPrice = useWatch({ control: form.control, name: 'funding.miscPrice' })

  function toggleIncentive(index: number) {
    setOpenIncentives((prev) => {
      const next = new Set(prev)
      if (next.has(index)) {
        next.delete(index)
      }
      else {
        next.add(index)
      }
      return next
    })
  }

  async function handleRemoveIncentive(index: number) {
    const confirmed = await confirmDelete()
    if (!confirmed)
      return

    remove(index)
    setOpenIncentives((prev) => {
      const next = new Set<number>()
      for (const i of prev) {
        if (i < index)
          next.add(i)
        else if (i > index)
          next.add(i - 1)
      }
      return next
    })
  }

  useEffect(() => {
    // finalTcp is derived via `computeFinalTcp({ funding, sow })` — never set here.
    // In breakdown mode, sync startingTcp to Σ sectionPrice + miscPrice so the
    // canonical formula (startingTcp − global discounts − section incentives) stays correct.
    if (pricingMode !== 'breakdown') {
      return
    }
    const { totalSOWPriceBreakdown } = getProposalAggregates(form.getValues())
    if (!totalSOWPriceBreakdown || totalSOWPriceBreakdown === 0) {
      return
    }
    form.setValue('funding.startingTcp', totalSOWPriceBreakdown + (miscPrice ?? 0))
  }, [sow, miscPrice, pricingMode, form])

  return (
    <>
      <DeleteConfirmDialog />
      <div className="flex flex-col gap-6">
        <FundingHero
          finalPrice={computeFinalTcp({ funding, sow })}
          totalIncentives={computeTotalSectionIncentives(sow) + computeTotalDiscounts(funding)}
        />

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2 lg:items-start">
          <section className="flex flex-col gap-2">
            {/* The Incentives heading shares a row with its Add button; this row matches its height so the two eyebrows line up. */}
            <div className="flex h-8 items-center">
              <h4 className={FUNDING_EYEBROW}>Breakdown</h4>
            </div>
            <FundingLedger pricingMode={pricingMode} />
          </section>

          <section className="flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <h4 className={FUNDING_EYEBROW}>Incentives</h4>
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="gap-1.5"
                disabled={disabled}
                onClick={() => {
                  append({
                    type: 'discount',
                    amount: 0,
                    notes: '',
                  })
                  setOpenIncentives(prev => new Set(prev).add(fields.length))
                }}
              >
                <PlusIcon className="size-4" />
                Add
              </Button>
            </div>

            {/* The incentive count is unknown until the proposal arrives: one closed row stands in. */}
            {loading
              ? (
                  <div aria-hidden className="overflow-hidden rounded-xl border border-border bg-card">
                    <div className="flex items-center justify-between gap-3 px-3 py-2.5 lg:px-4 lg:py-3">
                      <span className="text-sm font-medium lg:text-base">
                        <LoadingValue width={110}>{null}</LoadingValue>
                      </span>
                      <ChevronDownIcon className="size-5 shrink-0 -rotate-90 text-muted-foreground" />
                    </div>
                  </div>
                )
              : fields.length === 0
                ? (
                    <p className="py-4 text-center text-sm text-muted-foreground">
                      No incentives added
                    </p>
                  )
                : (
                    <div className="flex flex-col gap-3 lg:gap-4">
                      {fields.map((field, index) => {
                        const isOpen = openIncentives.has(index)
                        return (
                          <Collapsible
                            key={field.id}
                            open={isOpen}
                            onOpenChange={() => toggleIncentive(index)}
                          >
                            <div className="overflow-hidden rounded-xl border border-border bg-card">
                              <CollapsibleTrigger asChild>
                                <div>
                                  <IncentiveCollapsibleHeader
                                    incentive={incentives[index] ?? field}
                                    isOpen={isOpen}
                                  />
                                </div>
                              </CollapsibleTrigger>
                              <AnimatedCollapsibleContent open={isOpen}>
                                <div className="space-y-3 px-3 pb-3 lg:space-y-4 lg:px-4 lg:pb-4">
                                  <div className="grid grid-cols-1 gap-3 lg:grid-cols-2 lg:gap-4">
                                    <FormField
                                      name={`funding.incentives.${index}.type`}
                                      control={form.control}
                                      render={({ field }) => (
                                        <FormItem>
                                          <FormLabel>Incentive Type</FormLabel>
                                          <FormControl>
                                            <Select
                                              value={field.value}
                                              disabled={field.disabled}
                                              onValueChange={(val: IncentiveType) => {
                                                field.onChange(val)
                                              }}
                                            >
                                              <SelectTrigger {...field} className="w-full">
                                                <SelectValue placeholder="Select an incentive type" />
                                              </SelectTrigger>
                                              <SelectContent {...field}>
                                                {incentiveTypes.map(t => (
                                                  <SelectItem key={t} value={t}>
                                                    {formatProjectType(t)}
                                                  </SelectItem>
                                                ))}
                                              </SelectContent>
                                            </Select>
                                          </FormControl>
                                          <FormMessage />
                                        </FormItem>
                                      )}
                                    />
                                    {incentives[index]?.type === 'discount' && (
                                      <FormField
                                        name={`funding.incentives.${index}.amount`}
                                        control={form.control}
                                        render={({ field }) => (
                                          <FormItem>
                                            <FormLabel>Amount</FormLabel>
                                            <FormControl>
                                              <MoneyField
                                                {...field}
                                                inputMode="numeric"
                                                placeholder="$1,000"
                                                value={field.value || null}
                                                onChange={value => field.onChange(value ?? 0)}
                                              />
                                            </FormControl>
                                            <FormMessage />
                                          </FormItem>
                                        )}
                                      />
                                    )}
                                    {incentives[index]?.type === 'exclusive-offer' && (
                                      <FormField
                                        name={`funding.incentives.${index}.offer`}
                                        control={form.control}
                                        render={({ field }) => (
                                          <FormItem>
                                            <FormLabel>Offer</FormLabel>
                                            <FormControl>
                                              <Input {...field} />
                                            </FormControl>
                                            <FormMessage />
                                          </FormItem>
                                        )}
                                      />
                                    )}
                                  </div>
                                  <div className="grid grid-cols-1 gap-3 lg:grid-cols-2 lg:gap-4">
                                    <FormField
                                      name={`funding.incentives.${index}.notes`}
                                      control={form.control}
                                      render={({ field }) => (
                                        <FormItem>
                                          <FormLabel>Notes</FormLabel>
                                          <FormControl>
                                            {incentives[index]?.type === 'discount'
                                              ? (
                                                  <Input
                                                    {...field}
                                                    placeholder="Friends & Family Discount"
                                                    onChange={(e) => {
                                                      field.onChange(e.target.value || '')
                                                    }}
                                                  />
                                                )
                                              : (
                                                  <Textarea
                                                    {...field}
                                                    placeholder="Complementary 10 ft gutters"
                                                    onChange={(e) => {
                                                      field.onChange(e.target.value || '')
                                                    }}
                                                  />
                                                )}
                                          </FormControl>
                                          <FormMessage />
                                        </FormItem>
                                      )}
                                    />
                                    <FormField
                                      name={`funding.incentives.${index}.expiresAt`}
                                      control={form.control}
                                      render={({ field }) => (
                                        <FormItem>
                                          <FormLabel>Expiration</FormLabel>
                                          {/* The shared picker takes no disabled prop; a disabled fieldset disables its trigger button. */}
                                          <fieldset disabled={field.disabled} className="contents">
                                            <FormControl>
                                              <DateTimePicker
                                                className="h-9 w-full justify-start rounded-md border border-input bg-input-background px-3 py-1 text-sm shadow-xs hover:border-input-hover hover:bg-input-background"
                                                placeholder="Set expiration"
                                                value={field.value ? new Date(field.value) : undefined}
                                                onChange={(date) => {
                                                  field.onChange(date ? date.toISOString() : undefined)
                                                }}
                                              />
                                            </FormControl>
                                          </fieldset>
                                          <FormMessage />
                                        </FormItem>
                                      )}
                                    />
                                  </div>
                                  <div className="flex justify-end">
                                    <Button
                                      type="button"
                                      size="sm"
                                      variant="ghost"
                                      className="gap-1.5 text-destructive-text"
                                      disabled={disabled}
                                      onClick={() => handleRemoveIncentive(index)}
                                    >
                                      <TrashIcon className="size-4" />
                                      Remove incentive
                                    </Button>
                                  </div>
                                </div>
                              </AnimatedCollapsibleContent>
                            </div>
                          </Collapsible>
                        )
                      })}
                    </div>
                  )}
          </section>
        </div>
      </div>
    </>
  )
}
