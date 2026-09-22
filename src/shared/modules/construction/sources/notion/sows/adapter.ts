import type { PageObjectResponse } from '@notionhq/client/build/src/api-endpoints'
import type { SowTemplate } from '@/shared/modules/construction/core/schemas'
import { sowTemplateSchema } from '@/shared/modules/construction/core/schemas'
import { relationIds, titleText } from '../extractors'
import { normalizeNotionId } from '../normalize-id'
import { SOW_TEMPLATE_PROPERTIES_MAP } from './properties-map'

// see ../../DOCS.md#adapter-returns-entity-or-null
export function pageToSowTemplate(page: PageObjectResponse): SowTemplate | null {
  try {
    const p = page.properties

    const raw: Partial<SowTemplate> = {
      id: normalizeNotionId(page.id),
      name: titleText(p, SOW_TEMPLATE_PROPERTIES_MAP.name.label),
      scopeIds: relationIds(p, SOW_TEMPLATE_PROPERTIES_MAP.scopeIds.label).map(normalizeNotionId),
    }

    const valid = sowTemplateSchema.safeParse(raw)

    if (valid.success) {
      return valid.data
    }

    console.warn('[pageToSowTemplate] Skipping invalid SOW', {
      id: page.id,
      name: raw.name,
      issues: valid.error.issues,
    })
    return null
  }
  catch (err) {
    console.warn('[pageToSowTemplate] Failed to extract SOW', { id: page.id, error: err })
    return null
  }
}
