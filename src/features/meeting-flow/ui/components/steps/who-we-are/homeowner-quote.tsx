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
 * pulls the room's attention. Every quote's text and caption stack in the same grid cell, the
 * others invisible, so the block always holds the tallest quote's height and switching never
 * moves the rail or the slide around it.
 */
export function HomeownerQuote({ quotes }: HomeownerQuoteProps) {
  const [position, setPosition] = useState(0)
  const current = position < quotes.length ? position : 0

  return (
    <figure className="grid grid-cols-[auto_minmax(0,1fr)] items-start gap-presentation-tight @max-[30rem]/presentation:grid-cols-1" data-quote>
      <span className="relative block size-[clamp(3.5rem,6cqw,5.25rem)] overflow-hidden rounded-sm">
        <Image alt="" className="object-cover" draggable={false} fill sizes="6rem" src={quotes[current].image} />
      </span>
      <div className="grid min-w-0 gap-1">
        <div className="grid">
          {quotes.map((item, index) => (
            <blockquote
              key={item.id}
              // Not cn(): tailwind-merge doesn't know the custom `text-presentation-body` size
              // scale and mistakes it for a conflicting text-colour utility, dropping it.
              className={`[grid-area:1/1] text-presentation-body text-white/90 before:mr-0.5 before:font-sans before:font-bold before:text-(--presentation-accent) before:content-['“'] ${index === current ? '' : 'invisible'}`}
            >
              {item.text}
            </blockquote>
          ))}
        </div>
        <figcaption className="flex items-center justify-between gap-x-presentation-tight text-presentation-label text-white/60">
          <span className="grid min-w-0 flex-1">
            {quotes.map((item, index) => (
              <span key={item.id} className={cn('[grid-area:1/1]', index !== current && 'invisible')}>
                {[item.shortName, item.city, item.trade].filter(Boolean).join(' · ')}
              </span>
            ))}
          </span>
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
