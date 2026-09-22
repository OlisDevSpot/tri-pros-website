import type { TradePropertySource } from './trades/properties-map'
import type { PainPoint, Scope, SowTemplate } from '@/shared/modules/construction/core/schemas'
import type { RawPropertyMap } from '@/shared/services/providers/notion/types'
import { PAIN_POINT_PROPERTIES_MAP } from './pain-points/properties-map'
import { SCOPE_PROPERTIES_MAP } from './scopes/properties-map'
import { SOW_TEMPLATE_PROPERTIES_MAP } from './sows/properties-map'
import { TRADE_PROPERTIES_MAP } from './trades/properties-map'

export type NotionDatabaseName = 'painPoints' | 'trades' | 'scopes' | 'sows'

type RawDatbaseMap = {
  [K in NotionDatabaseName]: {
    id: string
    name: K
    propertiesMap:
      | RawPropertyMap<Omit<PainPoint, 'id'>>
      | RawPropertyMap<TradePropertySource>
      | RawPropertyMap<Omit<Scope, 'coverImageUrl'>>
      | RawPropertyMap<SowTemplate>
  }
}

export const notionDatabasesMeta = {
  painPoints: {
    id: '31f0ca1b-548b-8014-8a18-000b60a42c1e',
    name: 'painPoints',
    propertiesMap: PAIN_POINT_PROPERTIES_MAP,
  },
  trades: {
    id: '6f00ca1b-548b-8279-9f2d-87f649413084',
    name: 'trades',
    propertiesMap: TRADE_PROPERTIES_MAP,
  },
  scopes: {
    id: 'ef70ca1b-548b-8226-b680-07fe8f00a91f',
    name: 'scopes',
    propertiesMap: SCOPE_PROPERTIES_MAP,
  },
  sows: {
    id: '53e0ca1b-548b-83e3-8cd9-87067f43457a',
    name: 'sows',
    propertiesMap: SOW_TEMPLATE_PROPERTIES_MAP,
  },
} as const satisfies RawDatbaseMap

export type NotionDatabaseMap = typeof notionDatabasesMeta
