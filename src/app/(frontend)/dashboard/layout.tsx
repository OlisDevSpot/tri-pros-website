import { Suspense } from 'react'
import { GlobalDialogs } from '@/shared/components/dialogs/modals/global-dialogs'
import { PwaInstallPrompt } from '@/shared/components/pwa-install-prompt'

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <GlobalDialogs />
      <PwaInstallPrompt />
      <div
        className="h-dvh flex flex-col"
        data-no-gutter-stable
        style={{
          '--sidebar-width': '148px',
          '--sidebar-height': '68px',
          'background': `radial-gradient(150% 150% at 50% 0%, var(--background), var(--background), color-mix(in oklab, var(--primary) 60%, transparent))`,
        } as React.CSSProperties}
      >
        <div className="container grow min-h-0">
          <div className="h-full">
            <Suspense>
              {children}
            </Suspense>
          </div>
        </div>
      </div>
    </>
  )
}
