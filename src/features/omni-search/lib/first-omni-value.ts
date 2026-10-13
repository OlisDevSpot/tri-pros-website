import type { RankedOmniEntry } from '@/features/omni-search/types'
import type { AppRouterOutputs } from '@/trpc/routers/app'

type OmniData = AppRouterOutputs['searchRouter']['omni']

/** The cmdk `value` of the row that renders first, mirroring the group order in `OmniSearchResults`. */
export function firstOmniValue(ranked: RankedOmniEntry[], data: OmniData | undefined, entriesFirst: boolean): string | undefined {
  const entry = (ranked.find(r => r.entry.group === 'go-to') ?? ranked.find(r => r.entry.group === 'actions'))?.entry.id
  const record = data?.customers[0]
    ? `customer:${data.customers[0].id}`
    : data?.meetings[0]
      ? `meeting:${data.meetings[0].id}`
      : data?.proposals[0]
        ? `proposal:${data.proposals[0].id}`
        : data?.projects[0] ? `project:${data.projects[0].id}` : undefined
  return entriesFirst ? (entry ?? record) : (record ?? entry)
}
