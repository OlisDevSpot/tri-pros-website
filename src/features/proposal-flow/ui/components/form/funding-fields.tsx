import type { ProposalFormSchema } from '@/features/proposal-flow/schemas/form-schema'
import type { IncentiveType } from '@/shared/constants/enums'
import { PlusIcon } from 'lucide-react'
import { AnimatePresence, motion } from 'motion/react'
import { useEffect, useState } from 'react'
import { useFieldArray, useFormContext, useWatch } from 'react-hook-form'
import { formValuesToProposal } from '@/features/proposal-flow/lib/converters'
import { getProposalAggregates } from '@/features/proposal-flow/lib/get-proposal-aggregates'
import { DateTimePicker } from '@/shared/components/date-time-picker'
import { Button } from '@/shared/components/ui/button'
import { Collapsible, CollapsibleTrigger } from '@/shared/components/ui/collapsible'
import { FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/shared/components/ui/form'
import { Input } from '@/shared/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/components/ui/select'
import { Textarea } from '@/shared/components/ui/textarea'
import { incentiveTypes } from '@/shared/constants/enums'
import { useConfirm } from '@/shared/hooks/use-confirm'
import { PricingBreakdown } from '../pricing-breakdown'
import { IncentiveCollapsibleHeader } from './incentive-collapsible-header'

const TRANSITION = { duration: 0.2, ease: [0.25, 0.1, 0.25, 1] } as const

interface Props {
  pricingMode: 'total' | 'breakdown'
}

export function FundingFields({ pricingMode }: Props) {
  const form = useFormContext<ProposalFormSchema>()

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: 'funding.data.incentives',
  })

  const [openIncentives, setOpenIncentives] = useState<Set<number>>(() => new Set())

  const [DeleteConfirmDialog, confirmDelete] = useConfirm({
    title: 'Delete Incentive',
    message: 'Are you sure you want to delete this incentive? This action cannot be undone.',
  })

  const startingTcp = useWatch({ control: form.control, name: 'funding.data.startingTcp' })
  const incentives = useWatch({ control: form.control, name: 'funding.data.incentives' })
  const sow = useWatch({ control: form.control, name: 'project.data.sow' })
  const miscPrice = useWatch({ control: form.control, name: 'funding.data.miscPrice' })
  const showPricingBreakdown = useWatch({ control: form.control, name: 'funding.meta.showPricingBreakdown' })

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
    const { totalProjectDiscounts, totalSOWPriceBreakdown } = getProposalAggregates(form.getValues())

    if (pricingMode !== 'breakdown') {
      form.setValue('funding.data.finalTcp', startingTcp - totalProjectDiscounts)
    }
    else {
      if (!totalSOWPriceBreakdown || totalSOWPriceBreakdown === 0)
        return
      form.setValue('funding.data.startingTcp', totalSOWPriceBreakdown + (miscPrice ?? 0))
      form.setValue('funding.data.finalTcp', totalSOWPriceBreakdown + (miscPrice ?? 0) - totalProjectDiscounts)
    }
  }, [sow, miscPrice, pricingMode, incentives, form, startingTcp])

  return (
    <>
      <DeleteConfirmDialog />
      <div className="flex flex-col gap-4 lg:gap-6">
        {/* Base Pricing */}
        <div className="space-y-3">
          <div className="grid grid-cols-1 gap-3 lg:grid-cols-3 lg:gap-4">
            {pricingMode === 'breakdown' && (
              <FormField
                name="funding.data.miscPrice"
                control={form.control}
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Misc Pricing</FormLabel>
                    <FormControl>
                      <Input
                        {...field}
                        placeholder="$0"
                        onChange={(value) => {
                          const numericValue = Number(value.target.value.replace(/\D/g, ''))
                          field.onChange(numericValue)
                        }}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}
            <FormField
              name="funding.data.startingTcp"
              control={form.control}
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Total Contract Price</FormLabel>
                  <FormControl>
                    <Input
                      {...field}
                      disabled={pricingMode === 'breakdown'}
                      placeholder="$50,000"
                      onChange={(value) => {
                        const numericValue = Number(value.target.value.replace(/\D/g, ''))
                        field.onChange(numericValue)
                      }}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              name="funding.data.depositAmount"
              control={form.control}
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Deposit</FormLabel>
                  <FormControl>
                    <Input
                      {...field}
                      placeholder="$1,000"
                      onChange={(value) => {
                        const numericValue = Number(value.target.value.replace(/\D/g, ''))
                        field.onChange(numericValue)
                      }}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>
        </div>

        {/* Incentives */}
        <div className="space-y-3 lg:space-y-4">
          <div className="flex items-center justify-between border-t border-border/30 pt-3 lg:pt-4">
            <h4 className="text-base font-semibold lg:text-lg">Incentives</h4>
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="gap-1.5"
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

          {fields.length === 0
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
                        <div className="overflow-hidden rounded-xl border border-border/30 bg-[color-mix(in_oklch,var(--card)_97%,var(--foreground)_3%)]">
                          <CollapsibleTrigger asChild>
                            <div>
                              <IncentiveCollapsibleHeader
                                incentive={incentives[index] ?? field}
                                isOpen={isOpen}
                                onDelete={(e) => {
                                  e.stopPropagation()
                                  handleRemoveIncentive(index)
                                }}
                              />
                            </div>
                          </CollapsibleTrigger>
                          <AnimatePresence initial={false}>
                            {isOpen && (
                              <motion.div
                                initial={{ height: 0, opacity: 0 }}
                                animate={{ height: 'auto', opacity: 1 }}
                                exit={{ height: 0, opacity: 0 }}
                                transition={TRANSITION}
                                className="overflow-hidden"
                              >
                                <div className="space-y-3 px-3 pb-3 lg:space-y-4 lg:px-4 lg:pb-4">
                                  <div className="grid grid-cols-1 gap-3 lg:grid-cols-2 lg:gap-4">
                                    <FormField
                                      name={`funding.data.incentives.${index}.type`}
                                      control={form.control}
                                      render={({ field }) => (
                                        <FormItem>
                                          <FormLabel>Incentive Type</FormLabel>
                                          <FormControl>
                                            <Select
                                              defaultValue="discount"
                                              onValueChange={(val: IncentiveType) => {
                                                field.onChange(val)
                                              }}
                                            >
                                              <SelectTrigger {...field} className="w-full">
                                                <SelectValue placeholder="Select an incentive type" />
                                              </SelectTrigger>
                                              <SelectContent {...field}>
                                                {incentiveTypes.filter(t => t === 'discount' || t === 'exclusive-offer').map(t => (
                                                  <SelectItem key={t} value={t}>
                                                    {t.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}
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
                                        name={`funding.data.incentives.${index}.amount`}
                                        control={form.control}
                                        render={({ field }) => (
                                          <FormItem>
                                            <FormLabel>Amount</FormLabel>
                                            <FormControl>
                                              <Input
                                                {...field}
                                                placeholder="$1,000"
                                                onChange={(value) => {
                                                  const numericValue = Number(value.target.value.replace(/\D/g, ''))
                                                  field.onChange(numericValue)
                                                  const { totalProjectDiscounts } = getProposalAggregates(form.getValues())
                                                  form.setValue('funding.data.finalTcp', form.getValues('funding.data.startingTcp') - totalProjectDiscounts)
                                                }}
                                              />
                                            </FormControl>
                                            <FormMessage />
                                          </FormItem>
                                        )}
                                      />
                                    )}
                                    {incentives[index]?.type === 'exclusive-offer' && (
                                      <FormField
                                        name={`funding.data.incentives.${index}.offer`}
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
                                      name={`funding.data.incentives.${index}.notes`}
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
                                      name={`funding.data.incentives.${index}.expiresAt`}
                                      control={form.control}
                                      render={({ field }) => (
                                        <FormItem>
                                          <FormLabel>Expiration</FormLabel>
                                          <FormControl>
                                            <DateTimePicker
                                              className="h-9 w-full justify-start rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs"
                                              placeholder="Set expiration"
                                              value={field.value ? new Date(field.value) : undefined}
                                              onChange={(date) => {
                                                field.onChange(date ? date.toISOString() : undefined)
                                              }}
                                            />
                                          </FormControl>
                                          <FormMessage />
                                        </FormItem>
                                      )}
                                    />
                                  </div>
                                </div>
                              </motion.div>
                            )}
                          </AnimatePresence>
                        </div>
                      </Collapsible>
                    )
                  })}
                </div>
              )}
        </div>

        {/* Pricing breakdown helper */}
        {showPricingBreakdown && (
          <div className="w-full">
            <PricingBreakdown proposalData={formValuesToProposal(form.getValues())} />
          </div>
        )}
      </div>
    </>
  )
}
