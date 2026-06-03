import { TRPCError } from '@trpc/server'
import { and, eq, isNotNull, isNull, or } from 'drizzle-orm'

import { gcalSyncableActivityTypes } from '@/shared/constants/enums'
import { db } from '@/shared/db'
import { activities } from '@/shared/db/schema/activities'
import { meetings } from '@/shared/db/schema/meetings'
import { getGoogleAccountForUser } from '@/shared/entities/accounts/dal/server/google-calendar'
import { getSystemOwnerId } from '@/shared/entities/users/dal/server/system'
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
      // All meetings live on the centralized info@ calendar regardless of owner.
      const unsyncedMeetings = await db
        .select({ id: meetings.id })
        .from(meetings)
        .where(and(
          isNotNull(meetings.scheduledFor),
          isNull(meetings.gcalEventId),
        ))

      for (const m of unsyncedMeetings) {
        await schedulingService
          .syncMeeting(m.id)
          .catch((err) => {
            console.error(`[triggerSync] syncMeeting ${m.id} failed:`, err)
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
          .syncActivity(userId, a.id)
          .catch((err) => {
            console.error(`[triggerSync] syncActivity ${a.id} failed:`, err)
          })
      }

      // 3. Pull inbound changes from Google Calendar
      await schedulingService.handleInboundSync(userId)

      return { synced: true }
    }),

  /**
   * Diagnostic snapshot of the centralized info@ calendar's sync state.
   * Surfaces the failure mode behind "inbound GCal edits stopped reaching
   * the app" — typically a webhook channel that expired without renewal.
   * Super-admin gated; safe to expose to operators only.
   */
  systemOwnerHealth: agentProcedure
    .query(async ({ ctx }) => {
      if (ctx.ability.cannot('manage', 'all')) {
        throw new TRPCError({
          code: 'FORBIDDEN',
          message: 'Only super-admins can view system-owner sync health.',
        })
      }

      const systemOwnerId = await getSystemOwnerId()
      const acct = await getGoogleAccountForUser(systemOwnerId)

      if (!acct) {
        return {
          connected: false,
          calendarId: null,
          channelId: null,
          channelExpiresAt: null,
          channelExpired: null,
          hasSyncToken: false,
          tokenRefreshAt: null,
        }
      }

      const channelExpiry = acct.gcalChannelExpiry ? new Date(acct.gcalChannelExpiry) : null
      const channelExpired = channelExpiry ? channelExpiry.getTime() < Date.now() : null

      return {
        connected: !!acct.gcalCalendarId,
        calendarId: acct.gcalCalendarId,
        channelId: acct.gcalChannelId,
        channelExpiresAt: acct.gcalChannelExpiry,
        channelExpired,
        hasSyncToken: !!acct.gcalSyncToken,
        tokenRefreshAt: acct.accessTokenExpiresAt,
      }
    }),

  /**
   * Manually re-arm the system owner's webhook channel. Calls
   * renewChannelIfNeeded — which is a no-op if the channel still has >24h
   * left, otherwise stops the old watch and registers a new one. Intended
   * as a fallback for operators when the scheduled cron hasn't run or has
   * been failing. Super-admin gated.
   */
  renewSystemOwnerChannel: agentProcedure
    .mutation(async ({ ctx }) => {
      if (ctx.ability.cannot('manage', 'all')) {
        throw new TRPCError({
          code: 'FORBIDDEN',
          message: 'Only super-admins can renew the system owner channel.',
        })
      }

      const systemOwnerId = await getSystemOwnerId()
      await schedulingService.renewChannelIfNeeded(systemOwnerId)
      return { renewed: true }
    }),
})
