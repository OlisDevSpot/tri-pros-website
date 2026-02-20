import type { ProposalFormValues } from '@/features/proposal-flow/schemas/form-schema'
import { HeartHandshakeIcon } from 'lucide-react'
import { useFormContext, useWatch } from 'react-hook-form'
import { FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/shared/components/ui/form'
import { Input } from '@/shared/components/ui/input'
import { InputGroup, InputGroupAddon, InputGroupInput } from '@/shared/components/ui/input-group'

export function HomeownerFields() {
  const form = useFormContext<ProposalFormValues>()

  const customerAge = useWatch({
    control: form.control,
    name: 'homeowner.customerAge',
  })

  return (
    <section className="space-y-8">
      <div className="flex flex-col gap-6 border border-border/30 shadow p-6 rounded-xl bg-[color-mix(in_oklch,var(--card)_97%,var(--foreground)_3%)]">
        <div className="grid lg:grid-cols-2 gap-4">
          <FormField
            name="homeowner.name"
            control={form.control}
            render={({ field }) => (
              <FormItem>
                <FormLabel>Full Name *</FormLabel>
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
                  {/* <Input
                    placeholder="50"
                    {...field}
                    onChange={(e) => {
                      field.onChange(Number(e.target.value) || '')
                    }}
                  /> */}
                  <InputGroup>
                    <InputGroupInput
                      placeholder="Card number"
                      {...field}
                      onChange={(e) => {
                        field.onChange(Number(e.target.value) || '')
                      }}
                    />
                    {customerAge > 62 && (
                      <InputGroupAddon align="inline-end">
                        <HeartHandshakeIcon className="text-green-300" />
                        <span className="text-green-300">Senior</span>
                      </InputGroupAddon>
                    )}
                  </InputGroup>
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
