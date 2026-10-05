# Projects Standardization — Phase 3 Residuals Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Finish Projects Standardization Phase 3 — route every remaining project-side mutation through the DAL and drop the inline `db` import from `accounting.service`, `business.router`, `media.router`, and `google-drive.router`.

**Architecture:** All writes route through `createCrudDal` handlers or sanctioned bespoke DAL functions (naked-writer for bulk/conditional); all reads move to `entities/*/dal/server/queries.ts`. The DAL substrate already exists (`media-files/dal/server/media-ops.ts`, `accounts/dal/server/google-calendar.ts`, `proposals`/`proposal-media-files` DAL). This plan adds a handful of bespoke DAL fns + one google-drive token service and rewires four call sites. Behavior-preserving: no scope-tightening (that is the #285 tail).

**Tech Stack:** Next.js 15 · TypeScript · tRPC · Drizzle ORM (node-postgres / Neon) · Zod · CASL. No test runner.

**Spec:** Design of record = the Phase 3 brainstorm (2026-08-20, in-session) + `docs/plans/2026-08-11-projects-standardization-epic.md` Phase 3 + `docs/plans/2026-08-20-backend-refactor-roadmap.md` §①. Parent architecture: `docs/plans/2026-08-12-crud-dal-mutation-interface-extension.md` (§3.7 abstractions, §5.9 naked-writer, G-catalog).

## Global Constraints

- **No test runner.** Verify EVERY task with `pnpm tsc` + `pnpm lint` (both green). NEVER `pnpm build`. For behavior-changing tasks, additionally run a throwaway smoke (`scripts/tmp-*.ts`) against the **dev** DB and delete it when done.
- **`server-only` DAL modules can't be imported by plain `tsx`.** Run smokes with `NODE_OPTIONS="--conditions=react-server" npx tsx scripts/tmp-*.ts`. Throwaway scripts MUST begin with `import './lib/load-env'` (not `'dotenv/config'`).
- **DB safety:** dev DB only. NEVER `DRIZZLE_TARGET=prod`. No prod push (standing user constraint — refactor+#285 must land first).
- **Git:** work on local `main`. Stage explicitly by path; NEVER `git add -A`. Commit ONLY the files a task touches. Re-check `git status` per commit (a concurrent VOIP migration is uncommitted in the tree).
- **Behavior-preserving.** No scope-tightening: `agentProcedure` stays bare, `ctx.scope ?? undefined` is unscoped exactly as today. Error surfaces (TRPC codes/messages) preserved. Scope/CASL gates are the named **#285 tail**, out of scope here.
- **`SYSTEM_CONTEXT`** for the job-driven `accounting.service` path (its callers are QStash jobs; mirrors the existing `ensureCustomer`).
- **Naked-writer is sanctioned** for bulk/conditional writes (`moveMediaPhase`, `setHeroImage`); do NOT invent a `crud.bulk`.

---

## File Structure

**Created:**
- `src/shared/entities/media-files/dal/server/mutations.ts` — `moveMediaPhase`, `setHeroImage` (mediaFiles-specific bespoke writes)
- `src/shared/services/providers/google-drive/token.service.ts` — `googleDriveTokenService.getValidAccessToken(userId)`

**Modified:**
- `src/shared/entities/proposals/dal/server/queries.ts` — add `getProposalsByIds`, `getProposalsByMeetingId`
- `src/shared/entities/proposal-media-files/dal/server/queries.ts` — add `listImportableProjectMedia`
- `src/shared/entities/accounts/dal/server/google-calendar.ts` — add `updateAccountTokens`
- `src/shared/services/accounting.service.ts` — route reads+write through DAL; drop `db` import
- `src/trpc/routers/projects.router/business.router.ts` — reads via DAL; drop `db` import
- `src/trpc/routers/projects.router/media.router.ts` — `movePhase`/`toggleHero`/importable reads via DAL; drop `db` import
- `src/trpc/routers/projects.router/google-drive.router.ts` — token via service; drop `db` import
- `docs/plans/2026-08-11-projects-standardization-epic.md` — Phase 3 checkboxes → done
- `memory/project-media-service-dal-compliance.md` — mark moot (media.service is db-free)

---

## Sequence & Dependencies

Four independent slices (each drops one file's `db` import) + a doc close-out. No slice depends on another; order below is by ascending risk.

```
Task 1 (accounting)  ─┐
Task 2 (business)    ─┤ independent
Task 3 (media)       ─┤
Task 4 (google-drive)─┘
Task 5 (docs)  ── after 1–4 land
```

---

### Task 1: `accounting.service` — full R13 (db-free)

**Files:**
- Modify: `src/shared/entities/proposals/dal/server/queries.ts` (add `getProposalsByIds`)
- Modify: `src/shared/services/accounting.service.ts`

**Interfaces:**
- Produces: `getProposalsByIds(ctx: ScopedContext, ids: string[]): Promise<DalReturn<Row<typeof proposals>[]>>`
- Consumes: existing `customerCrud`/`projectCrud`/`proposalCrud`, `SYSTEM_CONTEXT`, `dalVerifySuccess` (already imported in the service).

- [ ] **Step 1: Add `getProposalsByIds` to proposals queries**

In `src/shared/entities/proposals/dal/server/queries.ts` (imports already include `and`, `eq`, `inArray`, `db`, `proposals`, `dalDbOperation`, `ScopedContext`, `DalReturn`, `Row`):

```ts
/** Full rows for a set of proposal ids (scoped). Empty input → []. Used by accounting invoice build. */
export async function getProposalsByIds(
  ctx: ScopedContext,
  ids: string[],
): Promise<DalReturn<Row<typeof proposals>[]>> {
  return dalDbOperation(async () => {
    if (ids.length === 0) {
      return []
    }
    return db
      .select()
      .from(proposals)
      .where(and(inArray(proposals.id, ids), ctx.scope ?? undefined)) as Promise<Row<typeof proposals>[]>
  })
}
```

- [ ] **Step 2: Route `accounting.service` reads + write through the DAL**

In `src/shared/services/accounting.service.ts`:
- Add import: `import { projectCrud } from '@/shared/entities/projects/dal/server/crud'` and `import { getProposalsByIds } from '@/shared/entities/proposals/dal/server/queries'`.
- `ensureCustomer` line 27: replace `const [customer] = await db.select().from(customers).where(eq(customers.id, customerId))` with:
  ```ts
  const customer = dalVerifySuccess(await customerCrud.getById(SYSTEM_CONTEXT, { id: customerId }))
  ```
- `ensureProjectSubCustomer` line 89: replace the `db.select().from(projects)` read with:
  ```ts
  const project = dalVerifySuccess(await projectCrud.getById(SYSTEM_CONTEXT, { id: projectId }))
  ```
- `ensureProjectSubCustomer` line 120: replace `await db.update(projects).set({ qbSubCustomerId }).where(eq(projects.id, projectId))` with:
  ```ts
  dalVerifySuccess(await projectCrud.update(SYSTEM_CONTEXT, { id: projectId, data: { qbSubCustomerId } }))
  ```
- `createInvoice` line 125: replace the `db.select().from(projects)` read with the same `projectCrud.getById(SYSTEM_CONTEXT, { id: projectId })` pattern.
- `createInvoice` line 131: replace `const proposalRows = await db.select().from(proposals).where(inArray(proposals.id, proposalIds))` with:
  ```ts
  const proposalRows = dalVerifySuccess(await getProposalsByIds(SYSTEM_CONTEXT, proposalIds))
  ```
- Delete now-unused imports: `db`, `eq`, `inArray`, `customers`, `projects`, `proposals` (keep `proposalCrud`/`customerCrud` — still used). `crud.getById` returns `Row | undefined`, so keep the existing `if (!customer)`/`if (!project)` not-found guards on the unwrapped value.

**Note:** `dalVerifySuccess` throws on a `DalError` but returns `data` (which may be `undefined` for `getById`) — the existing `if (!customer)`/`if (!project)` checks stay and preserve the current "not found" throws.

- [ ] **Step 3: Verify — tsc + lint + write-through smoke**

Run: `pnpm tsc && pnpm lint` → expect green, and `rg "@/shared/db'" src/shared/services/accounting.service.ts` → no match (db import gone).
Then smoke `scripts/tmp-smoke-accounting.ts`:
```ts
import './lib/load-env'
import { db } from '@/shared/db'
import { projects } from '@/shared/db/schema'
import { eq } from 'drizzle-orm'
import { projectCrud } from '@/shared/entities/projects/dal/server/crud'
import { SYSTEM_CONTEXT } from '@/shared/dal/server/types'
import { dalVerifySuccess } from '@/shared/dal/server/lib/helpers'

async function main() {
  const [p] = await db.select().from(projects).limit(1)
  const before = p.qbSubCustomerId
  dalVerifySuccess(await projectCrud.update(SYSTEM_CONTEXT, { id: p.id, data: { qbSubCustomerId: 'SMOKE-QB-1' } }))
  const [after] = await db.select({ v: projects.qbSubCustomerId }).from(projects).where(eq(projects.id, p.id))
  console.log(after.v === 'SMOKE-QB-1' ? '✅ write-through OK' : '❌ FAIL')
  await db.update(projects).set({ qbSubCustomerId: before }).where(eq(projects.id, p.id)) // restore
}
main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1) })
```
Run: `NODE_OPTIONS="--conditions=react-server" npx tsx scripts/tmp-smoke-accounting.ts` → expect `✅`. Delete the script.

- [ ] **Step 4: Commit**

```bash
git add src/shared/entities/proposals/dal/server/queries.ts src/shared/services/accounting.service.ts
git commit -m "refactor(dal): route accounting.service through CRUD/DAL, drop db import (projects Phase 3)"
```

---

### Task 2: `business.create` reads via DAL

**Files:**
- Modify: `src/shared/entities/proposals/dal/server/queries.ts` (add `getProposalsByMeetingId`)
- Modify: `src/trpc/routers/projects.router/business.router.ts`

**Interfaces:**
- Produces: `getProposalsByMeetingId(ctx: ScopedContext, meetingId: string): Promise<DalReturn<{ id: string, projectJSON: ProjectSection }[]>>` — the minimal shape `extractScopeIdsFromProposals` + the ≥1 gate consume.

- [ ] **Step 1: Add `getProposalsByMeetingId` to proposals queries**

In `src/shared/entities/proposals/dal/server/queries.ts` (use the `projectJSON` column type from the schema — `typeof proposals.projectJSON._.data` is `ProjectSection`; import `ProjectSection` from `@/shared/entities/projects/schemas` if not already, matching `extractScopeIdsFromProposals`'s input type):

```ts
/** Minimal proposal projection for a meeting — id + projectJSON — feeds the project-create gate + scope derivation. */
export async function getProposalsByMeetingId(
  ctx: ScopedContext,
  meetingId: string,
): Promise<DalReturn<{ id: string, projectJSON: ProjectSection }[]>> {
  return dalDbOperation(async () =>
    db
      .select({ id: proposals.id, projectJSON: proposals.projectJSON })
      .from(proposals)
      .where(and(eq(proposals.meetingId, meetingId), ctx.scope ?? undefined)),
  )
}
```

- [ ] **Step 2: Rewire `business.router.ts`**

- Add import: `import { getProposalsByMeetingId } from '@/shared/entities/proposals/dal/server/queries'` and `import { getCustomer } from '@/shared/entities/customers/dal/server/queries'`.
- Replace the `meetingProposals` block (the `db.select({ id, projectJSON }).from(proposals).where(eq(proposals.meetingId, input.meetingId))`) with:
  ```ts
  const meetingProposals = dalVerifySuccess(await getProposalsByMeetingId({ ...ctx, scope: null }, input.meetingId))
  ```
- Replace the customer address `db.select(...).from(customers).where(eq(customers.id, input.customerId))` with a `getCustomer` call (verify `getCustomer`'s signature at `customers/dal/server/queries.ts:67` returns the address fields; if it returns a heavier view, use `customerCrud.getById({ ...ctx, scope: null }, { id: input.customerId })` instead and read `.address/.city/.state/.zip`). Keep the existing `if (!customer)` NOT_FOUND throw.
- Delete now-unused imports: `db`, `eq`, `customers`, `proposals`. Keep `dalVerifySuccess`, `projectCrud`, `meetingCrud`, `setProjectScopes`, `extractScopeIdsFromProposals`, `TRPCError`.

- [ ] **Step 3: Verify**

Run `pnpm tsc && pnpm lint` → green; `rg "@/shared/db'" src/trpc/routers/projects.router/business.router.ts` → no match. (Behavior is read-only relocation; the existing projects smoke + a manual create-from-meeting in a later E2E covers it — no new smoke required for a pure read move.)

- [ ] **Step 4: Commit**

```bash
git add src/shared/entities/proposals/dal/server/queries.ts src/trpc/routers/projects.router/business.router.ts
git commit -m "refactor(dal): route business.create reads through proposals/customers DAL, drop db import (projects Phase 3)"
```

---

### Task 3: `media.router` de-inline

**Files:**
- Create: `src/shared/entities/media-files/dal/server/mutations.ts`
- Modify: `src/shared/entities/proposal-media-files/dal/server/queries.ts` (add `listImportableProjectMedia`)
- Modify: `src/trpc/routers/projects.router/media.router.ts`

**Interfaces:**
- Produces: `moveMediaPhase(ctx, ids, phase)`, `setHeroImage(ctx, id, isHeroImage)`, `listImportableProjectMedia(projectId, ids?)`.

- [ ] **Step 1: Create `media-files/dal/server/mutations.ts`**

```ts
// mediaFiles-specific bespoke writes that are NOT single-row CRUD slots. Naked-writer
// (sanctioned §5.9): bulk phase move + hero-exclusivity. Rung by the projects media router.

import type { DalReturn, ScopedContext } from '@/shared/dal/server/types'

import { and, eq } from 'drizzle-orm'

import { dalDbOperation } from '@/shared/dal/server/lib/helpers'
import { ThrowableDalError } from '@/shared/dal/server/types'
import { mediaPhases } from '@/shared/constants/enums/media'
import { db } from '@/shared/db'
import { mediaFiles } from '@/shared/db/schema'

type MediaPhase = (typeof mediaPhases)[number]

/** Bulk-set `phase` for the given ids in one scoped transaction. Empty input → no-op. */
export function moveMediaPhase(
  ctx: ScopedContext,
  ids: number[],
  phase: MediaPhase,
): Promise<DalReturn<void>> {
  return dalDbOperation(async () => {
    if (ids.length === 0) {
      return
    }
    await db.transaction(async (tx) => {
      for (const id of ids) {
        await tx.update(mediaFiles).set({ phase }).where(and(eq(mediaFiles.id, id), ctx.scope ?? undefined))
      }
    })
  })
}

/**
 * Set/unset the hero image for a project. When setting, enforces single-hero
 * exclusivity (clears every other hero on the same project first) in one tx.
 * Scoped: an out-of-scope id matches nothing → not-found.
 */
export function setHeroImage(
  ctx: ScopedContext,
  id: number,
  isHeroImage: boolean,
): Promise<DalReturn<void>> {
  return dalDbOperation(async () => {
    await db.transaction(async (tx) => {
      if (isHeroImage) {
        const [file] = await tx
          .select({ projectId: mediaFiles.projectId })
          .from(mediaFiles)
          .where(and(eq(mediaFiles.id, id), ctx.scope ?? undefined))
        if (!file) {
          throw new ThrowableDalError({ type: 'not-found' })
        }
        await tx.update(mediaFiles).set({ isHeroImage: false }).where(eq(mediaFiles.projectId, file.projectId))
      }
      await tx.update(mediaFiles).set({ isHeroImage }).where(and(eq(mediaFiles.id, id), ctx.scope ?? undefined))
    })
  })
}
```

- [ ] **Step 2: Add `listImportableProjectMedia` to proposal-media-files queries**

In `src/shared/entities/proposal-media-files/dal/server/queries.ts` (add imports `inArray`, `like`, `proposals`, `meetings` from schema):

```ts
export interface ImportableProjectMediaRow {
  id: number
  proposalId: string
  proposalLabel: string | null
  name: string
  mimeType: string
  fileExtension: string | null
  pathKey: string | null
  bucket: string | null
  optimizationStatus: string
  optimizationVariants: string[] | null
}

/**
 * Image rows on proposals belonging to THIS project's meetings — the import-picker
 * source set. Authorization by construction: the meeting→project join means only
 * media reachable from the project is returned (no arbitrary-id import). Pass `ids`
 * to restrict to a chosen subset (the actual import call).
 */
export async function listImportableProjectMedia(
  projectId: string,
  ids?: number[],
): Promise<ImportableProjectMediaRow[]> {
  return db
    .select({
      id: proposalMediaFiles.id,
      proposalId: proposalMediaFiles.proposalId,
      proposalLabel: proposals.label,
      name: proposalMediaFiles.name,
      mimeType: proposalMediaFiles.mimeType,
      fileExtension: proposalMediaFiles.fileExtension,
      pathKey: proposalMediaFiles.pathKey,
      bucket: proposalMediaFiles.bucket,
      optimizationStatus: proposalMediaFiles.optimizationStatus,
      optimizationVariants: proposalMediaFiles.optimizationVariants,
    })
    .from(proposalMediaFiles)
    .innerJoin(proposals, eq(proposals.id, proposalMediaFiles.proposalId))
    .innerJoin(meetings, eq(meetings.id, proposals.meetingId))
    .where(and(
      eq(meetings.projectId, projectId),
      like(proposalMediaFiles.mimeType, 'image/%'),
      ids && ids.length > 0 ? inArray(proposalMediaFiles.id, ids) : undefined,
    ))
}
```

- [ ] **Step 3: Rewire `media.router.ts`**

- `movePhase` → `dalToTrpc(await moveMediaPhase(ctx, input.ids, input.phase))` (add `ctx` to the handler args).
- `toggleHero` → `dalToTrpc(await setHeroImage(ctx, input.id, input.isHeroImage))` (add `ctx`; deletes the inline read+two updates and the local `TRPCError` NOT_FOUND — the DAL `not-found` maps to TRPC NOT_FOUND via `dalToTrpc`, preserving behavior).
- `listImportableProposalMedia` → `const rows = await listImportableProjectMedia(input.projectId)`; keep the existing `withUrl`/`byProposal` presentation mapping in the router.
- `importFromProposal` → `const sources = await listImportableProjectMedia(input.projectId, input.proposalMediaFileIds)`; keep the r2 copy + `mediaService.createRecord` loop.
- Delete now-unused imports: `db`, `and`, `eq`, `inArray`, `like`, `mediaFiles`, `meetings`, `proposalMediaFiles`, `proposals`, and the header `// TODO(1f)` comment. Keep `TRPCError` only if still referenced (it is not after toggleHero changes — remove if unused).

- [ ] **Step 4: Verify — tsc + lint + media smoke**

Run `pnpm tsc && pnpm lint` → green; `rg "@/shared/db'" src/trpc/routers/projects.router/media.router.ts` → no match.
Smoke `scripts/tmp-smoke-media.ts` (dev DB): pick a project with ≥2 media files; assert (a) `setHeroImage(ctx, A, true)` then `setHeroImage(ctx, B, true)` leaves exactly ONE hero (B), and (b) `moveMediaPhase(ctx, [A], 'after')` sets A's phase. Use `const ctx = { scope: null } as unknown as ScopedContext`. Restore original phase/hero after. Run with the `--conditions=react-server` incantation; delete after.

- [ ] **Step 5: Commit**

```bash
git add src/shared/entities/media-files/dal/server/mutations.ts src/shared/entities/proposal-media-files/dal/server/queries.ts src/trpc/routers/projects.router/media.router.ts
git commit -m "refactor(dal): de-inline media.router via media-files mutations + importable-media query (projects Phase 3)"
```

---

### Task 4: `google-drive.router` de-inline

**Files:**
- Modify: `src/shared/entities/accounts/dal/server/google-calendar.ts` (add `updateAccountTokens`)
- Create: `src/shared/services/providers/google-drive/token.service.ts`
- Modify: `src/trpc/routers/projects.router/google-drive.router.ts`

**Interfaces:**
- Produces: `updateAccountTokens(accountId, { accessToken, accessTokenExpiresAt })`; `googleDriveTokenService.getValidAccessToken(userId): Promise<string>`.

- [ ] **Step 1: Add `updateAccountTokens` to the accounts DAL**

In `src/shared/entities/accounts/dal/server/google-calendar.ts`, under `// ── Mutations ──`:

```ts
/** Persist a refreshed OAuth access token (provider-neutral — used by google-drive + gcal). */
export async function updateAccountTokens(
  accountId: string,
  fields: Pick<AccountRow, 'accessToken' | 'accessTokenExpiresAt'>,
): Promise<void> {
  await db.update(accountTable).set(fields).where(eq(accountTable.id, accountId))
}
```

- [ ] **Step 2: Create the google-drive token service**

`src/shared/services/providers/google-drive/token.service.ts`:

```ts
import { TRPCError } from '@trpc/server'

import { getGoogleAccountForUser, updateAccountTokens } from '@/shared/entities/accounts/dal/server/google-calendar'

import { googleDriveClient } from './client'

/**
 * Resolve a valid Google access token for a user: read the linked google account,
 * refresh via the refresh token when the current access token is missing/expiring
 * (<5 min), persist the refreshed token, and return it. Behavior-identical to the
 * inline logic the projects google-drive router used to carry in two places.
 */
export const googleDriveTokenService = {
  async getValidAccessToken(userId: string): Promise<string> {
    const acct = await getGoogleAccountForUser(userId)
    if (!acct) {
      throw new TRPCError({ code: 'NOT_FOUND', message: 'No Google account linked' })
    }
    if (!acct.refreshToken) {
      throw new TRPCError({ code: 'PRECONDITION_FAILED', message: 'Google Drive connection expired — please sign out and sign in again' })
    }

    const fiveMinutesFromNow = new Date(Date.now() + 5 * 60 * 1000)
    if (acct.accessToken && acct.accessTokenExpiresAt && acct.accessTokenExpiresAt > fiveMinutesFromNow) {
      return acct.accessToken
    }

    const { accessToken, expiresAt } = await googleDriveClient.refreshAccessToken({ refreshToken: acct.refreshToken })
    await updateAccountTokens(acct.id, { accessToken, accessTokenExpiresAt: expiresAt })
    return accessToken
  },
}
```

**Note (preserve the one message difference):** the old `getAccessToken` used the message *"No Google account linked"* / *"…expired…"*; `uploadFromFile` used *"No Google Drive connection…"*. The service unifies on the `getAccessToken` wording — this is a cosmetic message change in the upload path only, no code/status change. Flag it in the task report; if the reviewer wants byte-identical upload messaging, split into two typed reasons. (Recommended: accept the unified message.)

- [ ] **Step 3: Rewire `google-drive.router.ts`**

- `getAccessToken` query → `return { accessToken: await googleDriveTokenService.getValidAccessToken(ctx.session.user.id) }`.
- `uploadFromFile` → replace the account-read + refresh block with `const accessToken = await googleDriveTokenService.getValidAccessToken(ctx.session.user.id)`; keep the Drive fetch + r2 put + `mediaService.createRecord`.
- Delete now-unused imports: `db`, `and`, `eq`, `account`, `googleDriveClient` (now used only inside the service), and the header `// TODO(1f)`. Add `import { googleDriveTokenService } from '@/shared/services/providers/google-drive/token.service'`. Keep `TRPCError` (still thrown for Drive-fetch failures).

- [ ] **Step 4: Verify**

Run `pnpm tsc && pnpm lint` → green; `rg "@/shared/db'" src/trpc/routers/projects.router/google-drive.router.ts` → no match. (Token refresh needs live Google OAuth — not smoke-able on the dev DB; verify by reading the service against the old inline logic for equivalence. A real Drive upload is an E2E check for a later tunneled session.)

- [ ] **Step 5: Commit**

```bash
git add src/shared/entities/accounts/dal/server/google-calendar.ts src/shared/services/providers/google-drive/token.service.ts src/trpc/routers/projects.router/google-drive.router.ts
git commit -m "refactor(dal): de-inline google-drive.router via token service + accounts DAL (projects Phase 3)"
```

---

### Task 5: Close out docs + stale memory

**Files:**
- Modify: `docs/plans/2026-08-11-projects-standardization-epic.md`
- Modify: `memory/project-media-service-dal-compliance.md`
- Modify: `docs/plans/2026-08-20-backend-refactor-roadmap.md`

- [ ] **Step 1: Flip Phase 3 to done in the projects epic**

In `docs/plans/2026-08-11-projects-standardization-epic.md`, change the Phase 3 line from `[~]` to `[x]` and note the residuals shipped (accounting/business/media/gdrive all db-free); the only remaining projects item is the **#285 scope-tightening tail** (not this epic).

- [ ] **Step 2: Mark the media-service-dal-compliance memory moot**

In `memory/project-media-service-dal-compliance.md`, add a top line: `**RESOLVED/MOOT (2026-08-20):** verified `media.service.ts` is already db-free (routes through `media-files/dal/server/media-ops.ts` + the store `crud`). No action needed.` Update the `MEMORY.md` pointer accordingly if it implies open work.

- [ ] **Step 3: Update the roadmap ①**

In `docs/plans/2026-08-20-backend-refactor-roadmap.md`, mark §① Projects Phase 3 residuals ✅ done; the projects thread's only remainder is the #285 scope-tightening tail.

- [ ] **Step 4: Commit**

```bash
git add docs/plans/2026-08-11-projects-standardization-epic.md docs/plans/2026-08-20-backend-refactor-roadmap.md
git commit -m "docs(projects): Phase 3 residuals shipped — close out epic + roadmap"
```
(The `memory/` file is outside the repo — save it, no commit.)

---

## Done-when (Phase 3 residuals complete)

- [ ] `rg "from '@/shared/db'" src/shared/services/accounting.service.ts src/trpc/routers/projects.router/business.router.ts src/trpc/routers/projects.router/media.router.ts src/trpc/routers/projects.router/google-drive.router.ts` → **zero matches**.
- [ ] The `qbSubCustomerId` write, `movePhase`, and `toggleHero` route through DAL fns; hero-exclusivity + phase-move proven by dev-DB smoke.
- [ ] `pnpm tsc` + `pnpm lint` green.
- [ ] All `scripts/tmp-*.ts` smoke files deleted.
- [ ] Behavior preserved: bare `agentProcedure` unchanged; no scope-tightening; error surfaces intact (one accepted cosmetic message unification in the gdrive upload path).
- [ ] Projects epic Phase 3 + roadmap ① marked done; media-service-dal-compliance memory marked moot.

## Self-Review Notes (for the executor)

- **`getById` returns `Row | undefined`** — `dalVerifySuccess` unwraps the `DalReturn` but does NOT assert presence; keep every existing `if (!x)` not-found guard on the unwrapped value.
- **Scope is unscoped by design** — `{ ...ctx, scope: null }` (routers) / `ctx.scope ?? undefined` (DAL) reproduces today's unscoped behavior for bare `agentProcedure`. Do NOT add a scope predicate — that's the #285 tail.
- **`SYSTEM_CONTEXT` vs router ctx** — accounting is job-driven (`SYSTEM_CONTEXT`); business/media/gdrive are request-driven (thread the procedure `ctx`, unscoped).
- **`moveMediaPhase`/`setHeroImage` are mediaFiles-specific** (phase/isHeroImage/projectId are project-media columns) → they live in a new `media-files/dal/server/mutations.ts`, NOT the shared table-parameterized `media-ops.ts`.
- **One accepted behavior nuance:** the gdrive upload-path error message unifies onto the `getAccessToken` wording (cosmetic). Flag in the report; do not treat as a regression.
- **No prod DB.** Smokes are dev-only; the standing constraint blocks any prod push until the refactor + #285 land.
