import { fetchRequestHandler } from '@trpc/server/adapters/fetch'
import { createHTTPTRPCContext } from '@/trpc/init'
import { appRouter } from '@/trpc/routers/app'

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
