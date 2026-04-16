import type { ActivityType, MeetingOutcome } from '@/shared/constants/enums'

export const DEFAULT_HIDDEN_DAYS = [6] // Saturday

export const STATUS_BG_TINTS: Partial<Record<MeetingOutcome, string>> = {
  not_set: 'bg-zinc-500/5 border-zinc-500/20',
  converted_to_project: 'bg-emerald-500/5 border-emerald-500/20',
  proposal_sent: 'bg-lime-500/5 border-lime-500/20',
  proposal_created: 'bg-amber-500/5 border-amber-500/20',
  follow_up_needed: 'bg-purple-500/5 border-purple-500/20',
  not_good: 'bg-red-500/5 border-red-500/20',
  pns: 'bg-red-500/5 border-red-500/20',
  npns: 'bg-red-500/5 border-red-500/20',
  ftd: 'bg-red-500/5 border-red-500/20',
  no_show: 'bg-red-500/5 border-red-500/20',
  lost_to_competitor: 'bg-red-500/5 border-red-500/20',
}

export const ACTIVITY_TYPE_BG_TINTS: Record<ActivityType, string> = {
  note: 'bg-blue-500/5 border-blue-500/20',
  reminder: 'bg-amber-500/5 border-amber-500/20',
  task: 'bg-emerald-500/5 border-emerald-500/20',
  event: 'bg-purple-500/5 border-purple-500/20',
}
