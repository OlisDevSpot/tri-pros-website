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
import { mapTwilioMessageStatus } from '@/shared/services/voip/lib/map-twilio-message-status'
import { voipDidsService } from '@/shared/services/voip/voip-dids.service'

// ---------------------------------------------------------------------------
// voipMessagesService — orchestrates outbound SMS + inbound persistence +
// STOP-keyword opt-out + delivery-status callback patches.
//
// THIS FILE IS PURE ORCHESTRATION. Composes DAL + provider + compliance.
//
// see memory/feedback-services-orchestrate-dal-implements.md
// ---------------------------------------------------------------------------

const STATUS_CALLBACK_URL = `${env.VOIP_WEBHOOK_BASE_URL}/api/webhooks/twilio`

// STOP-keyword detector. Matches exact carrier-recognized opt-out keywords +
// common variants. Carriers auto-process these too — we run our own gate so
// the DNC flag lands regardless of which path Twilio takes.
const STOP_KEYWORD_REGEX = /^(?:STOP|STOPALL|UNSUBSCRIBE|END|QUIT|CANCEL|REMOVE|OPT[\s-]?OUT)$/i

export function isOptOutKeyword(body: string): boolean {
  return STOP_KEYWORD_REGEX.test(body.trim())
}

// Production is the deployment environment, not the build mode: preview deploys build in production mode too.
const isProduction = env.VERCEL_ENV === 'production'

interface OutboundLine {
  id: string
  e164: string
}

interface SendOutboundInput {
  customerId: string | null
  remoteE164: string
  body: string
  from: OutboundLine
  /** Null for the main line: it is nobody's sticky DID. */
  agentUserId: string | null
  mediaUrl?: string[]
}

interface SendSmsInput {
  customerId: string
  remoteE164: string
  agentUserId: string
  body: string
}

interface SendFromMainLineInput {
  customerId: string | null
  remoteE164: string
  body: string
  mediaUrl?: string[]
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
  /** Twilio's MessageStatus, unmapped. */
  twilioStatus: string
  errorCode?: number
  /** When the callback arrived; Twilio sends no event time. */
  at: string
}

interface ApplyMessageStatusCallbackResult {
  /** Null when Twilio's state has no word in the table. */
  status: VoipMessage['status'] | null
  rowsAffected: number
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
  mediaUrl?: string[]
}): MessageListInstanceCreateOptions {
  return {
    from: input.fromE164,
    to: input.toE164,
    body: input.body,
    statusCallback: STATUS_CALLBACK_URL,
    ...(input.mediaUrl && input.mediaUrl.length > 0 ? { mediaUrl: input.mediaUrl } : {}),
  }
}

function describeTwilioError(e: unknown): string {
  if (e instanceof RestException) {
    return `twilio:${e.code ?? e.status ?? 'unknown'}`
  }
  return 'twilio:unknown'
}

/**
 * The one path a text leaves on, whichever line it leaves from:
 *  1. Do-not-contact gate.
 *  2. 10DLC vetting check, production only.
 *  3. Dev override on the Twilio leg, fail-closed: outside production the number must be set.
 *  4. Persist the row as `queued`.
 *  5. Fire Twilio and patch the row.
 */
async function sendOutbound(ctx: ScopedContext, input: SendOutboundInput): Promise<DalReturn<SendSmsResult>> {
  const allowed = await complianceService.canOutboundTo(input.remoteE164)
  if (!allowed) {
    const failureReason = 'dnc'
    const inserted = await voipMessageCrud.create(ctx, {
      customerId: input.customerId,
      voipDidId: input.from.id,
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

  if (isProduction && !getVetting().tenDlcCampaignSid) {
    return dalError({
      type: 'precondition-failed',
      reason: '10DLC campaign approval pending: outbound SMS is disabled in production.',
    })
  }

  // The dev database is a copy of production with real customer phones, so outside production
  // a text goes to one configured number or does not go.
  if (!isProduction && !VOIP_DEV_OVERRIDE_NUMBER) {
    return dalError({
      type: 'precondition-failed',
      reason: 'VOIP_DEV_OVERRIDE_NUMBER is not set. Outside production every text goes to that number, so nothing was sent.',
    })
  }
  const dialTarget = VOIP_DEV_OVERRIDE_NUMBER ?? input.remoteE164

  const created = await voipMessageCrud.create(ctx, {
    customerId: input.customerId,
    voipDidId: input.from.id,
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

  let twilioMessage: MessageInstance
  try {
    twilioMessage = await twilioClient.sendMessage(
      buildTwilioMessageParams({
        fromE164: input.from.e164,
        toE164: dialTarget,
        body: input.body,
        mediaUrl: input.mediaUrl,
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
    // Twilio accepted the message; the row is what is stale. Returning the send as failed would invite a second text.
    console.error('[voip-messages] sent, but the row patch failed', { messageId: messageRow.id, sid: twilioMessage.sid, error: patched.error })
  }
  return dalSuccess({
    messageId: messageRow.id,
    providerMessageId: twilioMessage.sid,
    status: 'sent' as const,
    failureReason: null,
  })
}

function createVoipMessagesService() {
  return {
    /** An agent texts a customer from the agent's sticky DID. */
    sendSms: async (
      ctx: ScopedContext,
      input: SendSmsInput,
    ): Promise<DalReturn<SendSmsResult>> => {
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
      return sendOutbound(ctx, {
        customerId: input.customerId,
        remoteE164: input.remoteE164,
        body: input.body,
        from: { id: didResult.data.id, e164: didResult.data.e164 },
        agentUserId: input.agentUserId,
      })
    },

    /** Every visit message leaves from the one main line, with no agent on the row. */
    sendFromMainLine: async (
      ctx: ScopedContext,
      input: SendFromMainLineInput,
    ): Promise<DalReturn<SendSmsResult>> => {
      const mainLine = await voipDidsService.getMainLineDid()
      if (!mainLine.success) {
        return mainLine
      }
      if (!mainLine.data) {
        return dalError({
          type: 'precondition-failed',
          reason: 'No main line is configured. Flag one DID as the main line first.',
        })
      }
      return sendOutbound(ctx, {
        customerId: input.customerId,
        remoteE164: input.remoteE164,
        body: input.body,
        mediaUrl: input.mediaUrl,
        from: { id: mainLine.data.id, e164: mainLine.data.e164 },
        agentUserId: null,
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

    /** Maps Twilio's state onto the table's and never moves a message backwards. */
    applyStatusCallback: async (
      _ctx: ScopedContext,
      input: ApplyMessageStatusCallbackInput,
    ): Promise<DalReturn<ApplyMessageStatusCallbackResult>> => {
      const status = mapTwilioMessageStatus(input.twilioStatus)
      if (!status) {
        return dalSuccess({ status: null, rowsAffected: 0 })
      }
      const terminalFailure = status === 'failed' || status === 'undelivered'
      const patched = await patchMessageStatusByProviderId({
        providerMessageId: input.providerMessageId,
        status,
        deliveredAt: status === 'delivered' ? input.at : undefined,
        failedAt: terminalFailure ? input.at : undefined,
        failureReason: terminalFailure ? `twilio:${input.errorCode ?? 'unknown'}` : undefined,
      })
      if (!patched.success) {
        return patched
      }
      return dalSuccess({ status, rowsAffected: patched.data.rowsAffected })
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
