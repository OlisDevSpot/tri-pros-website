import { baseProcedure, createTRPCRouter } from '../init'
import { landingRouter } from './landing.router'

export const appRouter = createTRPCRouter({
  healthcheck: baseProcedure.query(() => 'ok'),
  landingRouter,
})

export type AppRouter = typeof appRouter
