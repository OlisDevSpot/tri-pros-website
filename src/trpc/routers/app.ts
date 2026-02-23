import { baseProcedure, createTRPCRouter } from '../init'
import { aiRouter } from './ai.router'
import { constructionRouter } from './construction.router'
import { docusignRouter } from './docusign.router'
import { hubspotRouter } from './hubspot.router'
import { landingRouter } from './landing.router'
import { notionRouter } from './notion.router'
import { proposalRouter } from './proposal.router'

export const appRouter = createTRPCRouter({
  healthcheck: baseProcedure.query(() => 'ok'),
  landingRouter,
  proposalRouter,
  notionRouter,
  hubspotRouter,
  docusignRouter,
  constructionRouter,
  aiRouter,
})

export type AppRouter = typeof appRouter
