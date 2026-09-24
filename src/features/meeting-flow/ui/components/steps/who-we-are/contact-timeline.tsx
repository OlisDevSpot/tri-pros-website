'use client'

import type { CSSProperties } from 'react'
import type { WhoWeAreContentOf } from '@/features/meeting-flow/types'
import { motion } from 'motion/react'
import { useSlideInView } from '@/shared/components/presentation/context'
import { BRAND_EASE } from '@/shared/constants/motion'
import { cn } from '@/shared/lib/utils'

interface ContactTimelineProps {
  timeline: WhoWeAreContentOf<'agent'>['timeline']
  /** The meeting owner's first name, for the captions. */
  firstName: string
  /** The list's accessible name, e.g. "From today to the final walkthrough". */
  label: string
}

/**
 * The homeowner's line to one person, laid out in time: across the slide, or down it on a
 * narrow presentation. The first entry is today, so its dot is filled. The line draws when the
 * slide comes into view; under reduced motion the flow's MotionConfig skips the transform and
 * the line is simply there. A uniform scale grows the line from its start in either
 * orientation; its 2px thickness hides the rest.
 */
export function ContactTimeline({ timeline, firstName, label }: ContactTimelineProps) {
  const inView = useSlideInView()

  return (
    <div className="relative @max-[40rem]/presentation:mx-auto @max-[40rem]/presentation:w-fit" style={{ '--entries': timeline.length } as CSSProperties}>
      <motion.span
        animate={{ scale: inView ? 1 : 0 }}
        aria-hidden
        className="absolute inset-x-[calc(50%/var(--entries))] top-[7px] h-0.5 origin-left bg-linear-to-r from-(--presentation-accent) to-(--presentation-accent)/30 @max-[40rem]/presentation:inset-x-auto @max-[40rem]/presentation:top-2 @max-[40rem]/presentation:bottom-2 @max-[40rem]/presentation:left-[7px] @max-[40rem]/presentation:h-auto @max-[40rem]/presentation:w-0.5 @max-[40rem]/presentation:origin-top @max-[40rem]/presentation:bg-linear-to-b"
        data-timeline-line
        initial={false}
        transition={{ duration: 1.1, delay: 0.25, ease: BRAND_EASE }}
      />
      <ol
        aria-label={label}
        className="grid auto-cols-fr grid-flow-col @max-[40rem]/presentation:grid-flow-row @max-[40rem]/presentation:gap-presentation-tight"
        data-timeline
      >
        {timeline.map((entry, position) => (
          <li
            key={entry.when}
            className="grid justify-items-center gap-presentation-tight px-[0.6cqw] text-center @max-[40rem]/presentation:grid-cols-[1rem_minmax(0,1fr)] @max-[40rem]/presentation:justify-items-start @max-[40rem]/presentation:gap-x-presentation-tight @max-[40rem]/presentation:gap-y-0.5 @max-[40rem]/presentation:px-0 @max-[40rem]/presentation:text-left"
          >
            <span
              aria-hidden
              className={cn(
                'relative z-10 size-4 rounded-full border-2 border-(--presentation-accent) @max-[40rem]/presentation:row-span-2 @max-[40rem]/presentation:mt-0.5',
                position === 0 ? 'bg-(--presentation-accent) ring-4 ring-(--presentation-accent)/20' : 'bg-(--presentation-ground)',
              )}
            />
            <span className="font-mono text-presentation-label font-bold tracking-[0.1em] text-white/60 uppercase">{entry.when}</span>
            <span className="text-presentation-body leading-snug text-balance text-white/90">{entry.caption(firstName)}</span>
          </li>
        ))}
      </ol>
    </div>
  )
}
