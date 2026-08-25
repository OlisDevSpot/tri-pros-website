import { SYSTEM_CONTEXT } from '@/shared/dal/server/types'
import { justcallDispositionToUnenrollReason } from '@/shared/services/providers/justcall/constants'
import { justcallWebhookAdapter } from '@/shared/services/providers/justcall/webhooks/adapter'
import { notifyLastInteractingAgentJob } from '@/shared/services/providers/upstash/jobs/notify-last-interacting-agent'
import { campaignEnrollmentService } from '@/shared/services/voip/campaigns/enrollment.service'
import { isStopKeyword } from '@/shared/services/voip/campaigns/lib/is-stop-keyword'
import { resolveCustomerByPhone, resolveCustomerByProviderContactId } from '@/shared/services/voip/campaigns/lib/resolve-customer'
import { smsCadenceService } from '@/shared/services/voip/campaigns/sms-cadence.service'
import { complianceService } from '@/shared/services/voip/compliance.service'

// JustCall webhook receiver — single endpoint, route handler IS the orchestrator.
// Per docs/codebase-conventions/webhook-routes.md: verify signature, normalize
// the body to a canonical event via the provider WebhookAdapter, switch on the
// canonical type, compose existing services directly. No wrapper service — and
// nothing here knows the provider is JustCall (the adapter is the only seam).
//
// PERFECT SEPARATION (EPIC 2026-06-04): the dialer owns the lead lifecycle. We
// persist exactly TWO things from dialer events:
//   1. DNC      — on STOP SMS / opt_out disposition (→ complianceService.addToDnc)
//   2. Unenroll — terminal dispositions exit the campaign via the single
//                 idempotent campaignEnrollmentService.unenroll (decision #18)
// No status writes, no voip_calls/voip_messages shadow rows, no attempt counting
// beyond the cadence claim, no after() (cosmetic notify → QStash).
//
// Failure policy (convention rule 4): 401 bad signature · 400 bad body ·
// 200 once signature+body valid, even if a switch arm throws (logged).
//
// JustCall disposition split: the final disposition may arrive on `sd.call_updated`
// (→ canonical `call.disposition_set`) rather than `sd.call_completed` (→ `call.ended`),
// so the adapter emits `call.disposition_set` only when a disposition is present.
//
// see docs/superpowers/specs/2026-08-19-justcall-dialer-migration-design.md

export async function POST(req: Request): Promise<Response> {
  // 1. Signature (HMAC-SHA256, keyed with the API secret). 401 on mismatch.
  const rawBody = await req.text()
  if (!justcallWebhookAdapter.verify(req, rawBody)) {
    return new Response('unauthorized', { status: 401 })
  }

  // 2. Normalize → canonical event. 400 on unrecognized body; null (nothing
  //    actionable, e.g. a call update with no disposition yet) also short-circuits.
  const event = justcallWebhookAdapter.parse(rawBody)
  if (!event) {
    return new Response('bad request', { status: 400 })
  }

  // 3. Dispatch. 200 always once signature + body valid.
  try {
    switch (event.type) {
      case 'sms.received': {
        if (isStopKeyword(event.text)) {
          // STOP → DNC + unenroll(opted_out). Both idempotent.
          const customer = await resolveCustomerByPhone(event.fromE164)
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
          // Cosmetic — QStash job, NOT after(). Silent loss acceptable; the
          // dialer keeps the SMS record (we don't persist it — INTEGRATION-SEAM §8).
          void notifyLastInteractingAgentJob.dispatch({
            customerPhoneE164: event.fromE164,
            body: event.text,
          })
        }
        break
      }

      // Three terminal dispositions exit the campaign (decision #18); each maps
      // to an unenroll reason via a pure lib fn. Non-terminal → null → keep dialing.
      case 'call.disposition_set': {
        const reason = justcallDispositionToUnenrollReason(event.disposition)
        if (reason) {
          // Absent contact id → can't resolve → keep dialing (safe).
          const customer = await resolveCustomerByProviderContactId(event.providerContactId ?? '')
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
            console.warn('[justcall webhook] terminal disposition with unresolvable contact', {
              disposition: event.disposition,
              providerContactId: event.providerContactId ?? null,
            })
          }
        }
        break
      }

      // Outbound dials drive the automated SMS cadence (count attempt + maybe
      // send next message). Idempotent; failures logged, 200 returned.
      case 'call.ended': {
        await smsCadenceService.handleCallEnded(event)
        break
      }
    }
  }
  catch (err) {
    console.error('[justcall webhook] handler error — returning 200 to avoid retry storm', {
      type: event.type,
      err: err instanceof Error ? err.message : String(err),
    })
  }

  return Response.json({ ok: true })
}
