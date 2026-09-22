import type { PageObjectResponse } from '@notionhq/client/build/src/api-endpoints'
import type { PainPoint } from '@/shared/modules/construction/core/schemas'
import { painPointSchema } from '@/shared/modules/construction/core/schemas'
import { multiSelectNames, relationIds, richText, selectName, titleText } from '../extractors'
import { normalizeNotionId } from '../normalize-id'
import { PAIN_POINT_PROPERTIES_MAP } from './properties-map'

// see ../../../DOCS.md#adapter-returns-entity-or-null
export function pageToPainPoint(page: PageObjectResponse): PainPoint | null {
  try {
    const p = page.properties
    const map = PAIN_POINT_PROPERTIES_MAP

    const raw = {
      id: normalizeNotionId(page.id),
      name: titleText(p, map.name.label),
      accessor: richText(p, map.accessor.label),
      category: selectName(p, map.category.label) ?? undefined,
      severity: selectName(p, map.severity.label) ?? undefined,
      urgency: selectName(p, map.urgency.label) ?? undefined,
      emotionalDrivers: multiSelectNames(p, map.emotionalDrivers.label),
      trades: relationIds(p, map.trades.label).map(normalizeNotionId),
      householdResonance: multiSelectNames(p, map.householdResonance.label),
      programFit: multiSelectNames(p, map.programFit.label),
      tags: multiSelectNames(p, map.tags.label),
    }

    const valid = painPointSchema.safeParse(raw)

    if (valid.success) {
      return valid.data
    }

    console.warn('[pageToPainPoint] Skipping invalid pain point', {
      id: page.id,
      name: raw.name,
      issues: valid.error.issues,
    })
    return null
  }
  catch (err) {
    console.warn('[pageToPainPoint] Failed to extract pain point', { id: page.id, error: err })
    return null
  }
}
