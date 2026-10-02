'use client'

import type { ReactNode } from 'react'
import { useEffect, useRef } from 'react'
import { INLINE_SHEET_SCROLL_SELECTOR } from '@/shared/constants/inline-sheet'
import { useDragToClose } from '@/shared/hooks/use-drag-to-close'
import { cn } from '@/shared/lib/utils'

interface InlineSheetProps {
  children: ReactNode
  // Lifts the sheet off its frame's bottom edge, for a bar that stays live below it:
  // `[--inline-sheet-offset:4rem]`.
  className?: string
  // The opener carries aria-controls={id}; focus returns to it when the sheet closes.
  id: string
  labelledBy: string
  onOpenChange: (open: boolean) => void
  open: boolean
}

// A bottom sheet that renders where it is placed: the nearest positioned ancestor is its frame,
// the backdrop fills that frame and the sheet rests on its bottom edge. It is not a Radix or vaul
// modal on purpose: those write to <body> on every open and close (pointer-events, a scroll lock),
// each write restyling the whole document on the frame the sheet starts to move. This one stays
// mounted and opening it flips one attribute; the slide is a CSS transition on `translate`.
export function InlineSheet({ children, className, id, labelledBy, onOpenChange, open }: InlineSheetProps) {
  const sheetRef = useRef<HTMLDivElement>(null)
  const backdropRef = useRef<HTMLDivElement>(null)
  const state = open ? 'open' : 'closed'

  useDragToClose({ backdropRef, ignoreSelector: INLINE_SHEET_SCROLL_SELECTOR, onOpenChange, sheetRef })

  useEffect(() => {
    if (!open) {
      return
    }
    const sheet = sheetRef.current
    // A keyboard press on the opener moves focus into the sheet; a tap leaves it on the opener.
    if (sheet && document.activeElement?.matches(':focus-visible')) {
      sheet.querySelector<HTMLElement>('a[href], button:not(:disabled), input, textarea, select')?.focus()
    }
    // Radix's dismissable layers listen for Escape on document in the capture phase. Window's
    // capture phase runs before document's, so stopping the event here closes only this sheet
    // and leaves the dialog around it open.
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.stopPropagation()
        onOpenChange(false)
      }
    }
    window.addEventListener('keydown', onKeyDown, true)
    return () => {
      window.removeEventListener('keydown', onKeyDown, true)
      // Closing makes the sheet inert; hand focus back to its opener rather than to <body>.
      if (sheet?.contains(document.activeElement)) {
        document.querySelector<HTMLElement>(`[aria-controls="${id}"]`)?.focus()
      }
    }
  }, [id, open, onOpenChange])

  return (
    <>
      <div
        aria-hidden
        className="absolute inset-0 z-20 touch-none bg-background/60 transition-opacity duration-260 ease-[cubic-bezier(0.32,0.72,0,1)] motion-reduce:transition-none data-[state=closed]:pointer-events-none data-[state=closed]:opacity-0"
        data-inline-sheet-backdrop
        data-state={state}
        onClick={() => onOpenChange(false)}
        ref={backdropRef}
      />
      <div
        aria-labelledby={labelledBy}
        aria-modal="false"
        className={cn(
          'absolute inset-x-0 bottom-[var(--inline-sheet-offset,0px)] z-20 flex max-h-[85%] touch-none flex-col rounded-t-2xl border-t border-border bg-popover text-popover-foreground shadow-2xl',
          // Closed, the sheet sits one travel below its place and turns invisible once the slide
          // ends; open, it turns visible at once. The curve is vaul's, like the app's other sheets.
          'invisible translate-y-[calc(100%+var(--inline-sheet-offset,0px))] [transition:translate_260ms_cubic-bezier(0.32,0.72,0,1),visibility_0s_260ms]',
          'data-[state=open]:visible data-[state=open]:translate-y-0 data-[state=open]:[transition:translate_260ms_cubic-bezier(0.32,0.72,0,1),visibility_0s]',
          'motion-reduce:transition-none',
          className,
        )}
        data-inline-sheet
        data-state={state}
        id={id}
        inert={!open}
        ref={sheetRef}
        role="dialog"
      >
        <div aria-hidden className="mx-auto mt-2.5 mb-1 h-1.5 w-10 shrink-0 rounded-full bg-border" data-inline-sheet-handle />
        {children}
      </div>
    </>
  )
}
