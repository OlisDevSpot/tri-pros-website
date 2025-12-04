'use client'
// ^-- to make sure we can mount the Provider from a server component
import type { QueryClient } from '@tanstack/react-query'
import type { AppRouter } from './routers/_app'
import { createTRPCContext } from '@trpc/tanstack-react-query'
import { makeQueryClient } from './query-client'

export const { TRPCProvider, useTRPC } = createTRPCContext<AppRouter>()

let browserQueryClient: QueryClient

export function getQueryClient() {
  if (typeof window === 'undefined') {
    // Server: always make a new query client
    return makeQueryClient()
  }
  // Browser: make a new query client if we don't already have one
  // This is very important, so we don't re-make a new client if React
  // suspends during the initial render. This may not be needed if we
  // have a suspense boundary BELOW the creation of the query client
  if (!browserQueryClient)
    browserQueryClient = makeQueryClient()
  return browserQueryClient
}

export function getUrl() {
  const base = (() => {
    if (typeof window !== 'undefined')
      return ''
    // eslint-disable-next-line node/prefer-global/process
    return `${process.env.NEXT_PUBLIC_BASE_URL}`
  })()
  return `${base}/api/trpc`
}
