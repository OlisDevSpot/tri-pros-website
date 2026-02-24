import type { PageObjectResponse } from '@notionhq/client/build/src/api-endpoints'
import type { SOW } from './schema'
import { relationIds, titleText } from '../extractors'
import { SOW_PROPERTIES_MAP } from './properties-map'
import { sowSchema } from './schema'

export function pageToSOW(page: PageObjectResponse): SOW {
  const p = page.properties

  const raw: Partial<SOW> = {
    id: page.id,
    name: titleText(p, SOW_PROPERTIES_MAP.name.label),
    relatedScope: relationIds(p, SOW_PROPERTIES_MAP.relatedScope.label),
  }

  const valid = sowSchema.safeParse(raw)

  if (valid.success)
    return valid.data

  throw new Error(valid.error.message)
}
