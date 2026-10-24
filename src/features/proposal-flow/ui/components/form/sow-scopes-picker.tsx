import type { ProposalFormSchema } from '@/features/proposal-flow/schemas/form-schema'
import { useFormContext } from 'react-hook-form'
import { plural } from '@/features/proposal-flow/lib/form-parts'
import { scopesTriggerLabel } from '@/features/proposal-flow/lib/scopes-trigger-label'
import { FormControl, FormField, FormItem } from '@/shared/components/ui/form'
import { MultiSelect, MultiSelectContent, MultiSelectGroup, MultiSelectItem, MultiSelectTrigger, MultiSelectValue } from '@/shared/components/ui/multi-select'
import { cn } from '@/shared/lib/utils'
import { SowScopesSelectedStrip } from './sow-scopes-selected-strip'

interface Props {
  index: number
  disabled: boolean
  // Only while the section is open: that is when the message under the header renders.
  messageId?: string
  options: { id: string, name: string }[] | undefined
  loading: boolean
  onScopesChange: (values: string[]) => Promise<boolean>
}

export function SowScopesPicker({ index, disabled, messageId, options, loading, onScopesChange }: Props) {
  const form = useFormContext<ProposalFormSchema>()

  return (
    <FormField
      control={form.control}
      name={`project.data.sow.${index}.scopes`}
      render={({ field, fieldState }) => {
        const ids = field.value.map(scope => scope.id)
        // The badges need the trade's scope list; until it lands the count stands in at every width.
        const badgesReady = !!options
        return (
          <FormItem className="contents">
            <MultiSelect onValuesChange={onScopesChange} values={ids}>
              <FormControl aria-describedby={fieldState.error && messageId ? messageId : undefined}>
                <MultiSelectTrigger
                  ref={field.ref}
                  variant="ghost"
                  aria-label={scopesTriggerLabel(field.value.map(scope => scope.label))}
                  // Without the trade's options the picks can't be mapped back to labels, so a change would drop them.
                  disabled={field.disabled || disabled || loading || !options}
                  // shrink: the button base is shrink-0, and the "+N" cutoff only engages once the trigger gives way.
                  // The md floor keeps a two-digit "+N" whole; past it the title truncates instead.
                  className="h-5.5 min-h-0 w-auto min-w-0 shrink gap-1 md:min-w-18 border-transparent bg-transparent px-1 py-0 text-xs font-medium shadow-none hover:border-transparent hover:bg-hover pressed:bg-press disabled:cursor-default disabled:opacity-100 has-[>svg]:px-1 max-md:bg-muted max-md:px-2 max-md:text-muted-foreground max-md:hover:bg-secondary-hover max-md:has-[>svg]:px-2 [&>svg]:size-3 disabled:[&>svg]:hidden max-md:[&>svg]:hidden"
                >
                  {field.value.length === 0
                    ? <span className="text-muted-foreground">{loading ? 'Loading...' : 'Select scopes'}</span>
                    : (
                        <>
                          {badgesReady && <MultiSelectValue overflowBehavior="cutoff" clickToRemove={false} className="max-md:hidden" />}
                          <span className={cn(badgesReady && 'md:hidden')}>{plural(field.value.length, 'scope')}</span>
                        </>
                      )}
                </MultiSelectTrigger>
              </FormControl>
              <MultiSelectContent
                search={{
                  emptyMessage: 'No scopes found',
                  placeholder: 'Search scopes...',
                }}
                // Keyboard highlighting scrolls a row into view; the padding keeps it clear of the pinned strip.
                className={cn(field.value.length > 0 && '**:data-[slot=command-list]:scroll-pb-[calc(1.375rem+1rem+1px)]')}
              >
                <MultiSelectGroup>
                  {options?.map(scope => (
                    <MultiSelectItem key={scope.id} value={scope.id}>
                      {scope.name}
                    </MultiSelectItem>
                  ))}
                </MultiSelectGroup>
                <SowScopesSelectedStrip
                  scopes={field.value}
                  onRemove={id => onScopesChange(ids.filter(value => value !== id))}
                />
              </MultiSelectContent>
            </MultiSelect>
          </FormItem>
        )
      }}
    />
  )
}
