import type { ProposalFormSchema } from '@/features/proposal-flow/schemas/form-schema'
import type { TradeAccessor } from '@/shared/db/types'
import { PlusIcon } from 'lucide-react'
import { useFieldArray, useFormContext } from 'react-hook-form'
import { Button } from '@/shared/components/ui/button'
import { FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/shared/components/ui/form'
import { Input } from '@/shared/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/components/ui/select'
import { Textarea } from '@/shared/components/ui/textarea'
import { SOWSection } from './sow-field'

export function ProjectFields() {
  const form = useFormContext<ProposalFormSchema>()

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: `project.sow`,
  })

  return (
    <section className="space-y-8">
      <div className="flex flex-col gap-6 border border-border/30 shadow p-6 rounded-xl bg-[color-mix(in_oklch,var(--card)_97%,var(--foreground)_3%)]">
        <div className="flex flex-col gap-4">
          <div className="flex items-center gap-4 flex-wrap w-full">
            <FormField
              name="project.address"
              control={form.control}
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Address *</FormLabel>
                  <FormControl>
                    <Input placeholder="123 ABC Street" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              name="project.city"
              control={form.control}
              render={({ field }) => (
                <FormItem>
                  <FormLabel>City *</FormLabel>
                  <FormControl>
                    <Input placeholder="Tarzana" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              name="project.state"
              control={form.control}
              render={({ field }) => (
                <FormItem>
                  <FormLabel>State *</FormLabel>
                  <FormControl>
                    <Input placeholder="CA" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              name="project.zipCode"
              control={form.control}
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Zip *</FormLabel>
                  <FormControl>
                    <Input placeholder="91335" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>
          <div className="grid lg:grid-cols-2 gap-4">
            <FormField
              name="project.projectType"
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
          </div>
          <div className="flex flex-col items-start gap-4 min-h-15 flex-wrap">
            <h3>Complete Scope of Work</h3>
            <div className="flex flex-col gap-8 flex-wrap w-full">
              {fields.map((fieldOfArray, index) => (
                <SOWSection
                  key={fieldOfArray.id}
                  index={index}
                  sowSnapshot={fieldOfArray}
                  onDelete={() => remove(index)}
                />
              ))}
              <Button
                type="button"
                size="icon"
                variant="outline"
                onClick={() => append({ scopes: [], title: '', html: '', trade: '' as TradeAccessor })}
              >
                <PlusIcon />
              </Button>
            </div>
          </div>
          <FormField
            name="project.agreementNotes"
            control={form.control}
            render={({ field }) => (
              <FormItem>
                <div className="flex gap-2 items-center">
                  <FormLabel>Agreement Notes</FormLabel>
                  <Button
                    variant="outline"
                    type="button"
                    className="text-xs text-muted-foreground hover:underline"
                    size="sm"
                  >
                    Templates
                  </Button>
                </div>
                <FormControl>
                  <Textarea
                    {...field}
                    value={field.value || ''}
                    placeholder="Tri Pros Remodeling will..."
                    className="min-h-62.5"
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          {/* <FormField
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
          /> */}
        </div>
      </div>
    </section>
  )
}
