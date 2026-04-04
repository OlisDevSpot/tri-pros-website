/** All business-wide pipelines (display + routing) */
export const pipelines = ['fresh', 'projects', 'rehash', 'dead'] as const

/** Pipelines storable on the meetings.pipeline column (projects is derived from projectId) */
export const meetingPipelines = ['fresh', 'rehash', 'dead'] as const

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
