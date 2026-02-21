import type { PageObjectResponse } from '@notionhq/client/build/src/api-endpoints'
import type { ScopeOrAddon } from './schema'
import { relationIds, selectName, titleText } from '../extractors'
import { SCOPE_OR_ADDON_PROPERTIES_MAP } from './properties-map'
import { scopeOrAddonSchema } from './schema'

export function pageToScope(page: PageObjectResponse): ScopeOrAddon {
  const p = page.properties

  const raw: Partial<ScopeOrAddon> = {
    id: page.id,
    name: titleText(p, SCOPE_OR_ADDON_PROPERTIES_MAP.name.label),
    entryType: selectName<'Scope' | 'Addon'>(p, SCOPE_OR_ADDON_PROPERTIES_MAP.entryType.label) ?? undefined,
    unitOfPricing: selectName<'sqft' | 'linear ft' | 'space' | 'unit'>(p, SCOPE_OR_ADDON_PROPERTIES_MAP.unitOfPricing.label) ?? undefined,
    relatedTrade: relationIds(p, SCOPE_OR_ADDON_PROPERTIES_MAP.relatedTrade.label)[0],
    relatedScopesOfWork: relationIds(p, SCOPE_OR_ADDON_PROPERTIES_MAP.relatedScopesOfWork.label),
  }

  const valid = scopeOrAddonSchema.safeParse(raw)

  if (valid.success)
    return valid.data

  throw new Error(valid.error.message)
}
