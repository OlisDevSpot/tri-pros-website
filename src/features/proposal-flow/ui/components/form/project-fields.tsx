import type { ProposalFormSchema } from '@/features/proposal-flow/schemas/form-schema'
import type { ProjectType } from '@/shared/types/enums'
import { PlusIcon } from 'lucide-react'
import { useState } from 'react'
import { useFieldArray, useFormContext, useWatch } from 'react-hook-form'
import { Button } from '@/shared/components/ui/button'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/shared/components/ui/collapsible'
import { FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/shared/components/ui/form'
import { Input } from '@/shared/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/components/ui/select'
import { Textarea } from '@/shared/components/ui/textarea'
import { projectTypes, validThroughTimeframes } from '@/shared/constants/enums'
import { SOWCollapsibleHeader } from './sow-collapsible-header'
import { SOWSection } from './sow-field'

interface Props {
  pricingMode: 'total' | 'breakdown'
}

export function ProjectFields({ pricingMode }: Props) {
  const form = useFormContext<ProposalFormSchema>()

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: `project.data.sow`,
  })

  const [openSections, setOpenSections] = useState<Set<number>>(() => new Set([0]))

  const sowValues = useWatch({ control: form.control, name: 'project.data.sow' })

  function toggleSection(index: number) {
    setOpenSections((prev) => {
      const next = new Set(prev)
      if (next.has(index)) {
        next.delete(index)
      }
      else {
        next.add(index)
      }
      return next
    })
  }

  return (
    <section className="space-y-8">
      <div className="flex flex-col gap-6 border border-border/30 shadow p-6 rounded-xl bg-[color-mix(in_oklch,var(--card)_97%,var(--foreground)_3%)]">
        <div className="flex flex-col gap-4">
          <div className="grid lg:grid-cols-3 gap-4">
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
                        <SelectValue placeholder="Select a project type" />
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
          <div className="flex flex-col items-start gap-4 min-h-15 flex-wrap">
            <h3>Complete Scope of Work</h3>
            <div className="flex flex-col gap-4 w-full">
              {fields.map((fieldOfArray, index) => {
                const isOpen = openSections.has(index)
                return (
                  <Collapsible
                    key={fieldOfArray.id}
                    open={isOpen}
                    onOpenChange={() => toggleSection(index)}
                  >
                    <div className="border border-border/30 rounded-xl overflow-hidden bg-[color-mix(in_oklch,var(--card)_97%,var(--foreground)_3%)]">
                      <CollapsibleTrigger asChild>
                        <div>
                          <SOWCollapsibleHeader
                            isOpen={isOpen}
                            onDelete={(e) => {
                              e.stopPropagation()
                              remove(index)
                              setOpenSections((prev) => {
                                const next = new Set<number>()
                                for (const i of prev) {
                                  if (i < index)
                                    next.add(i)
                                  else if (i > index)
                                    next.add(i - 1)
                                }
                                return next
                              })
                            }}
                            pricingMode={pricingMode}
                            sow={sowValues[index] ?? fieldOfArray}
                          />
                        </div>
                      </CollapsibleTrigger>
                      <CollapsibleContent>
                        <SOWSection
                          index={index}
                          pricingMode={pricingMode}
                          sowSnapshot={fieldOfArray}
                        />
                      </CollapsibleContent>
                    </div>
                  </Collapsible>
                )
              })}
              <Button
                type="button"
                size="icon"
                variant="outline"
                onClick={() => {
                  append({
                    contentJSON: '',
                    html: '',
                    price: pricingMode === 'breakdown' ? 0 : undefined,
                    scopes: [],
                    title: '',
                    trade: {
                      id: '',
                      label: '',
                    },
                  })
                  setOpenSections(prev => new Set(prev).add(fields.length))
                }}
              >
                <PlusIcon />
              </Button>
            </div>
          </div>
          <FormField
            name="project.data.agreementNotes"
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
