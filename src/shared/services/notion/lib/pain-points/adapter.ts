import type { PageObjectResponse } from '@notionhq/client/build/src/api-endpoints'
import type { NotionPainPoint } from './schema'
import { multiSelectNames, relationIds, richText, selectName, titleText } from '../extractors'
import { PAIN_POINT_PROPERTIES_MAP } from './properties-map'
import { notionPainPointSchema } from './schema'

export function pageToPainPoint(page: PageObjectResponse): NotionPainPoint {
  const p = page.properties
  const map = PAIN_POINT_PROPERTIES_MAP

  const raw = {
    id: page.id,
    name: titleText(p, map.name.label),
    accessor: richText(p, map.accessor.label),
    category: selectName(p, map.category.label) ?? undefined,
    severity: selectName(p, map.severity.label) ?? undefined,
    urgency: selectName(p, map.urgency.label) ?? undefined,
    emotionalDrivers: multiSelectNames(p, map.emotionalDrivers.label),
    trades: relationIds(p, map.trades.label),
    householdResonance: multiSelectNames(p, map.householdResonance.label),
    programFit: multiSelectNames(p, map.programFit.label),
    tags: multiSelectNames(p, map.tags.label),
  }

  const valid = notionPainPointSchema.safeParse(raw)

  if (valid.success) {
    return valid.data
  }

  throw new Error(valid.error.message)
}
