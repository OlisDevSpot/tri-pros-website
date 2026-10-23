import type { ProposalFormSchema } from '@/features/proposal-flow/schemas/form-schema'
import type { ProjectType } from '@/shared/constants/enums'
import { useFormContext } from 'react-hook-form'
import { formatProjectType } from '@/features/proposal-flow/lib/format-project-type'
import { FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/shared/components/ui/form'
import { Input } from '@/shared/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/components/ui/select'
import { projectTypes, validThroughTimeframes } from '@/shared/constants/enums'

export function GeneralFields({ withName = false }: { withName?: boolean }) {
  const form = useFormContext<ProposalFormSchema>()

  return (
    <div className="flex flex-col gap-4 lg:gap-6">
      {withName && (
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
      )}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)_minmax(0,1fr)]">
        <FormField
          name="project.data.type"
          control={form.control}
          render={({ field }) => (
            <FormItem>
              <FormLabel>Project Type</FormLabel>
              <FormControl>
                <Select
                  defaultValue="general-remodeling"
                  disabled={field.disabled}
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
                        {formatProjectType(type)}
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
                  disabled={field.disabled}
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
