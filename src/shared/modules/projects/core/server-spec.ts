import type { EntityServerSpec } from '@/shared/dal/server/types'

import {
  insertProjectSchema,
  projects,
  selectProjectSchema,
} from '@/shared/db/schema'
import { PROJECT } from '@/shared/modules/projects/core/lib/constants'
import { projectVisibility } from '@/shared/modules/projects/core/lib/visibility'

// No server-derived fields on the row itself, so update simply partials the
// insert schema (mirrors applications). `scopeIds` — the x_projectScopes
// side-channel the hand-written router carries — is NOT a `projects` column and
// intentionally does NOT ride through these schemas; it belongs to a dedicated
// scopes mutation, not the CRUD slot.
const updateProjectSchema = insertProjectSchema.partial()

/** Concrete schemas for `createCrudRouter` type inference (spec carries type-erased copies). */
export const projectSchemas = {
  insert: insertProjectSchema,
  update: updateProjectSchema,
}

/**
 * The `projects` entity spec. `projects` is a first-class entity that was still
 * hand-written (feature DAL + bare-`agentProcedure` router); this makes it
 * spec-driven so it sits on equal footing with the other entities — and, load-
 * bearing for the media work, gives project-media a real parent to bridge to
 * (`parent: { spec: projectServerSpec, fk: projectMediaFiles.projectId }`).
 *
 * SCOPE (S5a): this ships the spec + `projectCrud` (`dal/server/crud.ts`). Sub-plan D
 * (2026-08-19) routes the full project lifecycle through `projectCrud` via the
 * `create/updateProjectWithScopes` abstractions (scopeIds as a call-site closure)
 * and a `delete.before` R2-cleanup hook. Routing is **behavior-preserving**: the
 * router keeps bare `agentProcedure`, so `ctx.scope` stays `undefined` (unscoped —
 * identical to the pre-D feature-DAL path). Security tightening (route onto
 * `projectProcedure` for `ctx.scope`; gate `delete` on `can('delete','Project')`)
 * is the SEPARATE #285 tail — routing through crud does NOT tighten scope.
 */
export const projectServerSpec = {
  entityName: PROJECT,
  caslSubject: PROJECT,
  visibility: projectVisibility,
  table: projects,
  schemas: {
    insert: insertProjectSchema,
    update: updateProjectSchema,
    select: selectProjectSchema,
  },
} satisfies EntityServerSpec<typeof projects>
