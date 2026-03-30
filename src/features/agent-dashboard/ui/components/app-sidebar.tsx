'use client'

import type { SidebarNavItem } from '@/features/agent-dashboard/lib/get-sidebar-nav'
import type { BetterAuthUser } from '@/shared/auth/server'

import Image from 'next/image'
import Link from 'next/link'
import { useMemo } from 'react'
import { useQueryState } from 'nuqs'

import { getSidebarNav } from '@/features/agent-dashboard/lib/get-sidebar-nav'
import { dashboardStepParser } from '@/features/agent-dashboard/lib/url-parsers'
import { SidebarUserButton } from '@/features/agent-dashboard/ui/components/sidebar-user-button'
import { signOut } from '@/shared/auth/client'
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
  SidebarRail,
  SidebarSeparator,
  useSidebar,
} from '@/shared/components/ui/sidebar'

interface AppSidebarProps {
  user: BetterAuthUser
}

export function AppSidebar({ user }: AppSidebarProps) {
  const [step, setStep] = useQueryState('step', dashboardStepParser)
  const { state } = useSidebar()
  const isCollapsed = state === 'collapsed'

  const navConfig = useMemo(() => getSidebarNav(user.role), [user.role])

  function handleNavClick(item: SidebarNavItem) {
    if (item.enabled) {
      setStep(item.step)
    }
  }

  return (
    <Sidebar collapsible="icon" side="left" variant="sidebar">
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton size="lg" asChild tooltip="Home">
              <Link href="/">
                {isCollapsed
                  ? (
                      <Image
                        src="/company/logo/logo-light.svg"
                        alt="Tri Pros"
                        width={24}
                        height={24}
                        className="dark:invert"
                      />
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
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
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

      <SidebarRail />
    </Sidebar>
  )
}
