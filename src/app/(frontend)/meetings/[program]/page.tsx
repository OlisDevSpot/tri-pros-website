import { notFound } from 'next/navigation'
import { getProgramById, MEETING_PROGRAMS } from '@/features/meetings/constants/programs'
import { MeetingProgramView } from '@/features/meetings/ui/views/meeting-program'

interface Props {
  params: Promise<{ program: string }>
}

export function generateStaticParams() {
  return MEETING_PROGRAMS.map(p => ({ program: p.id }))
}

export default async function MeetingProgramPage({ params }: Props) {
  const { program: programId } = await params
  const program = getProgramById(programId)

  if (!program) {
    notFound()
  }

  return <MeetingProgramView programId={programId} />
}
