import { baseProcedure, createTRPCRouter } from '../init'
import { aiRouter } from './ai.router'
import { customersRouter } from './customers.router'
import { dashboardRouter } from './dashboard.router'
import { docusignRouter } from './docusign.router'
import { hubspotRouter } from './hubspot.router'
import { landingRouter } from './landing.router'
import { mediaRouter } from './media.router'
import { meetingsRouter } from './meetings.router'
import { notionRouter } from './notion.router'
import { proposalRouter } from './proposal.router'

export const appRouter = createTRPCRouter({
  healthcheck: baseProcedure.query(() => 'ok'),
  aiRouter,
  customersRouter,
  dashboardRouter,
  docusignRouter,
  hubspotRouter,
  landingRouter,
  mediaRouter,
  meetingsRouter,
  notionRouter,
  proposalRouter,
})

export type AppRouter = typeof appRouter
