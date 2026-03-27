import type { inferRouterOutputs } from '@trpc/server'
import type { StatBarItemConfig } from '@/shared/components/stat-bar/types'
import type { AppRouter } from '@/trpc/routers/app'

import { CalendarDaysIcon, CheckCircleIcon, PlayCircleIcon, SparklesIcon, XCircleIcon } from 'lucide-react'

type MeetingRow = inferRouterOutputs<AppRouter>['meetingsRouter']['getAll'][number]

export const meetingsStatConfig: StatBarItemConfig<MeetingRow>[] = [
  {
    key: 'total',
    label: 'Total Meetings',
    icon: CalendarDaysIcon,
    getValue: data => data.length,
  },
  {
    key: 'not_set',
    label: 'Not Set',
    icon: PlayCircleIcon,
    color: 'text-zinc-500',
    getValue: data => data.filter(m => m.meetingOutcome === 'not_set').length,
  },
  {
    key: 'proposal_created',
    label: 'Proposal Created',
    icon: SparklesIcon,
    color: 'text-emerald-500',
    getValue: data => data.filter(m => m.meetingOutcome === 'proposal_created').length,
  },
  {
    key: 'follow_up_needed',
    label: 'Follow-up Needed',
    icon: CheckCircleIcon,
    color: 'text-amber-500',
    getValue: data => data.filter(m => m.meetingOutcome === 'follow_up_needed').length,
  },
  {
    key: 'not_interested',
    label: 'Not Interested',
    icon: XCircleIcon,
    color: 'text-red-500',
    getValue: data => data.filter(m => m.meetingOutcome === 'not_interested').length,
  },
]
