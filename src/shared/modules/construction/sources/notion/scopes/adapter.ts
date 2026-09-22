import type { PageObjectResponse } from '@notionhq/client/build/src/api-endpoints'
import type { Scope } from '@/shared/modules/construction/core/schemas'
import { scopeSchema } from '@/shared/modules/construction/core/schemas'
import { relationIds, selectName, titleText } from '../extractors'
import { normalizeNotionId } from '../normalize-id'
import { SCOPE_PROPERTIES_MAP } from './properties-map'

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
export function pageToScope(page: PageObjectResponse): Scope | null {
  try {
    const p = page.properties

    const rawKind = selectName<'Scope' | 'Addon'>(p, SCOPE_PROPERTIES_MAP.kind.label)

    const raw: Partial<Scope> = {
      id: normalizeNotionId(page.id),
      name: titleText(p, SCOPE_PROPERTIES_MAP.name.label),
      kind: rawKind === 'Addon' ? 'addon' : 'scope',
      unitOfPricing: selectName<'sqft' | 'linear ft' | 'space' | 'unit'>(p, SCOPE_PROPERTIES_MAP.unitOfPricing.label) ?? undefined,
      coverImageUrl: extractCoverImageUrl(page),
      tradeId: relationIds(p, SCOPE_PROPERTIES_MAP.tradeId.label).map(normalizeNotionId)[0],
      sowIds: relationIds(p, SCOPE_PROPERTIES_MAP.sowIds.label).map(normalizeNotionId),
    }

    const valid = scopeSchema.safeParse(raw)

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
