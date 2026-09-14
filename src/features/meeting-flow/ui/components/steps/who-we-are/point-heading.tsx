'use client'

import { Reveal } from '@/features/meeting-flow/ui/components/presentation/reveal'

interface PointHeadingProps {
  id: string
  title: string
  line: string
}

/** A point's title and the one line under it; reveals first and second. */
export function PointHeading({ id, title, line }: PointHeadingProps) {
  return (
    <>
      <Reveal order={0}>
        <h2
          className="max-w-[20ch] font-sans text-[6cqw] leading-[1.04] font-semibold tracking-tight text-balance lg:text-[4.4cqw]"
          id={id}
        >
          {title}
        </h2>
      </Reveal>
      <Reveal order={1}>
        <p className="max-w-[42ch] text-[max(2.8cqw,0.875rem)] leading-snug text-white/80 lg:text-[max(1.8cqw,0.875rem)]">{line}</p>
      </Reveal>
    </>
  )
}
