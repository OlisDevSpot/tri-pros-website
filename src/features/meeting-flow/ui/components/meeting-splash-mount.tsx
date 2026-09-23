'use client'

import { useQuery } from '@tanstack/react-query'
import { useParams, useSelectedLayoutSegments } from 'next/navigation'
import { useQueryState } from 'nuqs'
import { stepParser } from '@/features/meeting-flow/constants/query-parsers'
import { MEETING_STEPS } from '@/features/meeting-flow/constants/step-config'
import { useMeetingSplash } from '@/features/meeting-flow/hooks/use-meeting-splash'
import { MeetingSplashScreen } from '@/features/meeting-flow/ui/components/meeting-splash-screen'
import { useTRPC } from '@/trpc/helpers'

/**
 * Where the meeting splash mounts: the dashboard layout, above the dashboard template (E9). The
 * template starts every page at opacity 0 inside a transformed, overflow-hidden `main`
 * (`app/(frontend)/dashboard/template.tsx`), so nothing inside a page can be the first paint;
 * from the layout the splash is in the first HTML chunk, open on the server, and above every
 * stacking context the stage creates. It renders only on `/dashboard/meetings/[meetingId]`.
 */
export function MeetingSplashMount() {
  const segments = useSelectedLayoutSegments()
  const params = useParams<{ meetingId: string }>()
  const meetingId = segments[0] === 'meetings' && typeof params.meetingId === 'string' ? params.meetingId : null
  if (!meetingId) {
    return null
  }
  return <MeetingSplash meetingId={meetingId} />
}

function MeetingSplash({ meetingId }: { meetingId: string }) {
  const trpc = useTRPC()
  const { open, dismiss } = useMeetingSplash(meetingId)
  const [currentStep] = useQueryState('step', stepParser)
  // The same query the view runs, observed only — never fetched from here: the mount hydrates with
  // the layout, before the page's Suspense boundary, and a fetch started here would put the meeting
  // in the cache before the view hydrates, so the view's first client render would be the ready tree
  // against the server's loading tree (a hydration mismatch, measured). Readiness therefore follows
  // the view's own fetch: the cue arms once it has settled, success or error, so the agent never
  // presses into a loading tree and an error is still reachable (E10).
  const meetingQuery = useQuery({ ...trpc.meetingsRouter.reads.getByIdWithJoins.queryOptions({ id: meetingId }), enabled: false })
  const step = MEETING_STEPS[currentStep - 1] ?? MEETING_STEPS[0]
  return <MeetingSplashScreen open={open} ready={!meetingQuery.isPending} step={step} onDismiss={dismiss} />
}
