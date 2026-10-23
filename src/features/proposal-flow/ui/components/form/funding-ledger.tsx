import type { ProposalFormSchema } from '@/features/proposal-flow/schemas/form-schema'
import type { PriceDisplayMode } from '@/shared/constants/enums'
import { useFormContext, useWatch } from 'react-hook-form'
import { FUNDING_LEDGER_ROW } from '@/features/proposal-flow/constants/funding-ledger'
import { useEditLoading } from '@/features/proposal-flow/contexts/edit-loading-context'
import { digitsToNumber } from '@/features/proposal-flow/lib/digits-to-number'
import { formatLedgerAmount } from '@/features/proposal-flow/lib/format-ledger-amount'
import { fundingLedgerLines } from '@/features/proposal-flow/lib/funding-ledger-lines'
import { FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/shared/components/ui/form'
import { Input } from '@/shared/components/ui/input'
import { FundingLedgerRow } from './funding-ledger-row'

interface Props {
  pricingMode: PriceDisplayMode
}

export function FundingLedger({ pricingMode }: Props) {
  const form = useFormContext<ProposalFormSchema>()
  const funding = useWatch({ control: form.control, name: 'funding' })
  const sow = useWatch({ control: form.control, name: 'project.data.sow' })
  // Before the proposal arrives its mode is unknown; the breakdown is the longer shape, so the ledger only
  // ever loses rows when the values land.
  const loading = useEditLoading()
  const lines = fundingLedgerLines({ funding, sow }, loading ? 'breakdown' : pricingMode)

  return (
    <dl>
      {lines.map((line) => {
        if (line.input) {
          const name = line.input === 'miscPrice' ? 'funding.miscPrice' : 'funding.startingTcp'
          return (
            <FormField
              key={line.key}
              name={name}
              control={form.control}
              render={({ field }) => (
                <FormItem className={FUNDING_LEDGER_ROW}>
                  <dt><FormLabel>{line.label}</FormLabel></dt>
                  <dd>
                    <FormControl>
                      <Input
                        {...field}
                        value={field.value ?? ''}
                        className="w-36 text-right"
                        placeholder={line.input === 'miscPrice' ? '$0' : '$50,000'}
                        onChange={event => field.onChange(digitsToNumber(event.target.value))}
                      />
                    </FormControl>
                    <FormMessage />
                  </dd>
                </FormItem>
              )}
            />
          )
        }
        return (
          <FundingLedgerRow
            key={line.key}
            label={line.label}
            value={formatLedgerAmount(line.amount)}
            sub={line.clamped ? 'Incentives exceed the subtotal' : line.sub}
            className={line.key === 'price' ? 'min-h-13 font-semibold' : undefined}
          />
        )
      })}
    </dl>
  )
}
