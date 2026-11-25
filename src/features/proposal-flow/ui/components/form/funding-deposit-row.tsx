import type { ProposalFormSchema } from '@/features/proposal-flow/schemas/form-schema'
import { InfoIcon } from 'lucide-react'
import { useFormContext } from 'react-hook-form'
import { FUNDING_LEDGER_ROW } from '@/features/proposal-flow/constants/funding-ledger'
import { HybridPopoverTooltip } from '@/shared/components/hybridPopoverTooltip'
import { FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/shared/components/ui/form'
import { InputGroup, InputGroupAddon, InputGroupButton } from '@/shared/components/ui/input-group'
import { MoneyField } from '@/shared/components/ui/money-field'
import { formatAsDollars } from '@/shared/lib/formatters'
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
        <FormItem className={FUNDING_LEDGER_ROW}>
          <dt><FormLabel>Deposit</FormLabel></dt>
          <dd>
            <InputGroup className="w-36" data-disabled={field.disabled}>
              <InputGroupAddon>
                <HybridPopoverTooltip content={`Leave empty to use the cap: ${describeDepositCap()}.`}>
                  <InputGroupButton size="icon-xs" aria-label="About the deposit cap">
                    <InfoIcon />
                  </InputGroupButton>
                </HybridPopoverTooltip>
              </InputGroupAddon>
              <FormControl>
                <MoneyField
                  {...field}
                  className="flex-1 rounded-none border-0 bg-transparent text-right shadow-none focus-visible:ring-0 dark:bg-transparent"
                  data-slot="input-group-control"
                  placeholder={formatAsDollars(depositCap)}
                />
              </FormControl>
            </InputGroup>
            <FormMessage />
          </dd>
        </FormItem>
      )}
    />
  )
}
