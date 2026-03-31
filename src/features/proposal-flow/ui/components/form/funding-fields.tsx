import type { ProposalFormSchema } from '@/features/proposal-flow/schemas/form-schema'
import type { IncentiveType } from '@/shared/types/enums'
import { PlusIcon, TrashIcon } from 'lucide-react'
import { useEffect } from 'react'
import { useFieldArray, useFormContext, useWatch } from 'react-hook-form'
import { formValuesToProposal } from '@/features/proposal-flow/lib/converters'
import { getProposalAggregates } from '@/features/proposal-flow/lib/get-proposal-aggregates'
import { DateTimePicker } from '@/shared/components/date-time-picker'
import { Button } from '@/shared/components/ui/button'
import { FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/shared/components/ui/form'
import { Input } from '@/shared/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/components/ui/select'
import { Textarea } from '@/shared/components/ui/textarea'
import { incentiveTypes } from '@/shared/constants/enums'
import { PricingBreakdown } from '../pricing-breakdown'

interface Props {
  pricingMode: 'total' | 'breakdown'
  showPricingBreakdown?: boolean
  showSettings?: boolean
}

export function FundingFields({
  pricingMode,
  showPricingBreakdown = false,
  showSettings = false,
}: Props) {
  const form = useFormContext<ProposalFormSchema>()

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: 'funding.data.incentives',
  })

  const startingTcp = useWatch({ control: form.control, name: 'funding.data.startingTcp' })
  const incentives = useWatch({ control: form.control, name: 'funding.data.incentives' })
  const sow = useWatch({ control: form.control, name: 'project.data.sow' })
  const miscPrice = useWatch({ control: form.control, name: 'funding.data.miscPrice' })

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
    <section className="space-y-6 lg:space-y-8">
      <div className="flex flex-col gap-4 border border-border/30 shadow p-3 rounded-xl bg-[color-mix(in_oklch,var(--card)_97%,var(--foreground)_3%)] lg:gap-6 lg:p-6">
        {/* Funding heading + fields */}
        <div className="space-y-4">
          <h3 className="text-2xl font-semibold">Funding</h3>
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
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

        {/* Incentives section */}
        {showSettings && (
          <div className="space-y-4">
            <div className="flex items-center justify-between border-t border-border/30 pt-4">
              <h4 className="text-lg font-semibold">Incentives</h4>
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
                }}
              >
                <PlusIcon className="size-4" />
                Add
              </Button>
            </div>

            {fields.length === 0
              ? (
                  <div className="rounded-xl border border-dashed border-border/50 bg-muted/10 px-3 py-6 text-center text-sm text-muted-foreground lg:px-4 lg:py-8">
                    No incentives added
                  </div>
                )
              : (
                  <div className="space-y-3 rounded-xl border border-dashed border-border/50 bg-muted/10 p-2 lg:space-y-4 lg:p-4">
                    {fields.map((field, index) => (
                      <div
                        key={field.id}
                        className="space-y-3 rounded-lg border border-border/40 bg-muted/30 p-3 lg:space-y-4 lg:p-4"
                      >
                        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
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
                        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
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
                        <div className="flex justify-end">
                          <Button
                            type="button"
                            size="sm"
                            variant="destructive"
                            className="gap-1.5"
                            onClick={() => {
                              remove(index)
                            }}
                          >
                            <TrashIcon className="size-4" />
                            Remove
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
          </div>
        )}

        {/* Pricing breakdown helper */}
        {showPricingBreakdown && (
          <div className="w-full">
            <PricingBreakdown proposalData={formValuesToProposal(form.getValues())} />
          </div>
        )}
      </div>
    </section>
  )
}
