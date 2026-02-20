import type { NotionDatabaseMap } from './constants/databases'

export type NotionDatabaseName = keyof NotionDatabaseMap
export type NotionDatabaseProperties<T extends NotionDatabaseName> = NotionDatabaseMap[T]['propertiesMap']
