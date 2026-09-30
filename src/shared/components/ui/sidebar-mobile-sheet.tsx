'use client'

import * as React from 'react'
import { createPortal } from 'react-dom'

import { cn } from '@/shared/lib/utils'

export const SIDEBAR_MOBILE_SHEET_ID = 'sidebar-mobile-sheet'

const DRAG_START_PX = 6
const CLOSE_DISTANCE_RATIO = 0.25
const CLOSE_VELOCITY_PX_PER_MS = 0.5

interface SidebarMobileSheetProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  className?: string
  children: React.ReactNode
}

// The phone presentation of the sidebar: the rail's nav list in a floating navy sheet that
// rises from the bottom and closes on a swipe down, a backdrop tap or Escape.
//
// It is not a dialog library's modal, on purpose. The controls that open it stay live beside it
// (a phone dock's button closes it, its tabs navigate), which a modal forbids. And a modal writes
// to <body> on every open and close (pointer-events, a scroll lock's style tag and custom
// property), each write restyling the whole document on the frame the sheet starts to move. This
// sheet stays mounted and opening it flips one attribute: the slide is a CSS transition on
// `translate`, which the compositor runs, and nothing outside the sheet restyles.
//
// The nav list mounts once the browser is idle after load (or on the first open, if that comes
// sooner), so neither the first paint nor a tap pays for it.
export function SidebarMobileSheet({ open, onOpenChange, className, children }: SidebarMobileSheetProps) {
  const sheetRef = React.useRef<HTMLDivElement>(null)
  const backdropRef = React.useRef<HTMLDivElement>(null)
  const isContentReady = useIdleReady() || open

  useDragToClose(sheetRef, backdropRef, onOpenChange)

  React.useEffect(() => {
    if (!open) {
      return
    }
    const sheet = sheetRef.current
    // A keyboard press on the opener moves focus into the sheet; a tap leaves it on the opener.
    if (sheet && document.activeElement?.matches(':focus-visible')) {
      sheet.querySelector<HTMLElement>('a[href], button:not(:disabled), input')?.focus()
    }
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onOpenChange(false)
      }
    }
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('keydown', onKeyDown)
      // Closing hides the sheet from focus; hand focus back to its opener rather than to <body>.
      if (sheet?.contains(document.activeElement)) {
        document.querySelector<HTMLElement>(`[aria-controls="${SIDEBAR_MOBILE_SHEET_ID}"]`)?.focus()
      }
    }
  }, [open, onOpenChange])

  return createPortal(
    <>
      <div
        ref={backdropRef}
        aria-hidden
        data-state={open ? 'open' : 'closed'}
        onClick={() => onOpenChange(false)}
        className={cn(
          'fixed inset-0 z-35 touch-none bg-sidebar/40',
          'transition-opacity duration-500 ease-[cubic-bezier(0.32,0.72,0,1)] motion-reduce:transition-none',
          'data-[state=closed]:pointer-events-none data-[state=closed]:opacity-0',
        )}
      />
      <div
        ref={sheetRef}
        id={SIDEBAR_MOBILE_SHEET_ID}
        role="dialog"
        aria-label="Menu"
        data-state={open ? 'open' : 'closed'}
        data-sidebar="sidebar"
        data-slot="sidebar"
        data-mobile="true"
        className={cn(
          'fixed inset-x-2.5 bottom-[max(0.625rem,env(safe-area-inset-bottom))] z-35 flex max-h-[82dvh] flex-col',
          'touch-none overflow-hidden rounded-[22px] border border-sidebar-border text-sidebar-foreground shadow-lg',
          'bg-sidebar bg-[linear-gradient(180deg,oklch(1_0_0/0.05),transparent_28%)]',
          // Closed, the sheet sits one travel below its place and turns invisible once the slide
          // ends; open, it turns visible at once. The travel defaults to its own height plus its
          // lift; the curve and 500ms are vaul's, so it moves like the app's other bottom sheets.
          '[--sheet-travel:calc(100%+max(0.625rem,env(safe-area-inset-bottom))+1rem)]',
          'invisible translate-y-(--sheet-travel) [transition:translate_500ms_cubic-bezier(0.32,0.72,0,1),visibility_0s_500ms]',
          'data-[state=open]:visible data-[state=open]:translate-y-0 data-[state=open]:[transition:translate_500ms_cubic-bezier(0.32,0.72,0,1),visibility_0s]',
          'motion-reduce:transition-none',
          className,
        )}
      >
        <div aria-hidden className="mx-auto mt-2.5 h-1.5 w-10 shrink-0 rounded-full bg-sidebar-muted/50" />
        {/* The list scrolls natively; everywhere else on the sheet a downward drag closes it. A
            capped sheet can end its scroll area on a clean row, which reads as the end of the list:
            the fade says there is more, and the padding lets the last row clear it. */}
        <div className="flex min-h-0 w-full flex-1 flex-col overflow-hidden [&_[data-sidebar=content]]:touch-pan-y [&_[data-sidebar=content]]:overscroll-contain [&_[data-sidebar=content]]:pb-6 [&_[data-sidebar=content]]:[mask-image:linear-gradient(to_bottom,black_calc(100%-2rem),transparent)]">
          {isContentReady ? children : null}
        </div>
      </div>
    </>,
    document.body,
  )
}

function useIdleReady() {
  const [isReady, setIsReady] = React.useState(false)
  React.useEffect(() => {
    // Safari has no requestIdleCallback.
    if (typeof window.requestIdleCallback === 'function') {
      const handle = window.requestIdleCallback(() => setIsReady(true), { timeout: 3000 })
      return () => window.cancelIdleCallback(handle)
    }
    const handle = window.setTimeout(() => setIsReady(true), 1500)
    return () => window.clearTimeout(handle)
  }, [])
  return isReady
}

// A downward drag that starts outside the scrolling list moves the sheet with the finger and
// fades the backdrop; letting go past a quarter of the sheet, or with a flick, closes it, and
// anything less springs back. The drag writes inline styles only, then hands back to the class
// transition, which runs from wherever the finger left the sheet.
function useDragToClose(
  sheetRef: React.RefObject<HTMLDivElement | null>,
  backdropRef: React.RefObject<HTMLDivElement | null>,
  onOpenChange: (open: boolean) => void,
) {
  React.useEffect(() => {
    const sheet = sheetRef.current
    const backdrop = backdropRef.current
    if (!sheet || !backdrop) {
      return
    }
    let start: { y: number, time: number, pointerId: number } | null = null
    let offset = 0
    let isDragging = false

    const release = () => {
      sheet.style.removeProperty('translate')
      sheet.style.removeProperty('transition')
      backdrop.style.removeProperty('opacity')
      backdrop.style.removeProperty('transition')
    }

    const onPointerDown = (event: PointerEvent) => {
      if (!event.isPrimary || (event.target as Element).closest('[data-sidebar=content]')) {
        return
      }
      start = { y: event.clientY, time: event.timeStamp, pointerId: event.pointerId }
      offset = 0
    }
    const onPointerMove = (event: PointerEvent) => {
      if (!start || event.pointerId !== start.pointerId) {
        return
      }
      offset = Math.max(0, event.clientY - start.y)
      if (!isDragging) {
        if (offset < DRAG_START_PX) {
          return
        }
        isDragging = true
        sheet.setPointerCapture(event.pointerId)
        sheet.style.transition = 'none'
        backdrop.style.transition = 'none'
      }
      sheet.style.translate = `0 ${offset}px`
      backdrop.style.opacity = String(Math.max(0, 1 - offset / sheet.offsetHeight))
    }
    const onPointerEnd = (event: PointerEvent) => {
      if (!start || event.pointerId !== start.pointerId) {
        return
      }
      const velocity = offset / Math.max(1, event.timeStamp - start.time)
      const shouldClose = isDragging && (offset > sheet.offsetHeight * CLOSE_DISTANCE_RATIO || velocity > CLOSE_VELOCITY_PX_PER_MS)
      start = null
      if (!isDragging) {
        return
      }
      isDragging = false
      // The class transition picks up from the inline position, so the sheet leaves (or
      // returns) from where the finger let go rather than jumping first.
      requestAnimationFrame(release)
      if (shouldClose) {
        onOpenChange(false)
      }
    }
    // A drag that began on a link must not also follow it.
    const onClickCapture = (event: MouseEvent) => {
      if (offset >= DRAG_START_PX) {
        event.preventDefault()
        event.stopPropagation()
        offset = 0
      }
    }

    sheet.addEventListener('pointerdown', onPointerDown)
    sheet.addEventListener('pointermove', onPointerMove)
    sheet.addEventListener('pointerup', onPointerEnd)
    sheet.addEventListener('pointercancel', onPointerEnd)
    sheet.addEventListener('click', onClickCapture, true)
    return () => {
      sheet.removeEventListener('pointerdown', onPointerDown)
      sheet.removeEventListener('pointermove', onPointerMove)
      sheet.removeEventListener('pointerup', onPointerEnd)
      sheet.removeEventListener('pointercancel', onPointerEnd)
      sheet.removeEventListener('click', onClickCapture, true)
    }
  }, [sheetRef, backdropRef, onOpenChange])
}
