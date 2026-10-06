// Client-safe: the browser builds its ability from the rules the server sends, with `abilityFromRules`.

import type { AppAbility, PermissionRule, StockAbility } from './types'

import type { UserRole } from '@/shared/constants/enums'

import { AbilityBuilder, createMongoAbility } from '@casl/ability'

import { ACTIVITY } from '@/shared/entities/activities/lib/constants'
import { APP_SETTING } from '@/shared/entities/app-settings/lib/constants'
import { APPLICATION } from '@/shared/entities/applications/lib/constants'
import { CUSTOMER_NOTE } from '@/shared/entities/customer-notes/lib/constants'
import { CUSTOMER, CUSTOMER_LEAD_ATTRIBUTION, CUSTOMER_PROFILE } from '@/shared/entities/customers/lib/constants'
import { LEAD_SOURCE } from '@/shared/entities/lead-sources/lib/constants'
import { MEETING } from '@/shared/entities/meetings/lib/constants'
import { VOIP_CALL } from '@/shared/entities/voip-calls/lib/constants'
import { VOIP_CAMPAIGN_CONTACT } from '@/shared/entities/voip-campaign-contacts/lib/constants'
import { VOIP_CAMPAIGN } from '@/shared/entities/voip-campaigns/lib/constants'
import { VOIP_CONTACT_FIELD } from '@/shared/entities/voip-contact-fields/lib/constants'
import { VOIP_DID } from '@/shared/entities/voip-dids/lib/constants'
import { VOIP_LINK_TOKEN } from '@/shared/entities/voip-link-tokens/lib/constants'
import { VOIP_MESSAGE } from '@/shared/entities/voip-messages/lib/constants'
import { PROJECT } from '@/shared/modules/projects/core/lib/constants'
import { PROJECT_MEDIA_FILE } from '@/shared/modules/projects/media/lib/constants'
import { PROPOSAL } from '@/shared/modules/proposals/core/lib/constants'
import { PROPOSAL_INCENTIVE } from '@/shared/modules/proposals/incentives/lib/constants'
import { PROPOSAL_MEDIA_FILE } from '@/shared/modules/proposals/media/lib/constants'
import { PROPOSAL_VIEW } from '@/shared/modules/proposals/views/lib/constants'

export const ENTITY_NAMES = [
  CUSTOMER,
  CUSTOMER_PROFILE,
  CUSTOMER_LEAD_ATTRIBUTION,
  CUSTOMER_NOTE,
  MEETING,
  PROPOSAL,
  PROPOSAL_MEDIA_FILE,
  PROPOSAL_VIEW,
  PROPOSAL_INCENTIVE,
  PROJECT,
  PROJECT_MEDIA_FILE,
  // Agents have no lead-source grants by design — super-admin's `manage all` is the only access path.
  LEAD_SOURCE,
  ACTIVITY,
  VOIP_CALL,
  VOIP_DID,
  VOIP_MESSAGE,
  VOIP_LINK_TOKEN,
  APP_SETTING,
  VOIP_CAMPAIGN,
  VOIP_CONTACT_FIELD,
  VOIP_CAMPAIGN_CONTACT,
  APPLICATION,
] as const
export type EntityName = (typeof ENTITY_NAMES)[number]

interface PermissionUser {
  id: string
  role: UserRole
}

/** The one place an ability is built from rules, so the server and the browser match them the same way. */
export function abilityFromRules(rules: PermissionRule[]): StockAbility {
  return createMongoAbility<StockAbility>(rules)
}

export function defineAbilitiesFor(user: PermissionUser | null): AppAbility {
  const { can, rules } = new AbilityBuilder<StockAbility>(createMongoAbility)

  if (!user) {
    return abilityFromRules(rules)
  }

  switch (user.role) {
    case 'super-admin':
      can('manage', 'all')
      break

    case 'agent':
      can('access', 'Dashboard')

      can('read', 'Customer')
      // `age` is the only Customer-owned field an agent writes directly; the discovery fields are gated on CustomerProfile.
      can('update', 'Customer', ['age'])
      // No create — customer creation is office/super-admin work.

      can('read', 'CustomerProfile')
      can('update', 'CustomerProfile')

      // SYSTEM-written at capture and immutable afterward — no update grant.
      can('read', 'CustomerLeadAttribution')

      // update/delete are author-or-admin, enforced in the DAL — CASL can't express "own record" on plain-string subjects.
      can('read', 'CustomerNote')
      can('create', 'CustomerNote')
      can('update', 'CustomerNote')
      can('delete', 'CustomerNote')

      can('read', 'Meeting')
      can('create', 'Meeting')
      can('update', 'Meeting')
      can('own', 'Meeting') // agents own the meetings they create (implicitly the sales rep)

      can('read', 'Proposal')
      can('create', 'Proposal')
      can('update', 'Proposal')

      can('read', 'Application')
      can('create', 'Application')
      can('update', 'Application')

      can('read', 'Project')
      can('create', 'Project')
      can('update', 'Project')

      can('read', 'Activity')
      can('create', 'Activity')
      can('update', 'Activity')
      can('delete', 'Activity')
      can('manage', 'Calendar')

      // Read only: leads, rehash and dead pipelines are super-admin-managed.
      can('read', 'CustomerPipeline')

      can('read', 'User')

      // Row scoping (own rows only) is enforced by entity visibility predicates; CASL grants only the verbs.
      can('read', 'VoipCall')
      can('create', 'VoipCall') // placeAgentCall via softphone

      can('read', 'VoipMessage')
      can('create', 'VoipMessage') // sendSms via thread UI

      can('read', 'VoipDid') // resolve own sticky DID

      can('read', 'VoipLinkToken')
      can('create', 'VoipLinkToken') // mint L-DOC links

      // Resync, source binding and bulk enroll-all are super-admin-only — no agent rule for those.
      can('read', 'VoipCampaign')
      can('read', 'VoipContactField')
      can('read', 'VoipCampaignContact')
      can('update', 'VoipCampaignContact') // disqualify (unenroll) a lead

      // No agent rule for AppSetting — super-admin only via the 'manage' on 'all'.
      break

    // Authenticated homeowners only — most use token-based access instead. Proposal read has no
    // "own" condition because proposals link through Meeting → Customer; the token gate covers it today.
    case 'homeowner':
      can('read', 'Proposal')
      can('read', 'User')
      break

    // "Own record" is enforced at the DAL layer.
    case 'user':
      can('read', 'User')
      break

    // Internal lead-qualifier, NOT a sales agent: deliberately without can('own','Meeting'),
    // so the appointments they book land unassigned (system-owned) for the dispatch flow.
    case 'dispatcher':
      can('access', 'Dashboard')
      can('read', 'LeadsPool') // sees the shared leads pool (drives visibility + phone + pipeline access)

      can('read', 'Customer')
      // Lead-contact fields only — not the sales-discovery profile.
      can('update', 'Customer', ['name', 'phone', 'email', 'address', 'city', 'state', 'zip', 'pipelineStage'])

      can('read', 'CustomerLeadAttribution')

      can('read', 'Meeting')
      can('create', 'Meeting') // books appointments (lands unassigned — see resolve-owner.ts)
      can('update', 'Meeting')
      // Note: NO can('own','Meeting') — this is what makes their bookings unassigned.

      can('read', 'User')

      can('read', 'VoipCall')
      can('create', 'VoipCall')
      can('read', 'VoipMessage')
      can('create', 'VoipMessage')
      can('read', 'VoipDid')
      break
  }

  return abilityFromRules(rules)
}
