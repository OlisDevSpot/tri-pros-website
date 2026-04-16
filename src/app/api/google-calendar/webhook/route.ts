import { schedulingService } from '@/shared/services/scheduling.service'

/**
 * POST /api/google-calendar/webhook
 *
 * Receives push notifications from Google Calendar when events change.
 * Always returns 200 to prevent Google from retrying the notification.
 *
 * @see https://developers.google.com/calendar/api/guides/push
 */
export async function POST(request: Request) {
  try {
    const channelId = request.headers.get('X-Goog-Channel-ID')
    const resourceState = request.headers.get('X-Goog-Resource-State')

    // The initial 'sync' notification is sent when the channel is created.
    // We don't need to handle it — just acknowledge.
    if (resourceState === 'sync') {
      return new Response(null, { status: 200 })
    }

    if (!channelId) {
      return new Response(null, { status: 200 })
    }

    await schedulingService.handleWebhookNotification(channelId)
  }
  catch {
    // Swallow errors — always return 200 to avoid Google retries
  }

  return new Response(null, { status: 200 })
}
