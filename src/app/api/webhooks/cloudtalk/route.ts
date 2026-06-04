import env from '@/shared/config/server-env'
import { getCloudtalkConfig, isCloudtalkConfigured } from '@/shared/services/providers/cloudtalk/lib/config'

// see docs/codebase-conventions/webhook-routes.md
// see docs/plans/voip/INTEGRATION-SEAM.md#2-cloudtalk-webhooks-cloudtalk--our-app
// see docs/codebase-conventions/service-architecture.md#provider-env-config-when-optional

/**
 * CloudTalk webhook receiver — single endpoint for all 6 events.
 *
 * Per the webhook-routes convention: this route handler IS the orchestrator.
 * It verifies the shared secret, switches on event-type, and (in Phase 1)
 * will directly compose existing services/voip/* services. Phase 0 logs only.
 *
 * Events: call.started, call.answered, call.ended, call.missed,
 *         voicemail.received, sms.received.
 *
 * Failure policy (per convention Rule 4):
 *   - 401 on bad/missing secret
 *   - 400 on malformed envelope
 *   - 200 always once secret + envelope are valid, even if a switch arm throws
 *     (durable failure log goes to voip_webhook_errors when that table lands
 *     in voip-in-house Phase 1; Phase 0 logs to console only — no Sentry yet).
 */
export async function POST(request: Request): Promise<Response> {
  // ── Auth: shared-secret query param (CloudTalk has no HMAC signing) ──
  // Pre-check via isCloudtalkConfigured() to branch into a misconfigured
  // response in prod / accept-with-warning in dev — without letting
  // getCloudtalkConfig() throw NotConfiguredError.
  if (!isCloudtalkConfigured()) {
    if (env.NODE_ENV === 'production') {
      console.error('[cloudtalk webhook] CloudTalk not configured in production — refusing webhook')
      return new Response('Server misconfigured', { status: 500 })
    }
    console.warn('[cloudtalk webhook] CloudTalk not configured — accepting (dev only)')
  }
  else {
    const url = new URL(request.url)
    const providedSecret = url.searchParams.get('secret')
    const { webhookSecret } = getCloudtalkConfig()
    if (providedSecret !== webhookSecret) {
      console.warn('[cloudtalk webhook] invalid or missing secret')
      return new Response('Unauthorized', { status: 401 })
    }
  }

  // ── Parse body ────────────────────────────────────────────────────────
  let raw: unknown
  try {
    raw = await request.json()
  }
  catch {
    return new Response('Malformed JSON', { status: 400 })
  }

  // ── Extract event type (Phase 0: loose typing; Phase 1 wires Zod) ────
  const event = (raw as { event_type?: string, type?: string } | null)?.event_type
    ?? (raw as { event_type?: string, type?: string } | null)?.type
  if (!event || typeof event !== 'string') {
    console.warn('[cloudtalk webhook] missing event_type in payload', { keys: raw && Object.keys(raw) })
    return new Response('Bad request — missing event_type', { status: 400 })
  }

  // ── Dispatch ──────────────────────────────────────────────────────────
  // Phase 0: log only. Phase 1 fills each arm with the orchestrated
  // service calls per docs/plans/voip/INTEGRATION-SEAM.md §2.
  try {
    switch (event) {
      case 'call.started':
        // Phase 1: voipCalls.recordEvent({ ...payload, source: 'cloudtalk', status: 'initiated' })
        console.warn('[cloudtalk webhook] call.started', { raw })
        break
      case 'call.answered':
        // Phase 1: voipCalls.markAnswered({ ...payload })
        console.warn('[cloudtalk webhook] call.answered', { raw })
        break
      case 'call.ended':
        // Phase 1: voipCalls.complete({ ...payload }) + optional CI transcript persistence
        console.warn('[cloudtalk webhook] call.ended', { raw })
        break
      case 'call.missed':
        // Phase 1: voipCalls.markMissed({ ...payload })
        console.warn('[cloudtalk webhook] call.missed', { raw })
        break
      case 'voicemail.received':
        // Phase 1: voipCalls.markVoicemail(...) + notifications.notifyAdminPool(...)
        console.warn('[cloudtalk webhook] voicemail.received', { raw })
        break
      case 'sms.received':
        // Phase 1: if STOP keyword → voipDnc.add({ source: 'cloudtalk_stop' })
        //         else → voipMessages.recordInbound(...) + notifications.notifyLastInteractingAgent(...)
        console.warn('[cloudtalk webhook] sms.received', { raw })
        break
      default:
        console.warn('[cloudtalk webhook] unknown event_type', { event, raw })
    }
  }
  catch (err) {
    // TODO(voip-in-house Phase 1): insert into voip_webhook_errors table.
    // No Sentry yet — console.error is the durable failure record until both land.
    console.error('[cloudtalk webhook] handler threw — returning 200 anyway to avoid retry storm', {
      event,
      err: err instanceof Error ? { message: err.message, stack: err.stack } : err,
    })
  }

  return new Response('OK', { status: 200 })
}
