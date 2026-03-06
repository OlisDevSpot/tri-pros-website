import type { ProposalFormSchema } from '@/features/proposal-flow/schemas/form-schema'
import type { IncentiveType } from '@/shared/types/enums'
import { PlusIcon, TrashIcon } from 'lucide-react'
import { useEffect } from 'react'
import { useFieldArray, useFormContext, useWatch } from 'react-hook-form'
import { formValuesToProposal } from '@/features/proposal-flow/lib/converters'
import { getProposalAggregates } from '@/features/proposal-flow/lib/get-proposal-aggregates'
import { Button } from '@/shared/components/ui/button'
import { FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/shared/components/ui/form'
import { Input } from '@/shared/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/components/ui/select'
import { Textarea } from '@/shared/components/ui/textarea'
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
  const _finalTcp = useWatch({ control: form.control, name: 'funding.data.finalTcp' })

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
    <section className="space-y-8">
      <div className="flex flex-col gap-6 border border-border/30 shadow p-6 rounded-xl bg-[color-mix(in_oklch,var(--card)_97%,var(--foreground)_3%)]">
        <div className="flex gap-12 justify-between items-start">
          <div className="space-y-4">
            <div>
              <h3 className="text-2xl font-semibold">Funding</h3>
            </div>
            <div className="space-y-6">
              {pricingMode === 'breakdown' && (
                <FormField
                  name="funding.data.miscPrice"
                  control={form.control}
                  render={({ field }) => (
                    <FormItem className="max-w-62.5">
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
                  <FormItem className="max-w-62.5">
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
                  <FormItem className="max-w-62.5">
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
          { showSettings && (

            <div className="space-y-4 w-full">
              <div className="flex gap-3 items-center">
                <div>
                  <h3 className="text-2xl font-semibold">Incentives</h3>
                </div>
                <Button
                  type="button"
                  size="icon"
                  variant="outline"
                  className="size-8"
                  onClick={() => {
                    append({
                      type: 'discount',
                      amount: 0,
                      notes: '',
                    })
                  }}
                >
                  <PlusIcon size={20} />
                </Button>
              </div>
              <div className="flex flex-col gap-6 w-full">
                {fields.map((field, index) => (
                  <div
                    key={field.id}
                    className="w-full flex items-start gap-4"
                  >
                    <FormField
                      name={`funding.data.incentives.${index}.type`}
                      control={form.control}
                      render={({ field }) => (
                        <FormItem className="w-50">
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
                                <SelectItem value="discount">
                                  Discount
                                </SelectItem>
                                <SelectItem value="exclusive-offer">
                                  Exclusive Offer
                                </SelectItem>
                              </SelectContent>
                            </Select>
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    {
                      incentives[index]?.type === 'exclusive-offer' && (
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
                      )
                    }
                    { incentives[index]?.type === 'discount' && (
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
                    <FormField
                      name={`funding.data.incentives.${index}.notes`}
                      control={form.control}
                      render={({ field }) => (
                        <FormItem className="grow">
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
                    <div className="self-end">
                      <Button
                        type="button"
                        size="sm"
                        variant="destructive"
                        className="size-9"
                        onClick={() => {
                          remove(index)
                        }}
                      >
                        <TrashIcon size={20} />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
        {showPricingBreakdown && (
          <div className="w-full">
            <PricingBreakdown proposalData={formValuesToProposal(form.getValues())} />
          </div>
        )}
      </div>
    </section>
  )
}
