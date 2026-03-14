'use client'

import type { ProjectFormData } from '@/shared/entities/projects/schemas'
import { useFormContext } from 'react-hook-form'
import { FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/shared/components/ui/form'
import { Input } from '@/shared/components/ui/input'
import { Textarea } from '@/shared/components/ui/textarea'

export function HomeownerFields() {
  const form = useFormContext<ProjectFormData>()

  return (
    <section className="space-y-8">
      <div className="flex flex-col gap-6 border border-border/30 shadow p-6 rounded-xl bg-[color-mix(in_oklch,var(--card)_97%,var(--foreground)_3%)]">
        <div className="grid lg:grid-cols-2 gap-4">
          <FormField
            name="homeownerName"
            control={form.control}
            render={({ field }) => (
              <FormItem>
                <FormLabel>Homeowner Name</FormLabel>
                <FormControl>
                  <Input
                    placeholder="John Doe"
                    value={field.value ?? ''}
                    onChange={e => field.onChange(e.target.value || null)}
                    onBlur={field.onBlur}
                    name={field.name}
                    ref={field.ref}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            name="projectDuration"
            control={form.control}
            render={({ field }) => (
              <FormItem>
                <FormLabel>Project Duration</FormLabel>
                <FormControl>
                  <Input
                    placeholder="6 weeks"
                    value={field.value ?? ''}
                    onChange={e => field.onChange(e.target.value || null)}
                    onBlur={field.onBlur}
                    name={field.name}
                    ref={field.ref}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            name="homeownerQuote"
            control={form.control}
            render={({ field }) => (
              <FormItem className="lg:col-span-2">
                <FormLabel>Homeowner Quote</FormLabel>
                <FormControl>
                  <Textarea
                    placeholder="What the homeowner said about the project..."
                    rows={3}
                    value={field.value ?? ''}
                    onChange={e => field.onChange(e.target.value || null)}
                    onBlur={field.onBlur}
                    name={field.name}
                    ref={field.ref}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            name="completedAt"
            control={form.control}
            render={({ field }) => (
              <FormItem>
                <FormLabel>Completion Date</FormLabel>
                <FormControl>
                  <Input
                    type="date"
                    value={field.value ?? ''}
                    onChange={e => field.onChange(e.target.value || null)}
                    onBlur={field.onBlur}
                    name={field.name}
                    ref={field.ref}
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
