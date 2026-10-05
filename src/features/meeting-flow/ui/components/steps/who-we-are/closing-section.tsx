'use client'

import type { WhoWeAreContentOf } from '@/features/meeting-flow/types'
import type { SlideProps } from '@/shared/components/presentation/types'
import { ArrowRightIcon } from 'lucide-react'
import { Reveal } from '@/shared/components/presentation/reveal'
import { Slide } from '@/shared/components/presentation/slide'
import { Button } from '@/shared/components/ui/button'

interface ClosingSectionProps extends SlideProps<WhoWeAreContentOf<'closing'>> {
  /** Advances the meeting flow to the next step. */
  onContinue: () => void
}

/**
 * The last slide (C3): the closing truth over the dusk photo, the quote at the lead size in
 * the body face (never serif italic), and the hand-off to the next step in the accent (U3, U8).
 * `Slide` renders the centred heading at orders 0 and 1; the quote and the button follow.
 */
export function ClosingSection({ content, onContinue, ...slide }: ClosingSectionProps) {
  return (
    <Slide {...slide}>
      <Reveal order={2}>
        <p className="max-w-[52ch] text-presentation-lead text-white/90">{content.quote}</p>
      </Reveal>
      <Reveal order={3}>
        <Button
          className="min-h-11 bg-(--presentation-accent) font-semibold text-(--presentation-ground) hover:bg-(--presentation-accent)/90"
          size="lg"
          onClick={onContinue}
        >
          {content.cta.label}
          <ArrowRightIcon />
        </Button>
      </Reveal>
    </Slide>
  )
}
