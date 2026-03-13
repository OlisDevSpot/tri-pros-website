import type { Meeting } from '@/shared/db/schema'

export const MEETING_STATUS_COLORS: Record<Meeting['status'], string> = {
  completed: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400',
  converted: 'bg-violet-500/15 text-violet-700 dark:text-violet-400',
  in_progress: 'bg-sky-500/15 text-sky-700 dark:text-sky-400',
}
