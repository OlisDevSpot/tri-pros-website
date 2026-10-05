import { headers } from 'next/headers'
import { Suspense } from 'react'

import { ScrollRootProvider } from '@/features/proposal-flow/contexts/scroll-context'
import { ProposalPageNavbar } from '@/features/proposal-flow/ui/components/navbar/navbar'
import { ProposalFlowShell } from '@/features/proposal-flow/ui/components/proposal-flow-shell'
import { ProposalSplashScreen } from '@/features/proposal-flow/ui/components/proposal-splash-screen'
import { ProposalFlowLoadingState } from '@/features/proposal-flow/ui/components/states/loading'
import { GlobalDialogs } from '@/shared/components/dialogs/modals/global-dialogs'
import { ServerAbilityProvider } from '@/shared/components/providers/server-ability-provider'
import { auth } from '@/shared/domains/auth/server'

export default async function ProposalFlowLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const reqHeaders = await headers()
  const session = await auth.api.getSession({ headers: reqHeaders })
  const isAuthenticated = Boolean(session)

  // The agent/homeowner view is gated on the ability; seeding it from this session puts the
  // agent's view in the first paint instead of swapping it in after the browser's session fetch.
  const abilityUser = session ? { id: session.user.id, role: session.user.role } : null

  return (
    <ServerAbilityProvider user={abilityUser}>
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
    </ServerAbilityProvider>
  )
}
