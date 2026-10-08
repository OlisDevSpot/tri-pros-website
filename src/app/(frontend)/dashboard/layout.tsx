import { getSessionCookie } from 'better-auth/cookies'
import { cookies, headers } from 'next/headers'
import { Suspense } from 'react'

import { AppSidebarSkeleton } from '@/features/agent-dashboard/ui/components/app-sidebar-skeleton'
import { DashboardContentSkeleton } from '@/features/agent-dashboard/ui/components/dashboard-content-skeleton'
import { DashboardSessionContent } from '@/features/agent-dashboard/ui/components/dashboard-session-content'
import { DashboardSessionMobileNav } from '@/features/agent-dashboard/ui/components/dashboard-session-mobile-nav'
import { DashboardSessionSidebar } from '@/features/agent-dashboard/ui/components/dashboard-session-sidebar'
import { DashboardSignIn } from '@/features/agent-dashboard/ui/components/dashboard-sign-in'
import { SidebarSessionBoundary } from '@/features/agent-dashboard/ui/components/sidebar-session-boundary'
import { MeetingSplashMount } from '@/features/meeting-flow/ui/components/meeting-splash-mount'
import { readTablePreferences } from '@/shared/components/data-table/lib/read-table-preferences'
import { TablePreferencesProvider } from '@/shared/components/data-table/ui/table-preferences-provider'
import { GlobalDialogs } from '@/shared/components/dialogs/modals/global-dialogs'
import { SidebarInset, SidebarProvider } from '@/shared/components/ui/sidebar'
import { PwaInstallPrompt } from '@/shared/domains/pwa/ui/pwa-install-prompt'
import { PwaLaunchReady } from '@/shared/domains/pwa/ui/pwa-launch-ready'

// Nothing here waits on the database. Whether a session cookie is present (a
// header read) picks the sign-in screen or the signed-in shell; the session
// itself is read inside the three Suspense slots, which share one request memo.
// On a cold start the sidebar frame and skeletons stream while the database
// wakes, instead of the whole document waiting on it.
export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const [cookieStore, requestHeaders] = await Promise.all([cookies(), headers()])
  const hasSessionCookie = getSessionCookie(requestHeaders) !== null

  const sidebarCookie = cookieStore.get('sidebar_state')
  const defaultOpen = sidebarCookie ? sidebarCookie.value === 'true' : true

  return (
    <>
      {/* Above the sidebar and the template so it is the first paint of a meeting. */}
      {hasSessionCookie && <MeetingSplashMount />}
      <GlobalDialogs />
      <PwaInstallPrompt />
      <PwaLaunchReady />
      <TablePreferencesProvider initial={readTablePreferences(cookieStore.getAll())}>
        <SidebarProvider defaultOpen={defaultOpen} data-no-gutter-stable>
          {hasSessionCookie && (
            <SidebarSessionBoundary fallback={<AppSidebarSkeleton />}>
              <DashboardSessionSidebar />
            </SidebarSessionBoundary>
          )}
          <SidebarInset className="h-full min-w-0 overflow-hidden bg-background">
            <div className="flex-1 min-h-0 pt-[env(safe-area-inset-top)]">
              {hasSessionCookie
                ? (
                    <Suspense fallback={<DashboardContentSkeleton />}>
                      <DashboardSessionContent>{children}</DashboardSessionContent>
                    </Suspense>
                  )
                : <DashboardSignIn />}
            </div>
            {hasSessionCookie && (
              <Suspense>
                <DashboardSessionMobileNav />
              </Suspense>
            )}
          </SidebarInset>
        </SidebarProvider>
      </TablePreferencesProvider>
    </>
  )
}
