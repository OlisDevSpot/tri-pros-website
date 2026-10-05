import type { OptionSource } from '@/shared/dal/lib/query/constants'
import type { AppAbility } from '@/shared/domains/permissions/types'
import type { useTRPC } from '@/trpc/helpers'

/** Every option read returns rows with an id and a display name; the hook turns them into filter options. */
export interface OptionSourceRow {
  id: string
  name: string
}

interface OptionSourceRead {
  /** Mirrors the read's own server guard, so a viewer it would refuse never sends it; the filter just stays hidden. */
  canRead: (ability: AppAbility) => boolean
  // Checked through `queryFn`'s result (covariant); `select` would reject any row with more fields than OptionSourceRow.
  queryOptions: (trpc: ReturnType<typeof useTRPC>) => { queryKey: readonly unknown[], queryFn?: (...args: never[]) => Promise<readonly OptionSourceRow[]> | readonly OptionSourceRow[] }
}

/** Every option source's read. A source missing here, or a read whose rows lack `id`/`name`, fails `pnpm tsc`. */
export const OPTION_SOURCE_READS = {
  // Notion trade ids (never the Postgres `trades.id`); shares the catalog's cached query.
  trades: {
    canRead: () => true,
    queryOptions: trpc => trpc.constructionRouter.trades.getAll.queryOptions(),
  },
  reps: {
    canRead: ability => ability.can('assign', 'Meeting'),
    queryOptions: trpc => trpc.meetingsRouter.reads.getInternalUsers.queryOptions(),
  },
  setters: {
    canRead: ability => ability.can('assign', 'Meeting'),
    queryOptions: trpc => trpc.meetingsRouter.reads.getInternalUsers.queryOptions({ purpose: 'setter' }),
  },
  // Inactive sources included: old customers still point at them.
  leadSources: {
    canRead: ability => ability.can('manage', 'all'),
    queryOptions: trpc => trpc.leadSourcesRouter.list.queryOptions(),
  },
} satisfies Record<OptionSource, OptionSourceRead>
