import type { ProposalFormSchema } from '@/features/proposal-flow/schemas/form-schema'
import type { ProjectType } from '@/shared/types/enums'
import { useFormContext, useWatch } from 'react-hook-form'
import { FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/shared/components/ui/form'
import { Input } from '@/shared/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/components/ui/select'
import { Switch } from '@/shared/components/ui/switch'
import { projectTypes, validThroughTimeframes } from '@/shared/constants/enums'

export function GeneralFields() {
  const form = useFormContext<ProposalFormSchema>()
  const pricingMode = useWatch({ control: form.control, name: 'meta.pricingMode' })

  return (
    <div className="flex flex-col gap-4 lg:gap-6">
      <FormField
        name="project.data.label"
        control={form.control}
        render={({ field }) => (
          <FormItem>
            <FormLabel>Project Name</FormLabel>
            <FormControl>
              <Input placeholder="John Doe" {...field} />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />
      <div className="flex items-center gap-3">
        <Switch
          checked={pricingMode === 'breakdown'}
          onCheckedChange={checked =>
            form.setValue('meta.pricingMode', checked ? 'breakdown' : 'total')}
        />
        <span className="text-sm font-medium">
          {pricingMode === 'breakdown' ? 'Breakdown Pricing' : 'Total Pricing'}
        </span>
      </div>
      <div className="grid grid-cols-1 gap-3 lg:grid-cols-3 lg:gap-4">
        <FormField
          name="project.data.type"
          control={form.control}
          render={({ field }) => (
            <FormItem>
              <FormLabel>Project Type</FormLabel>
              <FormControl>
                <Select
                  defaultValue="general-remodeling"
                  onValueChange={(val: ProjectType) => {
                    field.onChange(val)
                  }}
                >
                  <SelectTrigger {...field} className="w-full">
                    <SelectValue placeholder="Select a project type" />
                  </SelectTrigger>
                  <SelectContent {...field}>
                    {projectTypes.map(type => (
                      <SelectItem key={type} value={type}>
                        {type.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          name="project.data.timeAllocated"
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
          name="project.data.validThroughTimeframe"
          control={form.control}
          render={({ field }) => (
            <FormItem>
              <FormLabel>Valid Through Timeframe</FormLabel>
              <FormControl>
                <Select
                  defaultValue="60 days"
                  onValueChange={(val: ProjectType) => {
                    field.onChange(val)
                  }}
                >
                  <SelectTrigger {...field} className="w-full">
                    <SelectValue placeholder="Select a timeframe" />
                  </SelectTrigger>
                  <SelectContent {...field}>
                    {validThroughTimeframes.map(tf => (
                      <SelectItem key={tf} value={tf}>{tf}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
      </div>
    </div>
  )
}
