import type { ConstructionCatalogSource } from './types'

import { notionCatalogSource } from './notion'

// The SINGLE seam binding — the one place the app names its live catalog
// source. Consumers import `catalogSource` from here (never `./notion/*`).
// Swapping to Postgres at P5 = one line, plus deleting `./notion/`.
// see ../DOCS.md#the-seam
export const catalogSource: ConstructionCatalogSource = notionCatalogSource

export * from './types'
