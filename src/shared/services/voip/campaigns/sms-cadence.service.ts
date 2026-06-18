import type { CloudtalkCallEndedEvent } from '@/shared/services/providers/cloudtalk/webhooks/events'
import {
  claimAndIncrementDialAttempt,
  recordAutoSmsSent,
} from '@/shared/entities/voip-campaign-contacts/dal/server/mutations'
import {
  findSmsCadenceContextByCtContactId,
} from '@/shared/entities/voip-campaign-contacts/dal/server/queries'
import { cloudtalkClient } from '@/shared/services/providers/cloudtalk/client'
import { decideCadenceSms } from './lib/decide-cadence-sms'
import { renderSmsTemplate } from './lib/render-sms-template'

// Orchestrates the per-lead automated SMS cadence off call.ended events.
// CloudTalk delivers; this service decides + sends. All cadence state lives in
// voip_campaign_contacts; per-campaign config in voip_campaigns.sms_cadence.
// see docs/superpowers/specs/2026-06-17-voip-campaigns-sms-cadence-design.md

function createSmsCadenceService() {
  return {
    /**
     * Handle one outbound call.ended: count the dial (exactly-once), then send
     * the next due cadence SMS if the gates pass. Throws nothing the caller must
     * handle — the webhook route is 200-on-error; failures are logged.
     */
    async handleCallEnded(event: CloudtalkCallEndedEvent): Promise<void> {
      // Only outbound dials drive the cadence (inbound callbacks don't count).
      if (event.direction && event.direction !== 'outbound') {
        return
      }
      const ctContactId = event.contact_id
      if (!ctContactId) {
        return // unresolvable contact → safe no-op
      }

      const ctxResult = await findSmsCadenceContextByCtContactId(ctContactId)
      if (!ctxResult.success || !ctxResult.data) {
        return
      }
      const ctx = ctxResult.data

      // Gate: actively enrolled, has a phone, has a cadence config.
      if (ctx.unenrolledAt !== null || !ctx.customerPhone || !ctx.smsCadence) {
        return
      }

      // Exactly-once attempt counting (dedup folded into the increment).
      const claim = await claimAndIncrementDialAttempt(ctx.customerId, event.call_uuid)
      if (!claim.success || claim.data === null) {
        return // redelivery already counted → stop
      }
      const dialAttempts = claim.data.dialAttempts

      const decision = decideCadenceSms({
        cadence: ctx.smsCadence,
        dialAttempts,
        autoSmsSentCount: ctx.autoSmsSentCount,
        lastAutoSmsAt: ctx.lastAutoSmsAt,
        now: new Date(),
      })
      if (!decision.send) {
        return
      }

      const text = renderSmsTemplate(decision.message.body, {
        name: ctx.customerName,
        city: ctx.customerCity,
        state: ctx.customerState,
        zip: ctx.customerZip,
        interestedTradesRaw: ctx.interestedTradesRaw,
      })

      // from = the DID CloudTalk dialed from (so the SMS matches the call number).
      const fromE164 = event.internal_number_e164
      if (!fromE164) {
        console.warn('[sms-cadence] no internal_number_e164 on call.ended — skipping send', {
          callUuid: event.call_uuid,
        })
        return
      }

      const sent = await cloudtalkClient.sendSms({
        fromE164,
        toE164: ctx.customerPhone,
        text,
      })
      // Advance the ladder only on a successful send — a failed send leaves the
      // slot due, retried by the next (non-deduped) call.ended.
      if (sent.success) {
        await recordAutoSmsSent(ctx.customerId)
      }
      else {
        console.error('[sms-cadence] sendSms reported failure', { callUuid: event.call_uuid })
      }
    },
  }
}

export const smsCadenceService = createSmsCadenceService()
