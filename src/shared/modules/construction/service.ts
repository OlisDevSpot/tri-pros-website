import { unstable_cache } from 'next/cache'

import { catalogSource } from './sources'

/**
 * Cached construction-catalog reads. One tag covers all four, so the refresh
 * button's single `revalidateTag` still clears everything.
 *
 * Scripts must NOT import this — `unstable_cache` needs a Next request
 * context. They import `catalogSource` from `./sources` directly.
 * see ./DOCS.md#one-cache-tag
 */
export const CONSTRUCTION_CATALOG_TAG = 'construction-catalog'

const REVALIDATE_SECONDS = 600

const getCatalog = unstable_cache(
  async () => {
    const [trades, scopes] = await Promise.all([
      catalogSource.getTrades(),
      catalogSource.getScopes(),
    ])
    return { trades, scopes }
  },
  ['construction-catalog'],
  { tags: [CONSTRUCTION_CATALOG_TAG], revalidate: REVALIDATE_SECONDS },
)

/** Kept out of `getCatalog` so a landing render never fetches them — only meeting-flow reads pain points. */
const getPainPoints = unstable_cache(
  async () => catalogSource.getPainPoints(),
  ['construction-pain-points'],
  { tags: [CONSTRUCTION_CATALOG_TAG], revalidate: REVALIDATE_SECONDS },
)

const getSowTemplatesByScope = unstable_cache(
  async (scopeId: string) => catalogSource.getSowTemplatesByScope(scopeId),
  ['construction-sow-templates'],
  { tags: [CONSTRUCTION_CATALOG_TAG], revalidate: REVALIDATE_SECONDS },
)

const getSowContent = unstable_cache(
  async (sowId: string) => catalogSource.getSowContent(sowId),
  ['construction-sow-content'],
  { tags: [CONSTRUCTION_CATALOG_TAG], revalidate: REVALIDATE_SECONDS },
)

export const constructionService = {
  getCatalog,
  getPainPoints,
  getSowTemplatesByScope,
  getSowContent,
}
