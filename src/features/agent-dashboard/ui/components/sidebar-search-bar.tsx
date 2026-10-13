'use client'

import { SearchIcon } from 'lucide-react'

import { useDashboardOverlays } from '@/features/agent-dashboard/hooks/use-dashboard-overlays'
import {
  SidebarGroup,
  SidebarGroupContent,
  useSidebar,
} from '@/shared/components/ui/sidebar'

export function SidebarSearchBar() {
  const setSearchOpen = useDashboardOverlays(state => state.setSearchOpen)
  const { isMobile, setOpenMobile } = useSidebar()

  return (
    <SidebarGroup>
      <SidebarGroupContent>
        <button
          type="button"
          onClick={() => {
            if (isMobile) {
              setOpenMobile(false)
            }
            setSearchOpen(true)
          }}
          aria-label="Search"
          className="
            flex h-8 w-full items-center gap-2 overflow-hidden
            rounded-lg border border-sidebar-border
            bg-sidebar-hover
            px-2.5 text-sm text-sidebar-muted
            transition-[width,height,padding,background,border-color,color]
            duration-200 ease-linear
            hover:border-sidebar-muted hover:text-sidebar-foreground
            focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring
            group-data-[collapsible=icon]:size-8!
            group-data-[collapsible=icon]:p-2!
          "
        >
          <SearchIcon className="size-4 shrink-0" />
          <span className="flex-1 truncate text-left group-data-[collapsible=icon]:hidden">Search...</span>
          <kbd
            className="
              pointer-events-none hidden shrink-0 select-none items-center gap-0.5
              rounded border border-sidebar-border bg-transparent px-1.5 py-0.5
              font-mono text-xs font-medium text-sidebar-muted
              sm:inline-flex
              group-data-[collapsible=icon]:hidden
            "
          >
            <span className="text-xs leading-none">⌘</span>
            <span className="leading-none">K</span>
          </kbd>
        </button>
      </SidebarGroupContent>
    </SidebarGroup>
  )
}
