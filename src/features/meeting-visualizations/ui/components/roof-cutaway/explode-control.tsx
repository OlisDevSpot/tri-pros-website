'use client'

import { Slider } from '@/shared/components/ui/slider'

interface ExplodeControlProps {
  value: number
  onChange: (value: number) => void
}

/** A slider for the slow reveal, plus one tap to open or close it fully while talking. */
export function ExplodeControl({ value, onChange }: ExplodeControlProps) {
  const open = value > 0.5
  return (
    <div className="grid gap-2">
      <div className="flex items-center justify-between gap-3">
        <span id="explode-label" className="text-sm font-semibold text-on-media/85">Peel back the layers</span>
        <button
          type="button"
          onClick={() => onChange(open ? 0 : 1)}
          className="min-h-11 cursor-pointer rounded-lg px-3 text-sm font-semibold text-(--presentation-accent) hover:bg-on-media/6 focus-visible:outline-2 focus-visible:outline-(--presentation-accent)"
        >
          {open ? 'Close it up' : 'Open it up'}
        </button>
      </div>
      <Slider
        aria-labelledby="explode-label"
        value={[value * 100]}
        onValueChange={([next]) => onChange((next ?? 0) / 100)}
        max={100}
        step={1}
        className="h-11 **:data-[slot=slider-range]:bg-(--presentation-accent) **:data-[slot=slider-thumb]:size-7 **:data-[slot=slider-thumb]:border-(--presentation-accent) **:data-[slot=slider-thumb]:bg-on-media **:data-[slot=slider-track]:h-2 **:data-[slot=slider-track]:bg-on-media/15"
      />
    </div>
  )
}
