import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarSeparator,
} from '@/shared/components/ui/sidebar'
import { Skeleton } from '@/shared/components/ui/skeleton'

// Same <Sidebar> primitive and props as AppSidebar: its in-flow `sidebar-gap`
// div reserves the sidebar's width, so the inset does not shift when the real
// sidebar swaps in. Fixed widths on purpose — SidebarMenuSkeleton randomizes its
// width, which differs between the server and the client render.
export function AppSidebarSkeleton() {
  return (
    <Sidebar collapsible="icon" side="left" variant="sidebar">
      <SidebarHeader>
        <div className="flex h-12 items-center px-2 group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:px-0">
          <Skeleton className="h-6 w-28 group-data-[collapsible=icon]:w-6" />
        </div>
      </SidebarHeader>
      <SidebarSeparator className="mx-0" />
      <SidebarContent className="gap-0">
        <SidebarGroup>
          <Skeleton className="h-8 w-full" />
        </SidebarGroup>
        <SidebarGroup>
          <div className="flex flex-col gap-1 p-1 group-data-[collapsible=icon]:p-0">
            <Skeleton className="h-8 w-full" />
            <Skeleton className="h-8 w-full" />
            <Skeleton className="h-8 w-full" />
            <Skeleton className="h-8 w-full" />
          </div>
        </SidebarGroup>
        <SidebarGroup>
          <SidebarGroupLabel>
            <Skeleton className="h-3 w-16" />
          </SidebarGroupLabel>
          <div className="flex flex-col gap-1">
            <Skeleton className="h-8 w-full" />
            <Skeleton className="h-8 w-full" />
            <Skeleton className="h-8 w-full" />
            <Skeleton className="h-8 w-full" />
          </div>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter>
        <SidebarSeparator className="mx-0" />
        <div className="flex flex-col gap-1">
          <Skeleton className="h-8 w-full" />
          <Skeleton className="h-8 w-full" />
        </div>
        <div className="flex h-12 items-center gap-2 p-2 group-data-[collapsible=icon]:h-8 group-data-[collapsible=icon]:p-0">
          <Skeleton className="size-8 shrink-0 rounded-lg" />
          <div className="flex flex-1 flex-col gap-1 group-data-[collapsible=icon]:hidden">
            <Skeleton className="h-3 w-24" />
            <Skeleton className="h-3 w-32" />
          </div>
        </div>
      </SidebarFooter>
    </Sidebar>
  )
}
