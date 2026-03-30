import { headers } from 'next/headers'
import { Suspense } from 'react'

import { AppSidebar } from '@/features/agent-dashboard/ui/components/app-sidebar'
import { auth } from '@/shared/auth/server'
import { GlobalDialogs } from '@/shared/components/dialogs/modals/global-dialogs'
import { PwaInstallPrompt } from '@/shared/components/pwa-install-prompt'
import { SidebarInset, SidebarProvider } from '@/shared/components/ui/sidebar'

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const reqHeaders = await headers()
  const session = await auth.api.getSession({ headers: reqHeaders })

  return (
    <>
      <GlobalDialogs />
      <PwaInstallPrompt />
      <SidebarProvider defaultOpen>
        {session && <AppSidebar user={session.user} />}
        <SidebarInset
          className="min-h-dvh"
          style={{
            background: `radial-gradient(ellipse 80% 50% at 50% 0%, color-mix(in oklch, var(--primary) 35%, transparent), var(--background) 70%), var(--background)`,
          }}
        >
          <Suspense>
            {children}
          </Suspense>
        </SidebarInset>
      </SidebarProvider>
    </>
  )
}
