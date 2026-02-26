import type { ProposalFormSchema } from '@/features/proposal-flow/schemas/form-schema'
import { useFormContext } from 'react-hook-form'
import { FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/shared/components/ui/form'
import { Input } from '@/shared/components/ui/input'

interface Props {
  showSettings?: boolean
}

export function FundingFields({
  showSettings = false,
}: Props) {
  const form = useFormContext<ProposalFormSchema>()

  return (
    <section className="space-y-8">
      <div className="flex flex-col gap-6 border border-border/30 shadow p-6 rounded-xl bg-[color-mix(in_oklch,var(--card)_97%,var(--foreground)_3%)]">
        <div className="grid lg:grid-cols-2 gap-4">
          <FormField
            name="funding.data.tcp"
            control={form.control}
            render={({ field }) => (
              <FormItem>
                <FormLabel>Total Contract Price</FormLabel>
                <FormControl>
                  <Input
                    {...field}
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
        { showSettings && (

          <div className="grid lg:grid-cols-2 gap-4">
            SETTINGS!
          </div>
        )}
      </div>
    </section>
  )
}
