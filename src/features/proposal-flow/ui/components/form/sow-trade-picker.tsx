import type { ProposalFormSchema } from '@/features/proposal-flow/schemas/form-schema'
import { useFormContext, useWatch } from 'react-hook-form'
import { FormControl, FormField, FormItem } from '@/shared/components/ui/form'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/components/ui/select'

interface Props {
  index: number
  disabled: boolean
  messageId: string
  trades: { id: string, name: string }[] | undefined
  onTradeChange: (id: string) => void
}

export function SowTradePicker({ index, disabled, messageId, trades, onTradeChange }: Props) {
  const form = useFormContext<ProposalFormSchema>()
  const label = useWatch({ control: form.control, name: `project.data.sow.${index}.trade.label` })

  return (
    <FormField
      control={form.control}
      name={`project.data.sow.${index}.trade.id`}
      render={({ field, fieldState }) => (
        <FormItem className="contents">
          <Select value={field.value} onValueChange={onTradeChange} disabled={field.disabled || disabled}>
            <FormControl aria-describedby={fieldState.error ? messageId : undefined}>
              <SelectTrigger
                ref={field.ref}
                name={field.name}
                onBlur={field.onBlur}
                size="sm"
                aria-label={label ? `Trade: ${label}` : undefined}
                // Phone's meta row shares its width with the price: the label truncates and the chevron goes.
                className="max-w-48 min-w-0 shrink gap-1 rounded-md border-transparent bg-secondary px-2 py-0 text-xs font-medium text-secondary-foreground shadow-none hover:border-transparent hover:bg-secondary-hover pressed:bg-press disabled:cursor-default disabled:opacity-100 data-[size=sm]:h-5.5 *:data-[slot=select-value]:min-w-0 [&>svg]:size-3 disabled:[&>svg]:hidden max-md:[&>svg]:hidden"
              >
                {/* The saved label, so the chip reads right before the trade list has loaded. */}
                <SelectValue placeholder="Select trade">
                  {label ? <span className="min-w-0 truncate">{label}</span> : undefined}
                </SelectValue>
              </SelectTrigger>
            </FormControl>
            <SelectContent>
              {trades?.map(trade => (
                <SelectItem key={trade.id} value={trade.id}>
                  {trade.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </FormItem>
      )}
    />
  )
}
