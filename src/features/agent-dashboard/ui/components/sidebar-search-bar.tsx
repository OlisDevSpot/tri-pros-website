'use client'

import { SearchIcon } from 'lucide-react'
import { useEffect, useState } from 'react'

import {
  CommandDialog,
  CommandEmpty,
  CommandInput,
  CommandList,
} from '@/shared/components/ui/command'
import {
  SidebarGroup,
  SidebarGroupContent,
} from '@/shared/components/ui/sidebar'

export function SidebarSearchBar() {
  const [open, setOpen] = useState(false)

  useEffect(() => {
    function onKeydown(event: KeyboardEvent) {
      if (event.key === 'k' && (event.metaKey || event.ctrlKey)) {
        event.preventDefault()
        setOpen(prev => !prev)
      }
    }
    document.addEventListener('keydown', onKeydown)
    return () => document.removeEventListener('keydown', onKeydown)
  }, [])

  return (
    <>
      <SidebarGroup>
        <SidebarGroupContent>
          <button
            type="button"
            onClick={() => setOpen(true)}
            aria-label="Search"
            className="
              flex h-9 w-full items-center gap-2 overflow-hidden
              rounded-lg border border-border/70
              bg-linear-to-b from-background to-muted/50
              px-2.5 text-sm text-muted-foreground
              transition-[width,height,padding,background,border-color,color]
              duration-200 ease-linear
              hover:border-border hover:text-foreground
              focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring
              group-data-[collapsible=icon]:size-8!
              group-data-[collapsible=icon]:p-2!
            "
          >
            <SearchIcon className="size-4 shrink-0" />
            <span className="flex-1 truncate text-left group-data-[collapsible=icon]:hidden">Search...</span>
            <kbd
              className="
                pointer-events-none hidden shrink-0 select-none items-center gap-0.5
                rounded border border-border/70 bg-muted px-1.5 py-0.5
                font-mono text-[10px] font-medium text-muted-foreground
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

      <CommandDialog open={open} onOpenChange={setOpen}>
        <CommandInput placeholder="Search customers, meetings, proposals, projects..." />
        <CommandList>
          <CommandEmpty>
            Omni-search coming soon — results will span all records.
          </CommandEmpty>
        </CommandList>
      </CommandDialog>
    </>
  )
}
