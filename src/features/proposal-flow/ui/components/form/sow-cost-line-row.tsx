import type { ProposalFormSchema } from '@/features/proposal-flow/schemas/form-schema'
import { TrashIcon } from 'lucide-react'
import { useFormContext } from 'react-hook-form'
import { SOW_PRICING_ROW } from '@/features/proposal-flow/constants/sow-pricing-grid'
import { Button } from '@/shared/components/ui/button'
import { AnimatedCollapsibleContent, Collapsible, CollapsibleTrigger } from '@/shared/components/ui/collapsible'
import { FormControl, FormField, FormItem, FormMessage } from '@/shared/components/ui/form'
import { Input } from '@/shared/components/ui/input'
import { MoneyField } from '@/shared/components/ui/money-field'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/components/ui/select'
import { Textarea } from '@/shared/components/ui/textarea'
import { cn } from '@/shared/lib/utils'

interface Props {
  index: number
  lineIndex: number
  scopes: { id: string, label: string }[]
  notesOpen: boolean
  onNotesOpenChange: (open: boolean) => void
  disabled: boolean
  onRemove: () => void
}

export function SowCostLineRow({ index, lineIndex, scopes, notesOpen, onNotesOpenChange, disabled, onRemove }: Props) {
  const form = useFormContext<ProposalFormSchema>()
  const base = `project.data.sow.${index}.financials.costLines.${lineIndex}` as const

  return (
    <Collapsible open={notesOpen} onOpenChange={onNotesOpenChange} className="mt-1 rounded-lg bg-band px-2 py-1.5">
      <div className={cn(SOW_PRICING_ROW, 'items-start')}>
        <div className="flex min-w-0 flex-col gap-2 md:flex-row md:flex-wrap md:items-start">
          <FormField
            name={`${base}.label`}
            control={form.control}
            render={({ field }) => (
              <FormItem className="min-w-0 md:min-w-40 md:flex-1">
                <FormControl>
                  <Input {...field} placeholder="Labor" aria-label="Cost line label" />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            name={`${base}.relatedScopeId`}
            control={form.control}
            render={({ field }) => (
              <FormItem className="min-w-0 md:w-44">
                <FormControl>
                  <Select value={field.value} onValueChange={field.onChange} disabled={field.disabled}>
                    <SelectTrigger className="w-full" aria-label="Related scope">
                      <SelectValue placeholder="Select scope" />
                    </SelectTrigger>
                    <SelectContent>
                      {scopes.map(scope => (
                        <SelectItem key={scope.id} value={scope.id}>
                          {scope.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <CollapsibleTrigger asChild>
            <Button type="button" size="sm" variant="ghost" className="justify-start text-xs text-muted-foreground md:h-9">
              {notesOpen ? 'Hide notes' : 'Add notes'}
            </Button>
          </CollapsibleTrigger>
        </div>
        <FormField
          name={`${base}.amount`}
          control={form.control}
          render={({ field }) => (
            <FormItem>
              <FormControl>
                <MoneyField
                  {...field}
                  placeholder="$1,000"
                  aria-label="Cost line amount"
                  className="pr-[11px] text-right"
                  value={field.value || null}
                  onChange={value => field.onChange(value ?? 0)}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <Button
          type="button"
          size="icon"
          variant="ghost"
          className="size-8 justify-self-center text-muted-foreground hover:text-destructive-text max-md:size-7"
          disabled={disabled}
          onClick={onRemove}
          aria-label="Remove cost line"
        >
          <TrashIcon className="size-4" />
        </Button>
      </div>
      <AnimatedCollapsibleContent open={notesOpen}>
        <div className="pt-2">
          <FormField
            name={`${base}.notes`}
            control={form.control}
            render={({ field }) => (
              <FormItem>
                <FormControl>
                  <Textarea
                    {...field}
                    value={field.value ?? ''}
                    placeholder="Additional context for this cost line"
                    aria-label="Cost line notes"
                    rows={2}
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
