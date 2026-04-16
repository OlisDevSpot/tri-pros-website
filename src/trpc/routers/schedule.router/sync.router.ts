import { and, eq, isNotNull, isNull, or } from 'drizzle-orm'

import { gcalSyncableActivityTypes } from '@/shared/constants/enums'
import { db } from '@/shared/db'
import { activities } from '@/shared/db/schema/activities'
import { meetings } from '@/shared/db/schema/meetings'
import { schedulingService } from '@/shared/services/scheduling.service'
import { agentProcedure, createTRPCRouter } from '@/trpc/init'

export const syncRouter = createTRPCRouter({
  getSyncStatus: agentProcedure
    .query(async ({ ctx }) => {
      return schedulingService.getSyncStatus(ctx.session.user.id)
    }),

  connectCalendar: agentProcedure
    .mutation(async ({ ctx }) => {
      return schedulingService.connectCalendar(ctx.session.user.id)
    }),

  disconnectCalendar: agentProcedure
    .mutation(async ({ ctx }) => {
      await schedulingService.disconnectCalendar(ctx.session.user.id)
      return { disconnected: true }
    }),

  /** Disconnect + reconnect (clears orphan state, creates fresh calendar) */
  resetCalendar: agentProcedure
    .mutation(async ({ ctx }) => {
      await schedulingService.disconnectCalendar(ctx.session.user.id)
      return schedulingService.connectCalendar(ctx.session.user.id)
    }),

  triggerSync: agentProcedure
    .mutation(async ({ ctx }) => {
      const userId = ctx.session.user.id

      // 1. Push unsynced meetings (have scheduledFor but no gcalEventId)
      const unsyncedMeetings = await db
        .select({ id: meetings.id })
        .from(meetings)
        .where(and(
          eq(meetings.ownerId, userId),
          isNotNull(meetings.scheduledFor),
          isNull(meetings.gcalEventId),
        ))

      for (const m of unsyncedMeetings) {
        await schedulingService
          .pushToGCal(userId, 'meeting', m.id)
          .catch((err) => {
            console.error(`[triggerSync] pushToGCal meeting ${m.id} failed:`, err)
          })
      }

      // 2. Push unsynced activities (syncable type + scheduledFor but no gcalEventId)
      const unsyncedActivities = await db
        .select({ id: activities.id })
        .from(activities)
        .where(and(
          eq(activities.ownerId, userId),
          isNotNull(activities.scheduledFor),
          isNull(activities.gcalEventId),
          or(
            ...gcalSyncableActivityTypes.map(t => eq(activities.type, t)),
          ),
        ))

      for (const a of unsyncedActivities) {
        await schedulingService
          .pushToGCal(userId, 'activity', a.id)
          .catch((err) => {
            console.error(`[triggerSync] pushToGCal activity ${a.id} failed:`, err)
          })
      }

      // 3. Pull inbound changes from Google Calendar
      await schedulingService.handleInboundSync(userId)

      return { synced: true }
    }),
})
