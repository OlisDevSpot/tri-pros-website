import type { ProposalFormSchema } from '@/features/proposal-flow/schemas/form-schema'
import { useFormContext } from 'react-hook-form'
import { FUNDING_LEDGER_ROW } from '@/features/proposal-flow/constants/funding-ledger'
import { FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from '@/shared/components/ui/form'
import { Input } from '@/shared/components/ui/input'
import { formatAsDollars } from '@/shared/lib/formatters'
import { cn } from '@/shared/lib/utils'
import { describeDepositCap, getDepositCap } from '@/shared/modules/proposals/core/lib/financials'

interface Props {
  finalTcp: number
}

export function FundingDepositRow({ finalTcp }: Props) {
  const form = useFormContext<ProposalFormSchema>()
  const depositCap = getDepositCap(finalTcp)

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
