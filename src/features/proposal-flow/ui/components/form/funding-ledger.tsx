import type { ProposalFormSchema } from '@/features/proposal-flow/schemas/form-schema'
import type { PriceDisplayMode } from '@/shared/constants/enums'
import { useFormContext, useWatch } from 'react-hook-form'
import { FUNDING_LEDGER_ROW } from '@/features/proposal-flow/constants/funding-ledger'
import { digitsToNumber } from '@/features/proposal-flow/lib/digits-to-number'
import { FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/shared/components/ui/form'
import { Input } from '@/shared/components/ui/input'
import { formatAsDollars } from '@/shared/lib/formatters'
import {
  computeFinalTcp,
  computeTotalDiscounts,
  computeTotalSectionIncentives,
  computeTotalSectionPrices,
} from '@/shared/modules/proposals/core/lib/financials'
import { FundingLedgerRow } from './funding-ledger-row'

interface Props {
  pricingMode: PriceDisplayMode
}

export function FundingLedger({ pricingMode }: Props) {
  const form = useFormContext<ProposalFormSchema>()
  const funding = useWatch({ control: form.control, name: 'funding' })
  const sow = useWatch({ control: form.control, name: 'project.data.sow' })
  const isBreakdown = pricingMode === 'breakdown'

  return (
    <dl>
      {isBreakdown && (
        <FundingLedgerRow label="Scope of Work" value={formatAsDollars(computeTotalSectionPrices(sow))} />
      )}
      {isBreakdown && (
        <FormField
          name="funding.miscPrice"
          control={form.control}
          render={({ field }) => (
            <FormItem className={FUNDING_LEDGER_ROW}>
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
          <FormItem className={FUNDING_LEDGER_ROW}>
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
      <FundingLedgerRow label="Section incentives" value={`− ${formatAsDollars(computeTotalSectionIncentives(sow))}`} />
      <FundingLedgerRow label="Incentives" value={`− ${formatAsDollars(computeTotalDiscounts(funding))}`} />
      <FundingLedgerRow
        label="Final price"
        value={formatAsDollars(computeFinalTcp({ funding, sow }))}
        className="min-h-13 font-semibold"
      />
    </dl>
  )
}
