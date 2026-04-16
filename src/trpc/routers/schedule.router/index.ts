import { createTRPCRouter } from '@/trpc/init'
import { activitiesRouter } from './activities.router'
import { syncRouter } from './sync.router'

export const scheduleRouter = createTRPCRouter({
  activities: activitiesRouter,
  sync: syncRouter,
})
