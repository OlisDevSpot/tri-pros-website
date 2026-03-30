'use client'

import type { SidebarNavItem } from '@/features/agent-dashboard/lib/get-sidebar-nav'
import type { BetterAuthUser } from '@/shared/auth/server'

import { ChevronLeftIcon, ChevronRightIcon } from 'lucide-react'
import { motion } from 'motion/react'
import Image from 'next/image'
import Link from 'next/link'
import { useQueryState } from 'nuqs'
import { useMemo } from 'react'

import { getSidebarNav } from '@/features/agent-dashboard/lib/get-sidebar-nav'
import { dashboardStepParser } from '@/features/agent-dashboard/lib/url-parsers'
import { SidebarUserButton } from '@/features/agent-dashboard/ui/components/sidebar-user-button'
import { signOut } from '@/shared/auth/client'
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

interface AppSidebarProps {
  user: BetterAuthUser
}

export function AppSidebar({ user }: AppSidebarProps) {
  const [step, setStep] = useQueryState('step', dashboardStepParser)
  const { state, toggleSidebar, isMobile, setOpenMobile } = useSidebar()
  const isCollapsed = state === 'collapsed'

  const navConfig = useMemo(() => getSidebarNav(user.role), [user.role])

  function handleNavClick(item: SidebarNavItem) {
    if (!item.enabled) {
      return
    }
    setStep(item.step)
    if (isMobile) {
      setOpenMobile(false)
    }
  }

  return (
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
                      className="dark:invert"
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
          className="absolute -right-2.5 top-1/2 -translate-y-1/2 z-20 hidden size-5 rounded-full border bg-background p-0 shadow-sm md:flex items-center justify-center"
          onClick={toggleSidebar}
        >
          {isCollapsed
            ? <ChevronRightIcon className="size-3" />
            : <ChevronLeftIcon className="size-3" />}
        </Button>
      </SidebarHeader>

      <SidebarSeparator />

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Main</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {navConfig.baseItems.map(item => (
                <SidebarMenuItem key={item.step}>
                  <SidebarMenuButton
                    tooltip={item.label}
                    isActive={step === item.step}
                    disabled={!item.enabled}
                    onClick={() => handleNavClick(item)}
                    className="gap-4"
                  >
                    <item.icon className="size-4 shrink-0" />
                    <span>{item.label}</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {navConfig.adminItems.length > 0 && (
          <SidebarGroup>
            <SidebarGroupLabel>Admin</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {navConfig.adminItems.map(item => (
                  <SidebarMenuItem key={item.step}>
                    <SidebarMenuButton
                      tooltip={item.label}
                      isActive={step === item.step}
                      disabled={!item.enabled}
                      onClick={() => handleNavClick(item)}
                      className="gap-4"
                    >
                      <item.icon className="size-4 shrink-0" />
                      <span>{item.label}</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}
      </SidebarContent>

      <SidebarFooter>
        <SidebarMenu>
          {navConfig.footerItems.map(item => (
            <SidebarMenuItem key={item.step}>
              <SidebarMenuButton
                tooltip={item.label}
                isActive={step === item.step}
                disabled={!item.enabled}
                onClick={() => handleNavClick(item)}
                className="gap-4"
              >
                <item.icon className="size-4 shrink-0" />
                <span>{item.label}</span>
              </SidebarMenuButton>
            </SidebarMenuItem>
          ))}
        </SidebarMenu>

        <SidebarUserButton
          user={{
            name: user.name,
            email: user.email,
            image: user.image,
          }}
          onSettingsClick={() => setStep('settings')}
          onLogoutClick={() => signOut()}
        />
      </SidebarFooter>

    </Sidebar>
  )
}
