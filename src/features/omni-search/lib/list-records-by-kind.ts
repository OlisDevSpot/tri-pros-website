import type { OmniData, OmniRecordLists } from '@/features/omni-search/types'

import { OMNI_LIST_KIND_CAP } from '@/features/omni-search/constants/omni-search'

/** The phone list's records: each kind newest first, as the server orders them, capped. */
export function listRecordsByKind(data: OmniData): OmniRecordLists {
  return {
    meetings: data.meetings.slice(0, OMNI_LIST_KIND_CAP),
    proposals: data.proposals.slice(0, OMNI_LIST_KIND_CAP),
    projects: data.projects.slice(0, OMNI_LIST_KIND_CAP),
  }
}
