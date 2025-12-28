import { baseProcedure, createTRPCRouter } from '../init'
import { landingRouter } from './landing.router'
import { proposalRouter } from './proposal.router'

export const appRouter = createTRPCRouter({
  healthcheck: baseProcedure.query(() => 'ok'),
  landingRouter,
  proposalRouter,
})

export type AppRouter = typeof appRouter
