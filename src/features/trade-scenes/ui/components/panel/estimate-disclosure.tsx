// LAZY: Parked for the Benefits interior; re-homed or deleted there.
'use client'

import { SAVINGS_COPY } from '@/features/trade-scenes/constants/home-scene-copy'
import { Popover, PopoverContent, PopoverTrigger } from '@/shared/components/ui/popover'

interface EstimateDisclosureProps {
  lines: readonly string[]
}

// The asterisk on a savings figure: every dollar the panel shows is an estimate, and this says from what.
export function EstimateDisclosure({ lines }: EstimateDisclosureProps) {
  return (
    <Popover>
      <PopoverTrigger
        aria-label={SAVINGS_COPY.disclosureTrigger}
        // As wide as its glyph in the line, so it sits on the word before it as a footnote mark does; the 32 px circle it
        // lights and its 44 px reach are drawn round it.
        className="relative isolate inline-grid h-8 w-[1ch] shrink-0 place-items-center text-lg leading-none font-semibold text-muted-foreground outline-none before:absolute before:top-1/2 before:left-1/2 before:-z-10 before:size-8 before:-translate-1/2 before:rounded-full after:absolute after:top-1/2 after:left-1/2 after:size-11 after:-translate-1/2 hover:text-foreground hover:before:bg-hover focus-visible:before:ring-2 focus-visible:before:ring-ring"
      >
        *
      </PopoverTrigger>
      {/* Scoped dark like the panel it opens from, since the portal leaves the panel's scope. */}
      <PopoverContent side="top" collisionPadding={16} className="dark grid w-72 gap-1.5 text-sm text-foreground">
        {lines.map(line => <p key={line} className="text-pretty">{line}</p>)}
      </PopoverContent>
    </Popover>
  )
}
