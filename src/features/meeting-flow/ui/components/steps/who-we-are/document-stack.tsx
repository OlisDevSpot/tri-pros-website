'use client'

import type { PresentationDocument } from '@/features/meeting-flow/types'
import { BookOpenIcon } from 'lucide-react'
import Image from 'next/image'
import { useState } from 'react'
import { DocumentDialog } from '@/features/meeting-flow/ui/components/steps/who-we-are/document-dialog'
import { Reveal } from '@/shared/components/presentation/reveal'
import { cn } from '@/shared/lib/utils'

interface DocumentStackProps {
  document: PresentationDocument
  /** Visible cue on the front page, e.g. "Read a sample scope". */
  openLabel: string
}

/**
 * A multi-page document fanned on the desk: the first three pages, front page on
 * top. The whole stack is one button that opens every page in the dialog.
 */
export function DocumentStack({ document, openLabel }: DocumentStackProps) {
  const [open, setOpen] = useState(false)
  // Back to front: the last fanned page renders first so the front page paints on top.
  const fanned = document.pages.slice(0, 3).reverse()
  const fan = ['translate-x-[16%] rotate-[7deg]', 'translate-x-[8%] rotate-[3deg]', '-rotate-2'].slice(-fanned.length)

  return (
    <>
      <Reveal className="absolute inset-y-0 left-0 w-full lg:left-[4%]" order={1}>
        <button
          aria-label={`${openLabel}, ${document.pages.length} pages`}
          className="group relative block h-[92%] max-w-[64%] cursor-zoom-in outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
          style={{ aspectRatio: `${document.width} / ${document.height}` }}
          type="button"
          onClick={() => setOpen(true)}
        >
          {fanned.map((page, position) => (
            <span
              // Placeholder documents reuse one image for every page, so the position is the identity.
              // eslint-disable-next-line react/no-array-index-key
              key={position}
              aria-hidden
              className={cn(
                'absolute inset-0 bg-white p-[0.7cqw] shadow-2xl shadow-black/60',
                // Ring colour sits at zero width until hover, so the stack answers a pointer without moving.
                'ring-white/25 group-hover:ring-4',
                fan[position],
              )}
            >
              <span className="relative block h-full w-full">
                <Image alt="" className="object-cover object-top" draggable={false} fill sizes="(min-width: 1024px) 26vw, 50vw" src={page} />
              </span>
            </span>
          ))}
          <span className="absolute inset-x-[8%] bottom-[6%] flex -rotate-2 items-center justify-center gap-2 rounded-md bg-(--presentation-ground)/90 px-3 py-2 text-[max(2.2cqw,0.8125rem)] font-semibold text-white lg:text-[max(1.3cqw,0.8125rem)]">
            <BookOpenIcon aria-hidden className="size-[1.1em] shrink-0" />
            {openLabel}
          </span>
        </button>
      </Reveal>

      <DocumentDialog document={open ? document : null} onClose={() => setOpen(false)} />
    </>
  )
}
