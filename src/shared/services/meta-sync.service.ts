import type { MetaServerEvent, MetaUserData } from '@/shared/services/providers/meta/schemas/server-event'
import { metaClient } from '@/shared/services/providers/meta/client'
import { META_ACTION_SOURCE, META_EVENT } from '@/shared/services/providers/meta/constants'
import { isMetaConfigured } from '@/shared/services/providers/meta/lib/config'

export interface LeadEventArgs {
  eventId: string
  eventTime: number
  phone?: string | null
  externalId: string
  fbp?: string | null
  fbc?: string | null
  clientIp?: string | null
  clientUserAgent?: string | null
  eventSourceUrl?: string | null
  contentCategory?: string | null
  contentName?: string | null
  testEventCode?: string | null
}

function buildUserData(args: LeadEventArgs): MetaUserData {
  const hashed = metaClient.hashUserData({ phone: args.phone })
  const userData: MetaUserData = {
    ...hashed,
    external_id: [metaClient.hashExternalId(args.externalId)],
  }
  if (args.fbp) {
    userData.fbp = args.fbp
  }
  if (args.fbc) {
    userData.fbc = args.fbc
  }
  if (args.clientIp) {
    userData.client_ip_address = args.clientIp
  }
  if (args.clientUserAgent) {
    userData.client_user_agent = args.clientUserAgent
  }
  return userData
}

/**
 * ACL facade: wraps metaClient in domain operations and translates a domain
 * event into the CAPI wire shape. No DB access. Phase 1 = trackLead; phase 2
 * adds trackContact/trackMeetingComplete/trackProposalSent/trackPurchase.
 */
function createMetaSyncService() {
  return {
    async trackLead(args: LeadEventArgs): Promise<void> {
      // Config absent (local dev / unprovisioned) → no-op. Keeps the loop inert
      // until Oliver creates the dataset + token.
      if (!isMetaConfigured()) {
        return
      }
      const event: MetaServerEvent = {
        event_name: META_EVENT.Lead,
        event_time: args.eventTime,
        event_id: args.eventId,
        action_source: META_ACTION_SOURCE.website,
        event_source_url: args.eventSourceUrl ?? undefined,
        user_data: buildUserData(args),
        custom_data: {
          content_category: args.contentCategory ?? undefined,
          content_name: args.contentName ?? undefined,
        },
      }
      await metaClient.sendConversions([event], {
        testEventCode: args.testEventCode ?? undefined,
      })
    },
  }
}

export type MetaSyncService = ReturnType<typeof createMetaSyncService>
export const metaSyncService = createMetaSyncService()
