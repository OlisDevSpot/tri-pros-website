import type { PushPayloadInput } from './lib/build-payload'
import type { VapidDetails } from './lib/web-push-client'
import type { PushSubscriptionRow } from '@/shared/dal/server/push-subscriptions/api'
import webpush from 'web-push'
import {
  deletePushSubscriptionsByEndpoint,
  getPushSubscriptionsByUser,
  getPushSubscriptionsByUsers,
  markPushFailure,
  markPushSuccess,
} from '@/shared/dal/server/push-subscriptions/api'
import { buildPushPayload } from './lib/build-payload'
import { DEAD_PUSH_STATUS_CODES, DEFAULT_PUSH_TTL_SECONDS } from './lib/constants'
import { getVapidDetails } from './lib/web-push-client'

import 'server-only'

export type { PushPayloadInput } from './lib/build-payload'

export interface PushSendOptions extends PushPayloadInput {
  /** Seconds the push service should retain the message if the device is offline. */
  ttl?: number
  /** "high" maps to APNS priority 10 (immediate). "normal" → 5 (deferred). */
  urgency?: 'very-low' | 'low' | 'normal' | 'high'
}

export interface PushSendResult {
  delivered: number
  /** Subscriptions deleted because the push service said they're dead (4xx). */
  removed: number
  /** Subscriptions that errored but weren't deleted (5xx, network, etc.). */
  failed: number
  errors: Array<{ endpoint: string, statusCode?: number, message: string }>
}

const EMPTY_RESULT: PushSendResult = { delivered: 0, removed: 0, failed: 0, errors: [] }

export async function sendPushToUser(userId: string, opts: PushSendOptions): Promise<PushSendResult> {
  const subs = await getPushSubscriptionsByUser(userId)
  return sendPushToSubscriptions(subs, opts)
}

export async function sendPushToUsers(userIds: string[], opts: PushSendOptions): Promise<PushSendResult> {
  if (userIds.length === 0) {
    return { ...EMPTY_RESULT }
  }
  const subs = await getPushSubscriptionsByUsers(userIds)
  return sendPushToSubscriptions(subs, opts)
}

export async function sendPushToSubscriptions(
  subs: PushSubscriptionRow[],
  opts: PushSendOptions,
): Promise<PushSendResult> {
  if (subs.length === 0) {
    return { ...EMPTY_RESULT }
  }

  // Resolve config ONCE per batch and pass the value down. No module-level
  // toggles, no setVapidDetails side effect — each sendNotification call
  // is purely functional with the VAPID details supplied per-request via
  // its options argument.
  const vapidDetails = getVapidDetails()
  if (!vapidDetails) {
    console.warn('[push.send] VAPID not configured — dropping push to', subs.length, 'subscriptions')
    return { ...EMPTY_RESULT }
  }

  const payload = JSON.stringify(buildPushPayload(opts))
  const ttl = opts.ttl ?? DEFAULT_PUSH_TTL_SECONDS
  const urgency = opts.urgency ?? 'high'

  const results = await Promise.all(subs.map(sub => sendOne(sub, payload, { ttl, urgency, vapidDetails })))

  const dead: string[] = []
  const succeeded: string[] = []
  const transientFails: string[] = []
  const errors: PushSendResult['errors'] = []
  let delivered = 0

  for (const r of results) {
    if (r.ok) {
      succeeded.push(r.endpoint)
      delivered++
    }
    else if (r.dead) {
      dead.push(r.endpoint)
      errors.push({ endpoint: r.endpoint, statusCode: r.statusCode, message: r.message })
    }
    else {
      transientFails.push(r.endpoint)
      errors.push({ endpoint: r.endpoint, statusCode: r.statusCode, message: r.message })
    }
  }

  // Best-effort bookkeeping. Failures here shouldn't block the caller from
  // learning that the push went out (or didn't), so we await sequentially
  // but swallow errors at the top.
  await Promise.allSettled([
    deletePushSubscriptionsByEndpoint(dead),
    markPushSuccess(succeeded),
    markPushFailure(transientFails),
  ])

  return {
    delivered,
    removed: dead.length,
    failed: transientFails.length,
    errors,
  }
}

interface SendOneSuccess { ok: true, endpoint: string }
interface SendOneFailure { ok: false, endpoint: string, dead: boolean, statusCode?: number, message: string }
type SendOneResult = SendOneSuccess | SendOneFailure

async function sendOne(
  sub: PushSubscriptionRow,
  payload: string,
  options: { ttl: number, urgency: PushSendOptions['urgency'], vapidDetails: VapidDetails },
): Promise<SendOneResult> {
  try {
    await webpush.sendNotification(
      {
        endpoint: sub.endpoint,
        keys: { p256dh: sub.p256dh, auth: sub.auth },
      },
      payload,
      {
        TTL: options.ttl,
        urgency: options.urgency,
        vapidDetails: options.vapidDetails,
      },
    )
    return { ok: true, endpoint: sub.endpoint }
  }
  catch (err) {
    const e = err as { statusCode?: number, body?: string, message?: string }
    const statusCode = typeof e.statusCode === 'number' ? e.statusCode : undefined
    const dead = statusCode !== undefined && (DEAD_PUSH_STATUS_CODES as readonly number[]).includes(statusCode)
    const message = e.body ?? e.message ?? 'Unknown push error'
    return { ok: false, endpoint: sub.endpoint, dead, statusCode, message }
  }
}
