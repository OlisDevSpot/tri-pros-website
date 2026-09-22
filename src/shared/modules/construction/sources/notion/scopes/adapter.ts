import type { PageObjectResponse } from '@notionhq/client/build/src/api-endpoints'
import type { ScopeOrAddon } from './schema'
import { relationIds, selectName, titleText } from '../extractors'
import { normalizeNotionId } from '../normalize-id'
import { SCOPE_OR_ADDON_PROPERTIES_MAP } from './properties-map'
import { scopeOrAddonSchema } from './schema'

function extractCoverImageUrl(page: PageObjectResponse): string | null {
  const cover = page.cover
  if (!cover) {
    return null
  }
  if (cover.type === 'external') {
    return cover.external.url
  }
  if (cover.type === 'file') {
    return cover.file.url
  }
  return null
}

// see ../../DOCS.md#adapter-returns-entity-or-null
export function pageToScope(page: PageObjectResponse): ScopeOrAddon | null {
  try {
    const p = page.properties

    const raw: Partial<ScopeOrAddon> = {
      id: normalizeNotionId(page.id),
      name: titleText(p, SCOPE_OR_ADDON_PROPERTIES_MAP.name.label),
      entryType: selectName<'Scope' | 'Addon'>(p, SCOPE_OR_ADDON_PROPERTIES_MAP.entryType.label) ?? undefined,
      unitOfPricing: selectName<'sqft' | 'linear ft' | 'space' | 'unit'>(p, SCOPE_OR_ADDON_PROPERTIES_MAP.unitOfPricing.label) ?? undefined,
      coverImageUrl: extractCoverImageUrl(page),
      relatedTrade: relationIds(p, SCOPE_OR_ADDON_PROPERTIES_MAP.relatedTrade.label).map(normalizeNotionId)[0],
      relatedScopesOfWork: relationIds(p, SCOPE_OR_ADDON_PROPERTIES_MAP.relatedScopesOfWork.label).map(normalizeNotionId),
    }

    const valid = scopeOrAddonSchema.safeParse(raw)

    if (valid.success) {
      return valid.data
    }

    console.warn('[pageToScope] Skipping invalid scope', {
      id: page.id,
      name: raw.name,
      issues: valid.error.issues,
    })
    return null
  }
  catch (err) {
    console.warn('[pageToScope] Failed to extract scope', { id: page.id, error: err })
    return null
  }
}
