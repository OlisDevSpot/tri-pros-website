import { packRules } from '@casl/ability/extra'
import { Suspense } from 'react'

import { ScrollRootProvider } from '@/features/proposal-flow/contexts/scroll-context'
import { ProposalFlowShell } from '@/features/proposal-flow/ui/components/proposal-flow-shell'
import { ProposalSplashScreen } from '@/features/proposal-flow/ui/components/proposal-splash-screen'
import { ProposalFlowLoadingState } from '@/features/proposal-flow/ui/components/states/loading'
import { GlobalDialogs } from '@/shared/components/dialogs/modals/global-dialogs'
import { AbilityProvider } from '@/shared/domains/permissions/client'
import { getRequestActor } from '@/shared/domains/permissions/server/get-request-actor'

export default async function ProposalFlowLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const { session, actor } = await getRequestActor()
  const isAuthenticated = Boolean(session)

  // The agent/homeowner view is gated on the ability; fed from this session, the agent's view is in the first paint.
  return (
    <AbilityProvider
      user={session ? { id: session.user.id, role: session.user.role } : null}
      rules={packRules(actor.ability.rules)}
    >
      <ProposalSplashScreen isAuthenticated={isAuthenticated} />
      <GlobalDialogs />
      <ProposalFlowShell>
        <ScrollRootProvider>
          <div className="flex min-h-0 grow flex-col pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)]">
            <Suspense fallback={<ProposalFlowLoadingState />}>
              {children}
            </Suspense>
          </div>
        </ScrollRootProvider>
      </ProposalFlowShell>
    </AbilityProvider>
  )
}
