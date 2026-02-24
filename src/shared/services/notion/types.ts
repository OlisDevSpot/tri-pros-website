import type { QueryDataSourceParameters } from '@notionhq/client'
import type { NotionDatabaseMap } from './constants/databases'
import type { queryNotionDatabase } from './dal/query-notion-database'
import { notionDatabasesMeta } from './constants/databases'

export type NotionDatabaseName = 'contacts' | 'meetings' | 'projects' | 'trades' | 'scopes' | 'sows'
export interface NotionPropDef {
  label: string
  type: NotionColumnType
}

export type RawPropertyMap<T extends Record<string, any>> = Omit<Record<keyof T, NotionPropDef>, 'id'>

export type NotionColumnType = 'title' | 'rich_text' | 'select' | 'date' | 'phone_number' | 'relation' | 'people' | 'timestamp'

export type NotionDatabaseProperties<T extends NotionDatabaseName> = NotionDatabaseMap[T]['propertiesMap']

export type PropertyFilter = NonNullable<QueryDataSourceParameters['filter']> // drop undefined

export function getDatabaseMeta<T extends NotionDatabaseName>(name: T): NotionDatabaseMap[T] {
  return notionDatabasesMeta[name]
}

export type QueryNotionTradesOptions = Parameters<typeof queryNotionDatabase<'trades'>>[1]
export type QueryNotionScopesOptions = Parameters<typeof queryNotionDatabase<'scopes'>>[1]
