import {
  defaultShouldDehydrateQuery,
  isServer,
  QueryClient,
} from '@tanstack/react-query'
import superjson from 'superjson'

export function makeQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 30 * 1000,
        retry: (failureCount, error) => {
          if (isServer) {
            return false // keep server prefetch at TanStack's 0-retry server default
          }
          // 4xx (UNAUTHORIZED, FORBIDDEN, NOT_FOUND, BAD_REQUEST) can't be fixed by retrying.
          const status = (error as { data?: { httpStatus?: number } })?.data?.httpStatus
          if (status !== undefined && status < 500) {
            return false
          }
          return failureCount < 2
        },
      },
      dehydrate: {
        serializeData: superjson.serialize,
        shouldDehydrateQuery: query =>
          defaultShouldDehydrateQuery(query)
          || query.state.status === 'pending',
        // TanStack's documented Next.js setup: Next's flight digests already
        // redact prod errors, and default redaction swallows Next control-flow
        // errors (redirect/notFound) thrown during streamed prefetches.
        shouldRedactErrors: () => false,
      },
      hydrate: {
        deserializeData: superjson.deserialize,
      },
    },
  })
}
