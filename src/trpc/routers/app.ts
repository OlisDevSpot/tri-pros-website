import type { inferRouterOutputs } from '@trpc/server'
import { baseProcedure, createTRPCRouter } from '../init'
import { agentSettingsRouter } from './agent-settings.router'
import { aiRouter } from './ai.router'
import { customerPipelinesRouter } from './customer-pipelines.router'
import { customersRouter } from './customers.router'
import { dashboardRouter } from './dashboard.router'
import { docusignRouter } from './docusign.router'
import { intakeRouter } from './intake.router'
import { landingRouter } from './landing.router'
import { meetingsRouter } from './meetings.router'
import { notionRouter } from './notion.router'
import { proposalsRouter } from './proposals.router'
import { showroomRouter } from './showroom.router'

export const appRouter = createTRPCRouter({
  healthcheck: baseProcedure.query(() => 'ok'),
  agentSettingsRouter,
  aiRouter,
  customersRouter,
  dashboardRouter,
  docusignRouter,
  intakeRouter,
  landingRouter,
  meetingsRouter,
  notionRouter,
  customerPipelinesRouter,
  proposalsRouter,
  showroomRouter,
})

export type AppRouter = typeof appRouter
export type AppRouterOutputs = inferRouterOutputs<AppRouter>
