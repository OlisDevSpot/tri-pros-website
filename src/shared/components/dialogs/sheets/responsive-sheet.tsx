'use client'

import type { ReactNode } from 'react'
import { useCallback, useLayoutEffect, useRef } from 'react'
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
} from '@/shared/components/ui/drawer'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from '@/shared/components/ui/sheet'
import { useIsBelowLg } from '@/shared/hooks/use-is-below-lg'
import { cn } from '@/shared/lib/utils'

interface ResponsiveSheetProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  description?: string
  /** Pinned below the scrolling body. */
  footer?: ReactNode
  /** Width above `lg` (for example `sm:max-w-xl`), height below it. */
  contentClassName?: string
  /** Radix `onOpenAutoFocus`. Call `event.preventDefault()` to place focus yourself. */
  onOpenAutoFocus?: (event: Event) => void
  children: ReactNode
}

/**
 * One host for "work on one thing" panels: a right-side Sheet (Radix Dialog) at
 * `lg` and up, a bottom Drawer (vaul) below it. Overlay, focus trap, Escape,
 * scroll lock, and drag-to-close come from the primitives. Return-focus is
 * handled here, not by the primitives: Radix's own `onCloseAutoFocus` default
 * only restores focus to a `Dialog.Trigger`/`Drawer.Trigger`, and every opener
 * across this app is a plain button, never a `Trigger`, so that default would
 * drop focus to `document.body`. A layout effect (it runs before FocusScope's
 * own autofocus effect, so it still sees the opener) records whichever element
 * was focused right before `open` became true; on close, that element is
 * refocused directly. Header and footer stay put; the body scrolls. The
 * breakpoint hook reports `false` on the first client render, so a sheet open
 * on page load below `lg` renders as a Sheet for one frame before becoming a
 * Drawer.
 */
export function ResponsiveSheet({
  open,
  onOpenChange,
  title,
  description,
  footer,
  contentClassName,
  onOpenAutoFocus,
  children,
}: ResponsiveSheetProps) {
  const isBelowLg = useIsBelowLg()
  const openerRef = useRef<HTMLElement | null>(null)

  useLayoutEffect(() => {
    if (open) {
      const active = document.activeElement
      openerRef.current = active instanceof HTMLElement && active !== document.body ? active : null
    }
  }, [open])

  const handleCloseAutoFocus = useCallback((event: Event) => {
    event.preventDefault()
    const opener = openerRef.current
    openerRef.current = null
    if (opener?.isConnected) {
      opener.focus()
    }
  }, [])

  if (isBelowLg) {
    return (
      <Drawer direction="bottom" open={open} onOpenChange={onOpenChange}>
        <DrawerContent className={contentClassName} onCloseAutoFocus={handleCloseAutoFocus} onOpenAutoFocus={onOpenAutoFocus}>
          <DrawerHeader className="text-left">
            <DrawerTitle>{title}</DrawerTitle>
            {description !== undefined && <DrawerDescription>{description}</DrawerDescription>}
          </DrawerHeader>
          <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-4">{children}</div>
          {footer !== undefined && (
            <DrawerFooter className="border-t pb-[max(1rem,env(safe-area-inset-bottom))]">{footer}</DrawerFooter>
          )}
        </DrawerContent>
      </Drawer>
    )
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className={cn('gap-0', contentClassName)} side="right" onCloseAutoFocus={handleCloseAutoFocus} onOpenAutoFocus={onOpenAutoFocus}>
        <SheetHeader className="pr-12">
          <SheetTitle>{title}</SheetTitle>
          {description !== undefined && <SheetDescription>{description}</SheetDescription>}
        </SheetHeader>
        <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-4">{children}</div>
        {footer !== undefined && <SheetFooter className="border-t">{footer}</SheetFooter>}
      </SheetContent>
    </Sheet>
  )
}
