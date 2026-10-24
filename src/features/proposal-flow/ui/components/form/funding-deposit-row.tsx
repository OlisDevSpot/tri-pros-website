import type { ProposalFormSchema } from '@/features/proposal-flow/schemas/form-schema'
import { useFormContext, useWatch } from 'react-hook-form'
import { FUNDING_LEDGER_ROW } from '@/features/proposal-flow/constants/funding-ledger'
import { getProposalAggregates } from '@/features/proposal-flow/lib/get-proposal-aggregates'
import { FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from '@/shared/components/ui/form'
import { Input } from '@/shared/components/ui/input'
import { formatAsDollars } from '@/shared/lib/formatters'
import { cn } from '@/shared/lib/utils'
import { describeDepositCap, getDepositCap } from '@/shared/modules/proposals/core/lib/financials'

export function FundingDepositRow() {
  const form = useFormContext<ProposalFormSchema>()
  // Watched only to re-render: the cap follows the live final price, which either can move.
  useWatch({ control: form.control, name: 'funding' })
  useWatch({ control: form.control, name: 'project.data.sow' })
  const depositCap = getDepositCap(getProposalAggregates(form.getValues()).finalTcp)

  return (
    <FormField
      name="funding.depositAmount"
      control={form.control}
      render={({ field }) => (
        <FormItem className={cn(FUNDING_LEDGER_ROW, 'py-2')}>
          <dt className="flex flex-col">
            <FormLabel>Deposit</FormLabel>
            <FormDescription>{`Leave empty to use the cap: ${describeDepositCap()}.`}</FormDescription>
          </dt>
          <dd>
            <FormControl>
              <Input
                {...field}
                value={field.value ?? ''}
                inputMode="numeric"
                className="w-36 text-right"
                placeholder={formatAsDollars(depositCap)}
                onChange={(event) => {
                  const digits = event.target.value.replace(/\D/g, '')
                  field.onChange(digits === '' ? null : Number(digits))
                }}
              />
            </FormControl>
            <FormMessage />
          </dd>
        </FormItem>
      )}
    />
  )
}
