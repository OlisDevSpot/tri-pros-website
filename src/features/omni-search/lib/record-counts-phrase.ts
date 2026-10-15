import type { OmniRecordCounts } from '@/features/omni-search/types'

import { OMNI_COPY } from '@/features/omni-search/constants/copy'
import { OMNI_COUNT_KINDS } from '@/features/omni-search/constants/omni-search'
import { countPhrase } from '@/features/omni-search/lib/count-phrase'

/** "3 meetings, 1 proposal": the non-zero totals, for a row's accessible name. Empty without counts. */
export function recordCountsPhrase(counts: OmniRecordCounts | undefined): string {
  return OMNI_COUNT_KINDS
    .flatMap((kind) => {
      const total = counts?.[`${kind}s`] ?? 0
      return total > 0 ? [countPhrase(total, OMNI_COPY.nouns[kind])] : []
    })
    .join(', ')
}
