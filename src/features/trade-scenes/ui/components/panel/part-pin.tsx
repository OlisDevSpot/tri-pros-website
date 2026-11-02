'use client'

import { cn } from '@/shared/lib/utils'

interface PartPinProps {
  number: number
  label: string
  selected: boolean
  // A hidden pin stays in the overlay, so it must also leave the tab order.
  shown: boolean
  onSelect: () => void
}

// A numbered pin on a part, the same number the part list gives it; tapping either emphasises the part.
export function PartPin({ number, label, selected, shown, onSelect }: PartPinProps) {
  return (
    <button
      type="button"
      aria-label={label}
      aria-pressed={selected}
      tabIndex={shown ? 0 : -1}
      onClick={onSelect}
      className="group/pin grid size-11 cursor-pointer place-items-center rounded-full focus-visible:outline-none"
    >
      <span
        className={cn(
          'grid size-7 place-items-center rounded-full border text-xs font-bold tabular-nums shadow-lg transition-colors group-focus-visible/pin:ring-2 group-focus-visible/pin:ring-on-media',
          selected
            ? 'border-(--presentation-accent) bg-(--presentation-accent) text-primary-foreground'
            : 'border-on-media/70 bg-scrim/80 text-on-media',
        )}
      >
        {number}
      </span>
    </button>
  )
}
