'use client'

import type { ReactNode, SyntheticEvent } from 'react'
import { XIcon } from 'lucide-react'
import { DismissableLayer, FocusScope } from 'radix-ui/internal'
import { useCallback, useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { FOCUSABLE_SELECTOR } from '@/shared/components/dialogs/sheets/constants/focusable'
import { useDragToClose } from '@/shared/hooks/use-drag-to-close'
import { useIdleReady } from '@/shared/hooks/use-idle-ready'
import { useIsBelowLg } from '@/shared/hooks/use-is-below-lg'
import { cn } from '@/shared/lib/utils'

interface ResponsiveSheetProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Names the sheet for assistive tech even when `header` replaces the visible title row. */
  title: string
  description?: string
  /** Pinned above the scrolling body in place of the title row and close button. */
  header?: ReactNode
  /** Pinned below the scrolling body. */
  footer?: ReactNode
  /** Classes for the right-side sheet (lg and up). */
  sheetClassName?: string
  /** Classes for the bottom sheet (below lg), for example a height cap. */
  drawerClassName?: string
  /** Classes for the scrolling body on both sides of the breakpoint. */
  bodyClassName?: string
  /** The title stays for assistive tech but is visually hidden, for content that brings its own header. */
  hideTitle?: boolean
  /** The sheet's id on either side of the breakpoint, for example so an external `aria-controls` resolves. */
  contentId?: string
  /** Called with a cancelable event when the sheet opens, before focus moves in. Call `event.preventDefault()` to place focus yourself. */
  onOpenAutoFocus?: (event: Event) => void
  children: ReactNode
}

const BODY_SELECTOR = '[data-slot="responsive-sheet-body"]'

function preventDefault(event: Event) {
  event.preventDefault()
}

// A Radix modal under the sheet holds a scroll lock that cancels wheel and touch scrolling outside
// itself. Its listener sits on document after React's, so stopping the event here keeps the
// sheet's body scrollable while React's own handlers inside the sheet still run.
function releaseScrollLock(event: SyntheticEvent) {
  event.nativeEvent.stopImmediatePropagation()
}

/**
 * One host for "work on one thing" panels: a right sheet at `lg` and up, a bottom sheet below,
 * where a downward drag closes it. It stays mounted, and opening it flips `data-state` and
 * `inert`: a Radix or vaul modal writes to <body> on every open and close (pointer-events, a
 * scroll lock), and each write restyles the whole document on the frame the sheet starts to move.
 *
 * While open it joins Radix's layer and focus stacks through an empty sentinel, so Escape goes to
 * whichever layer is on top: a menu or dialog opened from inside closes before the sheet, and a
 * Radix modal under the sheet neither closes on a press in the sheet nor pulls focus back into
 * itself. Above such a modal (detected by the pointer-events it put on <body>) the sentinel also
 * turns that modal's outside presses off, as a Radix layer on top would.
 *
 * Return focus is handled here: every opener across this app is a plain button, so the element
 * focused when `open` became true is refocused on close, before `inert` would drop it to <body>.
 */
export function ResponsiveSheet({
  open,
  onOpenChange,
  title,
  description,
  header,
  footer,
  sheetClassName,
  drawerClassName,
  bodyClassName,
  hideTitle,
  contentId,
  onOpenAutoFocus,
  children,
}: ResponsiveSheetProps) {
  const isBelowLg = useIsBelowLg()
  const isContentReady = useIdleReady() || open
  const sheetRef = useRef<HTMLDivElement>(null)
  const backdropRef = useRef<HTMLDivElement>(null)
  const openerRef = useRef<HTMLElement | null>(null)
  const titleId = useId()
  const descriptionId = useId()
  // The portal mounts a commit after its parent, as Radix's does: a sheet inside a dialog's first
  // render would otherwise land in <body> before that dialog, and so under it.
  const [isMounted, setIsMounted] = useState(false)
  // A transition does not run from an element's first style, so a sheet mounted open (a modal
  // layer) paints one closed frame before it slides in.
  const [hasPainted, setHasPainted] = useState(false)
  const isShown = open && hasPainted
  const state = isShown ? 'open' : 'closed'
  const isAboveModal = useMemo(() => open && typeof document !== 'undefined' && document.body.style.pointerEvents === 'none', [open])

  const latest = useRef({ onOpenChange, onOpenAutoFocus })
  useLayoutEffect(() => {
    latest.current = { onOpenChange, onOpenAutoFocus }
  })

  useLayoutEffect(() => {
    // eslint-disable-next-line react-hooks-extra/no-direct-set-state-in-use-effect
    setIsMounted(true)
  }, [])

  useEffect(() => {
    if (!isMounted) {
      return
    }
    const frame = requestAnimationFrame(() => setHasPainted(true))
    return () => cancelAnimationFrame(frame)
  }, [isMounted])

  useLayoutEffect(() => {
    if (open) {
      const active = document.activeElement
      openerRef.current = active instanceof HTMLElement && active !== document.body ? active : null
    }
  }, [open])

  const returnFocus = useCallback(() => {
    const opener = openerRef.current
    if (sheetRef.current?.contains(document.activeElement) && opener?.isConnected) {
      opener.focus()
    }
  }, [])

  const close = useCallback(() => {
    returnFocus()
    latest.current.onOpenChange(false)
  }, [returnFocus])

  // A close from outside (the parent flips `open`) gets the same return before `inert` lands.
  useLayoutEffect(() => {
    if (!isShown) {
      returnFocus()
    }
  }, [isShown, returnFocus])

  const onDragOpenChange = useCallback((next: boolean) => {
    if (!next) {
      close()
    }
  }, [close])

  // The hook wires its listeners when its options change and the nodes exist; the nodes exist only
  // once mounted, so the selector that turns the drag on changes only after that. At lg and up
  // nothing drags: '*' ignores every press.
  useDragToClose({ backdropRef, ignoreSelector: isMounted && isBelowLg ? BODY_SELECTOR : '*', onOpenChange: onDragOpenChange, sheetRef })

  const onEscapeKeyDown = useCallback((event: KeyboardEvent) => {
    event.preventDefault()
    close()
  }, [close])

  useEffect(() => {
    if (!isShown) {
      return
    }
    const sheet = sheetRef.current
    const event = new Event('openautofocus', { cancelable: true })
    latest.current.onOpenAutoFocus?.(event)
    // A keyboard press on the opener moves focus in; a tap leaves it on the opener.
    if (sheet && !event.defaultPrevented && document.activeElement?.matches(':focus-visible')) {
      sheet.querySelector<HTMLElement>(FOCUSABLE_SELECTOR)?.focus()
    }
  }, [isShown])

  useEffect(() => {
    const sheet = sheetRef.current
    if (!isShown || !sheet) {
      return
    }
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Tab') {
        return
      }
      const active = document.activeElement
      // Focus in a layer above the sheet (a dialog, a menu) belongs to that layer, and so does Tab.
      if (active instanceof HTMLElement && active !== document.body && !sheet.contains(active) && active !== openerRef.current) {
        return
      }
      const items = [...sheet.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)].filter(el => el.offsetParent !== null)
      const first = items[0]
      const last = items.at(-1)
      if (!first || !last) {
        return
      }
      if (event.shiftKey && (active === first || !sheet.contains(active))) {
        event.preventDefault()
        last.focus()
      }
      else if (!event.shiftKey && (active === last || !sheet.contains(active))) {
        event.preventDefault()
        first.focus()
      }
    }
    window.addEventListener('keydown', onKeyDown, true)
    return () => window.removeEventListener('keydown', onKeyDown, true)
  }, [isShown])

  if (!isMounted) {
    return null
  }

  const hasHeader = header !== undefined

  return createPortal(
    <>
      <div
        ref={backdropRef}
        aria-hidden
        data-state={state}
        onClick={close}
        className={cn(
          'pointer-events-auto fixed inset-0 z-50 touch-none bg-scrim/50 dark:bg-scrim/60',
          'transition-opacity duration-500 ease-[cubic-bezier(0.32,0.72,0,1)] motion-reduce:transition-none',
          'data-[state=closed]:pointer-events-none data-[state=closed]:opacity-0',
        )}
      />
      <div
        ref={sheetRef}
        id={contentId}
        role="dialog"
        aria-modal="true"
        aria-label={hasHeader ? title : undefined}
        aria-labelledby={hasHeader ? undefined : titleId}
        aria-describedby={hasHeader || description === undefined ? undefined : descriptionId}
        tabIndex={-1}
        data-state={state}
        data-slot="responsive-sheet"
        inert={!isShown}
        onWheel={isAboveModal ? releaseScrollLock : undefined}
        onTouchMove={isAboveModal ? releaseScrollLock : undefined}
        className={cn(
          'pointer-events-auto fixed z-50 flex flex-col bg-card text-card-foreground shadow-lg outline-none',
          // Closed, the sheet sits one travel outside and turns invisible once the slide ends; open, it turns visible at once.
          'invisible [transition:translate_500ms_cubic-bezier(0.32,0.72,0,1),visibility_0s_500ms]',
          'data-[state=open]:visible data-[state=open]:[transition:translate_500ms_cubic-bezier(0.32,0.72,0,1),visibility_0s]',
          'motion-reduce:transition-none motion-reduce:data-[state=open]:transition-none',
          isBelowLg
            ? cn('inset-x-0 bottom-0 max-h-[85dvh] touch-none rounded-t-2xl border-t translate-y-[calc(100%+1rem)] data-[state=open]:translate-y-0', drawerClassName)
            : cn('inset-y-0 right-0 w-3/4 border-l sm:max-w-sm translate-x-[calc(100%+1rem)] data-[state=open]:translate-x-0', sheetClassName),
        )}
      >
        {isShown && (
          <DismissableLayer.Root asChild disableOutsidePointerEvents={isAboveModal} onEscapeKeyDown={onEscapeKeyDown}>
            <FocusScope.Root asChild onMountAutoFocus={preventDefault} onUnmountAutoFocus={preventDefault}>
              <span hidden />
            </FocusScope.Root>
          </DismissableLayer.Root>
        )}
        {isBelowLg && <div aria-hidden className="mx-auto mt-2.5 mb-1 h-1.5 w-10 shrink-0 rounded-full bg-border" />}
        {hasHeader
          ? <div className="shrink-0">{header}</div>
          : (
              <>
                <div className={cn('flex flex-col gap-1.5 p-4', !isBelowLg && 'pr-12', hideTitle && 'sr-only')}>
                  <h2 id={titleId} className="font-semibold text-foreground">{title}</h2>
                  {description !== undefined && <p id={descriptionId} className="text-sm text-muted-foreground">{description}</p>}
                </div>
                {!isBelowLg && (
                  <button type="button" onClick={close} className="absolute top-[calc(max(1rem,env(safe-area-inset-top))_-_0.25rem)] right-3 rounded-md p-1 text-muted-foreground transition-colors outline-none hover:bg-hover hover:text-foreground pressed:bg-press focus-visible:ring-3 focus-visible:ring-ring/50">
                    <XIcon className="size-4" />
                    <span className="sr-only">Close</span>
                  </button>
                )}
              </>
            )}
        <div data-slot="responsive-sheet-body" className={cn('min-h-0 flex-1 touch-pan-y overflow-y-auto overscroll-contain scrollbar-gutter-stable px-4', footer === undefined ? 'pb-[max(1rem,env(safe-area-inset-bottom))]' : 'pb-4', bodyClassName)}>
          {isContentReady ? children : null}
        </div>
        {footer !== undefined && <div className="mt-auto flex flex-col gap-2 border-t p-4 pb-[max(1rem,env(safe-area-inset-bottom))]">{footer}</div>}
      </div>
    </>,
    document.body,
  )
}
