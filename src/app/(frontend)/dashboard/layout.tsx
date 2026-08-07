import { cookies } from 'next/headers'
import { Suspense } from 'react'

import { AppSidebar } from '@/features/agent-dashboard/ui/components/app-sidebar'
import { DashboardMobileNav } from '@/features/agent-dashboard/ui/components/dashboard-mobile-nav'
import { DashboardSignIn } from '@/features/agent-dashboard/ui/components/dashboard-sign-in'
import { GlobalDialogs } from '@/shared/components/dialogs/modals/global-dialogs'
import { PushSubscriptionBanner } from '@/shared/components/push-subscription-banner'
import { PwaInstallPrompt } from '@/shared/components/pwa-install-prompt'
import { SidebarInset, SidebarProvider } from '@/shared/components/ui/sidebar'
import { getCachedSession } from '@/shared/domains/auth/lib/get-cached-session'

// Colocate the dashboard's server render with the Neon DB (aws-us-west-2).
// Vercel's default region is iad1 (us-east-1); every session/query round-trip
// would otherwise cross the country. pdx1 = Vercel's us-west-2 (Oregon).
export const preferredRegion = 'pdx1'

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const [session, cookieStore] = await Promise.all([getCachedSession(), cookies()])

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
            {session && <PushSubscriptionBanner />}
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
