import { baseProcedure, createTRPCRouter } from '../init'
import { constructionRouter } from './construction.router'
import { landingRouter } from './landing.router'
import { proposalRouter } from './proposal.router'

export const appRouter = createTRPCRouter({
  healthcheck: baseProcedure.query(() => 'ok'),
  landingRouter,
  constructionRouter,
  proposalRouter,
})

export type AppRouter = typeof appRouter
