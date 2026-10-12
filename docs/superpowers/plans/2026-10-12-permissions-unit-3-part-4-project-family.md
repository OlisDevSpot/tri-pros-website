# Permissions unit 3 part 4: the Project family — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Projects and their media run on compiled CASL rules: an agent reaches the projects whose meetings they sit in, a dispatcher reaches none, only super-admin publishes, creates portfolio-only projects or deletes, and a media row can only name an object under its own owner's key.

**Architecture:** `'Project'` joins `COMPILED_SUBJECTS`, so `createCrudDal` scopes the project spec and its media sub-entity (`media`) through `permit`. Every hand-written reader and writer of the family ANDs `permit(ctx, …).sql` or probes `permit(ctx, …).probe(id)`; the legacy `projectProcedure`, `projectVisibility` and the projects kanban's hand SQL go. The media CRUD hooks refuse a bucket or path outside the owner's key, for project and proposal media alike.

**Tech Stack:** Next.js 15 app router, tRPC 11, Drizzle (Postgres/Neon), `@casl/ability` 6.8.0, better-auth.

**Spec:** `docs/superpowers/specs/2026-10-05-permissions-structure-design.md` (§4–§7), tracker `docs/plans/2026-08-10-casl-scope-compiler-epic.md` (D-03, D-04, D-05, D-07, D-15, D-17, D-20; §5.1 S4 S5 S7 S13 S14 S16; §4 Unit 3 "Project family" carry-overs). Design approved by the owner in chat 2026-10-12, with ruling A: the public portfolio is super-admin's (recorded in the tracker §4, Unit 3, "Part 4 design").

## Global Constraints

- Never `pnpm build`. Each task ends with `pnpm tsc` and `pnpm lint` passing, run from the worktree root.
- No test runner and no unit tests in the permissions library. Verification is `pnpm tsc`, `pnpm lint`, `src/shared/domains/permissions/type-checks/must-not-compile.ts`, the DB-free tsx probe, and GET-only API probes as dev role fixtures.
- No database writes for testing, the dev database included (it holds real phones and emails). Never print a phone, an email, a share token or a row id in any output. Never probe PII tables through Bash.
- No backwards compatibility: a change removes what it replaces in the same commit. No aliases, no wrappers kept for old call sites.
- Comments say why, never what, and never cite plans, specs, tasks or tracker ids. No file banners. A comment this plan makes false (anything describing the unscoped project router, `ctx.scope` on projects, "#285 will…") is rewritten or deleted in the same edit.
- One React component per file. Named exports only. No constants or helpers inside component files.
- New names need the owner's agreement. Agreed earlier: `bearerContext`, `proposalBearerRules`, `BEARER_RULES`, `toHomeownerProposalView`, `withoutCostLines`, `shareRouteContext`, `SHARE_LINK_LIMITS`, the system reasons in `rules/system.ts`. **Proposed for this part, agreed with the plan:** `isOwnedObject` (media helper), the system reason `derived:project-conversion`, the constant keys `PROJECT_MEDIA.bucket` / `PROJECT_MEDIA.pathKeyPrefix` and `PROPOSAL_MEDIA.bucket` / `PROPOSAL_MEDIA.pathKeyPrefix`, the file rename `lib/visibility.ts` → `lib/has-associated-meeting.ts`. Any other new exported name: stop and ask.
- `@casl/ability` stays 6.8.0. `@casl/react` is imported only in `src/shared/domains/permissions/client.tsx`.
- NO outcome or pipeline-derivation logic on this branch.
- Git: stay on `refactor/285-refactor-permissions-casl-scope-compiler`. Never `git stash`, `git reset`, `git checkout <file>` or `git restore`. Stage by explicit path. Conventional commits ending with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`. The pre-commit hook takes about 110 s: use a 300000 ms timeout on `git commit`. Push after each commit (`git push -q origin HEAD`).
- Do not kill or restart the owner's dev server (port 3003). It hot-reloads.
- Run tsx probes from inside the worktree: `NODE_OPTIONS="--conditions=react-server" node_modules/.bin/tsx --tsconfig tsconfig.json <file>`.
- `DEV_LOGIN_SECRET` goes into a shell only: `export DEV_LOGIN_SECRET="$(sed -n 's/^DEV_LOGIN_SECRET=//p' /home/olis-solutions/olis-v3/nextjs/tri-pros-website/.env.local | tr -d '"')"`. Never echo it.

## Review Focus

1. **An agent saves their own project's edit form.** Expected: the save succeeds; the form never sends `isPublic` for a viewer who may not publish, and the Public switch is not shown. A save that did send it would answer FORBIDDEN `Project.isPublic`. Pinned in Task 4 Step 3 and the owner's hand check H2.
2. **An agent converts a meeting to a project.** Expected: the project is created, the meeting is linked and marked converted, and the agent then sees the project. The new project has no meeting until the link lands, so the link runs as `derived:project-conversion` after the actor's meeting-update reach was checked first; a refused conversion leaves no orphan project. Pinned in Task 3 Step 6 and hand check H3.
3. **A scopes-only project update from someone out of reach.** Expected: NOT_FOUND and no `x_project_scopes` write (the links are written outside the engine, so the reach is probed first). Pinned in Task 2 Step 6.
4. **A media row naming another owner's object.** Expected: `create` with a bucket other than `tpr-media`, or a `pathKey` outside `projects/<projectId>/` (proposal media: `proposals/<proposalId>/`), answers FORBIDDEN; `update` with `pathKey` or `bucket` answers FORBIDDEN; normal uploads, the Drive import and the proposal-media import still pass. Pinned in Task 1 Step 2 (DB-free cases) and hand check H4.
5. **A dispatcher anywhere projects appear.** Expected: the projects list is empty, the edit page shows its error state, `listForProject` and the import picker answer NOT_FOUND, the profile's Projects list is empty, and the Project meeting type is not offered. Pinned in Task 2 Step 9, Task 3 Step 9 and Task 4 Step 6.

---

## File map

| File | Task | Change |
|---|---|---|
| `.superpowers/permissions-probes/part4-checks.cjs` | 1 | create: GET-only per-role probe (git-ignored) |
| `src/shared/modules/media/core/lib/is-owned-object.ts` | 1 | create: `isOwnedObject` |
| `src/shared/modules/projects/media/lib/constants.ts`, `store.ts`, `dal/server/crud.ts` | 1 | bucket + key prefix in the leaf constants; create/update guard |
| `src/shared/modules/proposals/media/lib/constants.ts`, `store.ts`, `dal/server/crud.ts` | 1 | same |
| `src/shared/domains/permissions/rules/agent.ts` | 2 | conditioned read, `cannot update isPublic` |
| `src/shared/modules/projects/core/server-spec.ts` | 2 | `visibility` and `ownerId` condition column dropped |
| `src/shared/modules/projects/core/lib/visibility.ts` → `lib/has-associated-meeting.ts` | 2 | participation helpers deleted |
| `src/shared/dal/server/lib/scope.ts` | 2 | `'Project'` compiled |
| `src/trpc/routers/projects.router/procedures.ts` | 2 | deleted |
| `src/trpc/routers/projects.router/{crud,media,google-drive}.router.ts`, `src/trpc/routers/meetings.router/reads.router.ts` | 2 | procedure bases, probes, `getAll` deleted |
| `src/shared/modules/projects/core/dal/server/{queries,crud}.ts` | 2 | `permit`; scopes-only probe |
| `src/shared/modules/projects/media/{service.ts,server-spec.ts,dal/server/mutations.ts}` | 2 | `permit` probes and filters |
| `src/shared/modules/proposals/media/dal/server/queries.ts` | 2 | `listImportableProjectMedia(ctx, …)` ANDs the proposal-media read reach |
| `src/shared/entities/meetings/dal/server/queries.ts` | 2 | `listMeetingsForProject` probes the project |
| `src/shared/domains/permissions/type-checks/must-not-compile.ts` | 2 | `ownerId` examples move off Project |
| `src/shared/entities/customers/dal/server/pipeline-items.ts` | 3 | projects arm takes the Project reach |
| `src/features/customer-pipelines/dal/server/move-customer-pipeline-item.ts` | 3 | projects branch through the update reach |
| `src/shared/entities/customers/dal/server/get-customer-profile.ts`, `src/trpc/routers/customer-pipelines.router.ts` | 3 | Project reach on the customer's projects |
| `src/shared/entities/meetings/dal/server/crud.ts` | 3 | client-supplied `projectId` probed |
| `src/trpc/routers/projects.router/business.router.ts`, `src/shared/modules/projects/core/schemas/index.ts`, `src/features/customer-pipelines/ui/components/create-project-form.tsx`, `src/shared/domains/permissions/rules/system.ts` | 3 | conversion: reach first, customer from the meeting, `derived:project-conversion` |
| `src/shared/services/accounting.service.ts` | 3 | `SYSTEM_CONTEXT` → `quickbooks` |
| `src/shared/modules/projects/core/constants/actions.ts`, `src/features/records-management/ui/components/projects-records-table.tsx`, `src/app/(frontend)/dashboard/projects/new/page.tsx`, `src/features/project-management/ui/components/form/basic-info-fields.tsx`, `src/features/project-management/ui/views/edit-project-view.tsx`, `src/shared/entities/meetings/components/create-meeting-form.tsx` | 4 | publish gate, New Project, Public switch, Project meeting type |
| tracker, DISTILLED, memory | 5 | record |

**Not in this plan (named so nobody reads them in):** the public portfolio reads (`showroom-display.router.ts`, `features/landing/dal/server/projects.ts`, `get-trade-images.ts`) stay raw `isPublic = true` reads with no actor — public by design; the QuickBooks job's raw project read (`create-qb-records.ts`, a server-derived id); dropping the `projects.ownerId` column (main's lifecycle work, R31 — this plan only stops reading and writing it); caller-supplied `url` on media rows (display only, not the delete path); `duplicate` on media rows; Application (stays legacy); the projects `DOCS.md` migration-status prose.

---

### Task 1: Media rows name only their owner's objects, and the baseline probe

**Files:**
- Create: `.superpowers/permissions-probes/part4-checks.cjs` (git-ignored)
- Create: `src/shared/modules/media/core/lib/is-owned-object.ts`
- Modify: `src/shared/modules/projects/media/lib/constants.ts`, `src/shared/modules/projects/media/store.ts`, `src/shared/modules/projects/media/dal/server/crud.ts`
- Modify: `src/shared/modules/proposals/media/lib/constants.ts`, `src/shared/modules/proposals/media/store.ts`, `src/shared/modules/proposals/media/dal/server/crud.ts`

**Interfaces:**
- Produces: `isOwnedObject(row: { bucket?: string | null, pathKey?: string | null }, owner: { bucket: string, pathKeyPrefix: string }): boolean`; `PROJECT_MEDIA.bucket`, `PROJECT_MEDIA.pathKeyPrefix(projectId: string): string`; `PROPOSAL_MEDIA.bucket`, `PROPOSAL_MEDIA.pathKeyPrefix(proposalId: string): string`; `part4-checks.cjs` (run as `node .superpowers/permissions-probes/part4-checks.cjs`).

- [ ] **Step 1: Write the per-role probe and record the baseline BEFORE any code changes**

`.superpowers/permissions-probes/part4-checks.cjs`:

```js
// Project family reads per role. GET-only (every other method is aborted); prints counts, codes and paths only:
// never an id, a token, a phone or an email.
const { chromium } = require('/home/olis-solutions/olis-v3/nextjs/tri-pros-website/.worktrees/issue-285/node_modules/playwright')
const BASE = 'http://localhost:3003'
const secret = process.env.DEV_LOGIN_SECRET
const q = async (ctx, path, input) => {
  const r = await ctx.request.get(`${BASE}/api/trpc/${path}?input=${encodeURIComponent(JSON.stringify({ json: input }))}`, { timeout: 180000 })
  let b = null
  try { b = await r.json() } catch {}
  return { status: r.status(), data: b?.result?.data?.json, code: b?.error?.json?.data?.code ?? null }
}
;(async () => {
  const browser = await chromium.launch()
  const sign = async (role) => {
    const ctx = await browser.newContext()
    await ctx.route('**/*', r => (['GET', 'HEAD'].includes(r.request().method()) ? r.continue() : r.abort()))
    const page = await ctx.newPage()
    await page.goto(`${BASE}/api/dev/playwright-session?secret=${encodeURIComponent(secret)}&role=${role}&redirect=/`, { waitUntil: 'networkidle', timeout: 180000 })
    await page.close()
    return ctx
  }
  const out = {}
  try {
    const sa = await sign('super-admin')
    const saList = await q(sa, 'projectsRouter.crud.list', { pagination: { limit: 500, offset: 0 } })
    const P = (saList.data?.rows ?? []).find(r => r.hasMeetings)?.id
    const saPipe = await q(sa, 'customerPipelinesRouter.getCustomerPipelineItems', { pipeline: 'projects' })
    const C = (saPipe.data?.rows ?? [])[0]?.id
    out.picked = { project: Boolean(P), projectCustomer: Boolean(C) }
    const probe = async (ctx) => {
      const list = await q(ctx, 'projectsRouter.crud.list', { pagination: { limit: 500, offset: 0 } })
      const rows = list.data?.rows ?? []
      const edit = P ? await q(ctx, 'projectsRouter.crud.getForEdit', { id: P }) : null
      const meetings = P ? await q(ctx, 'meetingsRouter.reads.listForProject', { projectId: P }) : null
      const importable = P ? await q(ctx, 'projectsRouter.media.listImportableProposalMedia', { projectId: P }) : null
      const pipe = await q(ctx, 'customerPipelinesRouter.getCustomerPipelineItems', { pipeline: 'projects' })
      const prof = C ? await q(ctx, 'customerPipelinesRouter.getCustomerProfile', { customerId: C }) : null
      const page = await ctx.newPage()
      await page.goto(`${BASE}/dashboard/projects/new`, { waitUntil: 'domcontentloaded', timeout: 180000 })
      const newPageLandsOn = new URL(page.url()).pathname
      await page.close()
      return {
        list: { status: list.status, code: list.code, total: list.data?.total, rows: rows.length, portfolioOnly: rows.filter(r => !r.hasMeetings).length, public: rows.filter(r => r.isPublic).length },
        edit: edit && { status: edit.status, code: edit.code, found: Boolean(edit.data), media: edit.data?.media?.length ?? null },
        meetingsOfProject: meetings && { status: meetings.status, code: meetings.code, count: Array.isArray(meetings.data) ? meetings.data.length : null },
        importable: importable && { status: importable.status, code: importable.code, groups: Array.isArray(importable.data) ? importable.data.length : null },
        projectsPipeline: { status: pipe.status, code: pipe.code, rows: (pipe.data?.rows ?? []).length },
        profileProjects: prof && { status: prof.status, code: prof.code, projects: prof.data?.projects?.length ?? null },
        newPageLandsOn,
      }
    }
    out['super-admin'] = await probe(sa)
    await sa.close()
    for (const role of ['agent', 'dispatcher']) {
      const ctx = await sign(role)
      out[role] = await probe(ctx)
      await ctx.close()
    }
  }
  finally {
    await browser.close()
  }
  console.log(JSON.stringify(out, null, 1))
})().catch((e) => { console.log('FAILED', String(e).slice(0, 300)); process.exit(1) })
```

Run:

```bash
export DEV_LOGIN_SECRET="$(sed -n 's/^DEV_LOGIN_SECRET=//p' /home/olis-solutions/olis-v3/nextjs/tri-pros-website/.env.local | tr -d '"')"
node .superpowers/permissions-probes/part4-checks.cjs | tee .superpowers/permissions-probes/part4-baseline.txt
```

Expected: JSON with `picked.project: true` and `picked.projectCustomer: true`. The baseline shows today's holes: the dispatcher's and agent's `edit.found` is `true` (S4). Keep the file; Tasks 2, 3 and 5 compare against it. If the dev server is not answering on 3003, stop and report: do not start or restart it.

- [ ] **Step 2: Write the helper and check it database-free**

`src/shared/modules/media/core/lib/is-owned-object.ts`:

```ts
interface StoredObject {
  bucket?: string | null
  pathKey?: string | null
}

/**
 * Deleting a media row deletes the object it names, so a row may only name an object under its own
 * owner's key. A row with no object at all (a Stream video) names nothing.
 */
export function isOwnedObject(row: StoredObject, owner: { bucket: string, pathKeyPrefix: string }): boolean {
  if (row.bucket == null && row.pathKey == null) {
    return true
  }
  return row.bucket === owner.bucket && row.pathKey != null && row.pathKey.startsWith(owner.pathKeyPrefix)
}
```

Create `.superpowers/permissions-probes/owned-object.ts`:

```ts
import { isOwnedObject } from '@/shared/modules/media/core/lib/is-owned-object'

const owner = { bucket: 'tpr-media', pathKeyPrefix: 'projects/p1/' }
const cases: [string, Parameters<typeof isOwnedObject>[0], boolean][] = [
  ['own upload', { bucket: 'tpr-media', pathKey: 'projects/p1/before/a.jpg' }, true],
  ['no object', { bucket: null, pathKey: null }, true],
  ['other project', { bucket: 'tpr-media', pathKey: 'projects/p2/before/a.jpg' }, false],
  ['prefix without slash boundary', { bucket: 'tpr-media', pathKey: 'projects/p10/a.jpg' }, false],
  ['proposal object', { bucket: 'tpr-media', pathKey: 'proposals/x/a.jpg' }, false],
  ['other bucket', { bucket: 'tpr-homeowner-files', pathKey: 'projects/p1/a.mp3' }, false],
  ['bucket without key', { bucket: 'tpr-media', pathKey: null }, false],
  ['key without bucket', { bucket: null, pathKey: 'projects/p1/a.jpg' }, false],
]
let failed = 0
for (const [label, row, expected] of cases) {
  const got = isOwnedObject(row, owner)
  if (got !== expected) {
    failed++
  }
  console.log(`${got === expected ? 'PASS' : 'FAIL'} ${label}: ${got}`)
}
console.log(`${cases.length - failed}/${cases.length}`)
process.exit(failed ? 1 : 0)
```

Run: `NODE_OPTIONS="--conditions=react-server" node_modules/.bin/tsx --tsconfig tsconfig.json .superpowers/permissions-probes/owned-object.ts`
Expected: `8/8`.

- [ ] **Step 3: Move bucket and key prefix into the leaf constants**

`src/shared/modules/projects/media/lib/constants.ts` — replace the `PROJECT_MEDIA` object (keep `PROJECT_MEDIA_FILE` and the comment above `PROJECT_MEDIA`):

```ts
import { R2_BUCKETS } from '@/shared/services/providers/r2/types'

// …PROJECT_MEDIA_FILE and its comment unchanged…

export const PROJECT_MEDIA = {
  ownerKind: 'project',
  variants: ['sm', 'md', 'lg'],
  bucket: R2_BUCKETS.media,
  pathKeyPrefix: (projectId: string) => `projects/${projectId}/`,
} as const
```

`src/shared/modules/projects/media/store.ts`: drop the `R2_BUCKETS` import and use the constants:

```ts
  bucket: PROJECT_MEDIA.bucket,
  // …crud getter unchanged…
  buildPathKey: (ownerId, fileId, ext, extra) => `${PROJECT_MEDIA.pathKeyPrefix(ownerId)}${extra?.phase ?? 'uncategorized'}/${fileId}${ext}`,
```

`src/shared/modules/proposals/media/lib/constants.ts`:

```ts
import { R2_BUCKETS } from '@/shared/services/providers/r2/types'

// …PROPOSAL_MEDIA_FILE and comments unchanged…

export const PROPOSAL_MEDIA = {
  ownerKind: 'proposal',
  variants: ['xs', 'sm', 'md', 'lg'],
  bucket: R2_BUCKETS.media,
  pathKeyPrefix: (proposalId: string) => `proposals/${proposalId}/`,
} as const
```

`src/shared/modules/proposals/media/store.ts`: drop the `R2_BUCKETS` import;

```ts
  bucket: PROPOSAL_MEDIA.bucket,
  // …
  buildPathKey: (ownerId, fileId, ext) => `${PROPOSAL_MEDIA.pathKeyPrefix(ownerId)}${fileId}${ext}`,
```

`R2_BUCKETS` comes from a types module with no imports of its own, so the leaf constants stay leaves (the stores and the CRUD hooks both read them; neither imports the other).

- [ ] **Step 4: Guard create and update in both media CRUDs**

`src/shared/modules/projects/media/dal/server/crud.ts` — add imports `isOwnedObject` (`@/shared/modules/media/core/lib/is-owned-object`) and `ThrowableDalError` (`@/shared/dal/server/types`), then extend the hooks:

```ts
export const projectMediaCrud = createCrudDal(projectMediaServerSpec, () => ({
  hooks: {
    create: {
      // Deleting the row deletes the object it names; see isOwnedObject.
      before(input) {
        if (!isOwnedObject(input, { bucket: PROJECT_MEDIA.bucket, pathKeyPrefix: PROJECT_MEDIA.pathKeyPrefix(input.projectId) })) {
          throw new ThrowableDalError({ type: 'forbidden' })
        }
        return input
      },
      after(row: ProjectMediaFile) {
        // …unchanged…
      },
    },
    update: {
      // An object is chosen once, at upload; nothing re-points a row afterwards.
      before(data) {
        if (data.bucket !== undefined || data.pathKey !== undefined) {
          throw new ThrowableDalError({ type: 'forbidden' })
        }
        return data
      },
    },
    delete: {
      // …unchanged…
    },
  },
}))
```

`src/shared/modules/proposals/media/dal/server/crud.ts` — the same two hooks, with `PROPOSAL_MEDIA` and `input.proposalId`:

```ts
    create: {
      // Deleting the row deletes the object it names; see isOwnedObject.
      before(input) {
        if (!isOwnedObject(input, { bucket: PROPOSAL_MEDIA.bucket, pathKeyPrefix: PROPOSAL_MEDIA.pathKeyPrefix(input.proposalId) })) {
          throw new ThrowableDalError({ type: 'forbidden' })
        }
        return input
      },
      after(row: ProposalMediaFile) {
        // …unchanged…
      },
    },
    update: {
      // An object is chosen once, at upload; nothing re-points a row afterwards.
      before(data) {
        if (data.bucket !== undefined || data.pathKey !== undefined) {
          throw new ThrowableDalError({ type: 'forbidden' })
        }
        return data
      },
    },
```

Check that no existing caller updates `bucket` or `pathKey` through a media CRUD: `grep -rn "pathKey\|bucket" src/trpc/routers/proposals.router/media.router.ts src/trpc/routers/projects.router/media.router.ts src/shared/modules/*/media/service.ts`. The only writers are `create` paths (upload, Drive import, proposal-media import) and those build the key under the owner's prefix. If an `update` call site sends either column, stop and report.

- [ ] **Step 5: Verify**

Run: `pnpm tsc && pnpm lint`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/shared/modules/media/core/lib/is-owned-object.ts src/shared/modules/projects/media/lib/constants.ts src/shared/modules/projects/media/store.ts src/shared/modules/projects/media/dal/server/crud.ts src/shared/modules/proposals/media/lib/constants.ts src/shared/modules/proposals/media/store.ts src/shared/modules/proposals/media/dal/server/crud.ts
git commit -m "fix(media): a media row names only an object under its owner's key

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
git push -q origin HEAD
```

---

### Task 2: Project and its media on compiled rules

**Files:**
- Modify: `src/shared/domains/permissions/rules/agent.ts`
- Modify: `src/shared/modules/projects/core/server-spec.ts`
- Rename: `src/shared/modules/projects/core/lib/visibility.ts` → `src/shared/modules/projects/core/lib/has-associated-meeting.ts`
- Modify: `src/shared/modules/projects/core/dal/server/project-field-sql.ts`, `src/shared/modules/projects/core/lib/portfolio.ts` (comment)
- Modify: `src/shared/dal/server/lib/scope.ts`
- Delete: `src/trpc/routers/projects.router/procedures.ts`
- Modify: `src/trpc/routers/projects.router/crud.router.ts`, `media.router.ts`, `google-drive.router.ts`
- Modify: `src/trpc/routers/meetings.router/reads.router.ts`
- Modify: `src/shared/modules/projects/core/dal/server/queries.ts`, `crud.ts`
- Modify: `src/shared/modules/projects/media/service.ts`, `server-spec.ts`, `dal/server/mutations.ts`, `dal/server/crud.ts` (comment only)
- Modify: `src/shared/modules/proposals/media/dal/server/queries.ts`
- Modify: `src/shared/entities/meetings/dal/server/queries.ts`
- Modify: `src/shared/domains/permissions/type-checks/must-not-compile.ts`
- Create: `.superpowers/permissions-probes/project-rules.ts` (git-ignored)

**Interfaces:**
- Consumes: `permit(ctx, action, spec, fields?)` → `{ sql, probe, test }` (`@/shared/dal/server/lib/permissions/permit`); `projectServerSpec`, `projectMediaServerSpec`, `proposalMediaServerSpec`.
- Produces: `getProjectForEdit(ctx: ScopedContext, projectId: string): Promise<DalReturn<ProjectForEdit | null>>`; `listImportableProjectMedia(ctx: ScopedContext, projectId: string, ids?: number[]): Promise<ImportableProjectMediaRow[]>`; `hasAssociatedMeeting()` from `lib/has-associated-meeting.ts`; `projectProcedure` and `getAllProjects` no longer exist.

- [ ] **Step 1: Move the `ownerId` examples off Project in the wrong-on-purpose file (they fail as soon as `ownerId` stops being a condition column)**

In `must-not-compile.ts`:

1. Declarations: replace `declare const optionalConditions: { ownerId?: string }` with `declare const optionalConditions: { id?: string }`, and delete `declare const maybeConditions: { ownerId: string } | undefined`.
2. In `rulesThatMustCompile`: delete `can('read', 'Project', { ownerId: userId })`; after `can('read', 'Project', { $participatesViaMeeting: { via: 'projectId', userId } })` add `cannot('update', 'Project', ['isPublic'])`.
3. In the must-not-compile block, replace these lines (keep each `@ts-expect-error` comment text):

```ts
  // @ts-expect-error a condition value that may be undefined
  can('read', 'Proposal', { id: maybeUserId })
  // @ts-expect-error a condition value that is undefined
  can('read', 'Proposal', { id: undefined })
  // @ts-expect-error conditions whose key may be absent
  can('read', 'Proposal', optionalConditions)
```

```ts
  // @ts-expect-error conditions that may be undefined
  can('read', 'Proposal', maybeProposalConditions)
```

```ts
  // @ts-expect-error an empty conditions object: a rule without conditions is written without the argument
  can('read', 'Proposal', {})
  // @ts-expect-error an empty conditions object held in a variable
  can('read', 'Proposal', emptyConditions)
```

and add, next to the other condition-column lines:

```ts
  // @ts-expect-error projects have no owner: ownerId is not a condition column
  can('update', 'Project', { ownerId: userId })
```

- [ ] **Step 2: Rules and spec**

`rules/agent.ts` — replace the three Project lines:

```ts
    // A project is reached through the meetings on it; the row filter and the UI read this one rule.
    can('read', 'Project', { $participatesViaMeeting: { via: 'projectId', userId } })
    can('create', 'Project')
    can('update', 'Project')
    // Publishing puts a customer's job on the public site: the office decides.
    cannot('update', 'Project', ['isPublic'])
```

`defineRules((can) => …)` in that file must become `defineRules((can, cannot) => …)`.

`src/shared/modules/projects/core/server-spec.ts` — whole file:

```ts
import { defineEntitySpec } from '@/shared/dal/server/lib/define-spec'
import {
  insertProjectSchema,
  projects,
  selectProjectSchema,
} from '@/shared/db/schema'
import { PROJECT } from '@/shared/modules/projects/core/lib/constants'

// `scopeIds` is not a `projects` column: it rides beside the row through `create/updateProjectWithScopes`.
const updateProjectSchema = insertProjectSchema.partial()

/** Concrete schemas for `createCrudRouter` type inference (spec carries type-erased copies). */
export const projectSchemas = {
  insert: insertProjectSchema,
  update: updateProjectSchema,
}

export const projectServerSpec = defineEntitySpec({
  entityName: PROJECT,
  subject: PROJECT,
  conditionColumns: [],
  table: projects,
  schemas: {
    insert: insertProjectSchema,
    update: updateProjectSchema,
    select: selectProjectSchema,
  },
})
```

`scope.ts`: `COMPILED_SUBJECTS` = `['Customer', 'CustomerNote', 'Meeting', 'Proposal', 'Project']`.

`git mv src/shared/modules/projects/core/lib/visibility.ts src/shared/modules/projects/core/lib/has-associated-meeting.ts`, then delete `projectParticipationScope`, `projectVisibility` and their imports from the moved file, keeping `hasAssociatedMeeting` and its comment. Point `project-field-sql.ts` and `queries.ts` at the new path, and change the `./visibility.ts` mention in `lib/portfolio.ts`'s comment to `./has-associated-meeting.ts`.

- [ ] **Step 3: The project readers**

`src/shared/modules/projects/core/dal/server/queries.ts`:

- `listProjects`: replace `ctx.scope ?? undefined,` with `permit(ctx, 'read', projectServerSpec).sql,`.
- Delete `getAllProjects` (no caller once `crud.getAll` goes).
- Replace `getProjectForEdit`:

```ts
export async function getProjectForEdit(ctx: ScopedContext, projectId: string): Promise<DalReturn<ProjectForEdit | null>> {
  return dalDbOperation(async () => {
    const project = dalVerifySuccess(await projectCrud.getById(ctx, { id: projectId }))
    if (!project) {
      return null
    }
    const [scopeRows, media] = await Promise.all([
      db
        .select({ scopeId: x_projectScopes.scopeId })
        .from(x_projectScopes)
        .where(eq(x_projectScopes.projectId, projectId)),
      db
        .select()
        .from(projectMediaFiles)
        .where(and(eq(projectMediaFiles.projectId, projectId), permit(ctx, 'read', projectMediaServerSpec).sql))
        .orderBy(projectMediaFiles.sortOrder, projectMediaFiles.createdAt),
    ])
    return { project, scopeIds: scopeRows.map(r => r.scopeId), media }
  })
}
```

Imports to add: `permit`, `dalVerifySuccess` (`@/shared/dal/server/lib/helpers`), `projectCrud` (`./crud`), `projectServerSpec`, `projectMediaServerSpec`. `crud.ts` does not import `queries.ts`, so there is no cycle; if `pnpm tsc` or lint reports one, stop and report.

- [ ] **Step 4: The projects router**

`crud.router.ts` — whole router:

```ts
export const crudRouter = createTRPCRouter({
  list: agentProcedure
    .input(projectListInputSchema)
    .query(async ({ ctx, input }) => dalToTrpc(await listProjects(ctx, input))),

  getForEdit: agentProcedure
    .input(z.object({ id: z.string().uuid() }))
    .query(async ({ ctx, input }) => dalToTrpc(await getProjectForEdit(ctx, input.id))),

  // The portfolio editor: a project with no meeting is reached by nobody but whoever publishes.
  create: superAdminProcedure
    .input(projectFormSchema)
    .mutation(async ({ ctx, input }) => {
      const { scopeIds, ...projectData } = input
      return dalToTrpc(await createProjectWithScopes(ctx, projectData, scopeIds ?? []))
    }),

  update: agentProcedure
    .input(z.object({
      id: z.string().uuid(),
      data: projectFormSchema.partial(),
    }))
    .mutation(async ({ ctx, input }) => {
      const { scopeIds, ...projectData } = input.data
      const project = dalToTrpc(await updateProjectWithScopes(ctx, input.id, projectData, scopeIds))
      // The public story page is prerendered; without this, edits only appear after the next deploy.
      revalidatePath(`/portfolio/projects/${project.accessor}`)
      return project
    }),

  delete: agentProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      dalToTrpc(await projectCrud.delete(ctx, { id: input.id }))
      return { success: true }
    }),
})
```

Imports: `superAdminProcedure` from `../../init`; drop `getAllProjects` and `./procedures`. Delete `src/trpc/routers/projects.router/procedures.ts`. In `meetings.router/reads.router.ts`, `listForProject` becomes `agentProcedure` and its comment reads `// Scoped by the project, not the meeting: whoever reaches the project sees every meeting on it.`; drop the `projectProcedure` import.

`google-drive.router.ts` `uploadFromFile` — first lines of the mutation, before the token read:

```ts
      // Nothing is downloaded or stored for a project out of reach.
      if (!(await permit(ctx, 'update', projectServerSpec, ['media']).probe(input.projectId))) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Project not found' })
      }
```

`media.router.ts` `listImportableProposalMedia`:

```ts
  listImportableProposalMedia: agentProcedure
    .input(z.object({ projectId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      // The picker is the import's first half, so it asks what the import asks.
      if (!(await permit(ctx, 'update', projectServerSpec, ['media']).probe(input.projectId))) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Project not found' })
      }
      const rows = await listImportableProjectMedia(ctx, input.projectId)
      // …the rest unchanged…
```

(`TRPCError` from `@trpc/server`; `permit`; `projectServerSpec`.)

- [ ] **Step 5: The proposal-media import source**

`src/shared/modules/proposals/media/dal/server/queries.ts` — `listImportableProjectMedia` takes the context first and only returns media the actor reads through the proposal reach:

```ts
/**
 * Image rows on proposals belonging to THIS project's meetings that the actor can read — the import
 * picker's source set. Pass `ids` to restrict to a chosen subset (the actual import call).
 */
export async function listImportableProjectMedia(
  ctx: ScopedContext,
  projectId: string,
  ids?: number[],
): Promise<ImportableProjectMediaRow[]> {
  return db
    .select({ /* …unchanged… */ })
    .from(proposalMediaFiles)
    .innerJoin(proposals, eq(proposals.id, proposalMediaFiles.proposalId))
    .innerJoin(meetings, eq(meetings.id, proposals.meetingId))
    .where(and(
      eq(meetings.projectId, projectId),
      like(proposalMediaFiles.mimeType, 'image/%'),
      ids && ids.length > 0 ? inArray(proposalMediaFiles.id, ids) : undefined,
      permit(ctx, 'read', proposalMediaServerSpec).sql,
    ))
}
```

- [ ] **Step 6: Project writes and project media**

`src/shared/modules/projects/core/dal/server/crud.ts`:

- In `updateProjectWithScopes`, the scopes-only branch probes first:

```ts
  if (!hasData && scopeIds !== undefined) {
    // The scope links are written outside the engine, so the update reach is checked here first.
    if (!(await permit(ctx, 'update', projectServerSpec).probe(id))) {
      return { success: false, error: { type: 'not-found' } }
    }
    await setProjectScopes(id, scopeIds)
    // …rest unchanged…
```

- In the `delete.before` comment, replace the paragraph about `ctx.scope` with: `// No row filter: the purge must reach every object the project owns, and the engine already checked the delete reach on the project.` Delete the "Sub-plan D …" sentence of the `projectCrud` doc comment and the "G2 / §5.11", "G7" citations in the two helpers' comments (keep the reasons they give).

`src/shared/modules/projects/media/dal/server/mutations.ts`: replace both `ctx.scope ?? undefined` (three occurrences) with `permit(ctx, 'update', projectMediaServerSpec).sql`; replace the file's top comment with `// Bulk writes on project media that are not single-row CRUD slots: a phase move and the one-hero rule.`.

`src/shared/modules/projects/media/service.ts`:
- Delete the `NOTE (D4)` paragraph of the header comment.
- `buildUploadTarget(ctx, input)`:

```ts
    return dalDbOperation(async () => {
      if (!(await permit(ctx, 'update', projectServerSpec, ['media']).probe(input.projectId))) {
        throw new ThrowableDalError({ type: 'not-found' })
      }
      return mediaService.buildUploadTarget(projectMediaStore, {
        ownerId: input.projectId,
        filename: input.filename,
        mimeType: input.mimeType,
        extra: { phase: input.phase },
      })
    })
```

- `list`: probe `permit(ctx, 'read', projectServerSpec).probe(input.projectId)` (not-found on a miss), then `mediaService.list(projectMediaStore, permit(ctx, 'read', projectMediaServerSpec).sql, input.projectId)`.
- `reorder`: `mediaService.reorder(projectMediaStore, permit(ctx, 'update', projectMediaServerSpec).sql, input.updates)`.
- `retryOptimization`: replace the `getById` read with `if (!(await permit(ctx, 'update', projectMediaServerSpec).probe(input.id))) throw new ThrowableDalError({ type: 'not-found' })`.
- `importFromProposal`: first line inside `dalDbOperation` probes `permit(ctx, 'update', projectServerSpec, ['media']).probe(input.projectId)` (not-found on a miss); then `listImportableProjectMedia(ctx, input.projectId, input.proposalMediaFileIds)`. Rewrite its doc comment: `Copy proposal media onto this project. The actor must be able to change the project's media, and only media they read on proposals of this project's meetings is copied.`
- Delete the now-false comment above `buildUploadTarget` ("nothing to scope here yet (D4)…").

`src/shared/modules/projects/media/server-spec.ts`: replace the doc comment with: `/** \`media_files\` (project media): the field \`media\` of \`Project\`. Reading it needs the project's read reach; writing it, the project's \`update\` of \`media\`. Its hooks live on \`createCrudDal\` in \`dal/server/crud.ts\`. */`. In `dal/server/crud.ts` delete the closing "See ../../server-spec.ts: the project-media router still passes an unscoped ctx…" paragraph (keep "Serial int PK." if it carries meaning elsewhere — it does not; delete it too).

- [ ] **Step 7: The project's meetings**

`src/shared/entities/meetings/dal/server/queries.ts`:

```ts
/** A project's sales history: whoever reaches the project sees every meeting on it. */
export async function listMeetingsForProject(
  ctx: ScopedContext,
  input: { projectId: string },
): Promise<DalReturn<CustomerProfileMeeting[]>> {
  return dalDbOperation(async () => {
    if (!(await permit(ctx, 'read', projectServerSpec).probe(input.projectId))) {
      throw new ThrowableDalError({ type: 'not-found' })
    }
    const { meetings: rows } = await getMeetingsWithProposals(ctx, eq(meetings.projectId, input.projectId))
    return rows
  })
}
```

Drop imports this leaves unused (`projects`, `exists` if no other reader in the file uses them).

- [ ] **Step 8: Verify types, lint and the greps**

Run: `pnpm tsc && pnpm lint`
Expected: PASS. An unused `@ts-expect-error` in `must-not-compile.ts` means a moved example stopped erroring: report it, do not delete the line.

Run: `grep -rn "projectProcedure\|projectVisibility\|projectParticipationScope\|getAllProjects\|projects/core/lib/visibility" src`
Expected: no output.

Run: `grep -rn "ctx.scope\|scope: null" src/shared/modules/projects src/trpc/routers/projects.router`
Expected: no output.

- [ ] **Step 9: The DB-free rules probe and the per-role probe**

`.superpowers/permissions-probes/project-rules.ts`:

```ts
import type { UserRole } from '@/shared/constants/enums'
import type { ScopedContext } from '@/shared/dal/server/types'

import { PgDialect } from 'drizzle-orm/pg-core'

import { assertRulesCompile } from '@/shared/dal/server/lib/permissions/check-rules'
import { permit } from '@/shared/dal/server/lib/permissions/permit'
import { COMPILED_SUBJECTS } from '@/shared/dal/server/lib/scope'
import { defineAbilitiesFor } from '@/shared/domains/permissions/abilities'
import { projectServerSpec } from '@/shared/modules/projects/core/server-spec'
import { projectMediaServerSpec } from '@/shared/modules/projects/media/server-spec'

const USER = '11111111-1111-4111-8111-111111111111'
const dialect = new PgDialect()
const render = (s: ReturnType<typeof permit>['sql']) => dialect.sqlToQuery(s).sql.replace(/\s+/g, ' ')
const ctxFor = (role: UserRole): ScopedContext => ({ actor: { ability: defineAbilitiesFor({ id: USER, role }), userId: USER }, scope: null })

assertRulesCompile()
console.log(`COMPILED_SUBJECTS = [${[...COMPILED_SUBJECTS].join(', ')}]`)
for (const role of ['super-admin', 'agent', 'dispatcher'] as UserRole[]) {
  const ctx = ctxFor(role)
  const ab = ctx.actor.ability
  console.log(`\n── ${role}`)
  console.log({
    readProject: ab.can('read', 'Project'),
    createProject: ab.can('create', 'Project'),
    updateProject: ab.can('update', 'Project'),
    deleteProject: ab.can('delete', 'Project'),
    publish: ab.can('update', 'Project', 'isPublic'),
    updateMedia: ab.can('update', 'Project', 'media'),
    testUpdateTitle: permit(ctx, 'update', projectServerSpec, ['title']).test({ id: 'p' }),
    testUpdateIsPublic: permit(ctx, 'update', projectServerSpec, ['isPublic']).test({ id: 'p' }),
  })
  console.log('read project   :', render(permit(ctx, 'read', projectServerSpec).sql))
  console.log('update project :', render(permit(ctx, 'update', projectServerSpec).sql))
  console.log('read media     :', render(permit(ctx, 'read', projectMediaServerSpec).sql))
  console.log('update media   :', render(permit(ctx, 'update', projectMediaServerSpec).sql))
}
```

Run: `NODE_OPTIONS="--conditions=react-server" node_modules/.bin/tsx --tsconfig tsconfig.json .superpowers/permissions-probes/project-rules.ts`
Expected: `COMPILED_SUBJECTS` lists `Project`. super-admin: every flag `true`, every SQL `true`. agent: `readProject`, `createProject`, `updateProject`, `updateMedia`, `testUpdateTitle` true; `deleteProject`, `publish`, `testUpdateIsPublic` false; read and update SQL are an `exists (select … from "meetings" inner join "meeting_participants" … where ("meetings"."project_id" = "projects"."id" and "meeting_participants"."user_id" = $n))`; media SQL is `"project_id" in (select "id" from "projects" where exists (…))`. dispatcher: every flag false, every SQL `false`. Also re-run `owned-object.ts` (8/8).

Run: `node .superpowers/permissions-probes/part4-checks.cjs` (with `DEV_LOGIN_SECRET` exported).
Expected, against `part4-baseline.txt`: super-admin's `list`, `edit`, `meetingsOfProject`, `importable` unchanged; dispatcher and agent fixture (who sits in no meeting): `list.total` 0, `edit.found` false, `meetingsOfProject.code` `NOT_FOUND`, `importable.code` `NOT_FOUND`. The pipeline, profile and `newPageLandsOn` lines change in Tasks 3 and 4, not here.

- [ ] **Step 10: Commit**

```bash
git add -A src/shared/modules/projects/core/lib src/trpc/routers/projects.router
git add src/shared/domains/permissions/rules/agent.ts src/shared/modules/projects/core/server-spec.ts src/shared/modules/projects/core/dal/server/project-field-sql.ts src/shared/modules/projects/core/dal/server/queries.ts src/shared/modules/projects/core/dal/server/crud.ts src/shared/dal/server/lib/scope.ts src/trpc/routers/meetings.router/reads.router.ts src/shared/modules/projects/media/service.ts src/shared/modules/projects/media/server-spec.ts src/shared/modules/projects/media/dal/server/mutations.ts src/shared/modules/projects/media/dal/server/crud.ts src/shared/modules/proposals/media/dal/server/queries.ts src/shared/entities/meetings/dal/server/queries.ts src/shared/domains/permissions/type-checks/must-not-compile.ts
git status --short   # only the paths above (plus CLAUDE.local.md untracked) may appear staged
git commit -m "refactor(permissions): the Project family runs on compiled rules

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
git push -q origin HEAD
```

(`git add -A <dir>` is scoped to the two directories that hold the rename and the deleted file.)

---

### Task 3: Cross-module project readers and writers

**Files:**
- Modify: `src/shared/entities/customers/dal/server/pipeline-items.ts`
- Modify: `src/features/customer-pipelines/dal/server/move-customer-pipeline-item.ts`
- Modify: `src/shared/entities/customers/dal/server/get-customer-profile.ts`
- Modify: `src/trpc/routers/customer-pipelines.router.ts`
- Modify: `src/shared/entities/meetings/dal/server/crud.ts`
- Modify: `src/shared/domains/permissions/rules/system.ts`
- Modify: `src/trpc/routers/projects.router/business.router.ts`, `src/shared/modules/projects/core/schemas/index.ts`, `src/features/customer-pipelines/ui/components/create-project-form.tsx`
- Modify: `src/shared/services/accounting.service.ts`

**Interfaces:**
- Consumes: `projectServerSpec`, `projectCrud`, `permit`, `systemContext(reason)` (`@/shared/dal/server/lib/contexts`).
- Produces: `SystemReason` gains `'derived:project-conversion'`; `createProjectFormSchema` loses `customerId`.

- [ ] **Step 1: The projects kanban arm**

`pipeline-items.ts`:
- `PipelineBranchArgs`: delete `userId` and `isOmni` (their only reader is the projects arm); add

```ts
  /** The Project read reach, for the projects arm. */
  projectReach: SQL
```

- In `getCustomerPipelineItems`: delete the `userId` and `isOmni` lines; add `projectReach: permit(ctx, 'read', projectServerSpec).sql,`.
- In `getProjectsPipelineItems`'s `where`:

```ts
    .where(and(
      isNotNull(projects.customerId),
      args.projectReach,
      args.customerWhere,
    ))
```

Run `grep -n "isOmni\|args.userId" src/shared/entities/customers/dal/server/pipeline-items.ts` — expected no output. Drop `sql` from the drizzle import only if nothing else in the file uses it.

- [ ] **Step 2: Dragging a project's stage**

`move-customer-pipeline-item.ts`, the projects branch:

```ts
  // Projects pipeline: the card shows the customer's newest project, so that is the one the drag moves.
  if (pipeline === 'projects') {
    const [project] = await db
      .select({ id: projects.id })
      .from(projects)
      .where(and(eq(projects.customerId, customerId), permit(ctx, 'update', projectServerSpec).sql))
      .orderBy(desc(projects.createdAt))
      .limit(1)

    if (!project) {
      throw new TRPCError({
        code: 'NOT_FOUND',
        message: 'No project found for this customer',
      })
    }

    dalVerifySuccess(await projectCrud.update(ctx, { id: project.id, data: { pipelineStage: toStage } }))
    return
  }
```

Imports: `desc` from drizzle, `projectCrud` (`@/shared/modules/projects/core/dal/server/crud`), `projectServerSpec`.

- [ ] **Step 3: A customer's projects**

`get-customer-profile.ts`, the projects read: `.where(and(eq(projects.customerId, customerId), permit(ctx, 'read', projectServerSpec).sql))`.

`customer-pipelines.router.ts` `getCustomerProjects`: same `where`. Rewrite the comment above `assignToProject`'s update to: `// The meeting update checks the project's read reach, so a meeting is tied only to a project the actor already reaches.`

- [ ] **Step 4: A meeting's client-supplied project**

`src/shared/entities/meetings/dal/server/crud.ts`:

`create.before`, after the customer probe:

```ts
        if (userId !== null && input.projectId && !(await permit(ctx, 'read', projectServerSpec).probe(input.projectId))) {
          throw new ThrowableDalError({ type: 'not-found' })
        }
```

and change the comment above the two probes to `// Client-supplied customer and project ids are checked against the creator's reach: booking a meeting must never be the way to reach either. Server-derived creates have no user and skip it.`

`update.before`, after the customer probe:

```ts
        if (ctx.actor.userId !== null && data.projectId && !(await permit(ctx, 'read', projectServerSpec).probe(data.projectId))) {
          throw new ThrowableDalError({ type: 'not-found' })
        }
```

Import `projectServerSpec` from `@/shared/modules/projects/core/server-spec`.

- [ ] **Step 5: The system reason**

`rules/system.ts`, append to the union: `| 'derived:project-conversion'`.

- [ ] **Step 6: Converting a meeting to a project**

`createProjectFormSchema` (`schemas/index.ts`): delete the `customerId` line. `create-project-form.tsx`: delete `customerId,` from the `createMutation.mutate({...})` payload (the component keeps its `customerId` prop for its reads and invalidations).

`business.router.ts` — whole mutation:

```ts
export const businessRouter = createTRPCRouter({
  create: agentProcedure
    .input(createProjectFormSchema)
    .mutation(async ({ ctx, input }) => {
      // Converting writes the meeting, so the actor must be able to tie it to a project before anything is created.
      if (!(await permit(ctx, 'update', meetingServerSpec, ['projectId', 'meetingOutcome']).probe(input.meetingId))) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Meeting not found' })
      }
      const meeting = dalVerifySuccess(await meetingCrud.getById(ctx, { id: input.meetingId }))
      if (!meeting?.customerId) {
        throw new TRPCError({ code: 'BAD_REQUEST', message: 'The meeting has no customer' })
      }

      const meetingProposals = dalVerifySuccess(await getProposalsByMeetingId(ctx, input.meetingId))
      if (meetingProposals.length === 0) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Cannot create a project without at least one proposal on the meeting',
        })
      }

      const customer = dalVerifySuccess(await customerCrud.getById(ctx, { id: meeting.customerId }))
      if (!customer) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Customer not found' })
      }

      const slug = input.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
      const accessor = `${slug}-${Math.random().toString(36).slice(2, 8)}`

      // The address is the install site at contract time, so it is copied, not linked.
      const project = dalVerifySuccess(await projectCrud.create(ctx, {
        title: input.title,
        accessor,
        customerId: meeting.customerId,
        address: customer.address,
        city: customer.city,
        state: customer.state ?? 'CA',
        zip: customer.zip,
        description: input.description,
        projectDuration: input.projectDuration,
        pipelineStage: 'signed',
        isPublic: false,
      }))

      // Through meetingCrud so the calendar sync and refresh hooks fire. The new project has no meeting until this
      // write lands, so the actor cannot reach it yet; their right to make the link was checked above.
      dalVerifySuccess(await meetingCrud.update(systemContext('derived:project-conversion'), {
        id: input.meetingId,
        data: { projectId: project.id, meetingOutcome: 'converted_to_project' },
      }))

      await setProjectScopes(project.id, extractScopeIdsFromProposals(meetingProposals))

      return project
    }),
})
```

`ownerId` is no longer written: projects have no owner, and a set `ownerId` would delete the project when that user is deleted (the column cascades). Imports: `permit`, `systemContext`, `meetingServerSpec` (`@/shared/entities/meetings/lib/server-spec`).

- [ ] **Step 7: QuickBooks**

`accounting.service.ts`: the three `projectCrud` calls pass `quickbooks` (the `systemContext('sync:quickbooks')` already built at the top of `createAccountingService`) instead of `SYSTEM_CONTEXT`; drop the `SYSTEM_CONTEXT` import if nothing else in the file uses it.

- [ ] **Step 8: Verify**

Run: `pnpm tsc && pnpm lint`
Expected: PASS.

Run: `grep -rn "ownerId" src/shared/entities/customers/dal/server/pipeline-items.ts src/trpc/routers/projects.router src/shared/modules/projects/core | grep -iv "meetings\.\|meeting\b\|ownerId: input\|buildPathKey\|DOCS.md"`
Expected: no line that reads or writes `projects.ownerId`.

- [ ] **Step 9: Per-role probe**

Run: `node .superpowers/permissions-probes/part4-checks.cjs`
Expected, against the baseline: super-admin's `projectsPipeline.rows` and `profileProjects.projects` unchanged; dispatcher `projectsPipeline.code` `FORBIDDEN` (unchanged) and `profileProjects.projects` 0 (the dispatcher reaches the customer, not their projects); agent fixture `projectsPipeline.rows` 0 and `profileProjects.code` `NOT_FOUND` (the customer is out of reach).

- [ ] **Step 10: Commit**

```bash
git add src/shared/entities/customers/dal/server/pipeline-items.ts src/features/customer-pipelines/dal/server/move-customer-pipeline-item.ts src/shared/entities/customers/dal/server/get-customer-profile.ts src/trpc/routers/customer-pipelines.router.ts src/shared/entities/meetings/dal/server/crud.ts src/shared/domains/permissions/rules/system.ts src/trpc/routers/projects.router/business.router.ts src/shared/modules/projects/core/schemas/index.ts src/features/customer-pipelines/ui/components/create-project-form.tsx src/shared/services/accounting.service.ts
git commit -m "refactor(permissions): every project reader and writer outside the module takes the Project reach

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
git push -q origin HEAD
```

---

### Task 4: The UI follows the rules

**Files:**
- Modify: `src/shared/modules/projects/core/constants/actions.ts`
- Modify: `src/features/records-management/ui/components/projects-records-table.tsx`
- Modify: `src/app/(frontend)/dashboard/projects/new/page.tsx`
- Modify: `src/features/project-management/ui/components/form/basic-info-fields.tsx`
- Modify: `src/features/project-management/ui/views/edit-project-view.tsx`
- Modify: `src/shared/entities/meetings/components/create-meeting-form.tsx`

**Interfaces:**
- Consumes: `PROJECT_ACTIONS.showOnPortfolio.permission` as THE publish permission (`['update', 'Project', 'isPublic']`); `Can` (`@/shared/domains/permissions/ui/can`); `useAbility` (`@/shared/domains/permissions/client`).

- [ ] **Step 1: The publish permission**

`actions.ts`: `showOnPortfolio` and `hideFromPortfolio` take `permission: ['update', 'Project', 'isPublic']`.

- [ ] **Step 2: New Project is the publisher's**

`projects-records-table.tsx`: wrap the `headerActions` button:

```tsx
      headerActions={(
        <Can permission={PROJECT_ACTIONS.showOnPortfolio.permission}>
          <Button size="sm" asChild>
            <Link href={ROOTS.dashboard.projects.new()}>
              <PlusIcon className="mr-2 h-4 w-4" />
              New Project
            </Link>
          </Button>
        </Can>
      )}
```

`dashboard/projects/new/page.tsx`:

```tsx
import { redirect } from 'next/navigation'

import { CreateProjectView } from '@/features/project-management/ui/views'
import { ROOTS } from '@/shared/config/roots'
import { protectDashboardPage } from '@/shared/domains/permissions/lib/protect-dashboard-page'
import { PROJECT_ACTIONS } from '@/shared/modules/projects/core/constants/actions'

export const dynamic = 'force-dynamic'

export default async function NewProjectPage() {
  const authState = await protectDashboardPage()
  // A project made here has no meeting, so only whoever publishes can reach it afterwards.
  if (authState.status === 'authenticated' && authState.actor.ability.cannot(...PROJECT_ACTIONS.showOnPortfolio.permission)) {
    redirect(ROOTS.dashboard.projects.root())
  }
  return <CreateProjectView />
}
```

- [ ] **Step 3: The Public switch and the edit save**

`basic-info-fields.tsx`: wrap the `<div className="flex items-center gap-3">` that holds the `isPublic` `FormField` in `<Can permission={PROJECT_ACTIONS.showOnPortfolio.permission}>…</Can>`.

`edit-project-view.tsx`:

```tsx
  const ability = useAbility()
  // …
  function onSubmit(data: ProjectFormData) {
    // The server checks every column it is sent; a viewer who may not publish never sends the switch.
    const payload = ability.can(...PROJECT_ACTIONS.showOnPortfolio.permission) ? data : { ...data, isPublic: undefined }
    updateProject.mutate({ id: projectId, data: payload }, {
      // …unchanged…
    })
  }
```

(`useAbility` is a hook: call it with the other hooks at the top of the component, before the early returns.)

- [ ] **Step 4: The Project meeting type**

`create-meeting-form.tsx`, next to `canAddInternalNote`:

```tsx
  // A project meeting is tied to one of the customer's projects, which a viewer without the project read cannot pick.
  const meetingTypes = ability.can('read', 'Project') ? creatableMeetingTypes : creatableMeetingTypes.filter(t => t !== 'Project')
```

and map `meetingTypes` instead of `creatableMeetingTypes` in the type buttons.

- [ ] **Step 5: Verify**

Run: `pnpm tsc && pnpm lint`
Expected: PASS.

- [ ] **Step 6: Per-role probe and screenshots**

Run: `node .superpowers/permissions-probes/part4-checks.cjs`
Expected: `newPageLandsOn` is `/dashboard/projects/new` for super-admin and `/dashboard/projects` for agent and dispatcher (the dispatcher may land elsewhere if the projects page itself redirects them; report what it is).

With a GET-only Playwright script as each role (`/api/dev/playwright-session`, every non-GET aborted), screenshot `/dashboard/projects` (super-admin: New Project shown; agent: not shown) and, as super-admin, one project's edit page (Public switch shown). Save under `.superpowers/permissions-probes/part4-shots/`. Report what each shows; do not claim UI done without them.

- [ ] **Step 7: Commit**

```bash
git add src/shared/modules/projects/core/constants/actions.ts src/features/records-management/ui/components/projects-records-table.tsx "src/app/(frontend)/dashboard/projects/new/page.tsx" src/features/project-management/ui/components/form/basic-info-fields.tsx src/features/project-management/ui/views/edit-project-view.tsx src/shared/entities/meetings/components/create-meeting-form.tsx
git commit -m "feat(permissions): publishing and portfolio-only projects are shown only to whoever may publish

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
git push -q origin HEAD
```

---

### Task 5: Record, and the owner's hand checks

**Files:**
- Modify: `docs/plans/2026-08-10-casl-scope-compiler-epic.md`
- Modify: `docs/plans/2026-09-07-casl-re-grounding/DISTILLED-2026-10-01.md`
- Modify: memory `project-permissions-casl-compiler.md` (outside the repo)

- [ ] **Step 1: Final probe run**

Run `project-rules.ts`, `owned-object.ts`, `bearer-rules.ts`, `rules-matrix.ts` and `part4-checks.cjs`; all as expected above, and `part3-checks.cjs` (default mode) unchanged from its last recorded run. Count: `grep -rn "SYSTEM_CONTEXT" src --include=*.ts --include=*.tsx | grep -v "import" | wc -l` and `grep -rnE "ctx\.scope|scope: null" src --include=*.ts --include=*.tsx | wc -l`, before (at the Task 1 base) and now.

- [ ] **Step 2: Record**

Tracker:
- §0 "What the tree runs": `Project` joins the compiled list; the legacy engine's subjects lose `Project`.
- §4 Unit 3: a "Part 4 built" record (commits, review results, probe numbers, rulings made during execution, deferred items), mirroring the part 3 record. The "Project family" carry-over line closes.
- §5.1: S4, S5, S13, S14, S16 closed; S7's project side closed; S10's "`update` accepts `projectId`" closed.
- D-04: "Code still to follow" is done; say so.
- Appendix A (log): a 2026-10-12 line.

DISTILLED: the security-holes table and the next-steps line. Memory: a "PART 4 BUILT" entry and the `MEMORY.md` index line.

- [ ] **Step 3: Commit**

```bash
git add docs/plans/2026-08-10-casl-scope-compiler-epic.md docs/plans/2026-09-07-casl-re-grounding/DISTILLED-2026-10-01.md
git commit -m "docs(permissions): record unit 3 part 4, the Project family on compiled rules

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
git push -q origin HEAD
```

- [ ] **Step 4: Hand the owner these checks (they write, so only the owner runs them)**

| # | As | Do | Expect |
|---|---|---|---|
| H1 | agent in a project meeting | open Projects, open the project, look at Media | the project is listed and opens; media uploads, reorders, moves phase, sets a hero |
| H2 | same agent | change the title, save | saves; no Public switch on the form; no Show/Hide on Portfolio in the row menu |
| H3 | agent | convert a meeting with a proposal (pipeline → Create project) | the project appears in their Projects and the projects kanban; the meeting shows converted |
| H4 | agent | import from a proposal, and import a Drive file | both land on the project |
| H5 | agent | drag their project's card on the projects kanban | the stage changes |
| H6 | super-admin | New Project, publish a project, delete a project | all work as before |
| H7 | dispatcher | book a meeting on a project customer | only the Fresh type is offered |
| H8 | agent not in a project's meetings | open that project's edit URL | the "Could not load project" state |

Then: the whole-part review, the main merge at the part boundary, and the plan's deletion, as for part 3.
