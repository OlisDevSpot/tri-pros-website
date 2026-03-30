import type { AppRouterOutputs } from '@/trpc/routers/app'

export type AgentSettingsProfile = NonNullable<AppRouterOutputs['agentSettingsRouter']['getProfile']>
