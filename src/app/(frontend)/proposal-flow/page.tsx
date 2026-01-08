'use client'

import { AnimatePresence } from 'motion/react'
import { useRouter } from 'next/navigation'
import { useQueryState } from 'nuqs'
import { useEffect } from 'react'
import { myProposalsStepParser } from '@/features/proposal-flow/lib/url-parsers'
import { ProposalSidebar } from '@/features/proposal-flow/ui/components/sidebar'
import { CreateNewProposalView } from '@/features/proposal-flow/ui/views/create-new-proposal-view'
import { PastProposalsView } from '@/features/proposal-flow/ui/views/past-proposals-view'
import { useSession } from '@/shared/auth/client'
import { ErrorState } from '@/shared/components/states/error-state'
import { LoadingState } from '@/shared/components/states/loading-state'

export default function MyProposalsPage() {
  const router = useRouter()
  const session = useSession()

  const [myProposalStep] = useQueryState('step', myProposalsStepParser)

  useEffect(() => {
    if (!session.isPending && !session.data?.user) {
      router.replace('/')
    }
  }, [router, session.isPending, session.data?.user])

  if (session.isPending) {
    return (
      <div className="h-full w-full flex flex-col lg:flex-row gap-4 justify-between">
        <nav className="h-(--sidebar-height) lg:h-50 border border-primary/20 p-4 rounded-xl w-full lg:w-(--sidebar-width) shrink-0"></nav>
        <LoadingState title="Loading Session Data" description="This might take a few seconds" />
      </div>
    )
  }

  if (!session.data) {
    return <ErrorState title="Error: You are not logged in" description="Please log in to continue. Navigating away..." />
  }

  return (
    <div className="h-full w-full flex flex-col lg:flex-row gap-4 justify-between">
      <nav className="h-(--sidebar-height) lg:h-fit border border-primary/20 p-4 rounded-xl w-full lg:w-(--sidebar-width) shrink-0">
        <ProposalSidebar />
      </nav>
      <div className="relative w-full h-full overflow-hidden">
        <AnimatePresence>
          {myProposalStep === 'create-proposal' && (
            <CreateNewProposalView key="create-proposal" />
          )}
        </AnimatePresence>
        <AnimatePresence>
          {myProposalStep === 'past-proposals' && (
            <PastProposalsView key="past-proposals" />
          )}
        </AnimatePresence>
      </div>
    </div>
  )
}
