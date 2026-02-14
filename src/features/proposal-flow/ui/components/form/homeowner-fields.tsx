import type { ProposalFormValues } from '@/features/proposal-flow/schemas/form-schema'
import { useFormContext } from 'react-hook-form'
import { FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/shared/components/ui/form'
import { Input } from '@/shared/components/ui/input'

export function HomeownerFields() {
  const form = useFormContext<ProposalFormValues>()

  return (
    <section className="space-y-8">
      <div className="flex flex-col gap-6 border border-border/30 shadow p-6 rounded-xl bg-[color-mix(in_oklch,var(--card)_97%,var(--foreground)_3%)]">
        <div className="grid lg:grid-cols-2 gap-4">
          <FormField
            name="homeowner.firstName"
            control={form.control}
            render={({ field }) => (
              <FormItem>
                <FormLabel>First Name *</FormLabel>
                <FormControl>
                  <Input placeholder="John Doe" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            name="homeowner.lastName"
            control={form.control}
            render={({ field }) => (
              <FormItem>
                <FormLabel>Last Name *</FormLabel>
                <FormControl>
                  <Input placeholder="John Doe" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            name="homeowner.phoneNum"
            control={form.control}
            render={({ field }) => (
              <FormItem>
                <FormLabel>Phone *</FormLabel>
                <FormControl>
                  <Input placeholder="8181238765" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            name="homeowner.email"
            control={form.control}
            render={({ field }) => (
              <FormItem>
                <FormLabel>Email *</FormLabel>
                <FormControl>
                  <Input placeholder="oli@example.com" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            name="homeowner.customerAge"
            control={form.control}
            render={({ field }) => (
              <FormItem>
                <FormLabel>Age *</FormLabel>
                <FormControl>
                  <Input
                    placeholder="50"
                    {...field}
                    type="number"
                    onChange={(e) => {
                      field.onChange(Number(e.target.value))
                    }}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>
      </div>
    </section>
  )
}
