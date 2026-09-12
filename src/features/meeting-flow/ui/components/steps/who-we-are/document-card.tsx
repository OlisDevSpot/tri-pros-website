'use client'

import type { PresentationDocument } from '@/features/meeting-flow/types'
import Image from 'next/image'
import { cn } from '@/shared/lib/utils'

interface DocumentCardProps {
  document: PresentationDocument
  onOpen: () => void
  /** Placement and rotation; rotation lives here, never on a <Reveal> wrapper. */
  className?: string
}

/** A paper document laid on the desk. Tap to read it full size. */
export function DocumentCard({ document, onOpen, className }: DocumentCardProps) {
  return (
    <button
      aria-label={`Open ${document.title}`}
      className={cn(
        'block h-full w-full cursor-zoom-in bg-white p-[0.9cqw] shadow-2xl shadow-black/60 outline-none',
        'focus-visible:ring-[3px] focus-visible:ring-ring/50',
        className,
      )}
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
          src={document.src}
        />
      </span>
    </button>
  )
}
