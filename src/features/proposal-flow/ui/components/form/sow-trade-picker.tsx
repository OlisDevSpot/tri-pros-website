import type { ProposalFormSchema } from '@/features/proposal-flow/schemas/form-schema'
import { useFormContext, useWatch } from 'react-hook-form'
import { SOW_HEADER_CHIP } from '@/features/proposal-flow/constants/sow-header-chip'
import { FormControl, FormField, FormItem } from '@/shared/components/ui/form'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/components/ui/select'
import { cn } from '@/shared/lib/utils'

interface Props {
  index: number
  disabled: boolean
  // Only while the section is open: that is when the message under the header renders.
  messageId?: string
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
            <FormControl aria-describedby={fieldState.error && messageId ? messageId : undefined}>
              <SelectTrigger
                ref={field.ref}
                name={field.name}
                onBlur={field.onBlur}
                size="sm"
                aria-label={label ? `Trade: ${label}` : undefined}
                // Phone's meta row shares its width with the price: the label truncates and the chevron goes.
                className={cn(SOW_HEADER_CHIP, 'max-w-48 rounded-md bg-secondary px-2 text-secondary-foreground hover:bg-secondary-hover data-[size=sm]:h-5.5 *:data-[slot=select-value]:min-w-0')}
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
