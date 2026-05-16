// ─── Entity Server Registry ─────────────────────────────────────────────────
// Module-load-time map from EntityName → its EntityServerSpec.
//
// Populated by `createEntityRouter(spec, ...)` as a side-effect: any entity
// whose router is composed via L2 lands here. Used by:
//   - L0 (nested entities resolving their parent chain — dormant in Phase 1a)
//   - Future cross-cutting tooling (openapi gen, admin scaffolds, observability)
//
// The registry is intentionally a plain Partial<Record<...>>: registration is
// not enforced at the type level — that would require module-load
// orchestration. Instead, `createEntityRouter` is the single producer, and
// duplicate registrations throw immediately.

import type { EntityServerSpec } from './types'

import type { EntityName } from '@/shared/domains/permissions/abilities'

export const entityRegistry: Partial<Record<EntityName, EntityServerSpec>> = {}

/**
 * Register an entity's spec. Called automatically by `createEntityRouter`.
 * Throws on duplicate registration to surface module-load conflicts loudly
 * rather than silently overwriting.
 */
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
