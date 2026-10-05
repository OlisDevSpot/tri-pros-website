// Projects module service — the ONE server-side API for project orchestration,
// shared by tRPC, RSC pages, jobs and scripts. Same shape as
// `modules/proposals/service.ts`: the entity's five CRUD slots spread onto the
// service, then verbs, then child services as GETTERS.
//
// The getter is required, not stylistic: a child service reaches the root, so a
// top-level `media: projectMediaService` would read that binding while this object
// literal is being evaluated — a ReferenceError whenever the child module loads
// first. Reference an imported SERVICE only inside a method body or a getter.
//
// Read verbs (listProjects, the public projection, cover-image rule) arrive in
// spec B — this file exists now so those have a home and so callers can stop
// reaching into the DAL.
import type { SpecCrudHandlers } from '@/shared/dal/server/types'
import type { projectServerSpec } from '@/shared/modules/projects/core/server-spec'

import { projectCrud } from '@/shared/modules/projects/core/dal/server/crud'
import { projectMediaService } from '@/shared/modules/projects/media/service'

export const projectsService = {
  ...projectCrud,

  get media() {
    return projectMediaService
  },
} satisfies SpecCrudHandlers<typeof projectServerSpec>

export type ProjectsService = typeof projectsService
