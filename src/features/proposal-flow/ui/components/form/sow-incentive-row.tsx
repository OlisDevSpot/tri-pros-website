import type { ProposalFormSchema } from '@/features/proposal-flow/schemas/form-schema'
import { TrashIcon } from 'lucide-react'
import { useFormContext } from 'react-hook-form'
import { SOW_PRICING_ROW } from '@/features/proposal-flow/constants/sow-pricing-grid'
import { Button } from '@/shared/components/ui/button'
import { FormControl, FormField, FormItem, FormMessage } from '@/shared/components/ui/form'
import { Input } from '@/shared/components/ui/input'
import { cn } from '@/shared/lib/utils'

interface Props {
  index: number
  incentiveIndex: number
  disabled: boolean
  onRemove: () => void
}

export function SowIncentiveRow({ index, incentiveIndex, disabled, onRemove }: Props) {
  const form = useFormContext<ProposalFormSchema>()
  const base = `project.data.sow.${index}.financials.incentives.${incentiveIndex}` as const

  return (
    <div className={cn(SOW_PRICING_ROW, 'mt-1 items-start rounded-lg bg-band px-2 py-1.5')}>
      <FormField
        name={`${base}.label`}
        control={form.control}
        render={({ field }) => (
          <FormItem>
            <FormControl>
              <Input {...field} placeholder="Scope discount" aria-label="Incentive label" />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />
      <FormField
        name={`${base}.amount`}
        control={form.control}
        render={({ field }) => (
          <FormItem>
            <FormControl>
              <Input
                type="text"
                inputMode="numeric"
                placeholder="$500"
                aria-label="Incentive amount"
                className="pr-[11px] text-right"
                disabled={field.disabled}
                value={field.value === 0 ? '' : String(field.value)}
                onChange={(e) => {
                  field.onChange(Number(e.target.value.replace(/\D/g, '')))
                }}
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
        aria-label="Remove incentive"
      >
        <TrashIcon className="size-4" />
      </Button>
    </div>
  )
}
