'use client'

import type { SidebarNavItem } from '@/features/agent-dashboard/lib/get-sidebar-nav'
import type { Pipeline } from '@/shared/constants/enums/pipelines'
import type { BetterAuthUser } from '@/shared/domains/auth/server'

import { ChevronLeftIcon, ChevronRightIcon, ZapIcon } from 'lucide-react'
import { motion } from 'motion/react'
import Image from 'next/image'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useEffect, useMemo, useState } from 'react'

import { SIDEBAR_LABEL_ANIMATE, SIDEBAR_TRANSITION } from '@/features/agent-dashboard/constants/sidebar-motion'
import { SIDEBAR_NAV_ACTIVE_STYLE } from '@/features/agent-dashboard/constants/sidebar-styles'
import { getSidebarNav } from '@/features/agent-dashboard/lib/get-sidebar-nav'
import { ActionCenterSheet } from '@/features/agent-dashboard/ui/components/action-center-sheet'
import { SidebarPipelineItem } from '@/features/agent-dashboard/ui/components/sidebar-pipeline-item'
import { SidebarRecordsGroup } from '@/features/agent-dashboard/ui/components/sidebar-records-group'
import { SidebarSearchBar } from '@/features/agent-dashboard/ui/components/sidebar-search-bar'
import { SidebarUserButton } from '@/features/agent-dashboard/ui/components/sidebar-user-button'
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
import { ROOTS } from '@/shared/config/roots'
import { pipelines as pipelineValues } from '@/shared/constants/enums/pipelines'
import { signOut } from '@/shared/domains/auth/client'
import { defineAbilitiesFor } from '@/shared/domains/permissions/abilities'
import { getStoredPipeline } from '@/shared/domains/pipelines/hooks/pipeline-context'
import { usePipelineChange } from '@/shared/domains/pipelines/hooks/use-pipeline-change'

interface AppSidebarProps {
  user: BetterAuthUser
}

export function AppSidebar({ user }: AppSidebarProps) {
  const [isActionCenterOpen, setIsActionCenterOpen] = useState(false)
  const pathname = usePathname()
  const router = useRouter()
  const { state, toggleSidebar, isMobile, setOpenMobile } = useSidebar()
  const isCollapsed = state === 'collapsed'

  const [activePipeline, setActivePipeline] = useState<Pipeline>('fresh')
  const [hydrated, setHydrated] = useState(false)
  const changePipeline = usePipelineChange()

  // Hydrate once on mount from localStorage
  useEffect(() => {
    setActivePipeline(getStoredPipeline())
    setHydrated(true)
  }, [])

  // Sync from URL when pathname changes to a pipeline route
  useEffect(() => {
    const match = pathname.match(/^\/dashboard\/pipeline\/(\w+)/)
    if (match && (pipelineValues as readonly string[]).includes(match[1])) {
      setActivePipeline(match[1] as Pipeline)
    }
  }, [pathname])

  const navConfig = useMemo(
    () => getSidebarNav(defineAbilitiesFor({ id: user.id, role: user.role })),
    [user.id, user.role],
  )

  function getIsActive(item: SidebarNavItem): boolean {
    if (item.href === ROOTS.dashboard.root) {
      return pathname === item.href
    }
    // Pipeline item: match any /dashboard/pipeline/* route
    if (item.children) {
      return pathname.startsWith('/dashboard/pipeline')
    }
    return pathname.startsWith(item.href)
  }

  function renderNavItem(item: SidebarNavItem) {
    const isActive = getIsActive(item)

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
            aria-disabled={!item.enabled}
            tabIndex={item.enabled ? undefined : -1}
            onClick={(e) => {
              if (!item.enabled) {
                e.preventDefault()
                return
              }
              if (isMobile) {
                setOpenMobile(false)
              }
            }}
            className={item.enabled ? '' : 'pointer-events-none opacity-50'}
          >
            <item.icon className={`size-4 shrink-0 transition-colors duration-200 ${isActive ? 'text-primary' : ''}`} />
            <motion.span
              initial={false}
              animate={isCollapsed && !isMobile ? SIDEBAR_LABEL_ANIMATE.collapsed : SIDEBAR_LABEL_ANIMATE.expanded}
              transition={SIDEBAR_TRANSITION}
              className="overflow-hidden whitespace-nowrap"
            >
              {item.label}
            </motion.span>
          </Link>
        </SidebarMenuButton>
      </SidebarMenuItem>
    )
  }

  function renderPipelineNavItem(item: SidebarNavItem) {
    return (
      <SidebarPipelineItem
        key={item.href}
        item={item}
        isActive={getIsActive(item)}
        activePipeline={activePipeline}
        hydrated={hydrated}
        onPipelineChange={(p: Pipeline) => {
          setActivePipeline(p)
          changePipeline(p)
          if (isMobile) {
            setOpenMobile(false)
          }
        }}
        onNavigate={() => {
          if (isMobile) {
            setOpenMobile(false)
          }
        }}
      />
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
            className="absolute -bottom-2.5 -right-2.5 z-20 hidden size-5 rounded-full border bg-background p-0 shadow-sm md:flex items-center justify-center group-data-[collapsible=icon]:-right-3.5"
            onClick={toggleSidebar}
          >
            {isCollapsed
              ? <ChevronRightIcon className="size-3" />
              : <ChevronLeftIcon className="size-3" />}
          </Button>
        </SidebarHeader>

        <SidebarSeparator className="mx-0" />

        <SidebarContent className="gap-0">
          <SidebarSearchBar />

          <SidebarGroup>
            <div
              className="
                rounded-xl p-1
                bg-linear-to-b from-primary/5 to-primary/12
                ring-1 ring-inset ring-black/5
                shadow-[0_1px_3px_rgb(0_0_0/0.04),inset_0_1px_0_rgb(255_255_255/0.9),inset_0_2px_5px_rgb(0_0_0/0.08),inset_0_-1px_2px_rgb(0_0_0/0.03),inset_0_-1px_0_rgb(255_255_255/0.5)]
                dark:from-black/30 dark:to-black/55
                dark:ring-white/5
                dark:shadow-[0_1px_3px_rgb(0_0_0/0.35),inset_0_1px_0_rgb(255_255_255/0.06),inset_0_2px_8px_rgb(0_0_0/0.55),inset_0_-1px_3px_rgb(0_0_0/0.25),inset_0_-1px_0_rgb(255_255_255/0.03)]
                transition-[padding,border-radius] duration-200 ease-linear
                group-data-[collapsible=icon]:p-0
                group-data-[collapsible=icon]:rounded-md
              "
            >
              <SidebarMenu>
                {renderNavItem(navConfig.dashboardItem)}
                {navConfig.mainItems.map(item =>
                  item.children ? renderPipelineNavItem(item) : renderNavItem(item),
                )}
              </SidebarMenu>
            </div>
          </SidebarGroup>

          <SidebarRecordsGroup
            items={navConfig.recordsItems}
            renderItem={renderNavItem}
          />

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
            onLogoutClick={() => signOut({
              fetchOptions: {
                onSuccess: () => router.refresh(),
              },
            })}
          />
        </SidebarFooter>
      </Sidebar>
      <ActionCenterSheet isOpen={isActionCenterOpen} onClose={() => setIsActionCenterOpen(false)} />
    </>
  )
}
