import type { inferRouterOutputs } from '@trpc/server'
import { baseProcedure, createTRPCRouter } from '../init'
import { agentSettingsRouter } from './agent-settings.router'
import { aiRouter } from './ai.router'
import { customerPipelinesRouter } from './customer-pipelines.router'
import { customersRouter } from './customers.router'
import { dashboardRouter } from './dashboard.router'
import { funnelsRouter } from './funnels.router'
import { intakeRouter } from './intake.router'
import { landingRouter } from './landing.router'
import { leadSourcesRouter } from './lead-sources.router'
import { meetingFlowRouter } from './meeting-flow.router'
import { meetingsRouter } from './meetings.router'
import { notionRouter } from './notion.router'
import { projectsRouter } from './projects.router'
import { proposalsRouter } from './proposals.router'
import { pushRouter } from './push.router'
import { scheduleRouter } from './schedule.router'
import { voipCampaignsRouter } from './voip-campaigns.router'

export const appRouter = createTRPCRouter({
  healthcheck: baseProcedure.query(() => 'ok'),
  agentSettingsRouter,
  aiRouter,
  customersRouter,
  dashboardRouter,
  funnelsRouter,
  intakeRouter,
  landingRouter,
  leadSourcesRouter,
  meetingFlowRouter,
  meetingsRouter,
  notionRouter,
  customerPipelinesRouter,
  proposalsRouter,
  projectsRouter,
  pushRouter,
  scheduleRouter,
  voipCampaignsRouter,
})

export type AppRouter = typeof appRouter
export type AppRouterOutputs = inferRouterOutputs<AppRouter>
