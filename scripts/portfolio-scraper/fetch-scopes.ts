import type { PageObjectResponse } from '@notionhq/client/build/src/api-endpoints'
import type { MatchedScope } from './types'
import { Client } from '@notionhq/client'

const SCOPES_DATABASE_ID = 'ef70ca1b-548b-8226-b680-07fe8f00a91f'

interface NotionScope {
  id: string
  name: string
  entryType: string
}

function extractScope(page: PageObjectResponse): NotionScope | null {
  const props = page.properties

  const nameProperty = props['Scope or Addon']
  if (!nameProperty || nameProperty.type !== 'title')
    return null
  const name = nameProperty.title.map(t => t.plain_text).join('')

  const entryTypeProperty = props['Entry Type']
  const entryType = entryTypeProperty?.type === 'select'
    ? entryTypeProperty.select?.name ?? 'Scope'
    : 'Scope'

  return { id: page.id, name, entryType }
}

export async function fetchAllScopes(notionApiKey: string): Promise<NotionScope[]> {
  const client = new Client({ auth: notionApiKey })

  const response = await client.dataSources.query({
    data_source_id: SCOPES_DATABASE_ID,
  })

  const scopes: NotionScope[] = []
  for (const page of response.results) {
    const scope = extractScope(page as PageObjectResponse)
    if (scope && scope.name) {
      scopes.push(scope)
    }
  }

  return scopes
}

export function fuzzyMatchScopes(
  allScopes: NotionScope[],
  description: string,
): MatchedScope[] {
  const terms = description
    .toLowerCase()
    .split(/[,&+/]/)
    .map(t => t.trim())
    .filter(Boolean)

  const matched = new Map<string, MatchedScope>()

  for (const scope of allScopes) {
    const scopeLower = scope.name.toLowerCase()
    for (const term of terms) {
      if (
        scopeLower.includes(term)
        || term.includes(scopeLower)
        || levenshteinSimilar(scopeLower, term, 0.6)
      ) {
        matched.set(scope.id, {
          id: scope.id,
          name: scope.name,
          entryType: scope.entryType,
        })
      }
    }
  }

  return Array.from(matched.values())
}

function levenshteinSimilar(a: string, b: string, threshold: number): boolean {
  const longer = a.length > b.length ? a : b
  const shorter = a.length > b.length ? b : a

  if (longer.length === 0)
    return true

  const distance = levenshteinDistance(longer, shorter)
  const similarity = (longer.length - distance) / longer.length

  return similarity >= threshold
}

function levenshteinDistance(a: string, b: string): number {
  const matrix: number[][] = []

  for (let i = 0; i <= b.length; i++) {
    matrix[i] = [i]
  }
  for (let j = 0; j <= a.length; j++) {
    matrix[0][j] = j
  }

  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      if (b[i - 1] === a[j - 1]) {
        matrix[i][j] = matrix[i - 1][j - 1]
      }
      else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1,
          matrix[i][j - 1] + 1,
          matrix[i - 1][j] + 1,
        )
      }
    }
  }

  return matrix[b.length][a.length]
}
