import type { DalReturn, ScopedContext } from '@/shared/dal/server/types'
import type { VoipMessage } from '@/shared/db/schema/voip-messages'
import type { MessageInstance, MessageListInstanceCreateOptions } from '@/shared/services/providers/twilio/types'

import env from '@/shared/config/server-env'
import { dalError, dalSuccess } from '@/shared/dal/server/types'
import { getStickyDidForUser } from '@/shared/entities/voip-dids/dal/server/queries'
import { voipMessageCrud } from '@/shared/entities/voip-messages/dal/server/crud'
import { patchMessageStatusByProviderId, upsertInboundMessage } from '@/shared/entities/voip-messages/dal/server/mutations'
import { fetchThread as fetchThreadDal } from '@/shared/entities/voip-messages/dal/server/queries'
import { RestException, twilioClient } from '@/shared/services/providers/twilio/client'
import { getVetting, VOIP_DEV_OVERRIDE_NUMBER } from '@/shared/services/providers/twilio/constants'
import { complianceService } from '@/shared/services/voip/compliance.service'

// ---------------------------------------------------------------------------
// voipMessagesService — orchestrates outbound SMS + inbound persistence +
// STOP-keyword opt-out + delivery-status callback patches.
//
// THIS FILE IS PURE ORCHESTRATION. Composes DAL + provider + compliance.
//
// see memory/feedback-services-orchestrate-dal-implements.md
// see src/shared/entities/voip-messages/DOCS.md (thread key + STOP path)
// ---------------------------------------------------------------------------

const STATUS_CALLBACK_URL = `${env.VOIP_WEBHOOK_BASE_URL}/api/webhooks/twilio`

// STOP-keyword detector. Matches exact carrier-recognized opt-out keywords +
// common variants. Carriers auto-process these too — we run our own gate so
// the DNC flag lands regardless of which path Twilio takes.
const STOP_KEYWORD_REGEX = /^(?:STOP|STOPALL|UNSUBSCRIBE|END|QUIT|CANCEL|REMOVE|OPT[\s-]?OUT)$/i

export function isOptOutKeyword(body: string): boolean {
  return STOP_KEYWORD_REGEX.test(body.trim())
}

interface SendSmsInput {
  customerId: string
  remoteE164: string
  agentUserId: string
  body: string
}

interface SendSmsResult {
  messageId: string
  providerMessageId: string | null
  status: VoipMessage['status']
  failureReason: string | null
}

interface RecordInboundMessageInput {
  providerMessageId: string
  voipDidId: string | null
  customerId: string | null
  remoteE164: string
  body: string
}

interface ApplyMessageStatusCallbackInput {
  providerMessageId: string
  status: VoipMessage['status']
  deliveredAt?: string
  failedAt?: string
  failureReason?: string
}

interface FetchThreadInput {
  voipDidId: string
  remoteE164: string
  limit?: number
}

function buildTwilioMessageParams(input: {
  fromE164: string
  toE164: string
  body: string
}): MessageListInstanceCreateOptions {
  return {
    from: input.fromE164,
    to: input.toE164,
    body: input.body,
    statusCallback: STATUS_CALLBACK_URL,
  }
}

function describeTwilioError(e: unknown): string {
  if (e instanceof RestException) {
    return `twilio:${e.code ?? e.status ?? 'unknown'}`
  }
  return 'twilio:unknown'
}

function createVoipMessagesService() {
  return {
    /**
     * Send an SMS from an agent to a customer.
     *  1. Compliance gate.
     *  2. 10DLC vetting check (prod-only).
     *  3. Sticky DID.
     *  4. Dev-override on the Twilio leg.
     *  5. Persist row with `status='queued'`.
     *  6. Fire Twilio + patch row.
     */
    sendSms: async (
      ctx: ScopedContext,
      input: SendSmsInput,
    ): Promise<DalReturn<SendSmsResult>> => {
      // 1. Compliance gate.
      const allowed = await complianceService.canOutboundTo(input.remoteE164)
      if (!allowed) {
        const failureReason = 'dnc'
        const inserted = await voipMessageCrud.create(ctx, {
          customerId: input.customerId,
          remoteE164: input.remoteE164,
          body: input.body,
          direction: 'outbound',
          status: 'failed',
          failureReason,
          agentUserId: input.agentUserId,
        })
        if (!inserted.success) {
          return inserted
        }
        return dalSuccess({
          messageId: inserted.data.id,
          providerMessageId: null,
          status: 'failed' as const,
          failureReason,
        })
      }

      // 2. 10DLC vetting check (production only).
      if (env.NODE_ENV === 'production' && !getVetting().tenDlcCampaignSid) {
        return dalError({
          type: 'precondition-failed',
          reason: '10DLC campaign approval pending — outbound SMS disabled in production',
        })
      }

      // 3. Sticky DID.
      const didResult = await getStickyDidForUser(input.agentUserId)
      if (!didResult.success) {
        return didResult
      }
      if (!didResult.data) {
        return dalError({
          type: 'precondition-failed',
          reason: 'agent has no active primary DID — assign one via the admin panel',
        })
      }
      const stickyDid = didResult.data

      // 4. Dev-override on the Twilio leg.
      const dialTarget = VOIP_DEV_OVERRIDE_NUMBER ?? input.remoteE164

      // 5. Persist row with status='queued'.
      const created = await voipMessageCrud.create(ctx, {
        customerId: input.customerId,
        voipDidId: stickyDid.id,
        remoteE164: input.remoteE164,
        body: input.body,
        direction: 'outbound',
        status: 'queued',
        agentUserId: input.agentUserId,
      })
      if (!created.success) {
        return created
      }
      const messageRow = created.data

      // 6. Fire Twilio.
      let twilioMessage: MessageInstance
      try {
        twilioMessage = await twilioClient.sendMessage(
          buildTwilioMessageParams({
            fromE164: stickyDid.e164,
            toE164: dialTarget,
            body: input.body,
          }),
        )
      }
      catch (e) {
        const errorCode = describeTwilioError(e)
        const patched = await voipMessageCrud.update(ctx, {
          id: messageRow.id,
          data: { status: 'failed', failureReason: errorCode },
        })
        if (!patched.success) {
          return patched
        }
        return dalSuccess({
          messageId: messageRow.id,
          providerMessageId: null,
          status: 'failed' as const,
          failureReason: errorCode,
        })
      }

      const patched = await voipMessageCrud.update(ctx, {
        id: messageRow.id,
        data: {
          providerMessageId: twilioMessage.sid,
          status: 'sent',
          sentAt: new Date().toISOString(),
        },
      })
      if (!patched.success) {
        return patched
      }
      return dalSuccess({
        messageId: messageRow.id,
        providerMessageId: twilioMessage.sid,
        status: 'sent' as const,
        failureReason: null,
      })
    },

    /**
     * Idempotent upsert for inbound messages. Routes through the DAL mutation.
     */
    recordInboundMessage: (
      _ctx: ScopedContext,
      input: RecordInboundMessageInput,
    ): Promise<DalReturn<VoipMessage>> => {
      return upsertInboundMessage(input)
    },

    /**
     * Apply a delivery-status callback. Routes through the DAL mutation.
     */
    applyStatusCallback: (
      _ctx: ScopedContext,
      input: ApplyMessageStatusCallbackInput,
    ): Promise<DalReturn<{ rowsAffected: number }>> => {
      return patchMessageStatusByProviderId(input)
    },

    /**
     * Fetch a thread by composite key. Routes through the DAL query.
     */
    fetchThread: (
      ctx: ScopedContext,
      input: FetchThreadInput,
    ): Promise<DalReturn<VoipMessage[]>> => {
      return fetchThreadDal(ctx, input)
    },

    getMessageById: (
      ctx: ScopedContext,
      messageId: string,
    ): Promise<DalReturn<VoipMessage | undefined>> => {
      return voipMessageCrud.getById(ctx, { id: messageId })
    },
  }
}

export const voipMessagesService = createVoipMessagesService()
