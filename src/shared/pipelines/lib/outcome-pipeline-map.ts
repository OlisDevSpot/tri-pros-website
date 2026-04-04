import type { MeetingPipeline } from '@/shared/types/enums/pipelines'

export const OUTCOME_PIPELINE_MAP: Record<string, MeetingPipeline | null> = {
  not_set: null,
  proposal_created: null,
  proposal_sent: null,
  follow_up_needed: null,
  converted_to_project: null,
  not_good: 'rehash',
  pns: 'rehash',
  npns: 'rehash',
  ftd: 'rehash',
  no_show: 'rehash',
  lost_to_competitor: 'dead',
  not_interested: 'dead',
}
