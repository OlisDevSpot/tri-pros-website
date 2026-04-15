import { cookies, headers } from 'next/headers'
import { Suspense } from 'react'

import { AppSidebar } from '@/features/agent-dashboard/ui/components/app-sidebar'
import { DashboardMobileNav } from '@/features/agent-dashboard/ui/components/dashboard-mobile-nav'
import { DashboardSignIn } from '@/features/agent-dashboard/ui/components/dashboard-sign-in'
import { GlobalDialogs } from '@/shared/components/dialogs/modals/global-dialogs'
import { PwaInstallPrompt } from '@/shared/components/pwa-install-prompt'
import { SidebarInset, SidebarProvider } from '@/shared/components/ui/sidebar'
import { auth } from '@/shared/domains/auth/server'

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const [reqHeaders, cookieStore] = await Promise.all([headers(), cookies()])
  const session = await auth.api.getSession({ headers: reqHeaders })

  const sidebarCookie = cookieStore.get('sidebar_state')
  const defaultOpen = sidebarCookie ? sidebarCookie.value === 'true' : true

  return (
    <>
      <GlobalDialogs />
      <PwaInstallPrompt />
      <SidebarProvider defaultOpen={defaultOpen} data-no-gutter-stable>
        {session && <AppSidebar user={session.user} />}
        <SidebarInset
          className="h-full min-w-0 overflow-hidden"
          style={{
            background: `radial-gradient(ellipse 80% 50% at 50% 0%, color-mix(in oklch, var(--primary) 35%, transparent), var(--background) 70%), var(--background)`,
          }}
        >
          <div className="flex-1 min-h-0 pt-[env(safe-area-inset-top)]">
            <Suspense>
              {session ? children : <DashboardSignIn />}
            </Suspense>
          </div>
          {session && <DashboardMobileNav />}
        </SidebarInset>
      </SidebarProvider>
    </>
  )
}
