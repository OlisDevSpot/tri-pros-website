import type { Job, JobMap } from '@/shared/services/providers/upstash/types'
import { Receiver } from '@upstash/qstash'
import { createQbRecordsJob } from '@/shared/services/providers/upstash/jobs/create-qb-records'
import { deleteMeetingEventJob } from '@/shared/services/providers/upstash/jobs/delete-meeting-event'
import { generateAISummaryJob } from '@/shared/services/providers/upstash/jobs/generate-ai-summary'
import { initialCalendarSyncJob } from '@/shared/services/providers/upstash/jobs/initial-calendar-sync'
import { notifyMeetingTimeChangedJob } from '@/shared/services/providers/upstash/jobs/notify-meeting-time-changed'
import { optimizeImageJob } from '@/shared/services/providers/upstash/jobs/optimize-image'
import { propagateCustomerChangeJob } from '@/shared/services/providers/upstash/jobs/propagate-customer-change'
import { sendViewNotificationJob } from '@/shared/services/providers/upstash/jobs/send-view-notification'
import { syncCalendarsJob } from '@/shared/services/providers/upstash/jobs/sync-calendars'
import { syncCustomersJob } from '@/shared/services/providers/upstash/jobs/sync-customers'
import { syncMeetingToGcalJob } from '@/shared/services/providers/upstash/jobs/sync-meeting-to-gcal'
import { syncQbInvoiceJob } from '@/shared/services/providers/upstash/jobs/sync-qb-invoice'
import { syncQbPaymentJob } from '@/shared/services/providers/upstash/jobs/sync-qb-payment'
import { syncZohoSignStatusJob } from '@/shared/services/providers/upstash/jobs/sync-zoho-sign-status'
import { getQstashConfig, isQstashConfigured } from '@/shared/services/providers/upstash/lib/config'

/** Allow up to 60s for image optimization jobs (default is 10s on Hobby plan) */
export const maxDuration = 60

/**
 * An array of jobs we have defined.
 */
const jobs: Job[] = [
  generateAISummaryJob,
  syncCustomersJob,
  optimizeImageJob,
  createQbRecordsJob,
  syncQbPaymentJob,
  syncQbInvoiceJob,
  sendViewNotificationJob,
  syncZohoSignStatusJob,
  syncCalendarsJob,
  initialCalendarSyncJob,
  syncMeetingToGcalJob,
  deleteMeetingEventJob,
  propagateCustomerChangeJob,
  notifyMeetingTimeChangedJob,
]

/**
 * Register jobs, this is just a simple
 * way to find a job by key.
 */
const registry: JobMap = new Map()

for (const job of jobs) {
  registry.set(job.key, job.handler)
}

// Lazy-construct the Receiver — first request reads config + caches.
// Returns null if QStash isn't configured so the route can short-circuit
// to a clean 500 instead of crashing on `env.X!` assertions.
let _receiver: Receiver | undefined
function getReceiver(): Receiver | null {
  if (!isQstashConfigured()) {
    return null
  }
  if (!_receiver) {
    const config = getQstashConfig()
    _receiver = new Receiver({
      currentSigningKey: config.currentSigningKey,
      nextSigningKey: config.nextSigningKey,
    })
  }
  return _receiver
}

/**
 * Next.js route handler.
 */
export async function POST(request: Request) {
  /**
   * Parse the request.
   */
  const url = new URL(request.url)
  const key = url.searchParams.get('job')
  const signature = request.headers.get('Upstash-Signature')

  /**
   * Decode the request body.
   */
  const text = await request.text()
  const body = text ? JSON.parse(text) : {}

  /**
   * Verify the request.
   */

  if (!signature || !key) {
    return new Response('Missing signature or job key', { status: 403 })
  }

  const receiver = getReceiver()
  if (!receiver) {
    return new Response('QStash receiver not configured', { status: 500 })
  }

  const valid = await receiver.verify({
    signature,
    body: text,
  })

  if (!valid) {
    return new Response('Invalid signature', { status: 400 })
  }

  /**
   * Execute the handler.
   */
  const handler = registry.get(key)
  if (handler) {
    // QStash publishJSON sends body directly — use body.payload if wrapped, otherwise body itself
    const payload = body.payload ?? body
    await handler(payload)
  }

  /**
   * Return a 200 response.
   */
  return new Response()
}
