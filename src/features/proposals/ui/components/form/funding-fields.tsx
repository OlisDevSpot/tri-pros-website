import type { ProposalFormValues } from '@/features/proposals/schemas/form-schema'
import { useFormContext } from 'react-hook-form'
import { FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/shared/components/ui/form'
import { Input } from '@/shared/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/components/ui/select'

export function FundingFields() {
  const form = useFormContext<ProposalFormValues>()

  return (
    <section className="space-y-8">
      <div className="flex flex-col gap-6 border border-border/30 shadow p-6 rounded-xl bg-[color-mix(in_oklch,var(--card)_97%,var(--foreground)_3%)]">
        <div className="grid lg:grid-cols-2 gap-4">
          <FormField
            name="funding.tcp"
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
            name="funding.deposit"
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
          {/* <FormField
            name="funding.fundingType"
            control={form.control}
            render={({ field }) => (
              <FormItem>
                <FormLabel>Funding Type</FormLabel>
                <FormControl>
                  <Select defaultValue="all-cash">
                    <SelectTrigger {...field} className="w-full">
                      <SelectValue placeholder="Select a project type" />
                    </SelectTrigger>
                    <SelectContent {...field}>
                      <SelectItem value="all-cash">
                        All Cash
                      </SelectItem>
                      <SelectItem value="all-finance">
                        All Finance
                      </SelectItem>
                      <SelectItem value="mixed">
                        Mixed
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            name="project.completionDate"
            control={form.control}
            render={({ field }) => (
              <FormItem>
                <FormLabel>Completion Date</FormLabel>
                <FormControl>
                  <Input placeholder="1/30/2030" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          /> */}
        </div>
      </div>
    </section>
  )
}
