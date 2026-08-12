import type { EntityServerSpec } from '@/shared/dal/server/types'

import {
  insertProjectSchema,
  projects,
  selectProjectSchema,
} from '@/shared/db/schema'
import { PROJECT } from '@/shared/entities/projects/lib/constants'
import { projectVisibility } from '@/shared/entities/projects/lib/visibility'

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
 * (`parent: { spec: projectServerSpec, fk: mediaFiles.projectId }`).
 *
 * SCOPE (S5a): this ships the spec + `projectCrud` (`dal/server/crud.ts`) as the
 * foundation. It deliberately carries NO `hooks`/`duplicate` yet — the existing
 * lifecycle side-effects (x_projectScopes insert/replace, R2 media cleanup on
 * delete) live in `dal/server/mutations.ts` (`createProject`/`updateProject`/
 * `deleteProject`/`setProjectScopes`), which remains the lifecycle authority
 * until those mutations are routed through `createCrudDal` (projects-
 * standardization Phase 3).
 * Migrating the router also TIGHTENS behavior (create/update/delete gain
 * `ctx.scope`; `delete` gates on `can('delete','Project')`, which agents lack
 * today) — hence deferred to its own reviewed slice. Until then `projectCrud` is
 * a row-level foundation; do not route full project lifecycle through it without
 * porting those hooks.
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
