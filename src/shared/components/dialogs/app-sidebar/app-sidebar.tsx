'use client'

import type { generateNavItemsGroups } from '@/shared/constants/nav-items'
import type { NavItemsGroup } from '@/shared/types/nav'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Logo } from '@/shared/components/logo'
import { Badge } from '@/shared/components/ui/badge'
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuBadge,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
  useSidebar,
} from '@/shared/components/ui/sidebar'
import { getTypedKeys } from '@/shared/lib/utils'
import { useTRPC } from '@/trpc/helpers'

interface Props<T extends Record<Parameters<typeof generateNavItemsGroups>[0]['navType'], NavItemsGroup>> {
  sidebarItemsGroups: T
  adminUrl?: string
  settingsUrl?: string
  dashboardUrl?: string
  onSettingsClick?: () => void
  user?: {
    name?: string
    email?: string
    image?: string
  }
  isIdentityPending?: boolean
  isAdminPath?: boolean
}

export function AppSidebar<T extends Record<string, NavItemsGroup>>({
  sidebarItemsGroups,
  isAdminPath = false,
}: Props<T>) {
  const pathname = usePathname()
  const { setOpenMobile, open } = useSidebar()
  const trpc = useTRPC()

  return (
    <Sidebar
      collapsible="offcanvas"
      side="right"
      variant="floating"
      className="relative z-999"
    >
      <SidebarHeader className="border-b h-(--topnav-height) flex items-center pl-2">
        <SidebarMenu className="h-full flex justify-center">
          <SidebarMenuItem>
            <div className="flex gap-4 items-center justify-between">
              <SidebarMenuButton asChild className="p-0 items-center">
                <Link href="/" className="w-full hover:bg-transparent active:bg-transparent relative">
                  <Logo variant={open ? 'right' : 'icon'} />
                </Link>
              </SidebarMenuButton>
              {isAdminPath && (
                <Badge variant="secondary">Admin</Badge>
              )}
            </div>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent className="pt-2 text-sidebar-foreground">
        {getTypedKeys(sidebarItemsGroups).map(key => (
          <SidebarGroup key={key as string}>
            <SidebarGroupLabel>{sidebarItemsGroups[key].sectionName}</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {sidebarItemsGroups[key].items.map(item => (
                  <SidebarMenuItem key={item.name}>
                    <SidebarMenuButton asChild className="transition-colors duration-200 text-sidebar-foreground" isActive={pathname.startsWith(item.href)}>
                      <Link href={item.href} onClick={() => setOpenMobile(false)}>
                        <span>{item.name}</span>
                      </Link>
                    </SidebarMenuButton>
                    {item.badge && (
                      <SidebarMenuBadge className="border rounded-sm border-sidebar-foreground">{item.badge}</SidebarMenuBadge>
                    )}
                    {'subItems' in item && (
                      <SidebarMenuSub className="mt-0.5 pr-0 mr-0">
                        {item.subItems?.map(subItem => (
                          <SidebarMenuSubItem key={subItem.name}>
                            <SidebarMenuSubButton asChild className="transition-colors duration-200 text-sidebar-foreground" isActive={pathname.startsWith(subItem.href)}>
                              <Link href={subItem.href} onClick={() => setOpenMobile(false)} onMouseEnter={() => subItem.prefetchFn?.(trpc)}>
                                <span>{subItem.name}</span>
                              </Link>
                            </SidebarMenuSubButton>
                          </SidebarMenuSubItem>
                        ))}
                      </SidebarMenuSub>
                    )}
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        ))}
      </SidebarContent>
    </Sidebar>
  )
}
