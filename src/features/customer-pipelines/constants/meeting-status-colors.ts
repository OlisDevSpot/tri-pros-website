// Profile modal badge colors (used with Badge variant="outline")
// Scale: green (won) → amber (proposal out) → purple (follow-up) → red (lost) → grey (unset)
export const MEETING_LIST_STATUS_COLORS: Record<string, string> = {
  not_set: 'bg-zinc-500/10 text-zinc-600',
  converted_to_project: 'bg-green-500/10 text-green-600',
  proposal_sent: 'bg-lime-500/10 text-lime-600',
  proposal_created: 'bg-amber-500/10 text-amber-600',
  follow_up_needed: 'bg-purple-500/10 text-purple-600',
  not_good: 'bg-red-500/10 text-red-600',
  pns: 'bg-red-500/10 text-red-600',
  npns: 'bg-red-500/10 text-red-600',
  ftd: 'bg-red-500/10 text-red-600',
  no_show: 'bg-red-500/10 text-red-600',
  lost_to_competitor: 'bg-red-500/10 text-red-600',
  not_interested: 'bg-red-500/10 text-red-600', // deprecated
}
