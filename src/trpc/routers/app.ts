import { agentProcedure, baseProcedure, createTRPCRouter } from '../init'
import { constructionRouter } from './construction.router'
import { docusignRouter } from './docusign.router'
import { hubspotRouter } from './hubspot.router'
import { landingRouter } from './landing.router'
import { proposalRouter } from './proposal.router'

export const appRouter = createTRPCRouter({
  test: baseProcedure.query(async ({ ctx }) => {
    return { resHeaders: [...ctx.resHeaders.entries()] }
  }),
  test2: agentProcedure.query(({ ctx }) => {
    const cookies = ctx.req?.headers.get('cookie')
      ?.split('; ')
      .map(cookie => cookie.split('='))
      .reduce((acc, [key, value]) => ({ ...acc, [key]: value }), {}) as Record<string, string>

    return { cookies }
  }),
  healthcheck: baseProcedure.query(() => 'ok'),
  landingRouter,
  hubspotRouter,
  docusignRouter,
  constructionRouter,
  proposalRouter,
})

export type AppRouter = typeof appRouter
