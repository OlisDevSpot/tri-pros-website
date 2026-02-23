import type { PageObjectResponse } from '@notionhq/client'
import type { NotionDatabaseMap } from '../constants/databases'
import type { NotionDatabaseName, NotionPropDef } from '../types'
import { notionClient } from '../client'
import { notionDatabasesMeta } from '../constants/databases'
import { buildPropertyFilter } from '../lib/property-filter'

type PropertyKey<T extends NotionDatabaseName> = keyof NotionDatabaseMap[T]['propertiesMap']
type SortDirection = 'ascending' | 'descending'

interface QueryOpts<T extends NotionDatabaseName> {
  id?: string
  query?: string
  filterProperty?: PropertyKey<T>
  sortBy?: {
    property: PropertyKey<T>
    direction: SortDirection
  }
}

export function queryNotionDatabase<T extends NotionDatabaseName>(
  databaseName: T,
  opts: QueryOpts<T> & { id: string },
): Promise<PageObjectResponse[] | undefined>

export function queryNotionDatabase<T extends NotionDatabaseName>(
  databaseName: T,
  opts?: QueryOpts<T>,
): Promise<PageObjectResponse[] | undefined>

// implementation signature (must be compatible with both overloads)
export async function queryNotionDatabase<T extends NotionDatabaseName>(
  databaseName: T,
  opts: QueryOpts<T> = {},
): Promise<PageObjectResponse | PageObjectResponse[] | undefined> {
  const meta = notionDatabasesMeta[databaseName]
  const propertiesMap = meta.propertiesMap
  const propertyToSortBy = opts.sortBy && propertiesMap[opts.sortBy.property as keyof typeof propertiesMap] as unknown as NotionPropDef

  if (opts.id) {
    const contactPage = await notionClient.pages.retrieve({
      page_id: opts.id,
    })

    return [contactPage] as PageObjectResponse[]
  }
  else if (!opts.filterProperty) {
    const response = await notionClient.dataSources.query({
      data_source_id: meta.id,
      sorts: opts.sortBy && [
        {
          property: propertyToSortBy?.label as string,
          direction: opts.sortBy?.direction || 'ascending',
        },
      ],
    })

    return response.results as PageObjectResponse[]
  }

  const propertyToFilterBy = propertiesMap[opts.filterProperty as keyof typeof propertiesMap] as unknown as NotionPropDef

  const propertyFilterObject = buildPropertyFilter(propertyToFilterBy.label, propertyToFilterBy.type, opts.query || '')

  try {
    const response = await notionClient.dataSources.query({
      data_source_id: meta.id,
      filter: propertyFilterObject,
    })

    return response.results as PageObjectResponse[]
  }
  catch (e) {
    console.error(e)
  }
}
