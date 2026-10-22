import type { ProposalFormSchema } from '@/features/proposal-flow/schemas/form-schema'
import { ChevronDownIcon } from 'lucide-react'
import { useState } from 'react'
import { useFormContext, useWatch } from 'react-hook-form'
import { Button } from '@/shared/components/ui/button'
import { AnimatedCollapsibleContent, Collapsible, CollapsibleTrigger } from '@/shared/components/ui/collapsible'
import { FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/shared/components/ui/form'
import { Textarea } from '@/shared/components/ui/textarea'
import { cn } from '@/shared/lib/utils'

export function AgreementNotesItem() {
  const form = useFormContext<ProposalFormSchema>()
  const [open, setOpen] = useState(false)
  const notes = useWatch({ control: form.control, name: 'project.data.agreementNotes' })
  const preview = notes?.split('\n').find(line => line.trim())?.trim()

  return (
    <Collapsible
      open={open}
      onOpenChange={setOpen}
      className="flex min-h-0 flex-none flex-col overflow-hidden rounded-xl border border-border bg-card"
    >
      <CollapsibleTrigger asChild>
        <div className="flex-none data-[state=open]:border-b">
          <div className="flex w-full cursor-pointer items-center justify-between gap-3 px-3 py-2.5 transition-colors hover:bg-row-hover pressed:bg-row-press lg:px-4 lg:py-3">
            <div className="flex min-w-0 flex-col gap-1">
              <span className="px-1 py-0.5 text-sm font-medium lg:text-base">Agreement Notes</span>
              {!open && preview && (
                <span className="truncate px-1 text-sm text-muted-foreground">{preview}</span>
              )}
            </div>
            <ChevronDownIcon
              className={cn(
                'size-5 shrink-0 text-muted-foreground transition-transform duration-200',
                !open && '-rotate-90',
              )}
            />
          </div>
        </div>
      </CollapsibleTrigger>
      <AnimatedCollapsibleContent open={open} className="flex min-h-0 flex-col">
        <div className="min-h-0 overflow-y-auto overscroll-contain px-3 py-3 lg:px-4 lg:py-4">
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
      </AnimatedCollapsibleContent>
    </Collapsible>
  )
}
