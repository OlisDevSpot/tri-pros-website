import type { DalReturn, ScopedContext } from '@/shared/dal/server/types'
import type { VoipDid } from '@/shared/db/schema/voip-dids'

import { dalError, dalSuccess, SYSTEM_CONTEXT } from '@/shared/dal/server/types'
import { voipDidCrud } from '@/shared/entities/voip-dids/dal/server/crud'
import { assignToUser, promoteToPrimary, reconcileWithProvider, unassign } from '@/shared/entities/voip-dids/dal/server/mutations'
import { getDidByE164, getDidByProviderId, getStickyDidForUser } from '@/shared/entities/voip-dids/dal/server/queries'
import { twilioClient } from '@/shared/services/providers/twilio/client'

// ---------------------------------------------------------------------------
// voipDidsService — orchestrates DID assignment lifecycle and admin
// "Resync from Twilio" reconciliation.
//
// THIS FILE IS PURE ORCHESTRATION. All db operations live in
// `entities/voip-dids/dal/server/{queries,mutations}.ts`. The service fetches
// from Twilio (via `twilioClient.list*` / `fetch*`) and hands the result to
// the DAL's reconcile mutation — keeping the provider boundary on this side
// of the DAL.
//
// see memory/feedback-services-orchestrate-dal-implements.md
// see src/shared/entities/voip-dids/DOCS.md (1:N cardinality + partial unique index)
// ---------------------------------------------------------------------------

interface AssignDidInput {
  didId: string
  userId: string
}

interface MarkPrimaryInput {
  didId: string
}

interface UnassignDidInput {
  didId: string
}

interface ResyncFromTwilioInput {
  providerDidId?: string
}

interface ResyncFromTwilioResult {
  updated: number
  created: number
  deactivated: number
}

function createVoipDidsService() {
  return {
    /**
     * Assign a DID to a user. First DID auto-becomes primary.
     */
    assignDidToUser: (
      _ctx: ScopedContext,
      input: AssignDidInput,
    ): Promise<DalReturn<VoipDid>> => {
      return assignToUser(input)
    },

    /**
     * Mark a DID primary — transactionally demotes any other primaries
     * for the same agent.
     */
    markPrimary: (
      _ctx: ScopedContext,
      input: MarkPrimaryInput,
    ): Promise<DalReturn<VoipDid>> => {
      return promoteToPrimary(input)
    },

    /**
     * Unassign — clears assigned_user_id + is_primary together. History rows
     * keep their FK pointer (no cascade-delete).
     */
    unassignDid: (
      _ctx: ScopedContext,
      input: UnassignDidInput,
    ): Promise<DalReturn<VoipDid>> => {
      return unassign(input)
    },

    /**
     * Admin "Resync DIDs from Twilio". Fetches live numbers via the provider
     * client, hands them to the DAL reconcile mutation for diffing + writes.
     */
    resyncFromTwilio: async (
      _ctx: ScopedContext,
      input: ResyncFromTwilioInput = {},
    ): Promise<DalReturn<ResyncFromTwilioResult>> => {
      const liveNumbers = input.providerDidId
        ? [await twilioClient.fetchIncomingPhoneNumber(input.providerDidId)]
        : await twilioClient.listIncomingPhoneNumbers()

      return reconcileWithProvider({
        liveNumbers,
        // Single-SID mode shouldn't deactivate everything else not in the list.
        enableDeactivationSweep: input.providerDidId === undefined,
      })
    },

    // Read-side passthroughs — services + route handlers consume these
    // instead of importing the DAL queries directly, keeping the service
    // layer the canonical surface for outside callers.

    getStickyDidForUser: (userId: string): Promise<DalReturn<VoipDid | null>> => {
      return getStickyDidForUser(userId)
    },

    getDidByE164: (e164: string): Promise<DalReturn<VoipDid | null>> => {
      return getDidByE164(e164)
    },

    getDidByProviderId: (providerDidId: string): Promise<DalReturn<VoipDid | null>> => {
      return getDidByProviderId(providerDidId)
    },

    getDidByIdSystem: (didId: string): Promise<DalReturn<VoipDid | undefined>> => {
      return voipDidCrud.getById(SYSTEM_CONTEXT, { id: didId })
    },

    canAgentOutbound: async (userId: string): Promise<DalReturn<boolean>> => {
      const result = await getStickyDidForUser(userId)
      if (!result.success) {
        return result
      }
      return dalSuccess(result.data !== null)
    },

    requireStickyDid: async (userId: string): Promise<DalReturn<VoipDid>> => {
      const result = await getStickyDidForUser(userId)
      if (!result.success) {
        return result
      }
      if (!result.data) {
        return dalError({
          type: 'precondition-failed',
          reason: 'agent has no active primary DID',
        })
      }
      return dalSuccess(result.data)
    },
  }
}

export const voipDidsService = createVoipDidsService()
