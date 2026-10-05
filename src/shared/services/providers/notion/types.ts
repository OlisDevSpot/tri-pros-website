import type { QueryDataSourceParameters } from '@notionhq/client'

export interface NotionPropDef {
  label: string
  type: NotionColumnType
}

export type RawPropertyMap<T extends Record<string, any>> = Omit<Record<keyof T, NotionPropDef>, 'id'>

export type NotionColumnType = 'title' | 'rich_text' | 'select' | 'multi_select' | 'date' | 'phone_number' | 'relation' | 'people' | 'timestamp' | 'checkbox'

export type PropertyFilter = NonNullable<QueryDataSourceParameters['filter']> // drop undefined
