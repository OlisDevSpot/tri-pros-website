'use client'

import { AnimatePresence } from 'motion/react'
import { useRouter } from 'next/navigation'
import { useQueryState } from 'nuqs'
import { useEffect } from 'react'
import { editMeetingIdParser, meetingsDashboardStepParser } from '@/features/meetings/lib/url-parsers'
import { MeetingsSidebar } from '@/features/meetings/ui/components/meetings-sidebar'
import { EditMeetingSetupView } from '@/features/meetings/ui/views/edit-meeting-setup-view'
import { PastMeetingsView } from '@/features/meetings/ui/views/past-meetings-view'
import { useSession } from '@/shared/auth/client'
import { ErrorState } from '@/shared/components/states/error-state'
import { LoadingState } from '@/shared/components/states/loading-state'

export function MeetingsDashboard() {
  const router = useRouter()
  const session = useSession()
  const [step] = useQueryState('step', meetingsDashboardStepParser)
  const [editMeetingId] = useQueryState('editMeetingId', editMeetingIdParser)

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
        <AnimatePresence>
          {step === 'edit-meeting' && editMeetingId && (
            <EditMeetingSetupView key={`edit-meeting-${editMeetingId}`} meetingId={editMeetingId} />
          )}
        </AnimatePresence>
      </div>
    </div>
  )
}
