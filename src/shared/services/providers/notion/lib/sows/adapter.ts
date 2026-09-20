import type { PageObjectResponse } from '@notionhq/client/build/src/api-endpoints'
import type { SOW } from './schema'
import { relationIds, titleText } from '../extractors'
import { normalizeNotionId } from '../normalize-notion-id'
import { SOW_PROPERTIES_MAP } from './properties-map'
import { sowSchema } from './schema'

// see ../../DOCS.md#adapter-returns-entity-or-null
export function pageToSOW(page: PageObjectResponse): SOW | null {
  try {
    const p = page.properties

    const raw: Partial<SOW> = {
      id: normalizeNotionId(page.id),
      name: titleText(p, SOW_PROPERTIES_MAP.name.label),
      relatedScope: relationIds(p, SOW_PROPERTIES_MAP.relatedScope.label).map(normalizeNotionId),
    }

    const valid = sowSchema.safeParse(raw)

    if (valid.success) {
      return valid.data
    }

    console.warn('[pageToSOW] Skipping invalid SOW', {
      id: page.id,
      name: raw.name,
      issues: valid.error.issues,
    })
    return null
  }
  catch (err) {
    console.warn('[pageToSOW] Failed to extract SOW', { id: page.id, error: err })
    return null
  }
}
