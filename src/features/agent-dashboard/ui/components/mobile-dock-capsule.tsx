'use client'

import type { MobileDockTab as MobileDockTabConfig } from '@/features/agent-dashboard/lib/get-mobile-dock-tabs'

import { ZapIcon } from 'lucide-react'
import { usePathname } from 'next/navigation'
import { useState, useSyncExternalStore } from 'react'

import { MOBILE_DOCK_SURFACE_CLASS } from '@/features/agent-dashboard/constants/mobile-dock'
import { isNavItemActive } from '@/features/agent-dashboard/lib/is-nav-item-active'
import { MobileDockTab } from '@/features/agent-dashboard/ui/components/mobile-dock-tab'
import { useSidebar } from '@/shared/components/ui/sidebar'
import { ROOTS } from '@/shared/config/roots'
import { getStoredPipeline } from '@/shared/domains/pipelines/hooks/pipeline-context'
import { cn } from '@/shared/lib/utils'

function subscribeToStorage(onChange: () => void) {
  window.addEventListener('storage', onChange)
  return () => window.removeEventListener('storage', onChange)
}

// The last pipeline the agent opened lives in localStorage, which the server cannot read: the
// server renders the default board and the client reads the stored one on every render, so a
// board switch in this tab shows on the next navigation without an effect.
function useStoredPipelineHref(): string | null {
  return useSyncExternalStore(subscribeToStorage, () => ROOTS.dashboard.pipeline(getStoredPipeline()), () => null)
}

interface MobileDockCapsuleProps {
  tabs: readonly MobileDockTabConfig[]
  onActionCenterClick: () => void
  className?: string
}

export function MobileDockCapsule({ tabs, onActionCenterClick, className }: MobileDockCapsuleProps) {
  const pathname = usePathname()
  const pipelineHref = useStoredPipelineHref()
  const { setOpenMobile } = useSidebar()

  // The pathname only changes once the next page has rendered, a beat after the tap. The tapped
  // tab lights up at once and hands back to the pathname as soon as it moves.
  const [pending, setPending] = useState<{ href: string, from: string } | null>(null)
  // Cleared once the pathname moves, or coming Back to `from` would light the tapped tab again.
  if (pending && pending.from !== pathname) {
    setPending(null)
  }
  const pendingHref = pending?.from === pathname ? pending.href : null
  const activeIndex = pendingHref
    ? tabs.findIndex(tab => tab.item.href === pendingHref)
    : tabs.findIndex(tab => isNavItemActive(tab.item, pathname))

  // Off a tab's page the pill fades where it last was, so it slides from there when it comes back.
  const [pillIndex, setPillIndex] = useState(Math.max(activeIndex, 0))
  if (activeIndex !== -1 && activeIndex !== pillIndex) {
    setPillIndex(activeIndex)
  }

  return (
    <nav aria-label="Main" className={cn('flex h-14 items-center gap-0.5 rounded-[18px] p-1 max-[379px]:gap-0 max-[379px]:p-0.5', MOBILE_DOCK_SURFACE_CLASS, className)}>
      <div className="relative flex h-full min-w-0 flex-1">
        {/* One element moved by a CSS transform, which the compositor runs, so the slide stays
            smooth while the next page's render holds the main thread. */}
        <span
          aria-hidden
          data-hidden={activeIndex === -1 || undefined}
          className={cn(
            'pointer-events-none absolute inset-y-0 left-0 rounded-[14px] bg-sidebar-accent',
            'shadow-[inset_0_1px_0_oklch(1_0_0/0.35),0_4px_12px_-6px_oklch(0.8_0.12_228/0.6)]',
            'transition-[translate,opacity,scale] duration-300 ease-[cubic-bezier(0.3,0.8,0.2,1)] motion-reduce:transition-none',
            'data-hidden:scale-90 data-hidden:opacity-0',
          )}
          style={{ width: `${100 / Math.max(tabs.length, 1)}%`, translate: `${pillIndex * 100}% 0` }}
        />
        {tabs.map((tab, index) => {
          const href = tab.item.children ? (pipelineHref ?? tab.item.href) : tab.item.href
          return (
            <MobileDockTab
              key={tab.item.href}
              tab={tab}
              href={href}
              isActive={index === activeIndex}
              onNavigate={() => {
                setPending({ href: tab.item.href, from: pathname })
                setOpenMobile(false)
              }}
            />
          )
        })}
      </div>
      <span aria-hidden className="mx-0.5 h-7 w-px shrink-0 bg-sidebar-border max-[379px]:mx-0" />
      <button
        type="button"
        aria-label="Action Center"
        onClick={onActionCenterClick}
        className={cn(
          'grid h-full w-11 shrink-0 max-[379px]:w-9 place-items-center rounded-[14px] text-sidebar-muted outline-none [-webkit-tap-highlight-color:transparent]',
          'transition-[color,background-color,transform] duration-150 hover:bg-sidebar-hover hover:text-sidebar-foreground active:scale-[0.94] motion-reduce:transition-none motion-reduce:active:scale-100',
          'focus-visible:ring-2 focus-visible:ring-sidebar-ring focus-visible:ring-offset-2 focus-visible:ring-offset-sidebar',
        )}
      >
        <ZapIcon aria-hidden className="size-5" />
      </button>
    </nav>
  )
}
