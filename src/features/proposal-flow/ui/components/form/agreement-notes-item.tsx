import type { ProposalFormSchema } from '@/features/proposal-flow/schemas/form-schema'
import { ChevronDownIcon } from 'lucide-react'
import { useState } from 'react'
import { useFormContext, useFormState, useWatch } from 'react-hook-form'
import { Button } from '@/shared/components/ui/button'
import { AnimatedCollapsibleContent, Collapsible, CollapsibleTrigger } from '@/shared/components/ui/collapsible'
import { FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/shared/components/ui/form'
import { Textarea } from '@/shared/components/ui/textarea'
import { cn } from '@/shared/lib/utils'

interface Props {
  defaultOpen?: boolean
  onRemove: () => void
  className?: string
}

export function AgreementNotesItem({ defaultOpen = false, onRemove, className }: Props) {
  const form = useFormContext<ProposalFormSchema>()
  const [open, setOpen] = useState(defaultOpen)
  const notes = useWatch({ control: form.control, name: 'project.data.agreementNotes' })
  const { disabled } = useFormState({ control: form.control })
  const preview = notes?.split('\n').find(line => line.trim())?.trim()

  return (
    <Collapsible
      open={open}
      onOpenChange={setOpen}
      className={cn('flex min-h-0 flex-none flex-col overflow-hidden rounded-xl border border-border bg-card', className)}
    >
      <CollapsibleTrigger asChild>
        {/* A div, not a button: the header holds the Remove button, and a button inside a button is invalid DOM.
            The rule is always drawn (transparent while closed) so opening never adds a pixel to the header. */}
        <div
          role="button"
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.target === e.currentTarget && (e.key === 'Enter' || e.key === ' ')) {
              e.preventDefault()
              setOpen(prev => !prev)
            }
          }}
          className="flex w-full flex-none cursor-pointer items-center justify-between gap-3 border-b border-transparent px-3 py-2.5 text-left outline-none transition-colors hover:bg-row-hover pressed:bg-row-press focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:ring-inset data-[state=open]:border-border lg:px-4 lg:py-3"
        >
          <span className="flex min-w-0 flex-col gap-1">
            <span className="px-1 py-0.5 text-sm font-medium lg:text-base">Agreement Notes</span>
            {/* Always rendered (a non-breaking space when empty), so the first typed character never grows the header. */}
            <span aria-hidden={open || !preview || undefined} className={cn('truncate px-1 text-sm text-muted-foreground', open && 'invisible')}>
              {preview || '\u00A0'}
            </span>
          </span>
          <span className="flex shrink-0 items-center gap-1">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="text-destructive-text hover:text-destructive-text"
              disabled={disabled}
              onClick={(e) => {
                e.stopPropagation()
                onRemove()
              }}
            >
              Remove
            </Button>
            <ChevronDownIcon
              className={cn(
                'size-5 shrink-0 text-muted-foreground transition-transform duration-200',
                !open && '-rotate-90',
              )}
            />
          </span>
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
                  <FormLabel className="sr-only">Agreement Notes</FormLabel>
                  <Button
                    variant="outline"
                    type="button"
                    className="text-xs text-muted-foreground hover:underline"
                    size="sm"
                    disabled={field.disabled}
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
