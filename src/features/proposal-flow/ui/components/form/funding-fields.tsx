import type { ProposalFormSchema } from '@/features/proposal-flow/schemas/form-schema'
import type { IncentiveType } from '@/shared/types/enums'
import { PlusIcon, TrashIcon } from 'lucide-react'
import { useEffect } from 'react'
import { useFieldArray, useFormContext, useWatch } from 'react-hook-form'
import { Button } from '@/shared/components/ui/button'
import { FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/shared/components/ui/form'
import { Input } from '@/shared/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/components/ui/select'

interface Props {
  pricingMode: 'total' | 'breakdown'
  showSettings?: boolean
}

export function FundingFields({
  pricingMode,
  showSettings = false,
}: Props) {
  const form = useFormContext<ProposalFormSchema>()

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: 'funding.data.incentives',
  })

  const incentives = useWatch({
    control: form.control,
    name: 'funding.data.incentives',
  })

  const sowPrices = useWatch({ control: form.control, name: 'project.data.sow' })
  const miscPrice = useWatch({ control: form.control, name: 'funding.data.miscPrice' })

  useEffect(() => {
    if (pricingMode !== 'breakdown') {
      const lastStartingTcp = form.getValues('funding.data.startingTcp')
      form.setValue('funding.data.startingTcp', lastStartingTcp)
      return
    }
    const sowTotal = sowPrices.reduce((sum, s) => sum + (s.price ?? 0), 0)
    if (sowTotal === 0)
      return
    form.setValue('funding.data.startingTcp', sowTotal + (miscPrice ?? 0))
  }, [sowPrices, miscPrice, pricingMode, form])

  return (
    <section className="space-y-8">
      <div className="flex flex-col gap-6 border border-border/30 shadow p-6 rounded-xl bg-[color-mix(in_oklch,var(--card)_97%,var(--foreground)_3%)]">
        <div className="flex flex-col gap-4">
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
        { showSettings && (

          <div className="space-y-4 w-full">
            <div className="flex gap-2 items-center">
              <div>
                <h3>Manually Add Incentives</h3>
              </div>
              <Button
                type="button"
                size="sm"
                onClick={() => {
                  append({
                    type: 'discount',
                    amount: 0,
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
                  className="w-full flex items-center gap-4"
                >
                  <div>
                    <Button
                      type="button"
                      size="sm"
                      variant="destructive"
                      onClick={() => {
                        remove(index)
                      }}
                    >
                      <TrashIcon size={20} />
                    </Button>
                  </div>
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
                          <Input
                            {...field}
                            placeholder={incentives[index]?.type === 'discount' ? 'Friends & Family Discount' : 'Complementary 10 ft gutters'}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </section>
  )
}
