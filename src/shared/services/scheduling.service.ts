import type { AccountRow } from '@/shared/dal/server/accounts/google-calendar'

import env from '@/shared/config/server-env'
import { gcalSyncableActivityTypes } from '@/shared/constants/enums'
import {
  clearAccountGCalFields,
  getAccountByChannelId,
  getGoogleAccountForUser,
  updateAccountGCalFields,
} from '@/shared/dal/server/accounts/google-calendar'
import {
  clearActivityGCalFields,
  clearAllActivityGCalFieldsForUser,
  createActivityFromGCalEvent,
  deleteActivity,
  getActivityByGCalEventId,
  getActivityById,
  getSyncableActivitiesForUser,
  updateActivityFromGCal,
  updateActivityGCalFields,
} from '@/shared/dal/server/activities/google-calendar'
import {
  clearAllMeetingGCalFieldsForUser,
  clearMeetingGCalFields,
  getAllMeetingsWithSchedule,
  getMeetingByGCalEventId,
  getMeetingForGCal,
  updateMeetingGCalFields,
  updateMeetingScheduledFor,
} from '@/shared/dal/server/meetings/google-calendar'
import { getSystemOwnerId } from '@/shared/dal/server/users/system'

import { refreshAccessToken } from '@/shared/services/google-drive/lib/refresh-access-token'
import { GCalSyncTokenExpiredError, googleCalendarClient } from './google-calendar/client'
import { hasRemoteChanged, resolveConflict } from './google-calendar/lib/conflict'
import { gcalEventToLocal } from './google-calendar/lib/map-from-gcal'

import { activityToGCalEvent, meetingToGCalEvent } from './google-calendar/lib/map-to-gcal'

const isDev = env.NODE_ENV === 'development'
const TRI_PROS_CALENDAR_NAME = isDev ? 'Tri Pros Schedule (DEV)' : 'Tri Pros Schedule'

/** Get a fresh access token for a user's Google account, returning the full account row */
async function getAccessTokenForUser(userId: string): Promise<{ accessToken: string, account: AccountRow } | null> {
  const row = await getGoogleAccountForUser(userId)

  if (!row?.refreshToken) {
    return null
  }

  const expiresAt = row.accessTokenExpiresAt ? new Date(row.accessTokenExpiresAt) : new Date(0)
  const fiveMinFromNow = new Date(Date.now() + 5 * 60 * 1000)

  let accessToken = row.accessToken
  if (!accessToken || expiresAt < fiveMinFromNow) {
    const refreshed = await refreshAccessToken({ refreshToken: row.refreshToken })
    accessToken = refreshed.accessToken

    await updateAccountGCalFields(row.id, {
      accessToken: refreshed.accessToken,
      accessTokenExpiresAt: refreshed.expiresAt,
    })
  }

  return { accessToken: accessToken!, account: { ...row, accessToken: accessToken! } }
}

async function performInboundSync(userId: string): Promise<void> {
  const auth = await getAccessTokenForUser(userId)
  if (!auth) {
    return
  }

  const acct = auth.account

  if (!acct.gcalCalendarId) {
    return
  }

  let eventList
  try {
    eventList = await googleCalendarClient.listEvents(
      auth.accessToken,
      acct.gcalCalendarId,
      acct.gcalSyncToken ?? undefined,
    )
  }
  catch (err) {
    if (err instanceof GCalSyncTokenExpiredError) {
      await updateAccountGCalFields(acct.id, { gcalSyncToken: null })

      eventList = await googleCalendarClient.listEvents(auth.accessToken, acct.gcalCalendarId)
    }
    else {
      throw err
    }
  }

  for (const gcalEvent of eventList.items) {
    const linkedMeeting = await getMeetingByGCalEventId(gcalEvent.id)

    if (linkedMeeting) {
      if (gcalEvent.status === 'cancelled') {
        await clearMeetingGCalFields(linkedMeeting.id)
        continue
      }

      if (!hasRemoteChanged(linkedMeeting.gcalEtag, gcalEvent.etag)) {
        continue
      }

      const winner = resolveConflict(linkedMeeting.updatedAt, gcalEvent.updated)
      if (winner === 'remote') {
        const local = gcalEventToLocal(gcalEvent)
        await updateMeetingScheduledFor(linkedMeeting.id, local.scheduledFor)
        await updateMeetingGCalFields(linkedMeeting.id, {
          gcalEtag: local.gcalEtag,
          gcalSyncedAt: new Date().toISOString(),
        })
      }
      else {
        await updateMeetingGCalFields(linkedMeeting.id, {
          gcalEtag: gcalEvent.etag,
          gcalSyncedAt: new Date().toISOString(),
        })
      }
      continue
    }

    const linkedActivity = await getActivityByGCalEventId(gcalEvent.id)

    if (linkedActivity) {
      if (gcalEvent.status === 'cancelled') {
        await deleteActivity(linkedActivity.id)
        continue
      }

      if (!hasRemoteChanged(linkedActivity.gcalEtag, gcalEvent.etag)) {
        continue
      }

      const winner = resolveConflict(linkedActivity.updatedAt, gcalEvent.updated)
      if (winner === 'remote') {
        const local = gcalEventToLocal(gcalEvent)
        await updateActivityFromGCal(linkedActivity.id, {
          scheduledFor: local.scheduledFor,
          gcalEtag: local.gcalEtag,
          gcalSyncedAt: new Date().toISOString(),
        })
      }
      else {
        await updateActivityGCalFields(linkedActivity.id, {
          gcalEtag: gcalEvent.etag,
          gcalSyncedAt: new Date().toISOString(),
        })
      }
      continue
    }

    if (gcalEvent.status !== 'cancelled') {
      const local = gcalEventToLocal(gcalEvent)
      await createActivityFromGCalEvent({
        type: 'event',
        title: local.title,
        description: local.description,
        scheduledFor: local.scheduledFor,
        ownerId: userId,
        gcalEventId: local.gcalEventId,
        gcalEtag: local.gcalEtag,
        gcalSyncedAt: new Date().toISOString(),
        metaJSON: { location: local.location, allDay: local.allDay },
      })
    }
  }

  if (eventList.nextSyncToken) {
    await updateAccountGCalFields(acct.id, { gcalSyncToken: eventList.nextSyncToken })
  }
}

function createSchedulingService() {
  return {
    connectCalendar: async (userId: string): Promise<{ calendarId: string }> => {
      const auth = await getAccessTokenForUser(userId)
      if (!auth) {
        throw new Error('No Google account linked for this user')
      }

      const acct = auth.account
      const calendar = await googleCalendarClient.createCalendar(auth.accessToken, TRI_PROS_CALENDAR_NAME)

      await updateAccountGCalFields(acct.id, { gcalCalendarId: calendar.id })

      const eventList = await googleCalendarClient.listEvents(auth.accessToken, calendar.id)

      await updateAccountGCalFields(acct.id, { gcalSyncToken: eventList.nextSyncToken ?? null })

      // Push ALL scheduled meetings to the centralized calendar (only meaningful when info@ connects)
      const systemUserId = await getSystemOwnerId()
      if (userId === systemUserId) {
        const allMeetingIds = await getAllMeetingsWithSchedule()
        for (const { id: meetingId } of allMeetingIds) {
          const meeting = await getMeetingForGCal(meetingId)
          if (!meeting) {
            continue
          }

          const payload = meetingToGCalEvent(meeting)
          if (payload) {
            const created = await googleCalendarClient.createEvent(auth.accessToken, calendar.id, payload)
            await updateMeetingGCalFields(meetingId, {
              gcalEventId: created.id,
              gcalEtag: created.etag,
              gcalSyncedAt: new Date().toISOString(),
            })
          }
        }
      }

      const userActivities = await getSyncableActivitiesForUser(userId)

      for (const activity of userActivities) {
        if (!(gcalSyncableActivityTypes as readonly string[]).includes(activity.type)) {
          continue
        }

        const payload = activityToGCalEvent(activity)
        if (payload) {
          const created = await googleCalendarClient.createEvent(auth.accessToken, calendar.id, payload)
          await updateActivityGCalFields(activity.id, {
            gcalEventId: created.id,
            gcalEtag: created.etag,
            gcalSyncedAt: new Date().toISOString(),
          })
        }
      }

      // Register webhook for real-time push notifications
      const webhookBaseUrl = env.NGROK_URL ?? env.NEXT_PUBLIC_BASE_URL
      const webhookUrl = `${webhookBaseUrl}/api/google-calendar/webhook`
      const channelId = crypto.randomUUID()
      const watchResponse = await googleCalendarClient.watchEvents(
        auth.accessToken,
        calendar.id,
        webhookUrl,
        channelId,
      )

      await updateAccountGCalFields(acct.id, {
        gcalChannelId: channelId,
        gcalChannelExpiry: new Date(Number(watchResponse.expiration)).toISOString(),
      })

      return { calendarId: calendar.id }
    },

    disconnectCalendar: async (userId: string): Promise<void> => {
      const auth = await getAccessTokenForUser(userId)
      if (!auth) {
        return
      }

      const acct = auth.account

      if (acct.gcalChannelId) {
        await googleCalendarClient.stopWatch(auth.accessToken, acct.gcalChannelId, '').catch(() => {})
      }

      await clearAccountGCalFields(acct.id)
      // Meetings live on the centralized info@ calendar, so only clear meeting fields
      // when the system owner disconnects. Per-agent disconnects only affect activities.
      const systemUserId = await getSystemOwnerId()
      if (userId === systemUserId) {
        await clearAllMeetingGCalFieldsForUser(userId)
      }
      await clearAllActivityGCalFieldsForUser(userId)
    },

    pushToGCal: async (userId: string, entityType: 'meeting' | 'activity', entityId: string): Promise<void> => {
      if (entityType === 'meeting') {
        // Meetings always push to the centralized info@ system calendar
        const systemUserId = await getSystemOwnerId()
        const auth = await getAccessTokenForUser(systemUserId)
        if (!auth) {
          console.error('[pushToGCal] No Google account linked for system owner')
          return
        }

        const acct = auth.account
        if (!acct.gcalCalendarId) {
          console.error('[pushToGCal] No calendar ID for system owner')
          return
        }

        const calendarId = acct.gcalCalendarId
        const meeting = await getMeetingForGCal(entityId)
        if (!meeting) {
          return
        }

        const payload = meetingToGCalEvent(meeting)

        if (!payload) {
          if (meeting.gcalEventId) {
            await googleCalendarClient.deleteEvent(auth.accessToken, calendarId, meeting.gcalEventId)
            await clearMeetingGCalFields(entityId)
          }
          return
        }

        if (meeting.gcalEventId) {
          const updated = await googleCalendarClient.updateEvent(
            auth.accessToken,
            calendarId,
            meeting.gcalEventId,
            payload,
            meeting.gcalEtag ?? undefined,
          )
          await updateMeetingGCalFields(entityId, {
            gcalEtag: updated.etag,
            gcalSyncedAt: new Date().toISOString(),
          })
        }
        else {
          const created = await googleCalendarClient.createEvent(auth.accessToken, calendarId, payload)
          await updateMeetingGCalFields(entityId, {
            gcalEventId: created.id,
            gcalEtag: created.etag,
            gcalSyncedAt: new Date().toISOString(),
          })
        }
        return
      }

      // Activities continue to use the per-user calendar
      const auth = await getAccessTokenForUser(userId)
      if (!auth) {
        return
      }

      const acct = auth.account
      if (!acct.gcalCalendarId) {
        return
      }

      const calendarId = acct.gcalCalendarId
      const activity = await getActivityById(entityId)
      if (!activity) {
        return
      }

      const isSyncable = (gcalSyncableActivityTypes as readonly string[]).includes(activity.type)
        || (activity.type === 'task' && activity.scheduledFor)

      if (!isSyncable) {
        return
      }

      const payload = activityToGCalEvent(activity)

      if (!payload) {
        if (activity.gcalEventId) {
          await googleCalendarClient.deleteEvent(auth.accessToken, calendarId, activity.gcalEventId)
          await clearActivityGCalFields(entityId)
        }
        return
      }

      if (activity.gcalEventId) {
        const updated = await googleCalendarClient.updateEvent(
          auth.accessToken,
          calendarId,
          activity.gcalEventId,
          payload,
          activity.gcalEtag ?? undefined,
        )
        await updateActivityGCalFields(entityId, {
          gcalEtag: updated.etag,
          gcalSyncedAt: new Date().toISOString(),
        })
      }
      else {
        const created = await googleCalendarClient.createEvent(auth.accessToken, calendarId, payload)
        await updateActivityGCalFields(entityId, {
          gcalEventId: created.id,
          gcalEtag: created.etag,
          gcalSyncedAt: new Date().toISOString(),
        })
      }
    },

    handleInboundSync: async (userId: string): Promise<void> => {
      await performInboundSync(userId)
    },

    handleWebhookNotification: async (channelId: string): Promise<void> => {
      const acct = await getAccountByChannelId(channelId)

      if (!acct) {
        return
      }

      await performInboundSync(acct.userId)
    },

    renewChannelIfNeeded: async (userId: string): Promise<void> => {
      const auth = await getAccessTokenForUser(userId)
      if (!auth) {
        return
      }

      const acct = auth.account

      if (!acct.gcalCalendarId || !acct.gcalChannelExpiry) {
        return
      }

      const expiryTime = new Date(acct.gcalChannelExpiry).getTime()
      const twentyFourHoursFromNow = Date.now() + 24 * 60 * 60 * 1000

      if (expiryTime > twentyFourHoursFromNow) {
        return
      }

      if (acct.gcalChannelId) {
        await googleCalendarClient.stopWatch(auth.accessToken, acct.gcalChannelId, '').catch(() => {})
      }

      const webhookBaseUrl = env.NGROK_URL ?? env.NEXT_PUBLIC_BASE_URL
      const webhookUrl = `${webhookBaseUrl}/api/google-calendar/webhook`
      const newChannelId = crypto.randomUUID()
      const watchResponse = await googleCalendarClient.watchEvents(
        auth.accessToken,
        acct.gcalCalendarId,
        webhookUrl,
        newChannelId,
      )

      await updateAccountGCalFields(acct.id, {
        gcalChannelId: newChannelId,
        gcalChannelExpiry: new Date(Number(watchResponse.expiration)).toISOString(),
      })
    },

    getSyncStatus: async (userId: string): Promise<{
      connected: boolean
      calendarId: string | null
      lastSynced: string | null
      channelExpiry: string | null
    }> => {
      const acct = await getGoogleAccountForUser(userId)

      return {
        connected: !!acct?.gcalCalendarId,
        calendarId: acct?.gcalCalendarId ?? null,
        lastSynced: acct?.gcalSyncToken ? new Date().toISOString() : null,
        channelExpiry: acct?.gcalChannelExpiry ?? null,
      }
    },

    scheduleFollowUp: async (_params: { proposalId: string, delayMs: number }): Promise<void> => {
      throw new Error('schedulingService.scheduleFollowUp not implemented')
    },

    scheduleMeetingReminder: async (_params: { meetingId: string, reminderAt: string }): Promise<void> => {
      throw new Error('schedulingService.scheduleMeetingReminder not implemented')
    },

    cancelScheduled: async (_params: { jobId: string }): Promise<void> => {
      throw new Error('schedulingService.cancelScheduled not implemented')
    },
  }
}

export type SchedulingService = ReturnType<typeof createSchedulingService>
export const schedulingService = createSchedulingService()
