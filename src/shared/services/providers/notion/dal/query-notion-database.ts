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
    const page = await notionClient.pages.retrieve({ page_id: opts.id })

    // pages.retrieve can return a PartialPageObjectResponse (no `properties`).
    // Adapters require the full shape, so drop a partial rather than cast it.
    return 'properties' in page ? [page as PageObjectResponse] : []
  }

  const sorts = opts.sortBy && [
    {
      property: propertyToSortBy?.label as string,
      direction: opts.sortBy.direction || 'ascending',
    },
  ]

  if (!opts.filterProperty) {
    return queryAllPages(meta.id, { sorts })
  }

  const propertyToFilterBy = propertiesMap[opts.filterProperty as keyof typeof propertiesMap] as unknown as NotionPropDef

  const propertyFilterObject = buildPropertyFilter(propertyToFilterBy.label, propertyToFilterBy.type, opts.query || '')

  try {
    // `sorts` was silently dropped on this path before.
    return await queryAllPages(meta.id, { filter: propertyFilterObject, sorts })
  }
  catch (e) {
    throw new Error(`Failed to query Notion data source "${databaseName}"`, { cause: e })
  }
}

type QueryArgs = Parameters<typeof notionClient.dataSources.query>[0]

/**
 * Notion caps `page_size` at 100 and returns `has_more` + `next_cursor`.
 * Nothing in this codebase read them, so every list read silently truncated.
 * see ../DOCS.md#reads-paginate
 */
async function queryAllPages(
  dataSourceId: string,
  args: Pick<QueryArgs, 'filter' | 'sorts'>,
): Promise<PageObjectResponse[]> {
  const pages: PageObjectResponse[] = []
  let cursor: string | undefined

  do {
    const response = await notionClient.dataSources.query({
      data_source_id: dataSourceId,
      page_size: 100,
      start_cursor: cursor,
      ...args,
    })

    pages.push(...(response.results as PageObjectResponse[]))
    cursor = response.has_more ? (response.next_cursor ?? undefined) : undefined
  } while (cursor)

  return pages
}
