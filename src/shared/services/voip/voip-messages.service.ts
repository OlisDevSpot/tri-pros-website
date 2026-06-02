import type { DalReturn, ScopedContext } from '@/shared/dal/server/types'
import type { VoipMessage } from '@/shared/db/schema/voip-messages'
import type { MessageInstance, MessageListInstanceCreateOptions } from '@/shared/services/providers/twilio/types'

import { and, desc, eq, sql } from 'drizzle-orm'

import env from '@/shared/config/server-env'
import { dalDbOperation } from '@/shared/dal/server/lib/helpers'
import { dalError, dalSuccess } from '@/shared/dal/server/types'
import { db } from '@/shared/db'
import { voipMessages } from '@/shared/db/schema/voip-messages'
import { getStickyDidForUser } from '@/shared/entities/voip-dids/dal/server/queries'
import { voipMessageCrud } from '@/shared/entities/voip-messages/dal/server/crud'
import { complianceService } from '@/shared/services/compliance.service'
import { RestException, twilioClient } from '@/shared/services/providers/twilio/client'
import { VETTING, VOIP_DEV_OVERRIDE_NUMBER } from '@/shared/services/providers/twilio/constants'

// ---------------------------------------------------------------------------
// voipMessagesService — orchestrates SMS send + inbound persistence + STOP-
// keyword opt-out + delivery-status callback patches.
//
// see docs/plans/voip-in-house/phase-1-mvp.md GRILL RESULTS (2026-05-30)
// see src/shared/entities/voip-messages/DOCS.md (thread key + STOP path)
// see src/shared/services/providers/twilio/DOCS.md (caller rules)
//
// Composite thread key: (voipDidId, remoteE164). Same customer texting two
// different Tri Pros DIDs = two separate threads. The UI surfaces one thread
// at a time scoped to a specific agent's DID — never a flat merge.
// ---------------------------------------------------------------------------

// Twilio message-status callbacks fire delivery + receipt confirmations.
const STATUS_CALLBACK_URL = `${env.VOIP_WEBHOOK_BASE_URL}/api/webhooks/twilio`

// STOP-keyword detector. Matches the exact carrier-recognized opt-out keywords
// + a few common variants. Case-insensitive; trims whitespace. Carriers
// auto-process these too — but we run our own gate so the DNC flag lands
// regardless of which path Twilio takes.
const STOP_KEYWORD_REGEX = /^(?:STOP|STOPALL|UNSUBSCRIBE|END|QUIT|CANCEL|REMOVE|OPT[\s-]?OUT)$/i

export function isOptOutKeyword(body: string): boolean {
  return STOP_KEYWORD_REGEX.test(body.trim())
}

interface SendSmsInput {
  // Customer the agent is texting. Persisted on the row.
  customerId: string
  // E.164 phone the agent is texting. Drives compliance gate + Twilio leg.
  remoteE164: string
  // The agent sending the SMS — resolves their sticky DID for `from`.
  agentUserId: string
  // The SMS body. Already drafted in the UI; service does NOT auto-append
  // STOP footer — carrier-required disclosure is on the campaign-level
  // opt-in copy (10DLC compliance), not per-message.
  body: string
}

interface SendSmsResult {
  // Internal voip_messages row id.
  messageId: string
  // Twilio's MessageSid once accepted by their edge.
  providerMessageId: string | null
  status: VoipMessage['status']
  // Present on skipped / failed. Maps to compliance reason OR `twilio:{code}`.
  failureReason: string | null
}

interface RecordInboundMessageInput {
  // Twilio's MessageSid from the inbound webhook payload.
  providerMessageId: string
  // Our DID this message arrived on — resolved by webhook handler.
  voipDidId: string | null
  // Customer that owns the sending phone — resolved by webhook handler.
  customerId: string | null
  // The sender's E.164 (webhook's `From`). Composite thread key field.
  remoteE164: string
  body: string
}

interface ApplyMessageStatusCallbackInput {
  // Twilio's MessageSid — used to find the existing row idempotently.
  providerMessageId: string
  status: VoipMessage['status']
  // Present on `undelivered` / `failed`. Caller composes from Twilio's
  // numeric error code + message text.
  failureReason?: string
}

interface FetchThreadInput {
  // The agent-side DID (one side of the composite thread key).
  voipDidId: string
  // The customer-side E.164 (other side of the composite thread key).
  remoteE164: string
  // Pagination — default 50, max 200.
  limit?: number
}

function createVoipMessagesService() {
  return {
    /**
     * Send an SMS from an agent to a customer. Full path:
     *
     *  1. Compliance gate (kill-switch + DNC check on customer phone).
     *  2. 10DLC vetting check — in production, refuse if no campaign SID is
     *     registered. (Allowed in dev/preview for testing without vetting.)
     *  3. Resolve agent's sticky DID.
     *  4. Dev-override rewrite for the Twilio leg.
     *  5. Persist row with `status='queued'`.
     *  6. Fire `twilioClient.sendMessage` + patch row with MessageSid.
     */
    sendSms: async (
      ctx: ScopedContext,
      input: SendSmsInput,
    ): Promise<DalReturn<SendSmsResult>> => {
      // 1. Compliance gate.
      const allowed = await complianceService.canOutboundTo(input.remoteE164)
      if (!allowed) {
        const failureReason = 'dnc'
        const insertResult = await voipMessageCrud.create(ctx, {
          customerId: input.customerId,
          remoteE164: input.remoteE164,
          body: input.body,
          direction: 'outbound',
          status: 'failed',
          failureReason,
          agentUserId: input.agentUserId,
        })
        if (!insertResult.success) {
          return insertResult
        }
        return dalSuccess({
          messageId: insertResult.data.id,
          providerMessageId: null,
          status: 'failed' as const,
          failureReason,
        })
      }

      // 2. 10DLC vetting check. Production-only; dev/preview can SMS without
      // a campaign (Twilio still applies trial-account constraints).
      if (env.NODE_ENV === 'production' && !VETTING.tenDlcCampaignSid) {
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

      // 4. Dev-override rewrite (only the Twilio leg; row keeps the intent).
      const dialTarget = VOIP_DEV_OVERRIDE_NUMBER ?? input.remoteE164

      // 5. Persist row with status='queued'.
      const createResult = await voipMessageCrud.create(ctx, {
        customerId: input.customerId,
        voipDidId: stickyDid.id,
        remoteE164: input.remoteE164,
        body: input.body,
        direction: 'outbound',
        status: 'queued',
        agentUserId: input.agentUserId,
      })
      if (!createResult.success) {
        return createResult
      }
      const messageRow = createResult.data

      // 6. Fire Twilio.
      const twilioParams: MessageListInstanceCreateOptions = {
        from: stickyDid.e164,
        to: dialTarget,
        body: input.body,
        statusCallback: STATUS_CALLBACK_URL,
      }

      let twilioMessage: MessageInstance
      try {
        twilioMessage = await twilioClient.sendMessage(twilioParams)
      }
      catch (e) {
        const errorCode = e instanceof RestException
          ? `twilio:${e.code ?? e.status ?? 'unknown'}`
          : 'twilio:unknown'

        const patchResult = await voipMessageCrud.update(ctx, {
          id: messageRow.id,
          data: { status: 'failed', failureReason: errorCode },
        })
        if (!patchResult.success) {
          return patchResult
        }
        return dalSuccess({
          messageId: messageRow.id,
          providerMessageId: null,
          status: 'failed' as const,
          failureReason: errorCode,
        })
      }

      const patchResult = await voipMessageCrud.update(ctx, {
        id: messageRow.id,
        data: {
          providerMessageId: twilioMessage.sid,
          // Twilio's `sent` lifecycle phase corresponds to "accepted by edge".
          // Delivery confirmation arrives later via statusCallback.
          status: 'sent',
          sentAt: sql`NOW()` as unknown as string,
        },
      })
      if (!patchResult.success) {
        return patchResult
      }

      return dalSuccess({
        messageId: messageRow.id,
        providerMessageId: twilioMessage.sid,
        status: 'sent' as const,
        failureReason: null,
      })
    },

    /**
     * Idempotent upsert for inbound SMS. Called by the inbound-messaging
     * webhook handler. Keyed by the unique `provider_message_id`.
     *
     * Does NOT itself handle STOP-keyword opt-out — caller (route handler)
     * checks `isOptOutKeyword(body)` BEFORE persisting and calls
     * `complianceService.addToDnc` separately if matched. Splitting keeps
     * this method a pure persistence concern.
     */
    recordInboundMessage: async (
      _ctx: ScopedContext,
      input: RecordInboundMessageInput,
    ): Promise<DalReturn<VoipMessage>> => {
      return dalDbOperation(async () => {
        const [row] = await db
          .insert(voipMessages)
          .values({
            providerMessageId: input.providerMessageId,
            voipDidId: input.voipDidId,
            customerId: input.customerId,
            remoteE164: input.remoteE164,
            body: input.body,
            direction: 'inbound',
            status: 'received',
          })
          .onConflictDoUpdate({
            target: voipMessages.providerMessageId,
            set: {
              voipDidId: input.voipDidId,
              customerId: input.customerId,
              remoteE164: input.remoteE164,
              body: input.body,
              updatedAt: sql`NOW()`,
            },
          })
          .returning()

        return row!
      })
    },

    /**
     * Apply a delivery-status callback to an existing outbound message row.
     * Idempotent on `provider_message_id`. No-op when the row isn't found
     * yet (race with our own REST-return patch — eventually consistent).
     */
    applyStatusCallback: async (
      _ctx: ScopedContext,
      input: ApplyMessageStatusCallbackInput,
    ): Promise<DalReturn<{ rowsAffected: number }>> => {
      return dalDbOperation(async () => {
        const updates: Partial<typeof voipMessages.$inferInsert> = {
          status: input.status,
        }

        if (input.status === 'delivered') {
          updates.deliveredAt = sql`NOW()` as unknown as string
        }
        if (input.status === 'failed' || input.status === 'undelivered') {
          updates.failedAt = sql`NOW()` as unknown as string
          if (input.failureReason) {
            updates.failureReason = input.failureReason
          }
        }

        const result = await db
          .update(voipMessages)
          .set({
            ...updates,
            updatedAt: sql`NOW()`,
          })
          .where(eq(voipMessages.providerMessageId, input.providerMessageId))
          .returning({ id: voipMessages.id })

        return { rowsAffected: result.length }
      })
    },

    /**
     * Fetch a thread — all messages between a specific Tri Pros DID and a
     * specific customer phone, ordered newest-first. Used by the agent's
     * thread view in Slug F.
     *
     * Composite thread key `(voipDidId, remoteE164)` is the indexed access
     * path; left-prefix also covers "all messages on this DID" if you call
     * with `remoteE164=''` (don't — there's no use case for that). Single
     * agent ⇒ single DID ⇒ a coherent conversation timeline.
     */
    fetchThread: async (
      ctx: ScopedContext,
      input: FetchThreadInput,
    ): Promise<DalReturn<VoipMessage[]>> => {
      const limit = Math.min(input.limit ?? 50, 200)

      return dalDbOperation(async () => {
        const rows = await db
          .select()
          .from(voipMessages)
          .where(and(
            eq(voipMessages.voipDidId, input.voipDidId),
            eq(voipMessages.remoteE164, input.remoteE164),
            ctx.scope ?? undefined,
          ))
          .orderBy(desc(voipMessages.createdAt))
          .limit(limit)

        return rows
      })
    },

    /**
     * Convenience CRUD passthrough — same shape as voip-calls so callers
     * have a uniform service surface across the entity family.
     */
    getMessageById: async (
      ctx: ScopedContext,
      messageId: string,
    ): Promise<DalReturn<VoipMessage | undefined>> => {
      return voipMessageCrud.getById(ctx, { id: messageId })
    },
  }
}

/**
 * Single-instance voipMessagesService. NEVER import `twilioClient` directly
 * from a route handler — go through this service for the compliance gate,
 * sticky DID resolution, 10DLC vetting check, and dev-override rewrite.
 *
 * STOP-keyword detection is a sibling export (`isOptOutKeyword`) because
 * webhook handlers call it BEFORE persistence (e.g., to short-circuit a
 * normal thread insert when the body is a STOP and route to DNC instead).
 */
export const voipMessagesService = createVoipMessagesService()
