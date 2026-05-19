// Module-load-time map from EntityName → its EntityServerSpec.
// see ../DOCS.md#entity-registry-prevents-duplicates
// Populated by `createEntityRouter` as a side effect. Future use: openapi gen,
// admin scaffolds, observability. Partial<Record<...>> by design — registration
// is not type-enforced (would require module-load orchestration).

import type { EntityName } from '@/shared/domains/permissions/abilities'
import type { EntityServerSpec } from '@/trpc/types'

export const entityRegistry: Partial<Record<EntityName, EntityServerSpec>> = {}

/** Register an entity spec. Called by `createEntityRouter`. Throws on duplicate. */
export function registerEntity(spec: EntityServerSpec): void {
  const existing = entityRegistry[spec.entityName]
  if (existing) {
    throw new Error(
      `[entity-registry] Entity '${spec.entityName}' already registered. `
      + `Each entity must call createEntityRouter exactly once.`,
    )
  }
  entityRegistry[spec.entityName] = spec
}
