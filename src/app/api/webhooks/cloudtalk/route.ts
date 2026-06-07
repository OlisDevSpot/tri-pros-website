import { SYSTEM_CONTEXT } from '@/shared/dal/server/types'
import { cloudtalkClient } from '@/shared/services/providers/cloudtalk/client'
import { cloudtalkEventSchema } from '@/shared/services/providers/cloudtalk/webhooks/events'
import { notifyLastInteractingAgentJob } from '@/shared/services/providers/upstash/jobs/notify-last-interacting-agent'
import { campaignEnrollmentService } from '@/shared/services/voip/campaigns/enrollment.service'
import { isStopKeyword } from '@/shared/services/voip/campaigns/lib/is-stop-keyword'
import { resolveCustomerByCtContactId, resolveCustomerByPhone } from '@/shared/services/voip/campaigns/lib/resolve-customer'
import { ctDispositionToUnenrollReason } from '@/shared/services/voip/campaigns/lib/unenroll-reason'
import { complianceService } from '@/shared/services/voip/compliance.service'

// CloudTalk webhook receiver — single endpoint, route handler IS the orchestrator.
// Per docs/codebase-conventions/webhook-routes.md: verify secret, parse the
// envelope, switch on event-type, compose existing services directly. No wrapper
// service.
//
// PERFECT SEPARATION (EPIC 2026-06-04): CloudTalk owns the lead lifecycle +
// its own pipeline tags. Ring-1 persists exactly TWO things from CT events:
//   1. DNC      — on STOP SMS / opt_out disposition (→ complianceService.addToDnc)
//   2. Unenroll — terminal dispositions exit the campaign via the single
//                 idempotent campaignEnrollmentService.unenroll (decision #18)
// No status writes, no voip_calls/voip_messages shadow rows, no tag pushback,
// no attempt counting (deferred ring-2), no after() (cosmetic notify → QStash).
//
// Failure policy (convention rule 4): 401 bad secret · 400 bad envelope ·
// 200 once secret+envelope valid, even if a switch arm throws (logged).
//
// see docs/plans/voip-campaigns/phase-1-implementation.md#w3
// see docs/plans/voip-campaigns/EPIC.md decisions log 2026-06-04 (#18)

export async function POST(req: Request): Promise<Response> {
  // 1. Secret — client method, no separate verify.ts. CloudTalk has no HMAC;
  //    the ?secret= query param is the integrity check (constant-time compared).
  if (!cloudtalkClient.verifyWebhookSecret({ url: req.url })) {
    return new Response('unauthorized', { status: 401 })
  }

  // 2. Envelope. 400 on schema failure.
  let event
  try {
    event = cloudtalkEventSchema.parse(await req.json())
  }
  catch {
    return new Response('bad request', { status: 400 })
  }

  // 3. Dispatch. 200 always once secret + envelope valid.
  try {
    switch (event.event_type) {
      case 'sms.received': {
        if (isStopKeyword(event.text)) {
          // STOP → DNC + unenroll(opted_out). Both idempotent.
          const customer = await resolveCustomerByPhone(event.from_e164)
          if (customer) {
            // NOTE: addToDnc signature is (input) — NOT (ctx, input). DncReason
            // has no 'opt_out' literal; 'stop_keyword' is the inbound-STOP reason.
            await complianceService.addToDnc({
              customerId: customer.id,
              reason: 'stop_keyword',
              addedByUserId: null,
            })
            await campaignEnrollmentService.unenroll(SYSTEM_CONTEXT, {
              customerId: customer.id,
              reason: 'opted_out',
            })
          }
        }
        else {
          // Cosmetic — QStash job, NOT after(). Silent loss acceptable; CT keeps
          // the SMS record (we don't persist it — INTEGRATION-SEAM §8).
          void notifyLastInteractingAgentJob.dispatch({
            customerPhoneE164: event.from_e164,
            body: event.text,
          })
        }
        break
      }

      // Disposition arrives on the disposition-set / Call.Modified event. Three
      // terminal dispositions exit the campaign (decision #18); each maps to an
      // unenroll reason via a pure lib fn. Non-terminal → null → keep dialing.
      case 'call.disposition_set': {
        const reason = ctDispositionToUnenrollReason(event.disposition)
        if (reason) {
          // contact_id is injected (flat) by the Call.Modified WA body-builder
          // (Phase-0 CT dashboard config). Absent → can't resolve → keep dialing (safe).
          const customer = await resolveCustomerByCtContactId(event.contact_id ?? '')
          if (customer) {
            if (reason === 'opted_out') {
              await complianceService.addToDnc({
                customerId: customer.id,
                reason: 'stop_keyword',
                addedByUserId: null,
              })
            }
            await campaignEnrollmentService.unenroll(SYSTEM_CONTEXT, {
              customerId: customer.id,
              reason,
            })
          }
          else {
            console.warn('[cloudtalk webhook] terminal disposition with unresolvable contact', {
              disposition: event.disposition,
              contactId: event.contact_id ?? null,
            })
          }
        }
        break
      }

      // Deferred to ring 2 — no-op for now (handler stays stable for expansion):
      // call.started, call.answered, call.ended (attempt counter → cadence_exhausted),
      // voicemail.
      default:
        break
    }
  }
  catch (err) {
    console.error('[cloudtalk webhook] handler error — returning 200 to avoid retry storm', {
      eventType: event.event_type,
      err: err instanceof Error ? err.message : String(err),
    })
  }

  return Response.json({ ok: true })
}
