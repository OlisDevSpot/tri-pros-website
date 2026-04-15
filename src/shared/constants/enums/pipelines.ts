/** All business-wide pipelines (display + routing) */
export const pipelines = ['projects', 'fresh', 'leads', 'rehash', 'dead'] as const
export type Pipeline = (typeof pipelines)[number]

/** Leads pipeline stages (customers with no meetings yet) */
export const leadsPipelineStages = [
  'new',
  'contacted',
  'qualified',
  'meeting_scheduled',
] as const
export type LeadsPipelineStage = (typeof leadsPipelineStages)[number]

/** Pipelines storable on the meetings.pipeline column (projects is derived from projectId) */
export const meetingPipelines = ['fresh', 'rehash', 'dead'] as const
export type MeetingPipeline = (typeof meetingPipelines)[number]

/** Fresh pipeline — meeting phase stages */
export const freshMeetingStages = [
  'needs_confirmation',
  'meeting_scheduled',
  'meeting_in_progress',
  'meeting_completed',
  'follow_up_scheduled',
] as const
export type FreshMeetingStage = (typeof freshMeetingStages)[number]

/** Fresh pipeline — proposal phase stages */
export const freshProposalStages = [
  'proposal_sent',
  'contract_sent',
  'approved',
  'declined',
] as const
export type FreshProposalStage = (typeof freshProposalStages)[number]

/** Project lifecycle statuses */
export const projectStatuses = ['active', 'completed', 'on_hold'] as const
export type ProjectStatus = (typeof projectStatuses)[number]

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
export type ProjectPipelineStage = (typeof projectPipelineStages)[number]
