import { redirect } from 'next/navigation'

import { MeetingFlowView } from '@/features/meeting-flow/ui/views/meeting-flow'
import { ROOTS } from '@/shared/config/roots'
import { protectDashboardPage } from '@/shared/domains/permissions/lib/protect-dashboard-page'
import { MEETING_ACTIONS } from '@/shared/entities/meetings/constants/actions'

interface Props {
  params: Promise<{ meetingId: string }>
}

export default async function MeetingFlowPage({ params }: Props) {
  const { meetingId } = await params
  const authState = await protectDashboardPage()

  // This page is the presentation: it asks what Start Meeting asks, so a pasted link cannot open it either.
  if (authState.status === 'authenticated' && authState.actor.ability.cannot(...MEETING_ACTIONS.start.permission)) {
    redirect(ROOTS.dashboard.meetings.root())
  }

  return <MeetingFlowView meetingId={meetingId} />
}
