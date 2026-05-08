import { headers } from 'next/headers'
import { Suspense } from 'react'

import { ScrollRootProvider } from '@/features/proposal-flow/contexts/scroll-context'
import { ProposalPageNavbar } from '@/features/proposal-flow/ui/components/navbar/navbar'
import { ProposalFlowShell } from '@/features/proposal-flow/ui/components/proposal-flow-shell'
import { ProposalFlowLoadingState } from '@/features/proposal-flow/ui/components/states/loading'
import { GlobalDialogs } from '@/shared/components/dialogs/modals/global-dialogs'
import { ProposalSplashScreen } from '@/shared/components/splash-screen/proposal-splash-screen'
import { auth } from '@/shared/domains/auth/server'

export default async function ProposalFlowLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const reqHeaders = await headers()
  const session = await auth.api.getSession({ headers: reqHeaders })
  const isAuthenticated = Boolean(session)

  return (
    <>
      <ProposalSplashScreen isAuthenticated={isAuthenticated} />
      <GlobalDialogs />
      <ProposalFlowShell>
        <ScrollRootProvider>
          <div className="pt-[env(safe-area-inset-top)]">
            <ProposalPageNavbar />
          </div>
          <div className="container grow min-h-0 py-4 lg:py-8 pb-[max(env(safe-area-inset-bottom),1rem)]">
            <div className="h-full">
              <Suspense fallback={<ProposalFlowLoadingState />}>
                {children}
              </Suspense>
            </div>
          </div>
        </ScrollRootProvider>
      </ProposalFlowShell>
    </>
  )
}
