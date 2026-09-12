'use client'

// LAZY: first-pass stopgap. The shared `PhotoLightbox`
// (src/features/project-management/ui/components/photo-lightbox.tsx) is bound to
// `MediaFile` records, so this ships a minimal dialog instead of extending it.
// Migrate onto the lightbox and delete this file when that container is
// generalized. See docs/superpowers/specs/2026-09-12-who-we-are-scroll-presentation-design.md §4.3.

import type { PresentationDocument } from '@/features/meeting-flow/types'
import Image from 'next/image'
import { Dialog, DialogContent, DialogTitle } from '@/shared/components/ui/dialog'

interface DocumentDialogProps {
  /** The document to show; `null` keeps the dialog closed. */
  document: PresentationDocument | null
  onClose: () => void
}

/** Full-size, contained view of a credential document on the dark ground. */
export function DocumentDialog({ document, onClose }: DocumentDialogProps) {
  return (
    <Dialog open={document !== null} onOpenChange={open => !open && onClose()}>
      <DialogContent
        aria-describedby={undefined}
        className="h-[92dvh] w-[min(96vw,1100px)] max-w-none border-0 bg-[oklch(0.14_0.03_257)] p-2 sm:max-w-none"
      >
        {document && (
          <>
            <DialogTitle className="sr-only">{document.title}</DialogTitle>
            <button
              aria-label={`Close ${document.title}`}
              className="relative block h-full w-full cursor-zoom-out outline-none"
              type="button"
              onClick={onClose}
            >
              <Image
                alt={document.alt}
                className="object-contain"
                draggable={false}
                fill
                sizes="96vw"
                src={document.src}
              />
            </button>
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}
