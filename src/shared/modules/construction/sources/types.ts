import type { PainPoint, Scope, SowTemplate, Trade } from '@/shared/modules/construction/core/schemas'

/**
 * Neutral construction-catalog contract. Shaped around the reads the app
 * performs, not any vendor's endpoints. Notion (or, at P5, Postgres)
 * implements this; everything above depends ONLY on this interface via the
 * `../sources` barrel binding, never on `sources/notion/*` directly.
 *
 * There is deliberately no `getCatalog()` here — composition and caching
 * belong to `modules/construction/service.ts`, so a future binding is a
 * method-for-method implementation rather than a re-derivation.
 *
 * see ../DOCS.md#the-seam
 */
export interface ConstructionCatalogSource {
  getTrades: () => Promise<Trade[]>
  getScopes: () => Promise<Scope[]>
  getSowTemplatesByScope: (scopeId: string) => Promise<SowTemplate[]>
  getSowContent: (sowId: string) => Promise<string>
  getPainPoints: () => Promise<PainPoint[]>
}
