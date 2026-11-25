import type { ProposalFormSchema } from '@/features/proposal-flow/schemas/form-schema'
import type { PriceDisplayMode } from '@/shared/constants/enums'
import { useFormContext, useWatch } from 'react-hook-form'
import { FUNDING_LEDGER_ROW } from '@/features/proposal-flow/constants/funding-ledger'
import { useEditLoading } from '@/features/proposal-flow/contexts/edit-loading-context'
import { formatLedgerAmount } from '@/features/proposal-flow/lib/format-ledger-amount'
import { fundingLedgerLines } from '@/features/proposal-flow/lib/funding-ledger-lines'
import { FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/shared/components/ui/form'
import { MoneyField } from '@/shared/components/ui/money-field'
import { computeFinalTcp } from '@/shared/modules/proposals/core/lib/financials'
import { FundingDepositRow } from './funding-deposit-row'
import { FundingLedgerRow } from './funding-ledger-row'
import { FundingScopeLine } from './funding-scope-line'

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
  const mode = loading ? 'breakdown' : pricingMode
  const lines = fundingLedgerLines({ funding, sow }, mode)

  return (
    <dl>
      {lines.map((line) => {
        if (line.input) {
          return (
            <FormField
              key={line.key}
              name="funding.startingTcp"
              control={form.control}
              render={({ field }) => (
                <FormItem className={FUNDING_LEDGER_ROW}>
                  <dt><FormLabel>{line.label}</FormLabel></dt>
                  <dd>
                    <FormControl>
                      <MoneyField
                        {...field}
                        className="w-36 text-right"
                        placeholder="$50,000"
                        value={field.value || null}
                        onChange={value => field.onChange(value ?? 0)}
                      />
                    </FormControl>
                    <FormMessage />
                  </dd>
                </FormItem>
              )}
            />
          )
        }
        if (line.key === 'scopeOfWork') {
          return (
            <FundingScopeLine
              key={line.key}
              label={line.label}
              value={formatLedgerAmount(line.amount)}
              sub={line.sub}
              sow={sow}
              pricingMode={mode}
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
      <FundingDepositRow finalTcp={computeFinalTcp({ funding, sow })} />
    </dl>
  )
}
