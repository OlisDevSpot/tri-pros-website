import { fetchRequestHandler } from '@trpc/server/adapters/fetch'
import { createHTTPTRPCContext } from '@/trpc/init'
import { appRouter } from '@/trpc/routers/app'

async function handler(req: Request) {
  // GET NEXTJS REQUEST DETAILS AND ALLOW TRPC TO MUTATE THEM VIA CTX
  const resHeaders = new Headers()

  const trpcResponse = await fetchRequestHandler({
    endpoint: '/api/trpc',
    req,
    router: appRouter,
    createContext: () => createHTTPTRPCContext({ req, resHeaders }),
  })

  const res = new Response(trpcResponse.body, {
    status: trpcResponse.status,
    headers: resHeaders,
  })

  return res
}
export { handler as GET, handler as POST }
