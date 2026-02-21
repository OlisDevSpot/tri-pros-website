import type { ZodRawShape } from 'zod'
import type { Contact } from '../lib/contacts/schema'
import type { Meeting } from '../lib/meetings/schema'
import type { Project } from '../lib/projects/schema'
import type { ScopeOrAddon } from '../lib/scopes/schema'
import type { Trade } from '../lib/trades/schema'
import type { NotionDatabaseName, RawPropertyMap } from '../types'
import { CONTACT_PROPERTIES_MAP } from '../lib/contacts/properties-map'
import { contactSchema } from '../lib/contacts/schema'
import { MEETING_PROPERTIES_MAP } from '../lib/meetings/properties-map'
import { meetingSchema } from '../lib/meetings/schema'
import { PROJECT_PROPERTIES_MAP } from '../lib/projects/properties-map'
import { projectSchema } from '../lib/projects/schema'
import { SCOPE_OR_ADDON_PROPERTIES_MAP } from '../lib/scopes/properties-map'
import { scopeOrAddonSchema } from '../lib/scopes/schema'
import { TRADE_PROPERTIES_MAP } from '../lib/trades/properties-map'
import { tradeSchema } from '../lib/trades/schema'

type RawDatbaseMap = {
  [K in NotionDatabaseName]: {
    id: string
    name: K
    propertiesMap: RawPropertyMap<Contact> | RawPropertyMap<Meeting> | RawPropertyMap<Project> | RawPropertyMap<Trade> | RawPropertyMap<ScopeOrAddon>
    properties: ZodRawShape
  }
}

export const notionDatabasesMeta = {
  contacts: {
    id: '3030ca1b-548b-8075-95e1-000b4d1990ae',
    name: 'contacts',
    propertiesMap: CONTACT_PROPERTIES_MAP,
    properties: contactSchema.shape,
  },
  meetings: {
    id: '73a0ca1b-548b-83df-bb49-07d3eb5bb0cb',
    name: 'meetings',
    propertiesMap: MEETING_PROPERTIES_MAP,
    properties: meetingSchema.shape,
  },
  projects: {
    id: '3460ca1b-548b-832c-b92b-071c95af0757',
    name: 'projects',
    propertiesMap: PROJECT_PROPERTIES_MAP,
    properties: projectSchema.shape,
  },
  trades: {
    id: '6f00ca1b-548b-8279-9f2d-87f649413084',
    name: 'trades',
    propertiesMap: TRADE_PROPERTIES_MAP,
    properties: tradeSchema.shape,
  },
  scopes: {
    id: 'ef70ca1b-548b-8226-b680-07fe8f00a91f',
    name: 'scopes',
    propertiesMap: SCOPE_OR_ADDON_PROPERTIES_MAP,
    properties: scopeOrAddonSchema.shape,
  },
} as const satisfies RawDatbaseMap

export type NotionDatabaseMap = typeof notionDatabasesMeta
