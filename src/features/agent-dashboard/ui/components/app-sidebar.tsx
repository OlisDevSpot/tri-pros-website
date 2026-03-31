'use client'

import type { SidebarNavItem } from '@/features/agent-dashboard/lib/get-sidebar-nav'
import type { BetterAuthUser } from '@/shared/auth/server'

import { ChevronLeftIcon, ChevronRightIcon, ZapIcon } from 'lucide-react'
import { motion } from 'motion/react'
import Image from 'next/image'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useMemo, useState } from 'react'

import { SIDEBAR_NAV_ACTIVE_STYLE } from '@/features/agent-dashboard/constants/sidebar-styles'
import { getSidebarNav } from '@/features/agent-dashboard/lib/get-sidebar-nav'
import { ActionCenterSheet } from '@/features/agent-dashboard/ui/components/action-center-sheet'
import { SidebarUserButton } from '@/features/agent-dashboard/ui/components/sidebar-user-button'
import { signOut } from '@/shared/auth/client'
import { ROOTS } from '@/shared/config/roots'
import { Button } from '@/shared/components/ui/button'
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarSeparator,
  useSidebar,
} from '@/shared/components/ui/sidebar'
import { useAbility } from '@/shared/permissions/hooks'

interface AppSidebarProps {
  user: BetterAuthUser
}

export function AppSidebar({ user }: AppSidebarProps) {
  const [isActionCenterOpen, setIsActionCenterOpen] = useState(false)
  const pathname = usePathname()
  const router = useRouter()
  const { state, toggleSidebar, isMobile, setOpenMobile } = useSidebar()
  const ability = useAbility()
  const isCollapsed = state === 'collapsed'

  const navConfig = useMemo(() => getSidebarNav(ability), [ability])

  function getIsActive(item: SidebarNavItem): boolean {
    if (item.href === ROOTS.dashboard.root) {
      return pathname === item.href
    }
    return pathname.startsWith(item.href)
  }

  function renderNavItem(item: SidebarNavItem) {
    const isActive = getIsActive(item)

    if (item.enabled) {
      return (
        <SidebarMenuItem key={item.href}>
          <SidebarMenuButton
            asChild
            data-nav-item
            tooltip={item.label}
            isActive={isActive}
            className="gap-4 transition-all duration-200 hover:bg-transparent data-[active=true]:bg-transparent"
            style={isActive ? SIDEBAR_NAV_ACTIVE_STYLE : undefined}
          >
            <Link
              href={item.href}
              onClick={() => {
                if (isMobile) {
                  setOpenMobile(false)
                }
              }}
            >
              <item.icon className={`size-4 shrink-0 transition-colors duration-200 ${isActive ? 'text-primary' : ''}`} />
              <span>{item.label}</span>
            </Link>
          </SidebarMenuButton>
        </SidebarMenuItem>
      )
    }

    return (
      <SidebarMenuItem key={item.href}>
        <SidebarMenuButton
          data-nav-item
          tooltip={item.label}
          isActive={isActive}
          disabled
          className="gap-4 transition-all duration-200 hover:bg-transparent data-[active=true]:bg-transparent"
          style={isActive ? SIDEBAR_NAV_ACTIVE_STYLE : undefined}
        >
          <item.icon className={`size-4 shrink-0 transition-colors duration-200 ${isActive ? 'text-primary' : ''}`} />
          <span>{item.label}</span>
        </SidebarMenuButton>
      </SidebarMenuItem>
    )
  }

  return (
    <>
      <Sidebar collapsible="icon" side="left" variant="sidebar">
        <SidebarHeader className="relative">
          <motion.div
            whileHover={{ scale: 1.03 }}
            whileTap={{ scale: 0.97 }}
            transition={{ type: 'spring', stiffness: 400, damping: 20 }}
          >
            <Link
              href="/"
              className="flex h-12 items-center rounded-md px-2 group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:px-0"
            >
              {isCollapsed
                ? (
                    <motion.div
                      whileHover={{ rotate: [0, -6, 6, -3, 0] }}
                      transition={{ duration: 0.5, ease: 'easeInOut' }}
                    >
                      <Image
                        src="/company/logo/logo-light.svg"
                        alt="Tri Pros"
                        width={24}
                        height={24}
                        className="dark:hidden"
                      />
                      <Image
                        src="/company/logo/logo-dark.svg"
                        alt="Tri Pros"
                        width={24}
                        height={24}
                        className="hidden dark:block"
                      />
                    </motion.div>
                  )
                : (
                    <>
                      <Image
                        src="/company/logo/logo-light-right.svg"
                        alt="Tri Pros Remodeling"
                        width={140}
                        height={40}
                        className="dark:hidden"
                      />
                      <Image
                        src="/company/logo/logo-dark-right.svg"
                        alt="Tri Pros Remodeling"
                        width={140}
                        height={40}
                        className="hidden dark:block"
                      />
                    </>
                  )}
            </Link>
          </motion.div>
          <Button
            variant="outline"
            className="absolute -bottom-2.5 -right-2.5 z-20 hidden size-5 rounded-full border bg-background p-0 shadow-sm md:flex items-center justify-center"
            onClick={toggleSidebar}
          >
            {isCollapsed
              ? <ChevronRightIcon className="size-3" />
              : <ChevronLeftIcon className="size-3" />}
          </Button>
        </SidebarHeader>

        <SidebarSeparator className="mx-0" />

        <SidebarContent>
          <SidebarGroup>
            <SidebarGroupLabel>Main</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {navConfig.baseItems.map(renderNavItem)}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>

          {navConfig.adminItems.length > 0 && (
            <SidebarGroup>
              <SidebarGroupLabel>Admin</SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu>
                  {navConfig.adminItems.map(renderNavItem)}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          )}
        </SidebarContent>

        <SidebarFooter>
          <SidebarSeparator className="mx-0" />
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton
                data-nav-item
                tooltip="Action Center"
                onClick={() => setIsActionCenterOpen(true)}
                className="gap-4 transition-all duration-200 hover:bg-transparent"
              >
                <ZapIcon className="size-4 shrink-0" />
                <span>Action Center</span>
              </SidebarMenuButton>
            </SidebarMenuItem>
            {navConfig.footerItems.map(renderNavItem)}
          </SidebarMenu>

          <SidebarUserButton
            user={{
              name: user.name,
              email: user.email,
              image: user.image,
            }}
            onSettingsClick={() => router.push(ROOTS.dashboard.settings())}
            onLogoutClick={() => signOut()}
          />
        </SidebarFooter>
      </Sidebar>
      <ActionCenterSheet isOpen={isActionCenterOpen} onClose={() => setIsActionCenterOpen(false)} />
    </>
  )
}
