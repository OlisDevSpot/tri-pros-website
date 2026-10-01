'use client'

import { MoonIcon, SunIcon } from 'lucide-react'
import { motion } from 'motion/react'
import { useRef } from 'react'

import { SIDEBAR_TRANSITION, THEME_SWITCH_EASE } from '@/features/agent-dashboard/constants/sidebar-motion'
import { SIDEBAR_NAV_ITEM_CLASS } from '@/features/agent-dashboard/constants/sidebar-styles'
import { useThemeTransition } from '@/features/agent-dashboard/hooks/use-theme-transition'
import { SidebarMenuButton, useSidebar } from '@/shared/components/ui/sidebar'
import { Switch } from '@/shared/components/ui/switch'
import { cn } from '@/shared/lib/utils'

const THUMB_SLIDE_MS = 320

const GLYPH_CLASS = 'col-start-1 row-start-1'
// Each glyph slot is exactly the thumb's box, so a glyph centred in its slot sits under the
// thumb's own glyph when the thumb arrives.
const SLOT_CLASS = 'pointer-events-none absolute top-px grid place-items-center text-sidebar-muted transition-colors duration-200 group-hover/theme:text-sidebar-foreground'

// Trails the Settings row: a sun/moon switch on the open rail, a single icon button under the
// gear on the collapsed rail. Both are always mounted and trade width and height with the
// labels' own tween, so collapsing the rail folds the switch away instead of popping it.
export function SidebarThemeSwitch() {
  const { state, isMobile } = useSidebar()
  const isCollapsed = state === 'collapsed' && !isMobile
  const { isDark, switchTheme } = useThemeTransition()
  const switchRef = useRef<HTMLButtonElement>(null)

  function toggleFromSwitch(checked: boolean) {
    const thumb = switchRef.current?.querySelector<HTMLElement>('[data-slot="switch-thumb"]') ?? null
    const from = thumb?.getBoundingClientRect().left
    switchTheme(checked ? 'dark' : 'light', thumb, () => {
      if (!thumb || from === undefined) {
        return
      }
      // next-themes disables CSS transitions for the frame the class flips, so the thumb's
      // slide is played with WAAPI, which that stylesheet can't reach.
      const dx = from - thumb.getBoundingClientRect().left
      thumb.animate(
        [{ transform: `translateX(${dx}px)` }, { transform: 'none' }],
        { duration: THUMB_SLIDE_MS, easing: THEME_SWITCH_EASE },
      )
    })
  }

  const glyphSize = isMobile ? 'size-4' : 'size-3.5'
  const slotSize = isMobile ? 'size-7' : 'size-6'

  return (
    <>
      <motion.div
        initial={false}
        animate={isCollapsed ? { opacity: 0, width: 0, marginLeft: 0 } : { opacity: 1, width: 'auto', marginLeft: 8 }}
        transition={SIDEBAR_TRANSITION}
        inert={isCollapsed}
        className="flex shrink-0 overflow-clip [overflow-clip-margin:4px]"
      >
        <Switch
          ref={switchRef}
          checked={isDark}
          onCheckedChange={toggleFromSwitch}
          aria-label="Dark mode"
          className={cn(
            'group/theme relative p-px',
            // A groove below the rail, so the thumb (the active pill's navy lift) reads raised out of it.
            'data-[state=checked]:bg-[color-mix(in_oklab,var(--sidebar),black_22%)] data-[state=unchecked]:bg-[color-mix(in_oklab,var(--sidebar),black_22%)]',
            'shadow-[inset_0_0_0_1px_oklch(1_0_0/0.1),inset_0_1px_3px_oklch(0_0_0/0.45)]',
            'focus-visible:border-transparent focus-visible:ring-2 focus-visible:ring-sidebar-ring',
            isMobile
              ? 'h-8 w-15 after:absolute after:-inset-1.5 after:content-[""]'
              : 'h-7 w-13',
          )}
          thumbClassName={cn(
            // Dressed like the active nav row: navy-lift pill, cyan glyph.
            'relative grid place-items-center text-sidebar-active-icon',
            'bg-sidebar-accent dark:data-[state=checked]:bg-sidebar-accent dark:data-[state=unchecked]:bg-sidebar-accent',
            'shadow-[0_1px_3px_oklch(0_0_0/0.45),inset_0_1px_0_oklch(1_0_0/0.14)]',
            // Position follows the .dark class, not data-state: the server can't know the theme,
            // so data-state starts unchecked and would slide the thumb on every dark page load.
            'data-[state=checked]:translate-x-(--thumb-x) data-[state=unchecked]:translate-x-(--thumb-x) [--thumb-x:0px]',
            isMobile ? 'size-7 dark:[--thumb-x:--spacing(7)]' : 'size-6 dark:[--thumb-x:--spacing(6)]',
          )}
          thumb={(
            <>
              <SunIcon aria-hidden strokeWidth={2.25} className={cn(GLYPH_CLASS, glyphSize, 'dark:opacity-0')} />
              <MoonIcon aria-hidden strokeWidth={2.25} className={cn(GLYPH_CLASS, glyphSize, 'opacity-0 dark:opacity-100')} />
            </>
          )}
        >
          <span aria-hidden className={cn(SLOT_CLASS, slotSize, 'left-px')}>
            <SunIcon className={glyphSize} />
          </span>
          <span aria-hidden className={cn(SLOT_CLASS, slotSize, 'right-px')}>
            <MoonIcon className={glyphSize} />
          </span>
        </Switch>
      </motion.div>

      <motion.div
        initial={false}
        animate={isCollapsed ? { opacity: 1, height: 32, marginTop: 4 } : { opacity: 0, height: 0, marginTop: 0 }}
        transition={SIDEBAR_TRANSITION}
        inert={!isCollapsed}
        className="basis-full overflow-clip [overflow-clip-margin:4px]"
      >
        <SidebarMenuButton
          role="switch"
          aria-checked={isDark}
          tooltip="Dark mode"
          onClick={event => switchTheme(isDark ? 'light' : 'dark', event.currentTarget)}
          className={SIDEBAR_NAV_ITEM_CLASS}
        >
          <span className="grid size-4 shrink-0">
            <SunIcon className="col-start-1 row-start-1 size-4 transition-[rotate,scale,opacity] duration-200 ease-out dark:-rotate-90 dark:scale-50 dark:opacity-0 motion-reduce:transition-none" />
            <MoonIcon className="col-start-1 row-start-1 size-4 rotate-90 scale-50 opacity-0 transition-[rotate,scale,opacity] duration-200 ease-out dark:rotate-0 dark:scale-100 dark:opacity-100 motion-reduce:transition-none" />
          </span>
          <span className="sr-only">Dark mode</span>
        </SidebarMenuButton>
      </motion.div>
    </>
  )
}
