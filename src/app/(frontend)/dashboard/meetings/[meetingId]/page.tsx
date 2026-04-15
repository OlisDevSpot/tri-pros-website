import { MeetingFlowView } from '@/features/meeting-flow/ui/views/meeting-flow'

interface Props {
  params: Promise<{ meetingId: string }>
}

export default async function MeetingFlowPage({ params }: Props) {
  const { meetingId } = await params

  return <MeetingFlowView meetingId={meetingId} />
}
