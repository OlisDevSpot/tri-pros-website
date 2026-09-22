'use client'

// LAZY: first-pass stopgap. The shared `PhotoLightbox`
// (src/features/project-management/ui/components/photo-lightbox.tsx) is bound to
// `ProjectMediaFile` records, so this ships a minimal dialog instead of extending it.
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

/**
 * Every page of a document on the dark ground. A one-page document is sized to fit
 * the dialog whole; a multi-page one scrolls at reading width. The close control is a 44px
 * round target (U11); the dialog portals out of the stage, so the palette comes from `:root`.
 */
export function DocumentDialog({ document, onClose }: DocumentDialogProps) {
  return (
    <Dialog open={document !== null} onOpenChange={open => !open && onClose()}>
      <DialogContent
        aria-describedby={undefined}
        className="h-[92dvh] w-[min(96vw,1100px)] max-w-none grid-rows-[minmax(0,1fr)] border-0 bg-[oklch(var(--presentation-scrim))] p-2 text-white sm:max-w-none *:data-[slot=dialog-close]:inline-flex *:data-[slot=dialog-close]:size-11 *:data-[slot=dialog-close]:items-center *:data-[slot=dialog-close]:justify-center *:data-[slot=dialog-close]:rounded-full *:data-[slot=dialog-close]:bg-black/60 *:data-[slot=dialog-close]:opacity-100"
      >
        {document && (
          <>
            <DialogTitle className="sr-only">{document.title}</DialogTitle>
            <div className="grid min-h-0 content-start justify-items-center gap-3 overflow-y-auto overscroll-contain">
              {document.pages.map((page, position) => (
                <Image
                  // Placeholder documents reuse one image for every page, so the position is the identity.
                  // eslint-disable-next-line react/no-array-index-key
                  key={position}
                  alt={`${document.alt}, page ${position + 1} of ${document.pages.length}`}
                  className="h-auto bg-white"
                  draggable={false}
                  height={document.height}
                  sizes="96vw"
                  src={page}
                  style={{
                    width: document.pages.length === 1
                      ? `min(100%, calc((92dvh - 1rem) * ${document.width} / ${document.height}))`
                      : 'min(100%, 56rem)',
                  }}
                  width={document.width}
                />
              ))}
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}
