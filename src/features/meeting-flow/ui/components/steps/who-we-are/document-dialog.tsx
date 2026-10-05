'use client'

// LAZY: first-pass stopgap. The shared `PhotoLightbox`
// (src/features/project-management/ui/components/photo-lightbox.tsx) is bound to
// `ProjectMediaFile` records, so this ships a minimal dialog instead of extending it.
// Migrate onto the lightbox and delete this file when that container is
// generalized.

import type { FocusPoint, PresentationDocument } from '@/features/meeting-flow/types'
import { ZoomInIcon, ZoomOutIcon } from 'lucide-react'
import Image from 'next/image'
import { useState } from 'react'
import { Dialog, DialogContent, DialogTitle } from '@/shared/components/ui/dialog'
import { cn } from '@/shared/lib/utils'

interface DocumentDialogProps {
  /** The document to show; `null` keeps the dialog closed. */
  document: PresentationDocument | null
  /** Opens a one-page document zoomed in at this spot, e.g. a license number. */
  focus?: FocusPoint | null
  onClose: () => void
}

/**
 * Every page of a document on the dark ground. A one-page document is sized to fit the dialog
 * whole; a multi-page one scrolls at reading width. Opened at a focus point, the page starts
 * zoomed in on it, and a tap on the page or the Zoom control toggles it. Each opening starts
 * zoomed, whatever the last one ended on. The close control is a 44px round target; the dialog
 * portals out of the presentation, so its palette comes from `:root`.
 */
export function DocumentDialog({ document, focus = null, onClose }: DocumentDialogProps) {
  const [zoomedOut, setZoomedOut] = useState(false)
  const [openedAt, setOpenedAt] = useState<FocusPoint | null>(focus)
  if (focus !== openedAt) {
    setOpenedAt(focus)
    setZoomedOut(false)
  }
  const zoomable = focus !== null && document?.pages.length === 1
  const zoomed = zoomable && !zoomedOut

  return (
    <Dialog open={document !== null} onOpenChange={open => !open && onClose()}>
      <DialogContent
        aria-describedby={undefined}
        className="h-[92dvh] w-[min(96vw,1100px)] max-w-none grid-rows-[minmax(0,1fr)] border-0 bg-[oklch(var(--presentation-scrim))] p-2 text-white sm:max-w-none *:data-[slot=dialog-close]:inline-flex *:data-[slot=dialog-close]:size-11 *:data-[slot=dialog-close]:items-center *:data-[slot=dialog-close]:justify-center *:data-[slot=dialog-close]:rounded-full *:data-[slot=dialog-close]:bg-black/60 *:data-[slot=dialog-close]:opacity-100"
      >
        {document && (
          <>
            <DialogTitle className="sr-only">{document.title}</DialogTitle>
            {zoomable && (
              <button
                className="absolute top-4 left-4 z-10 inline-flex h-11 items-center gap-2 rounded-full bg-black/60 px-4 text-sm font-semibold outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
                type="button"
                onClick={() => setZoomedOut(value => !value)}
              >
                {zoomed ? <ZoomOutIcon aria-hidden className="size-4" /> : <ZoomInIcon aria-hidden className="size-4" />}
                {zoomed ? 'Zoom out' : 'Zoom in'}
              </button>
            )}
            <div className={cn('grid min-h-0 content-start justify-items-center gap-3 overscroll-contain', zoomable ? 'overflow-hidden' : 'overflow-y-auto')}>
              {document.pages.map((page, position) => {
                const image = (
                  <Image
                    alt={`${document.alt}, page ${position + 1} of ${document.pages.length}`}
                    className={cn('h-auto bg-white', zoomable && 'transition-transform duration-500 ease-out motion-reduce:transition-none', zoomed && 'scale-[2.4]')}
                    draggable={false}
                    height={document.height}
                    sizes="96vw"
                    src={page}
                    style={{
                      width: document.pages.length === 1
                        ? `min(100%, calc((92dvh - 1rem) * ${document.width} / ${document.height}))`
                        : 'min(100%, 56rem)',
                      transformOrigin: zoomable && focus ? `${focus.x * 100}% ${focus.y * 100}%` : undefined,
                    }}
                    width={document.width}
                  />
                )
                return zoomable
                  ? (
                      <button
                        // Placeholder documents reuse one image for every page, so the position is the identity.
                        // eslint-disable-next-line react/no-array-index-key
                        key={position}
                        aria-pressed={zoomed}
                        className={cn('outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50', zoomed ? 'cursor-zoom-out' : 'cursor-zoom-in')}
                        type="button"
                        onClick={() => setZoomedOut(value => !value)}
                      >
                        {image}
                        <span className="sr-only">Toggle zoom</span>
                      </button>
                    )
                  : (
                      // eslint-disable-next-line react/no-array-index-key
                      <div key={position}>{image}</div>
                    )
              })}
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}
