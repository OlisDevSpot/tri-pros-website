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

/** Public-facing visibility of a portfolio project (maps to projects.isPublic). */
export const projectVisibilities = ['public', 'draft'] as const
export type ProjectVisibility = (typeof projectVisibilities)[number]

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

/**
 * Coarse, user-facing status of a project — a handful of mutually-exclusive
 * buckets the dashboard and lists group by. Derived from `pipelineStage`, never
 * stored (see `PROJECT_STAGE_BUCKET`).
 */
export const projectStatusBuckets = ['active', 'completed', 'on_hold', 'cancelled'] as const
export type ProjectStatusBucket = (typeof projectStatusBuckets)[number]

/**
 * THE canonical project-status classifier: a project's coarse status is derived
 * from its `pipelineStage` through this map — do not re-encode the stage→bucket
 * relationship anywhere else. Buckets are JIT-derived on read
 * (`deriveProjectStatusBucket`); the `projects.status` column is DEPRECATED for
 * grouping (it defaults to 'active' and never advances, so it lies). Typed
 * `Record<ProjectPipelineStage, …>` so omitting a stage is a compile error.
 *
 * - active    — live work: signed through full payment, not yet closed
 * - completed — closed out (terminal, won) — also the fallback for a null/unset
 *               stage (pure-portfolio projects have no lifecycle stage; see
 *               `isPurePortfolioProject`)
 * - on_hold   — paused mid-flight
 * - cancelled — aborted (terminal, lost)
 */
export const PROJECT_STAGE_BUCKET: Record<ProjectPipelineStage, ProjectStatusBucket> = {
  signed: 'active',
  opened: 'active',
  pending_inspection: 'active',
  install_complete: 'active',
  pending_final_inspection: 'active',
  passed_final: 'active',
  got_partial_payment: 'active',
  got_full_payment: 'active',
  closed: 'completed',
  cancelled: 'cancelled',
  on_hold: 'on_hold',
}

/**
 * A project's status bucket from its `pipelineStage`. A null/unknown stage falls
 * back to 'completed': a project with no lifecycle stage is a pure-portfolio
 * showcase entry (never ran the signed→closed sequence), which reads as a
 * finished piece of work. Note pure-portfolio projects are separately excluded
 * from operational lists/analytics via `isPurePortfolioProject` (no meetings);
 * this fallback only governs how a stray null renders if one slips through.
 */
export function deriveProjectStatusBucket(stage: ProjectPipelineStage | string | null | undefined): ProjectStatusBucket {
  if (!stage) {
    return 'completed'
  }
  return PROJECT_STAGE_BUCKET[stage as ProjectPipelineStage] ?? 'completed'
}

/** Stage subsets per bucket — spread straight into `inArray(projects.pipelineStage, …)` predicates. */
export const ACTIVE_PROJECT_STAGES = projectPipelineStages.filter(s => PROJECT_STAGE_BUCKET[s] === 'active')
export const COMPLETED_PROJECT_STAGES = projectPipelineStages.filter(s => PROJECT_STAGE_BUCKET[s] === 'completed')
export const ON_HOLD_PROJECT_STAGES = projectPipelineStages.filter(s => PROJECT_STAGE_BUCKET[s] === 'on_hold')
export const CANCELLED_PROJECT_STAGES = projectPipelineStages.filter(s => PROJECT_STAGE_BUCKET[s] === 'cancelled')
