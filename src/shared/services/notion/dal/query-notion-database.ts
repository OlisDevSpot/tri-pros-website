import type { PageObjectResponse } from '@notionhq/client'
import type { NotionDatabaseName, NotionDatabaseProperties } from '../types'
import { notionClient } from '../client'
import { notionDatabasesMeta } from '../constants/databases'

export async function queryNotionDatabase<T extends NotionDatabaseName>(
  databaseName: T,
  query?: string,
  opts: {
    filterProperty?: NotionDatabaseProperties<T>[keyof NotionDatabaseProperties<T>]
    sortBy?: NotionDatabaseProperties<T>[keyof NotionDatabaseProperties<T>]
  } = {},
) {
  const meta = notionDatabasesMeta[databaseName]
  const filterProperty = opts.filterProperty as string | undefined
  const property = filterProperty ?? (meta.name === 'contacts' ? meta.propertiesMap.name : 'Title')

  const response = await notionClient.dataSources.query({
    data_source_id: notionDatabasesMeta[databaseName].id,
    filter: !query
      ? undefined
      : {
          property,
          title: {
            contains: query ?? '',
          },
        },
    sorts: !opts.sortBy
      ? undefined
      : [
          {
            property: opts.sortBy as string,
            direction: 'ascending',
          },
        ],
  })

  return response.results as PageObjectResponse[]
}
