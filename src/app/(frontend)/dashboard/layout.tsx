import { Suspense } from 'react'

import { GlobalDialogs } from '@/shared/components/dialogs/modals/global-dialogs'
import { PwaInstallPrompt } from '@/shared/components/pwa-install-prompt'
import { SidebarInset, SidebarProvider } from '@/shared/components/ui/sidebar'

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <GlobalDialogs />
      <PwaInstallPrompt />
      <SidebarProvider defaultOpen>
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
