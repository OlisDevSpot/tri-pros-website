import { fetchRequestHandler } from '@trpc/server/adapters/fetch'
import { createHTTPTRPCContext } from '@/trpc/init'
import { appRouter } from '@/trpc/routers/app'

// Colocate with the Neon DB (aws-us-west-2) — this handler serves every
// client-side dashboard query. pdx1 = Vercel's us-west-2 (Oregon); default
// iad1 (us-east-1) would make each query a cross-country round-trip.
export const preferredRegion = 'pdx1'

async function handler(req: Request) {
  const resHeaders = new Headers()

  const trpcResponse = await fetchRequestHandler({
    endpoint: '/api/trpc',
    req,
    router: appRouter,
    createContext: () => createHTTPTRPCContext({ req, resHeaders }),
    onError: ({ error, path }) => {
      console.error(`[tRPC] ${path}: ${error.message}`)
    },
  })

  // Merge tRPC response headers (including content-type) with custom headers
  trpcResponse.headers.forEach((value, key) => {
    resHeaders.set(key, value)
  })

  return new Response(trpcResponse.body, {
    status: trpcResponse.status,
    headers: resHeaders,
  })
}
export { handler as GET, handler as POST }
