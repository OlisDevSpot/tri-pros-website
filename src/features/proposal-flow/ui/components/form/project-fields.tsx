import type { ProposalFormSchema } from '@/features/proposal-flow/schemas/form-schema'
import type { ProjectType } from '@/shared/types/enums'
import { PlusIcon } from 'lucide-react'
import { AnimatePresence, motion } from 'motion/react'
import { useState } from 'react'
import { useFieldArray, useFormContext, useWatch } from 'react-hook-form'
import { Button } from '@/shared/components/ui/button'
import { Collapsible, CollapsibleTrigger } from '@/shared/components/ui/collapsible'
import { FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/shared/components/ui/form'
import { Input } from '@/shared/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/components/ui/select'
import { Textarea } from '@/shared/components/ui/textarea'
import { projectTypes, validThroughTimeframes } from '@/shared/constants/enums'
import { useConfirm } from '@/shared/hooks/use-confirm'
import { SOWCollapsibleHeader } from './sow-collapsible-header'
import { SOWSection } from './sow-field'

const TRANSITION = { duration: 0.2, ease: [0.25, 0.1, 0.25, 1] } as const

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

  const [DeleteConfirmDialog, confirmDelete] = useConfirm({
    title: 'Delete SOW Section',
    message: 'Are you sure you want to delete this scope of work section? This action cannot be undone.',
  })

  const sowValues = useWatch({ control: form.control, name: 'project.data.sow' })

  async function handleDeleteSection(index: number) {
    const confirmed = await confirmDelete()
    if (!confirmed)
      return

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
  }

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
    <>
      <DeleteConfirmDialog />
      <div className="flex flex-col gap-4 lg:gap-6">
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
                            handleDeleteSection(index)
                          }}
                          pricingMode={pricingMode}
                          sow={sowValues[index] ?? fieldOfArray}
                        />
                      </div>
                    </CollapsibleTrigger>
                    <AnimatePresence initial={false}>
                      {isOpen && (
                        <motion.div
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: 'auto', opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          transition={TRANSITION}
                          className="overflow-hidden"
                        >
                          <SOWSection
                            index={index}
                            pricingMode={pricingMode}
                            sowSnapshot={fieldOfArray}
                          />
                        </motion.div>
                      )}
                    </AnimatePresence>
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
      </div>
    </>
  )
}
