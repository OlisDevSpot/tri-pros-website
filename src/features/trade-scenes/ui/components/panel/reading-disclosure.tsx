'use client'

import { READING_COPY } from '@/features/trade-scenes/constants/home-scene-copy'
import { Popover, PopoverContent, PopoverTrigger } from '@/shared/components/ui/popover'

interface ReadingDisclosureProps {
  text: string
}

// The asterisk on a reading: every °F the scene shows is an estimate, and this says for what.
export function ReadingDisclosure({ text }: ReadingDisclosureProps) {
  return (
    <Popover>
      <PopoverTrigger
        aria-label={READING_COPY.disclosureTrigger}
        // 32 px drawn, 44 px to the finger: the hit area reaches past the chip's edge.
        className="relative grid size-8 place-items-center rounded-full text-base leading-none font-semibold text-on-media after:absolute after:-inset-1.5 hover:bg-on-media/15 focus-visible:ring-2 focus-visible:ring-on-media focus-visible:outline-none"
      >
        *
      </PopoverTrigger>
      {/* Scoped dark like the stage it opens over, since the portal leaves the stage's scope. */}
      <PopoverContent side="top" collisionPadding={16} className="dark w-64 text-sm text-foreground">
        {text}
      </PopoverContent>
    </Popover>
  )
}
