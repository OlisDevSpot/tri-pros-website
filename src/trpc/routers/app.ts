import { baseProcedure, createTRPCRouter } from '../init'
import { aiRouter } from './ai.router'
import { docusignRouter } from './docusign.router'
import { hubspotRouter } from './hubspot.router'
import { landingRouter } from './landing.router'

import { mediaRouter } from './media.router'
import { notionRouter } from './notion.router'
import { proposalRouter } from './proposal.router'

export const appRouter = createTRPCRouter({
  healthcheck: baseProcedure.query(() => 'ok'),
  aiRouter,
  docusignRouter,
  hubspotRouter,
  landingRouter,
  mediaRouter,
  notionRouter,
  proposalRouter,
})

export type AppRouter = typeof appRouter
