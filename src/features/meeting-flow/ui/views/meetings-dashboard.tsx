'use client'

import { AnimatePresence } from 'motion/react'
import { useRouter } from 'next/navigation'
import { useQueryState } from 'nuqs'
import { useEffect } from 'react'
import { meetingsDashboardStepParser } from '@/features/meeting-flow/lib/url-parsers'
import { MeetingsSidebar } from '@/features/meeting-flow/ui/components/meetings-sidebar'
import { PastMeetingsView } from '@/features/meeting-flow/ui/views/past-meetings-view'
import { ErrorState } from '@/shared/components/states/error-state'
import { LoadingState } from '@/shared/components/states/loading-state'
import { useSession } from '@/shared/domains/auth/client'

export function MeetingsDashboard() {
  const router = useRouter()
  const session = useSession()
  const [step] = useQueryState('step', meetingsDashboardStepParser)

  useEffect(() => {
    if (!session.isPending && !session.data?.user) {
      router.replace('/')
    }
  }, [router, session.isPending, session.data?.user])

  if (session.isPending) {
    return (
      <div className="h-full w-full flex flex-col lg:flex-row gap-4 justify-between py-4 lg:py-8">
        <nav className="h-(--sidebar-height) lg:h-50 border border-primary/20 p-4 rounded-xl w-full lg:w-(--sidebar-width) shrink-0" />
        <LoadingState title="Loading Session Data" description="This might take a few seconds" />
      </div>
    )
  }

  if (!session.data) {
    return (
      <ErrorState
        title="Error: You are not logged in"
        description="Please log in to continue. Navigating away..."
      />
    )
  }

  return (
    <div className="h-full w-full flex flex-col lg:flex-row gap-4 justify-between py-4 lg:py-8">
      <nav className="h-(--sidebar-height) lg:h-fit border border-primary/20 p-4 rounded-xl w-full lg:w-(--sidebar-width) shrink-0">
        <MeetingsSidebar />
      </nav>
      <div className="relative w-full h-full overflow-hidden min-h-0">
        <AnimatePresence>
          {step === 'past-meetings' && (
            <PastMeetingsView key="past-meetings" />
          )}
        </AnimatePresence>
      </div>
    </div>
  )
}
