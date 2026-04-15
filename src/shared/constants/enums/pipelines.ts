/** All business-wide pipelines (display + routing) */
export const pipelines = ['projects', 'fresh', 'leads', 'rehash', 'dead'] as const

/** Leads pipeline stages (customers with no meetings yet) */
export const leadsPipelineStages = [
  'new',
  'contacted',
  'qualified',
  'meeting_scheduled',
] as const

/** Pipelines storable on the meetings.pipeline column (projects is derived from projectId) */
export const meetingPipelines = ['fresh', 'rehash', 'dead'] as const

/** Fresh pipeline — meeting phase stages */
export const freshMeetingStages = [
  'needs_confirmation',
  'meeting_scheduled',
  'meeting_in_progress',
  'meeting_completed',
  'follow_up_scheduled',
] as const

/** Fresh pipeline — proposal phase stages */
export const freshProposalStages = [
  'proposal_sent',
  'contract_sent',
  'approved',
  'declined',
] as const

/** Project lifecycle statuses */
export const projectStatuses = ['active', 'completed', 'on_hold'] as const

/** Project management pipeline stages */
export const projectPipelineStages = [
  'signed',
  'opened',
  'pending_inspection',
  'install_complete',
  'pending_final_inspection',
  'passed_final',
  'got_partial_payment',
  'got_full_payment',
  'closed',
  'cancelled',
  'on_hold',
] as const
