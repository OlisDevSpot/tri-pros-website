import type { inferRouterOutputs } from '@trpc/server'

import type { StatBarItemConfig } from '@/shared/components/stat-bar/types'
import type { AppRouter } from '@/trpc/routers/app'

import { CalendarDaysIcon, CheckCircleIcon, PlayCircleIcon, SparklesIcon } from 'lucide-react'

type MeetingRow = inferRouterOutputs<AppRouter>['meetingsRouter']['getAll'][number]

export const meetingsStatConfig: StatBarItemConfig<MeetingRow>[] = [
  {
    key: 'total',
    label: 'Total Meetings',
    icon: CalendarDaysIcon,
    getValue: (data) => data.length,
  },
  {
    key: 'in_progress',
    label: 'In Progress',
    icon: PlayCircleIcon,
    color: 'text-sky-500',
    getValue: (data) => data.filter(m => m.status === 'in_progress').length,
  },
  {
    key: 'completed',
    label: 'Completed',
    icon: CheckCircleIcon,
    color: 'text-emerald-500',
    getValue: (data) => data.filter(m => m.status === 'completed').length,
  },
  {
    key: 'converted',
    label: 'Converted',
    icon: SparklesIcon,
    color: 'text-violet-500',
    getValue: (data) => data.filter(m => m.status === 'converted').length,
  },
]
