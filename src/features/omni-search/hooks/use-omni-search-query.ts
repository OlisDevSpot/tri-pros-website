import { keepPreviousData, useQuery } from '@tanstack/react-query'

import { OMNI_DEBOUNCE_MS, OMNI_STALE_MS } from '@/features/omni-search/constants/omni-search'
import { toOmniTerm } from '@/shared/domains/omni-search/schemas'
import { useDebounce } from '@/shared/hooks/use-debounce'
import { useTRPC } from '@/trpc/helpers'

export function useOmniSearchQuery(search: string) {
  const trpc = useTRPC()
  const term = toOmniTerm(useDebounce(search, OMNI_DEBOUNCE_MS))
  return useQuery({
    ...trpc.searchRouter.omni.queryOptions({ term: term ?? '' }),
    enabled: term !== null,
    staleTime: OMNI_STALE_MS,
    placeholderData: keepPreviousData,
  })
}
