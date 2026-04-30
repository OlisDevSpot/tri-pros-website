import type { FilterValue } from '@/shared/dal/client/query/types'
import type { DateRange } from '@/shared/dal/server/query/schemas'

import { parseAsArrayOf, parseAsBoolean, parseAsJson, parseAsString } from 'nuqs'

import { dateRangeSchema } from '@/shared/dal/server/query/schemas'

/**
 * Compile-time registry mapping each `FilterDefinition` type to its URL
 * parser + a normalizer that converts URL state → server input value
 * (returning `undefined` for "filter is not active").
 *
 * Adding a new filter type:
 *   1. Add the variant to `FilterDefinition` in `types.ts`
 *   2. Add an entry here (parser + normalize)
 *   3. Add a Render in `filter-renderer-registry.tsx`
 *
 * Each entry is independently typed; the union exhaustiveness check happens
 * at the FilterDefinition discriminator level (the switch in `query-toolbar`'s
 * `SingleFilter` slot becomes a tsc error if a new variant is added without
 * a case).
 */
export const filterParserRegistry = {
  'select': {
    parser: parseAsString.withDefault(''),
    normalize: (raw: string): FilterValue => raw || undefined,
  },
  'multi-select': {
    parser: parseAsArrayOf(parseAsString).withDefault([] as string[]),
    normalize: (raw: string[]): FilterValue => (raw.length > 0 ? raw : undefined),
  },
  'date-range': {
    parser: parseAsJson(dateRangeSchema.parse).withDefault({} as DateRange),
    normalize: (raw: DateRange): FilterValue => (raw.from || raw.to ? raw : undefined),
  },
  'boolean': {
    parser: parseAsBoolean.withDefault(false),
    normalize: (raw: boolean): FilterValue => (raw ? true : undefined),
  },
} as const
