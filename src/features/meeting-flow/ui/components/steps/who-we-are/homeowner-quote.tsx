'use client'

import type { HomeownerQuote as HomeownerQuoteData } from '@/features/meeting-flow/types'
import Image from 'next/image'
import { useState } from 'react'
import { cn } from '@/shared/lib/utils'

interface HomeownerQuoteProps {
  /** Non-empty; the section renders nothing without a quote. */
  quotes: HomeownerQuoteData[]
}

/**
 * A portfolio homeowner's words beside their own project's photo. The agent switches between
 * homeowners with the dots; nothing advances by itself, because movement the agent didn't start
 * pulls the room's attention.
 */
export function HomeownerQuote({ quotes }: HomeownerQuoteProps) {
  const [position, setPosition] = useState(0)
  const current = position < quotes.length ? position : 0
  const quote = quotes[current]
  const caption = [quote.shortName, quote.city, quote.trade].filter(Boolean).join(' · ')

  return (
    <figure className="grid grid-cols-[auto_minmax(0,1fr)] items-start gap-presentation-tight @max-[30rem]/presentation:grid-cols-1" data-quote>
      <span className="relative block size-[clamp(3.5rem,6cqw,5.25rem)] overflow-hidden rounded-sm">
        <Image alt="" className="object-cover" draggable={false} fill sizes="6rem" src={quote.image} />
      </span>
      <div className="grid min-w-0 gap-1">
        <blockquote className="text-presentation-body text-white/90 before:mr-0.5 before:font-sans before:font-bold before:text-(--presentation-accent) before:content-['“']">
          {quote.text}
        </blockquote>
        <figcaption className="flex flex-wrap items-center justify-between gap-x-presentation-tight text-presentation-label text-white/60">
          <span>{caption}</span>
          {quotes.length > 1 && (
            <span aria-label="Homeowner quotes" className="flex" role="group">
              {quotes.map((item, index) => (
                <button
                  key={item.id}
                  aria-label={`Quote ${index + 1} of ${quotes.length}`}
                  aria-pressed={index === current}
                  className="grid size-11 place-items-center rounded-full outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
                  type="button"
                  onClick={() => setPosition(index)}
                >
                  <span aria-hidden className={cn('size-1.5 rounded-full', index === current ? 'bg-(--presentation-accent)' : 'bg-white/30')} />
                </button>
              ))}
            </span>
          )}
        </figcaption>
      </div>
    </figure>
  )
}
