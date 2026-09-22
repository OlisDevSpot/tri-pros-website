'use client'

import type { PresentationDocument } from '@/features/meeting-flow/types'
import Image from 'next/image'
import { cn } from '@/shared/lib/utils'

interface DocumentCardProps {
  document: PresentationDocument
  onOpen: () => void
}

/** The first page of a document laid on the desk at its true proportions, square to the slide (U13). Tap to read it. */
export function DocumentCard({ document, onOpen }: DocumentCardProps) {
  return (
    <button
      aria-label={`Open ${document.title}`}
      className={cn(
        'block h-full max-w-full cursor-zoom-in bg-white p-[0.8cqw] shadow-2xl shadow-black/60 outline-none',
        // Ring colour sits at zero width until hover, so the card answers a pointer
        // without moving: a transform would shift a snap area's border box.
        'ring-white/25 hover:ring-4',
        'focus-visible:ring-[3px] focus-visible:ring-ring/50',
      )}
      style={{ aspectRatio: `${document.width} / ${document.height}` }}
      type="button"
      onClick={onOpen}
    >
      <span className="relative block h-full w-full">
        <Image
          alt={document.alt}
          className="object-cover object-top"
          draggable={false}
          fill
          sizes="(min-width: 1024px) 30vw, 60vw"
          src={document.pages[0]}
        />
      </span>
    </button>
  )
}
