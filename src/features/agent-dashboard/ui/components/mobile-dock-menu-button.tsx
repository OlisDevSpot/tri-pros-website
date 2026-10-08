'use client'

import { MenuIcon, XIcon } from 'lucide-react'

import { useSidebar, useSidebarOpenMobile } from '@/shared/components/ui/sidebar'
import { SIDEBAR_MOBILE_SHEET_ID } from '@/shared/components/ui/sidebar-mobile-sheet'
import { cn } from '@/shared/lib/utils'

const ICON_CLASS = 'col-start-1 row-start-1 size-6 transition-[rotate,scale,opacity] duration-200 ease-out motion-reduce:transition-none'

// A raised navy puck, the dock's material with depth, so the cyan tab stays the dock's one
// colored mark. It toggles: the thumb that opened the menu closes it from the same spot.
export function MobileDockMenuButton({ className }: { className?: string }) {
  const { setOpenMobile } = useSidebar()
  const openMobile = useSidebarOpenMobile()
  return (
    <button
      type="button"
      data-state={openMobile ? 'open' : 'closed'}
      aria-label={openMobile ? 'Close menu' : 'Open menu'}
      aria-haspopup="dialog"
      aria-controls={SIDEBAR_MOBILE_SHEET_ID}
      aria-expanded={openMobile}
      // Toggling on press, not on release, saves the tap's lift; a keyboard press has no pointer
      // and arrives as a click with no detail.
      onPointerDown={(event) => {
        if (event.button === 0) {
          setOpenMobile(!openMobile)
        }
      }}
      onClick={(event) => {
        if (event.detail === 0) {
          setOpenMobile(!openMobile)
        }
      }}
      className={cn(
        'group/menu-button grid size-14 shrink-0 place-items-center rounded-full border border-sidebar-border text-sidebar-foreground outline-none [-webkit-tap-highlight-color:transparent]',
        'bg-sidebar bg-(image:--sidebar-sheen-radial) shadow-(--shadow-dock-button)',
        'transition-[transform,box-shadow] duration-150 active:scale-[0.93] active:shadow-(--shadow-dock-button-pressed) motion-reduce:transition-none motion-reduce:active:scale-100',
        'focus-visible:ring-2 focus-visible:ring-sidebar-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background',
        className,
      )}
    >
      <MenuIcon aria-hidden strokeWidth={2.25} className={cn(ICON_CLASS, 'group-data-[state=open]/menu-button:rotate-90 group-data-[state=open]/menu-button:scale-50 group-data-[state=open]/menu-button:opacity-0')} />
      <XIcon aria-hidden strokeWidth={2.25} className={cn(ICON_CLASS, '-rotate-90 scale-50 opacity-0 group-data-[state=open]/menu-button:rotate-0 group-data-[state=open]/menu-button:scale-100 group-data-[state=open]/menu-button:opacity-100')} />
    </button>
  )
}
