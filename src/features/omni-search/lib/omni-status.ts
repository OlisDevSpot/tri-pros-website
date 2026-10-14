import type { OmniData, OmniQueryState, OmniStatus, OmniView } from '@/features/omni-search/types'

import { OMNI_COPY } from '@/features/omni-search/constants/copy'
import { countPhrase } from '@/features/omni-search/lib/count-phrase'
import { groupRecordsByCustomer } from '@/features/omni-search/lib/group-records-by-customer'
import { listRecordsByKind } from '@/features/omni-search/lib/list-records-by-kind'

// The records the view actually shows, so the footer never counts a row the agent can't see.
function shownRecords(data: OmniData, view: OmniView): { meetings: number, proposals: number, projects: number } {
  if (view === 'pick') {
    return { meetings: 0, proposals: 0, projects: 0 }
  }
  if (view === 'list') {
    const lists = listRecordsByKind(data)
    return { meetings: lists.meetings.length, proposals: lists.proposals.length, projects: lists.projects.length }
  }
  const records = groupRecordsByCustomer(data).stacks.flatMap(stack => stack.records)
  return {
    meetings: records.filter(record => record.kind === 'meeting').length,
    proposals: records.filter(record => record.kind === 'proposal').length,
    projects: records.filter(record => record.kind === 'project').length,
  }
}

export function omniStatus({ term, data, busy, failed }: Pick<OmniQueryState, 'term' | 'data' | 'busy' | 'failed'>, view: OmniView): OmniStatus {
  if (!term) {
    return { kind: 'idle', text: view === 'pick' ? OMNI_COPY.status.pickIdle : OMNI_COPY.status.idle }
  }
  // A retry after an error is in flight: say so rather than repeat the error.
  if (busy) {
    return { kind: 'busy', text: OMNI_COPY.status.busy(term) }
  }
  if (failed) {
    return { kind: 'error', text: OMNI_COPY.status.error }
  }
  if (!data) {
    return { kind: 'idle', text: OMNI_COPY.status.idle }
  }
  // Records only ever hang under a matched customer, so no customers means nothing matched.
  if (data.customers.length === 0) {
    return { kind: 'none', text: OMNI_COPY.noMatch.title(term) }
  }
  const shown = shownRecords(data, view)
  const parts = [
    countPhrase(data.customers.length, OMNI_COPY.nouns.customer),
    shown.meetings > 0 && countPhrase(shown.meetings, OMNI_COPY.nouns.meeting),
    shown.proposals > 0 && countPhrase(shown.proposals, OMNI_COPY.nouns.proposal),
    shown.projects > 0 && countPhrase(shown.projects, OMNI_COPY.nouns.project),
  ]
  return { kind: 'done', text: parts.filter(Boolean).join(' · ') }
}
