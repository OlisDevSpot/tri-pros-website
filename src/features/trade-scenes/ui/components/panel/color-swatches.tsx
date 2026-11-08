'use client'

import { RadioGroup, RadioGroupItem } from '@/shared/components/ui/radio-group'
import { cn } from '@/shared/lib/utils'

interface ColorSwatchesProps<T extends string> {
  label: string
  colors: readonly { id: T, name: string, hex: string }[]
  value: T | null
  onPick: (id: T) => void
}

// The radios are transparent 40 px targets over the drawn faces, as the wear dots are, so a list is one Tab stop and the
// arrow keys move through it. The faces are the products' own colours, the one place the panel paints a colour that is not a token.
export function ColorSwatches<T extends string>({ label, colors, value, onPick }: ColorSwatchesProps<T>) {
  return (
    // 12 apart, so each swatch's 40 px reach meets its neighbour's without taking a press meant for it.
    <RadioGroup aria-label={label} value={value ?? ''} onValueChange={id => onPick(id as T)} orientation="horizontal" className="flex flex-wrap gap-3">
      {colors.map(color => (
        <span key={color.id} className="relative size-7">
          <span
            aria-hidden
            className={cn('pointer-events-none absolute inset-0 rounded-md ring-1 ring-foreground/20 ring-inset', color.id === value && 'ring-2 ring-primary')}
            style={{ backgroundColor: color.hex }}
          />
          <RadioGroupItem
            value={color.id}
            aria-label={color.name}
            title={color.name}
            // The 28 px face reaches 40 past its edge. A radio already on reports no change, and pressing it still picks it.
            onClick={() => color.id === value && onPick(color.id)}
            className="absolute -inset-1.5 size-10 cursor-pointer rounded-md border-0 bg-transparent shadow-none hover:bg-hover focus-visible:ring-(--presentation-accent)/50 *:data-[slot=radio-group-indicator]:hidden"
          />
        </span>
      ))}
    </RadioGroup>
  )
}
