import type { ProposalFormValues } from '@/features/proposals/schemas/form-schema'
import { useFormContext } from 'react-hook-form'
import { FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/shared/components/ui/form'
import { Input } from '@/shared/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/components/ui/select'

export function ProjectFields() {
  const form = useFormContext<ProposalFormValues>()

  return (
    <section className="space-y-8">
      <div className="flex flex-col gap-6 border border-border/30 shadow p-6 rounded-xl bg-[color-mix(in_oklch,var(--card)_97%,var(--foreground)_3%)]">
        <div className="grid lg:grid-cols-2 gap-4">
          <FormField
            name="project.type"
            control={form.control}
            render={({ field }) => (
              <FormItem>
                <FormLabel>Project Type</FormLabel>
                <FormControl>
                  <Select defaultValue="general-remodeling">
                    <SelectTrigger {...field} className="w-full">
                      <SelectValue placeholder="Select a project type" />
                    </SelectTrigger>
                    <SelectContent {...field}>
                      <SelectItem value="general-remodeling">
                        General Remodeling
                      </SelectItem>
                      <SelectItem value="energy-efficient">
                        Energy Efficient
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            name="project.timeAllocated"
            control={form.control}
            render={({ field }) => (
              <FormItem>
                <FormLabel>Time Allocated</FormLabel>
                <FormControl>
                  <Input placeholder="4-6 weeks" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            name="project.startDate"
            control={form.control}
            render={({ field }) => (
              <FormItem>
                <FormLabel>Start Date</FormLabel>
                <FormControl>
                  <Input placeholder="1/1/2030" {...field} />
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
          />
        </div>
      </div>
    </section>
  )
}
