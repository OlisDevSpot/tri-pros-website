import type { CanonicalDialerEvent } from '@/shared/services/voip/dialer/types'
import {
  claimAndIncrementDialAttempt,
  recordAutoSmsSent,
} from '@/shared/entities/voip-campaign-contacts/dal/server/mutations'
import {
  findSmsCadenceContextByProviderContactId,
} from '@/shared/entities/voip-campaign-contacts/dal/server/queries'
import { toE164 } from '@/shared/lib/phone'
import { dialerProvider } from '@/shared/services/voip/dialer'
import { decideCadenceSms } from './lib/decide-cadence-sms'
import { renderSmsTemplate } from './lib/render-sms-template'

// Orchestrates the per-lead automated SMS cadence off call.ended events.
// The dialer delivers; this service decides + sends. All cadence state lives in
// voip_campaign_contacts; per-campaign config in voip_campaigns.sms_cadence.
// see docs/superpowers/specs/2026-06-17-voip-campaigns-sms-cadence-design.md

type CallEndedEvent = Extract<CanonicalDialerEvent, { type: 'call.ended' }>

function createSmsCadenceService() {
  return {
    /**
     * Handle one outbound call.ended: count the dial (exactly-once), then send
     * the next due cadence SMS if the gates pass. Throws nothing the caller must
     * handle — the webhook route is 200-on-error; failures are logged.
     */
    async handleCallEnded(event: CallEndedEvent): Promise<void> {
      // Only outbound dials drive the cadence (inbound callbacks don't count).
      if (event.direction && event.direction !== 'outbound') {
        return
      }
      const providerContactId = event.providerContactId
      if (!providerContactId) {
        return // unresolvable contact → safe no-op
      }

      const ctxResult = await findSmsCadenceContextByProviderContactId(providerContactId)
      if (!ctxResult.success || !ctxResult.data) {
        return
      }
      const ctx = ctxResult.data

      // Gate: actively enrolled, has a phone, has a cadence config.
      if (ctx.unenrolledAt !== null || !ctx.customerPhone || !ctx.smsCadence) {
        return
      }

      // Exactly-once attempt counting (dedup folded into the increment).
      const claim = await claimAndIncrementDialAttempt(ctx.customerId, event.callUuid)
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

      // from = the DID the dialer called from (so the SMS matches the call number).
      const fromE164 = event.fromNumberE164
      if (!fromE164) {
        console.warn('[sms-cadence] no fromNumberE164 on call.ended — skipping send', {
          callUuid: event.callUuid,
        })
        return
      }

      // Customer phone is stored canonical 10-digit; the dialer needs E.164.
      const toE164Number = toE164(ctx.customerPhone)
      if (!toE164Number) {
        console.warn('[sms-cadence] customer phone not a valid US number — skipping send', {
          customerId: ctx.customerId,
        })
        return
      }

      const sent = await dialerProvider.sendSms({
        fromNumberE164: fromE164,
        toE164: toE164Number,
        body: text,
      })
      // Advance the ladder only on a successful send — a failed send leaves the
      // slot due, retried by the next (non-deduped) call.ended.
      if (sent.providerMessageId) {
        await recordAutoSmsSent(ctx.customerId)
      }
      else {
        console.error('[sms-cadence] sendSms returned no message id', { callUuid: event.callUuid })
      }
    },
  }
}

export const smsCadenceService = createSmsCadenceService()
