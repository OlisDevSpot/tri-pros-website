import type { AppAbility, PermissionRule } from './types'

import type { UserRole } from '@/shared/constants/enums'

import { userRoles } from '@/shared/constants/enums'
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
import { MEETING_MESSAGE } from '@/shared/modules/meetings/messages/lib/constants'
import { PROJECT } from '@/shared/modules/projects/core/lib/constants'
import { PROJECT_MEDIA_FILE } from '@/shared/modules/projects/media/lib/constants'
import { PROPOSAL } from '@/shared/modules/proposals/core/lib/constants'
import { PROPOSAL_INCENTIVE } from '@/shared/modules/proposals/incentives/lib/constants'
import { PROPOSAL_MEDIA_FILE } from '@/shared/modules/proposals/media/lib/constants'
import { PROPOSAL_VIEW } from '@/shared/modules/proposals/views/lib/constants'

import { abilityFromRules } from './ability-from-rules'
import { agentRules } from './rules/agent'
import { assertRules } from './rules/check-rules'
import { dispatcherRules } from './rules/dispatcher'
import { homeownerRules } from './rules/homeowner'
import { superAdminRules } from './rules/super-admin'
import { userRules } from './rules/user'
import 'server-only'

export const ENTITY_NAMES = [
  CUSTOMER,
  CUSTOMER_PROFILE,
  CUSTOMER_LEAD_ATTRIBUTION,
  CUSTOMER_NOTE,
  MEETING,
  MEETING_MESSAGE,
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

/** The user's id is written into the conditions when the rules are built; nothing looks up "the current user" later. */
export function rulesForUser({ id, role }: PermissionUser): PermissionRule[] {
  switch (role) {
    case 'super-admin':
      return superAdminRules()
    case 'agent':
      return agentRules(id)
    case 'dispatcher':
      return dispatcherRules(id)
    case 'homeowner':
      return homeownerRules()
    case 'user':
      return userRules()
  }
}

/** No user means an ability with no rules, never `null`. */
export function defineAbilitiesFor(user: PermissionUser | null): AppAbility {
  return abilityFromRules(user ? rulesForUser(user) : [])
}

// A placeholder id: the checks read the shape of the rules, not whose they are.
assertRules(userRoles.map(role => ({ role, rules: rulesForUser({ id: '00000000-0000-4000-8000-000000000000', role }) })))
