import type { MeetingOutcome, MeetingOutcomeClass, MeetingPipeline } from '@/shared/constants/enums'

import { MEETING_OUTCOME_CLASS, meetingOutcomes } from '@/shared/constants/enums/meetings'

/** The meeting-grain pipeline bucket a given outcome class forces, or null. */
function classToPipeline(c: MeetingOutcomeClass): MeetingPipeline | null {
  if (c === 'negative-recallable') {
    return 'rehash'
  }
  if (c === 'negative-terminal') {
    return 'dead'
  }
  return null // unset / neutral / positive don't force a rehash|dead bucket
}

/**
 * Outcome → the meeting-grain pipeline bucket it forces (`rehash`/`dead`), or
 * `null` for outcomes that don't move the bucket. DERIVED from the single
 * outcome source of truth (`MEETING_OUTCOME_CLASS`), so it can never drift:
 * recallable ⇒ rehash, terminal ⇒ dead, else null.
 */
export const OUTCOME_PIPELINE_MAP: Record<string, MeetingPipeline | null> = Object.fromEntries(
  meetingOutcomes.map((o: MeetingOutcome) => [o, classToPipeline(MEETING_OUTCOME_CLASS[o])]),
)
