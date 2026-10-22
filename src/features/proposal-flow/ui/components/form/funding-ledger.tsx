import type { ProposalFormSchema } from '@/features/proposal-flow/schemas/form-schema'
import type { PriceDisplayMode } from '@/shared/constants/enums'
import { useFormContext, useWatch } from 'react-hook-form'
import { FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/shared/components/ui/form'
import { Input } from '@/shared/components/ui/input'
import { formatAsDollars } from '@/shared/lib/formatters'
import { cn } from '@/shared/lib/utils'
import {
  computeFinalTcp,
  computeTotalDiscounts,
  computeTotalSectionIncentives,
  computeTotalSectionPrices,
} from '@/shared/modules/proposals/core/lib/financials'

interface Props {
  pricingMode: PriceDisplayMode
}

const ROW = 'flex min-h-11 items-center justify-between gap-4 border-t border-border text-sm first:border-t-0'

function ReadOnlyRow({ label, value, className }: { label: string, value: string, className?: string }) {
  return (
    <div className={cn(ROW, className)}>
      <dt>{label}</dt>
      <dd className="tabular-nums">{value}</dd>
    </div>
  )
}

function digitsToNumber(raw: string) {
  return Number(raw.replace(/\D/g, ''))
}

export function FundingLedger({ pricingMode }: Props) {
  const form = useFormContext<ProposalFormSchema>()
  const funding = useWatch({ control: form.control, name: 'funding' })
  const sow = useWatch({ control: form.control, name: 'project.data.sow' })
  const isBreakdown = pricingMode === 'breakdown'

  return (
    <dl>
      {isBreakdown && (
        <ReadOnlyRow label="Scope of Work" value={formatAsDollars(computeTotalSectionPrices(sow))} />
      )}
      {isBreakdown && (
        <FormField
          name="funding.miscPrice"
          control={form.control}
          render={({ field }) => (
            <FormItem className={ROW}>
              <dt><FormLabel>Misc Pricing</FormLabel></dt>
              <dd>
                <FormControl>
                  <Input
                    {...field}
                    className="w-36 text-right"
                    placeholder="$0"
                    onChange={event => field.onChange(digitsToNumber(event.target.value))}
                  />
                </FormControl>
                <FormMessage />
              </dd>
            </FormItem>
          )}
        />
      )}
      <FormField
        name="funding.startingTcp"
        control={form.control}
        render={({ field }) => (
          <FormItem className={ROW}>
            <dt><FormLabel>Total Contract Price</FormLabel></dt>
            <dd>
              <FormControl>
                <Input
                  {...field}
                  className="w-36 text-right"
                  disabled={field.disabled || isBreakdown}
                  placeholder="$50,000"
                  onChange={event => field.onChange(digitsToNumber(event.target.value))}
                />
              </FormControl>
              <FormMessage />
            </dd>
          </FormItem>
        )}
      />
      <ReadOnlyRow label="Section incentives" value={`− ${formatAsDollars(computeTotalSectionIncentives(sow))}`} />
      <ReadOnlyRow label="Incentives" value={`− ${formatAsDollars(computeTotalDiscounts(funding))}`} />
      <ReadOnlyRow
        label="Final price"
        value={formatAsDollars(computeFinalTcp({ funding, sow }))}
        className="min-h-13 font-semibold"
      />
    </dl>
  )
}
