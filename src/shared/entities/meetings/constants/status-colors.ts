// Profile modal badge colors (used with Badge variant="outline")
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
}

// Table badge colors (used with StatusDropdownCell default Badge)
export const MEETING_OUTCOME_COLORS: Record<string, string> = {
  not_set: 'border-zinc-500/30 bg-zinc-500/10 text-zinc-400',
  converted_to_project: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-400',
  proposal_sent: 'border-lime-500/30 bg-lime-500/10 text-lime-400',
  proposal_created: 'border-amber-500/30 bg-amber-500/10 text-amber-400',
  follow_up_needed: 'border-purple-500/30 bg-purple-500/10 text-purple-400',
  not_good: 'border-red-500/30 bg-red-500/10 text-red-400',
  pns: 'border-red-500/30 bg-red-500/10 text-red-400',
  npns: 'border-red-500/30 bg-red-500/10 text-red-400',
  ftd: 'border-red-500/30 bg-red-500/10 text-red-400',
  no_show: 'border-red-500/30 bg-red-500/10 text-red-400',
  lost_to_competitor: 'border-red-500/30 bg-red-500/10 text-red-400',
}

// Human-readable labels for display
export const MEETING_OUTCOME_LABELS: Record<string, string> = {
  not_set: 'Not Set',
  converted_to_project: 'Converted to Project',
  proposal_sent: 'Proposal Sent',
  proposal_created: 'Proposal Created',
  follow_up_needed: 'Follow-up Needed',
  not_good: 'Not Good',
  pns: 'PNS',
  npns: 'NPNS',
  ftd: 'FTD',
  no_show: 'No Show',
  lost_to_competitor: 'Lost to Contractor',
}

// Dot colors for status indicators and sub-menu option indicators
export const MEETING_OUTCOME_DOT_COLORS: Record<string, string> = {
  not_set: 'bg-zinc-500',
  converted_to_project: 'bg-emerald-500',
  proposal_sent: 'bg-lime-500',
  proposal_created: 'bg-amber-500',
  follow_up_needed: 'bg-purple-500',
  not_good: 'bg-red-500',
  pns: 'bg-red-500',
  npns: 'bg-red-500',
  ftd: 'bg-red-500',
  no_show: 'bg-red-500',
  lost_to_competitor: 'bg-red-500',
}
