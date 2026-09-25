# Dev DB Refresh from Neon Parent — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the row-copying prod→dev snapshot script with a Neon reset-from-parent plus a scrub, mark the development environment with a green app accent instead of a 🧪 row prefix, and close the one remaining path from a dev action to prod data loss (the R2 purge).

**Architecture:** `pnpm db:refresh:dev` resolves the Neon branch behind `DATABASE_DEV_URL`, refuses anything that is not a childless non-default child branch, asks Neon to reset it to its parent's head (copy-on-write, seconds, byte-identical data + schema + sequences, zero load on prod), then runs one transaction of scrub statements on the reset branch. The root layout stamps `data-env` on `<html>` from the deployment-environment axis (`VERCEL_ENV`, absent locally = `development`), and one CSS block turns the app accent green for any non-production environment. A separate `resolveDbTarget()` becomes the single decision behind the DB singleton's URL and gates `purgeMediaObject`, so only a process on prod data deletes shared R2 objects.

**Tech Stack:** Next.js 15 (App Router), TypeScript, Drizzle ORM + `pg` Pool, Neon REST API v2 (`fetch`, `NEON_API_KEY`/`NEON_PROJECT_ID` already in `.env`), pnpm, `tsx` for scripts. The repo has no test runner; verification is `pnpm tsc`, `pnpm lint`, and read-only dry runs.

**Spec:** No standalone spec — this was a bounded brainstorm. The design summary is §Design below; the step-by-step model of the retired script is the published diagram https://claude.ai/artifact/4Y3u1VHEVu3MeFxQAJx7oa (sections 1–5).

## Global Constraints

- Verification is `pnpm tsc` and `pnpm lint`. **Never run `pnpm build`.**
- Scripts start with `import './lib/load-env'` (never `dotenv/config`) and use `import process from 'node:process'` (antfu lint rule `node/prefer-global/process`).
- Environment axes follow `docs/codebase-conventions/environment.md#environment-axes`: `NODE_ENV` is build mode only and never an environment signal; `VERCEL_ENV` is the deployment environment (absent locally); `DRIZZLE_TARGET` is the data target and unset never means prod. Never run `pnpm db:push:prod`.
- Non-defensive migration: the old script and both `db:snapshot*` package entries are deleted in the same commit that adds the replacement. No aliases, no dual paths.
- **The Neon reset is destructive to the dev branch and is never executed by an agent.** Tasks 1–4 only build and dry-run. Task 5 is the operator runbook.
- Git: stage by explicit path, never `git add -A`. End every commit message with `Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>`.
- Neon facts (verified 2026-09-17): project `polished-shape-00174668`; `production` = `br-purple-field-afkq0ups` (default, not protected, Free plan so protection is unavailable); `development` = `br-small-sun-afns8axo`, child of production, endpoint `ep-mute-sunset-afxp3pn5`; prod endpoint `ep-flat-wind-afvc0zla`; development currently has three child branches `wt/issue-285`, `wt/issue-280`, `wt/issue-29`.

## Design

**Why reset instead of copy.** The old `scripts/snapshot-prod-to-dev.ts` read 29 tables out of prod one query at a time and inserted them into dev with no transaction on either side, a string-equality same-URL guard, a hand-maintained table list that had drifted 13 tables behind the schema, and a 🧪 prefix on human-visible text that broke PDFs and search. Neon's reset-from-parent replaces all of it: the branch behind `DATABASE_DEV_URL` becomes an exact copy of its parent in one API call, consistent at one LSN, with sequences correct and no FK ordering to maintain. Connection strings do not change.

**What the script does** (`scripts/refresh-dev-from-prod.ts`, `pnpm db:refresh:dev`):

1. Parse `DATABASE_DEV_URL` and `DATABASE_URL` down to their Neon endpoint ids (`ep-…`, pooler suffix stripped). Abort if equal.
2. List the project's branches and endpoints through the Neon API. Map the dev endpoint → branch. Abort if the branch is the default branch, is protected, or has no parent.
3. Abort if the branch has child branches, listing them and the two ways to clear them (`pnpm dispatch neon-prune` for orphans; delete a live worktree's branch and let `pnpm dispatch start <issue>` recreate it).
4. `--dry-run` stops here after printing the lineage and scrub plan.
5. POST Neon's documented restore endpoint with `source_branch_id` = parent (head, no timestamp). Poll the returned operations until every one is `finished`.
6. On the reset branch, in one transaction: delete every row of `session`, `account`, `verification`, `push_subscriptions`, `qb_auth_tokens`, `bina_webhook_logs`; null `gcal_event_id`/`gcal_etag`/`gcal_synced_at` on `meetings` and `activities`; null `contract_envelope_id` on `proposals`. This is exactly the exclusion set of the retired script. VoIP tables and `app_settings` are kept (faithful to prod; outbound telephony is already gated by `VOIP_DEV_OVERRIDE_NUMBER`).
7. Print the follow-up: the branch now carries prod's schema, so run `pnpm db:push:dev` if local code has schema changes prod lacks.

**Worktrees.** The target follows the connection string. On main it is `development ← production`. In a dispatch worktree it is `wt/issue-N ← development`. To get fresh prod data into a worktree, refresh development first (after clearing its children), then run the command inside the worktree.

**Environment indicator instead of emoji.** The 🧪 prefix was a data marker; its replacement is an environment marker. `resolveDeploymentEnv()` returns `env.VERCEL_ENV ?? 'development'` — the deployment-environment axis the codebase already uses for its production safety gates — and the root layout stamps it as `data-env` on `<html>`, so the attribute reads as what it is: `development`, `preview` or `production`. `:root[data-env='development'], :root[data-env='preview']` overrides the accent family (`--primary`, `--accent`, `--ring`, `--sidebar-*`) to green; the `.dark` variant also hue-shifts `--background`, `--card`, `--popover`, `--sidebar` from blue to green. Production stays blue. The dashboard's top glow and sidebar active state already derive from `--primary` via `color-mix`, so no component changes. `.theme-marketing` / `.funnel-light` redefine their own tokens and stay brand blue. Known gap, accepted: a local server started with `DRIZZLE_TARGET=prod` is green while showing prod data, because the indicator answers "where am I", not "whose data is this".

**DB target and the purge gate.** `resolveDbTarget()` (`'prod' | 'dev'`) is extracted from the DB singleton into `src/shared/config/db-target.ts` with the same selection rules, and reports `'dev'` only when `DATABASE_DEV_URL` exists and is the chosen URL. Dev rows keep prod's `pathKey`s in the shared `tpr-media` bucket, so `purgeMediaObject` deletes from R2 only when `resolveDbTarget() === 'prod'`; otherwise it logs the skipped key and returns, and the caller still deletes the row. This gate is keyed on the data target, not the environment, on purpose: a local script run with `DRIZZLE_TARGET=prod` that deletes prod rows must purge, and a preview deploy on the dev database must not.

## File Structure

| File | Responsibility |
|---|---|
| `scripts/lib/neon-refresh.ts` (create) | Pure decisions: endpoint id from a URL, target resolution + guards, children lookup, the scrub statement list. No I/O. |
| `scripts/lib/neon-api.ts` (create) | Thin Neon REST client: list branches, list endpoints, reset-from-parent, wait for operations. |
| `scripts/refresh-dev-from-prod.ts` (create) | Orchestration + scrub transaction + operator output. |
| `scripts/snapshot-prod-to-dev.ts` (delete) | Retired copy script. |
| `package.json` (modify) | `db:snapshot`, `db:snapshot:fresh` → `db:refresh:dev`. |
| `src/shared/config/deployment-env.ts` (create) | `resolveDeploymentEnv()` — the deployment-environment axis as one named value. |
| `src/shared/config/db-target.ts` (create) | `resolveDbTarget()` / `resolveDbUrl()` — the one place that decides which DB a process is on. |
| `src/shared/db/index.ts` (modify) | Use `resolveDbUrl()`. |
| `src/app/(frontend)/layout.tsx` (modify) | `data-env` on `<html>`. |
| `src/app/(frontend)/globals.css` (modify) | Green override block for non-production environments. |
| `src/shared/modules/media/core/lib/purge.ts` (modify) | Gate on `resolveDbTarget()`. |
| Docs: `CLAUDE.md`, `docs/codebase-conventions/environment.md`, `docs/design-system/DESIGN.md`, `src/shared/modules/media/DOCS.md`, `docs/plans/2026-07-15-r2-dev-prod-blob-consistency-handoff.md` | Command line, new rule, color note, purge-path note, stale-ref fixes. |
| Memory: `memory/reference-db-snapshot.md` → `memory/reference-db-refresh.md`, `memory/reference-neon-branching.md`, `memory/MEMORY.md` | Operator note, one stale line, index line. (Memory dir: `/home/olis-solutions/.claude/projects/-home-olis-solutions-olis-v3-nextjs-tri-pros-website/memory/`.) |

---

### Task 1: The refresh script, its two helpers, and retirement of the copy script

**Files:**
- Create: `scripts/lib/neon-refresh.ts`
- Create: `scripts/lib/neon-api.ts`
- Create: `scripts/refresh-dev-from-prod.ts`
- Delete: `scripts/snapshot-prod-to-dev.ts`
- Modify: `package.json:22-23` (the two `db:snapshot*` entries)

**Interfaces:**
- Consumes: `pg` `Pool` (already a dependency); global `fetch` (Node 24).
- Produces: package script `pnpm db:refresh:dev [--dry-run]`. Helper names used across the three files: `NeonBranch`, `NeonEndpoint`, `endpointIdFromUrl`, `resolveTarget`, `childrenOf`, `SCRUB_STATEMENTS` (from `neon-refresh.ts`); `createNeonClient`, `NeonOperation` (from `neon-api.ts`).

- [ ] **Step 1: Write the pure decisions**

```ts
// scripts/lib/neon-refresh.ts
/**
 * Pure decisions behind `pnpm db:refresh:dev` (scripts/refresh-dev-from-prod.ts).
 * No I/O and no env: everything here is decidable from Neon API payloads and
 * connection strings.
 */

export interface NeonBranch {
  id: string
  name: string
  parent_id?: string
  default: boolean
  protected: boolean
  current_state: string
}

export interface NeonEndpoint {
  id: string
  host: string
  branch_id: string
}

/**
 * `ep-mute-sunset-afxp3pn5-pooler.c-2.us-west-2.aws.neon.tech` → `ep-mute-sunset-afxp3pn5`.
 * The endpoint id is the stable identity of a branch's compute; comparing ids
 * (not URL strings) is what catches a pooler vs direct host for the same branch.
 */
export function endpointIdFromUrl(connectionString: string): string {
  const host = new URL(connectionString).hostname
  const label = host.split('.')[0]
  if (!label.startsWith('ep-'))
    throw new Error(`Not a Neon host: ${host}`)
  return label.replace(/-pooler$/, '')
}

export type TargetResolution
  = | { ok: true, branch: NeonBranch, parent: NeonBranch }
    | { ok: false, reason: string }

/** Which branch to reset, or why we refuse. Every refusal happens before any write. */
export function resolveTarget(input: {
  branches: NeonBranch[]
  endpoints: NeonEndpoint[]
  devEndpointId: string
  prodEndpointId: string
}): TargetResolution {
  const { branches, endpoints, devEndpointId, prodEndpointId } = input
  if (devEndpointId === prodEndpointId)
    return { ok: false, reason: `DATABASE_DEV_URL and DATABASE_URL point at the same endpoint (${devEndpointId})` }
  const endpoint = endpoints.find(e => e.id === devEndpointId)
  if (!endpoint)
    return { ok: false, reason: `No Neon endpoint ${devEndpointId} in this project — is DATABASE_DEV_URL from another project?` }
  const branch = branches.find(b => b.id === endpoint.branch_id)
  if (!branch)
    return { ok: false, reason: `Endpoint ${devEndpointId} belongs to unknown branch ${endpoint.branch_id}` }
  if (branch.default)
    return { ok: false, reason: `${branch.name} is the project's default branch — refusing to reset it` }
  if (branch.protected)
    return { ok: false, reason: `${branch.name} is protected — refusing to reset it` }
  if (!branch.parent_id)
    return { ok: false, reason: `${branch.name} is a root branch — nothing to reset from` }
  const parent = branches.find(b => b.id === branch.parent_id)
  if (!parent)
    return { ok: false, reason: `Parent ${branch.parent_id} of ${branch.name} not found` }
  return { ok: true, branch, parent }
}

export function childrenOf(branches: NeonBranch[], branchId: string): NeonBranch[] {
  return branches.filter(b => b.parent_id === branchId)
}

/**
 * What a prod copy must not carry into dev. This is exactly the exclusion set
 * of the retired copy script: device-bound auth/push tables, third-party OAuth
 * and webhook state, and the Google Calendar / Zoho Sign ids that would make
 * dev talk to prod's calendars and envelopes. Statements are independent and
 * run in one transaction on the freshly reset branch.
 */
export const SCRUB_STATEMENTS: readonly string[] = [
  'DELETE FROM "session"',
  'DELETE FROM "account"',
  'DELETE FROM "verification"',
  'DELETE FROM "push_subscriptions"',
  'DELETE FROM "qb_auth_tokens"',
  'DELETE FROM "bina_webhook_logs"',
  'UPDATE "meetings" SET gcal_event_id = NULL, gcal_etag = NULL, gcal_synced_at = NULL WHERE gcal_event_id IS NOT NULL OR gcal_etag IS NOT NULL OR gcal_synced_at IS NOT NULL',
  'UPDATE "activities" SET gcal_event_id = NULL, gcal_etag = NULL, gcal_synced_at = NULL WHERE gcal_event_id IS NOT NULL OR gcal_etag IS NOT NULL OR gcal_synced_at IS NOT NULL',
  'UPDATE "proposals" SET contract_envelope_id = NULL WHERE contract_envelope_id IS NOT NULL',
]
```

- [ ] **Step 2: Write the Neon client**

```ts
// scripts/lib/neon-api.ts
import type { NeonBranch, NeonEndpoint } from './neon-refresh'
import process from 'node:process'

/**
 * Thin Neon REST v2 client for CLI scripts. Same credentials dispatch.sh uses
 * (NEON_API_KEY + NEON_PROJECT_ID from .env); `./load-env` must run first.
 */

const NEON_API = 'https://console.neon.tech/api/v2'
const FAILED_STATES = new Set(['failed', 'error', 'cancelled'])

export interface NeonOperation {
  id: string
  action: string
  status: string
  error?: string
}

export interface NeonClient {
  listBranches: () => Promise<NeonBranch[]>
  listEndpoints: () => Promise<NeonEndpoint[]>
  /**
   * Neon's documented "reset from parent": POST …/branches/{id}/restore with
   * the parent as `source_branch_id` and no timestamp/LSN = the parent's head.
   * https://neon.com/docs/guides/reset-from-parent (API tab)
   */
  resetFromParent: (branchId: string, parentId: string) => Promise<NeonOperation[]>
  waitForOperations: (ops: NeonOperation[], timeoutMs?: number) => Promise<void>
}

export function createNeonClient(): NeonClient {
  const apiKey = process.env.NEON_API_KEY
  const projectId = process.env.NEON_PROJECT_ID
  if (!apiKey || !projectId)
    throw new Error('NEON_API_KEY and NEON_PROJECT_ID must be set in .env (dispatch uses the same two)')

  async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
    const res = await fetch(`${NEON_API}/projects/${projectId}${path}`, {
      ...init,
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Accept': 'application/json',
        'Content-Type': 'application/json',
      },
    })
    if (!res.ok)
      throw new Error(`Neon API ${init.method ?? 'GET'} ${path} → ${res.status}: ${await res.text()}`)
    return res.json() as Promise<T>
  }

  async function waitForOne(op: NeonOperation, deadline: number): Promise<void> {
    let current = op
    while (current.status !== 'finished') {
      if (FAILED_STATES.has(current.status))
        throw new Error(`Neon operation ${current.action} (${current.id}) ${current.status}${current.error ? `: ${current.error}` : ''}`)
      if (Date.now() > deadline)
        throw new Error(`Timed out waiting for Neon operation ${current.action} (${current.id})`)
      await new Promise(resolve => setTimeout(resolve, 1500))
      const { operation } = await request<{ operation: NeonOperation }>(`/operations/${current.id}`)
      current = operation
    }
  }

  return {
    listBranches: async () => (await request<{ branches: NeonBranch[] }>('/branches')).branches,
    listEndpoints: async () => (await request<{ endpoints: NeonEndpoint[] }>('/endpoints')).endpoints,
    resetFromParent: async (branchId, parentId) => {
      const res = await request<{ operations: NeonOperation[] }>(`/branches/${branchId}/restore`, {
        method: 'POST',
        body: JSON.stringify({ source_branch_id: parentId }),
      })
      return res.operations
    },
    waitForOperations: async (ops, timeoutMs = 120_000) => {
      const deadline = Date.now() + timeoutMs
      for (const op of ops)
        await waitForOne(op, deadline)
    },
  }
}
```

- [ ] **Step 3: Write the script**

```ts
// scripts/refresh-dev-from-prod.ts
import process from 'node:process'
import { Pool } from 'pg'

import { createNeonClient } from './lib/neon-api'
import { childrenOf, endpointIdFromUrl, resolveTarget, SCRUB_STATEMENTS } from './lib/neon-refresh'

/**
 * Refresh the dev database from its Neon parent.
 *
 *   pnpm db:refresh:dev             # reset + scrub
 *   pnpm db:refresh:dev --dry-run   # print the plan, touch nothing
 *
 * Replaces the retired row-copying snapshot script. Instead of reading tables
 * out of prod and inserting them into dev, this asks Neon to reset the branch
 * behind DATABASE_DEV_URL to its parent's current state (copy-on-write, a few
 * seconds, byte-identical data + schema + sequences, no load on prod), then
 * scrubs the rows dev must not carry (SCRUB_STATEMENTS in ./lib/neon-refresh).
 *
 * The target follows the connection string, so one command is right everywhere:
 *   on main         DATABASE_DEV_URL → development   ← production
 *   in a worktree   DATABASE_DEV_URL → wt/issue-N    ← development
 * To get fresh prod data into a worktree, refresh development first.
 *
 * Guards — every one aborts before anything is touched:
 *   - dev and prod must resolve to different Neon endpoints
 *   - the target must be a non-default, unprotected branch with a parent
 *   - the target must have no child branches (Neon refuses otherwise)
 *
 * Prod is never written. DATABASE_URL is read only to compare endpoint ids;
 * the reset itself is Neon copying the parent's pages.
 *
 * After a reset the branch carries the PARENT's schema. If local code has
 * schema changes the parent lacks, run `pnpm db:push:dev` afterwards.
 */
import './lib/load-env'

const DRY_RUN = process.argv.includes('--dry-run')

function fail(message: string): never {
  console.error('')
  console.error(`  ${message}`)
  console.error('')
  process.exit(1)
}

async function scrub(connectionString: string): Promise<void> {
  const pool = new Pool({ connectionString })
  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    for (const statement of SCRUB_STATEMENTS) {
      const result = await client.query(statement)
      console.log(`  ${String(result.rowCount ?? 0).padStart(6)}  ${statement.split(' WHERE')[0]}`)
    }
    await client.query('COMMIT')
  }
  catch (err) {
    await client.query('ROLLBACK')
    throw err
  }
  finally {
    client.release()
    await pool.end()
  }
}

async function main() {
  const devUrl = process.env.DATABASE_DEV_URL
  const prodUrl = process.env.DATABASE_URL
  if (!devUrl)
    fail('DATABASE_DEV_URL is not set')
  if (!prodUrl)
    fail('DATABASE_URL is not set')

  const neon = createNeonClient()
  const [branches, endpoints] = await Promise.all([neon.listBranches(), neon.listEndpoints()])

  const target = resolveTarget({
    branches,
    endpoints,
    devEndpointId: endpointIdFromUrl(devUrl),
    prodEndpointId: endpointIdFromUrl(prodUrl),
  })
  if (!target.ok)
    fail(target.reason)

  const { branch, parent } = target
  console.log('')
  console.log(`--- db:refresh:dev [${DRY_RUN ? 'DRY RUN' : 'RESET'}] ---`)
  console.log(`  target  ${branch.name}  (${branch.id})`)
  console.log(`  parent  ${parent.name}  (${parent.id})`)

  const children = childrenOf(branches, branch.id)
  if (children.length > 0) {
    console.error('')
    console.error(`  ${branch.name} has ${children.length} child branch(es). Neon will not reset a branch with children:`)
    for (const child of children)
      console.error(`    ${child.name.padEnd(20)} ${child.id}  (${child.current_state})`)
    console.error('')
    console.error('  Orphans (no live dispatch slot):   pnpm dispatch neon-prune')
    console.error('  A live worktree\'s branch:           pnpm dispatch cleanup <issue>, or delete only its DB branch —')
    console.error('                                      `pnpm dispatch start <issue>` recreates it from the refreshed parent.')
    console.error('')
    process.exit(1)
  }

  console.log('')
  console.log('  scrub plan (one transaction on the reset branch):')
  for (const statement of SCRUB_STATEMENTS)
    console.log(`    ${statement.split(' WHERE')[0]}`)
  console.log('')

  if (DRY_RUN) {
    console.log('Dry run complete — nothing was touched.')
    console.log('')
    return
  }

  console.log(`Resetting ${branch.name} from ${parent.name}...`)
  const operations = await neon.resetFromParent(branch.id, parent.id)
  await neon.waitForOperations(operations)
  console.log(`  reset finished (${operations.length} Neon operation(s))`)
  console.log('')

  console.log('Scrubbing...')
  await scrub(devUrl)
  console.log('')
  console.log(`Done. ${branch.name} is a scrubbed copy of ${parent.name}.`)
  console.log('If your code has schema changes the parent lacks, run: pnpm db:push:dev')
  console.log('')
}

main().catch((err) => {
  console.error('Fatal error:', err)
  process.exit(1)
})
```

- [ ] **Step 4: Swap the package scripts and delete the old script**

In `package.json`, replace these two lines:
```json
    "db:snapshot": "tsx scripts/snapshot-prod-to-dev.ts",
    "db:snapshot:fresh": "tsx scripts/snapshot-prod-to-dev.ts --fresh",
```
with this one line:
```json
    "db:refresh:dev": "tsx scripts/refresh-dev-from-prod.ts",
```
Then:
```bash
git rm scripts/snapshot-prod-to-dev.ts
```

- [ ] **Step 5: Type-check and lint**

Run: `pnpm tsc && pnpm lint`
Expected: both exit 0. If lint reformats the union type layout in `TargetResolution`, accept lint's layout. The 🧪 references left in `src/shared/lib/pdf/render-pdf.ts` and `docs/plans/**` are comments and dated docs; they stay.

- [ ] **Step 6: Dry-run against the real project (read-only)**

Run: `pnpm db:refresh:dev --dry-run`
Expected output, then exit code 1:
```
--- db:refresh:dev [DRY RUN] ---
  target  development  (br-small-sun-afns8axo)
  parent  production  (br-purple-field-afkq0ups)

  development has 3 child branch(es). Neon will not reset a branch with children:
    wt/issue-285         br-damp-union-afsx4126  (archived)
    wt/issue-280         br-silent-term-afbexbkh  (archived)
    wt/issue-29          br-falling-fire-aftky0ld  (archived)
  ...
```
The three children may print in a different order (Neon lists by `updated_at`); the set is what matters. This proves the API calls, endpoint resolution and the children guard against live data without touching anything. (If the operator has already pruned children by the time this runs, the dry run instead prints the scrub plan and `Dry run complete`.)

- [ ] **Step 7: Prove the same-endpoint guard**

Run: `DATABASE_DEV_URL="$(grep '^DATABASE_URL=' .env | cut -d= -f2-)" pnpm db:refresh:dev --dry-run`
Expected: exits 1 with `DATABASE_DEV_URL and DATABASE_URL point at the same endpoint (ep-flat-wind-afvc0zla)`. (`load-env` never overwrites a variable already in the shell, so the override takes effect.)

- [ ] **Step 8: Commit**

```bash
git add scripts/lib/neon-refresh.ts scripts/lib/neon-api.ts scripts/refresh-dev-from-prod.ts package.json
git commit -m "feat(db)!: replace the prod→dev copy script with a Neon reset-from-parent

pnpm db:refresh:dev resets the branch behind DATABASE_DEV_URL to its
parent's head and scrubs device/third-party state in one transaction.
Rows are byte-identical to prod — no more 🧪 prefixes. Refuses default,
protected, root, same-endpoint and parent-with-children targets.
Retires scripts/snapshot-prod-to-dev.ts and both db:snapshot entries.

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 2: Docs and memory for the new standard

**Files:**
- Modify: `CLAUDE.md` (Commands block, the `db:reset:dev / db:seed:dev / db:snapshot` line)
- Modify: `docs/codebase-conventions/environment.md` (insert a rule under `## Dev tooling`, immediately before `## Key integrations`)
- Modify: `docs/plans/2026-07-15-r2-dev-prod-blob-consistency-handoff.md` (two stale sentences)
- Delete: `memory/reference-db-snapshot.md`; Create: `memory/reference-db-refresh.md`; Modify: `memory/reference-neon-branching.md` (one line), `memory/MEMORY.md` (the `DB env:` line). Memory dir is `/home/olis-solutions/.claude/projects/-home-olis-solutions-olis-v3-nextjs-tri-pros-website/memory/`.

- [ ] **Step 1: CLAUDE.md command line**

Replace:
```
pnpm db:reset:dev / db:seed:dev / db:snapshot
```
with:
```
pnpm db:reset:dev / db:seed:dev
pnpm db:refresh:dev [--dry-run]   # dev DB ← Neon reset from parent + scrub (rows identical to prod; no emoji)
```

- [ ] **Step 2: environment.md rule**

Insert before the `## Key integrations` heading:
```markdown
- **Refreshing dev data** — `pnpm db:refresh:dev` (dry-run: `--dry-run`). Resets
  the Neon branch behind `DATABASE_DEV_URL` to its parent's head (development ←
  production on main; `wt/issue-N` ← development in a worktree) and scrubs
  device-bound and third-party state in one transaction (`scripts/lib/neon-refresh.ts`
  `SCRUB_STATEMENTS`). Rows are byte-identical to the parent — the environment is told
  apart by the green app accent (`data-env` on `<html>`, from `VERCEL_ENV`), never by
  data markers. The branch must have no child branches (`pnpm dispatch neon-prune`) and
  comes back on the parent's schema, so run `pnpm db:push:dev` afterwards if local code
  has schema changes prod lacks. Prod is never written. The old copy script is gone
  (2026-09-17).
```

- [ ] **Step 3: Fix the two stale sentences in the R2 handoff doc**

In `docs/plans/2026-07-15-r2-dev-prod-blob-consistency-handoff.md`:

Replace, in the "one-paragraph problem" (line 11):
```
The dev DB is a snapshot of prod (🧪-prefixed rows, `pnpm db:snapshot`), so dev rows point at the **exact same pathKeys** prod serves.
```
with:
```
The dev DB is a Neon reset of prod (`pnpm db:refresh:dev`, rows byte-identical — updated 2026-09-17), so dev rows point at the **exact same pathKeys** prod serves.
```

Replace the "Env→DB selection" bullet:
```
- **Env→DB selection:** runtime db client picks its URL via `NODE_ENV` (scripts run against dev by default). Never `pnpm db:push` (prod); dev is `pnpm db:push:dev`. Dev DB is routinely reset/re-snapshotted from prod.
```
with:
```
- **Env→DB selection:** `resolveDbTarget()` in `src/shared/config/db-target.ts` — `DRIZZLE_TARGET` decides, unset never means prod (updated 2026-09-17; see `docs/codebase-conventions/environment.md#environment-axes`). Never `pnpm db:push:prod` casually; dev is `pnpm db:push:dev`. Dev DB is routinely reset from prod with `pnpm db:refresh:dev`.
```

- [ ] **Step 4: Memory notes**

Delete `memory/reference-db-snapshot.md`. Create `memory/reference-db-refresh.md`:
```markdown
---
name: reference-db-refresh
description: Refresh the dev DB from prod with `pnpm db:refresh:dev` (Neon reset-from-parent + scrub). Replaced the row-copy 🧪 snapshot script 2026-09-17. Children rule, scrub list, worktree behavior, db:push:dev afterwards.
type: reference
---

## Command

`pnpm db:refresh:dev` (`scripts/refresh-dev-from-prod.ts`). `--dry-run` prints target, parent, children and the scrub plan and touches nothing.

## What it does

1. Resolves the Neon branch behind `DATABASE_DEV_URL` by endpoint id (`ep-…`, pooler suffix stripped) and refuses if it equals prod's endpoint, is the default/protected/root branch, or has child branches.
2. Neon reset-from-parent (documented `restore` endpoint, parent = source, head). Seconds, copy-on-write, byte-identical data + schema + sequences. Connection strings unchanged. Prod is never written.
3. One transaction on the reset branch (`SCRUB_STATEMENTS` in `scripts/lib/neon-refresh.ts`): DELETE `session`, `account`, `verification`, `push_subscriptions`, `qb_auth_tokens`, `bina_webhook_logs`; NULL `gcal_event_id/gcal_etag/gcal_synced_at` on `meetings` + `activities`; NULL `proposals.contract_envelope_id`. Same exclusion set the old copy script had. VoIP tables and `app_settings` are kept.

## Rules

- **Children block the reset.** `development` gets `wt/*` children from dispatch. Orphans: `pnpm dispatch neon-prune`. A live worktree's branch: delete it (or `dispatch cleanup`); `dispatch start <issue>` recreates it from the refreshed parent.
- **Schema comes back as the parent's.** Run `pnpm db:push:dev` afterwards if local code has schema changes prod lacks.
- **Worktrees:** the target follows the connection string — inside a worktree the command resets `wt/issue-N` from `development`. Refresh development first for fresh prod data.
- **Environment is shown by color, not data.** Green accent = `data-env` is `development` or `preview` (`src/shared/config/deployment-env.ts`, from `VERCEL_ENV`). Never re-add data markers. Known gap: `DRIZZLE_TARGET=prod pnpm dev` is green on prod data.
- Neon caveat: for up to 24 h after a production snapshot *restore*, children cannot be reset from it.
- Free plan: production cannot be a protected branch (paid feature). When upgraded: `neon api /projects/polished-shape-00174668/branches/br-purple-field-afkq0ups -X PATCH -F branch.protected=true`.
- Manual prod snapshot (Free plan = 1): `neon snapshots delete <old> --project-id polished-shape-00174668` then `neon snapshots create --project-id polished-shape-00174668 --branch production --name "pre-<event>-$(date +%F)"`.
```

In `memory/MEMORY.md`, on the `DB env:` line, replace `[DB Snapshot](reference-db-snapshot.md)` with `[DB refresh (Neon reset)](reference-db-refresh.md)`.

In `memory/reference-neon-branching.md`, under `### Limits`, replace the stale line
```
- **Data freshness:** Branch forks from parent at creation time. New dev seed data after fork won't appear — run `pnpm db:seed` in worktree if needed.
```
with
```
- **Data freshness:** Branch forks from parent at creation time. To bring a worktree branch up to date with `development`, run `pnpm db:refresh:dev` inside the worktree (it resets `wt/issue-N` from `development`); `pnpm db:seed:dev` only re-seeds the construction catalog.
```

- [ ] **Step 5: Lint (markdown is ignored by lint; this is a sanity run) and commit**

Run: `pnpm lint`
Expected: exit 0.

```bash
git add CLAUDE.md docs/codebase-conventions/environment.md docs/plans/2026-07-15-r2-dev-prod-blob-consistency-handoff.md
git commit -m "docs: document pnpm db:refresh:dev as the dev-data standard

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```
(The memory directory is outside the repo; no commit for it.)

---

### Task 3: Environment indicator on `<html>`, green dev accent, one DB-target resolver

**Files:**
- Create: `src/shared/config/deployment-env.ts`
- Create: `src/shared/config/db-target.ts`
- Modify: `src/shared/db/index.ts:4-26`
- Modify: `src/app/(frontend)/layout.tsx:1-5` (imports) and `:123-127` (the `<html>` tag)
- Modify: `src/app/(frontend)/globals.css` — insert a block after the closing `}` of the `.dark { … }` block (line ~393) and before `@theme inline {`
- Modify: `docs/design-system/DESIGN.md` (Color section, one bullet)

**Interfaces:**
- Produces: `type DeploymentEnv = 'development' | 'preview' | 'production'`, `resolveDeploymentEnv(): DeploymentEnv`; `type DbTarget = 'prod' | 'dev'`, `resolveDbTarget(): DbTarget`, `resolveDbUrl(): string`. Task 4 imports `resolveDbTarget`.

- [ ] **Step 1: Write the deployment-environment resolver**

```ts
// src/shared/config/deployment-env.ts
import env from '@/shared/config/server-env'

export type DeploymentEnv = 'development' | 'preview' | 'production'

/**
 * Which environment this process is deployed in — the axis the production
 * safety gates already key on. Vercel injects VERCEL_ENV into every build and
 * invocation; a local machine never has it, so absent means `development`.
 * NODE_ENV is deliberately NOT consulted: it is the build mode and is
 * `production` on preview builds too.
 * see docs/codebase-conventions/environment.md#environment-axes
 */
export function resolveDeploymentEnv(): DeploymentEnv {
  return env.VERCEL_ENV ?? 'development'
}
```

- [ ] **Step 2: Write the DB-target resolver**

```ts
// src/shared/config/db-target.ts
import process from 'node:process'
import env from '@/shared/config/server-env'

export type DbTarget = 'prod' | 'dev'

/**
 * Which database this process is on. Extracted from the DB singleton so the
 * same decision can gate side effects that follow the DATA rather than the
 * environment (the R2 purge in modules/media/core/lib/purge.ts).
 *
 * Rules — see docs/codebase-conventions/environment.md#environment-axes:
 *   DRIZZLE_TARGET=prod             → prod
 *   DRIZZLE_TARGET=dev              → dev  (if DATABASE_DEV_URL is set)
 *   unset + VERCEL_ENV=production   → prod
 *   unset + anything else           → dev  (if DATABASE_DEV_URL is set)
 *
 * "dev" is reported only when the dev URL actually exists: a process that
 * falls back to DATABASE_URL is on PROD DATA and must say so.
 */
export function resolveDbTarget(): DbTarget {
  const explicit = process.env.DRIZZLE_TARGET
  const wantsProd = explicit === 'prod' || (explicit !== 'dev' && env.VERCEL_ENV === 'production')
  if (wantsProd)
    return 'prod'
  return env.DATABASE_DEV_URL ? 'dev' : 'prod'
}

export function resolveDbUrl(): string {
  if (resolveDbTarget() === 'dev' && env.DATABASE_DEV_URL)
    return env.DATABASE_DEV_URL
  return env.DATABASE_URL
}
```

- [ ] **Step 3: Point the DB singleton at it**

Replace `src/shared/db/index.ts` lines 4–26 (from `import env` through the `Pool` construction) so the file reads:
```ts
import { drizzle } from 'drizzle-orm/node-postgres'

import { Pool } from 'pg'
import { resolveDbUrl } from '@/shared/config/db-target'
import * as schema from '@/shared/db/schema'

// DB selection lives in src/shared/config/db-target.ts so the same decision
// can gate data-following side effects (the R2 purge).
// see docs/codebase-conventions/environment.md#environment-axes
const pool = new Pool({
  connectionString: resolveDbUrl(),
})

const db = drizzle(pool, {
  // eslint-disable-next-line node/prefer-global/process
  logger: process.env.npm_config_logger === 'true',
  schema,
})

export type DB = typeof db
export type DbOrTx = DB | Parameters<Parameters<DB['transaction']>[0]>[0]
export type Tx = Parameters<Parameters<DB['transaction']>[0]>[0]
export { db }
```
Behavior is unchanged: the URL chosen for every combination of `DRIZZLE_TARGET`, `VERCEL_ENV` and `DATABASE_DEV_URL` is the same as before.

- [ ] **Step 4: Stamp the attribute in the root layout**

In `src/app/(frontend)/layout.tsx` add the import after the `Providers` import:
```ts
import { resolveDeploymentEnv } from '@/shared/config/deployment-env'
```
and change the `<html>` opening tag to:
```tsx
    <html
      lang="en"
      suppressHydrationWarning
      data-scroll-behavior="smooth"
      data-env={resolveDeploymentEnv()}
    >
```

- [ ] **Step 5: Add the green override block to globals.css**

Insert immediately after the closing `}` of the `.dark { … }` block (the line before `@theme inline {`):
```css
/* Environment indicator — the root layout stamps data-env on <html> from
   resolveDeploymentEnv() (src/shared/config/deployment-env.ts): development
   locally, preview / production on Vercel. Anything that is not production
   turns the app accent green, so a screen in dev can never be mistaken for
   the live site. This replaces the old 🧪 row prefix. It is an operator
   signal, not a brand accent: .theme-marketing / .funnel-light redefine their
   own tokens on their wrappers and stay brand blue. The dashboard glow and
   sidebar active state derive from --primary via color-mix, so no component
   knows about this. */
:root[data-env='development'],
:root[data-env='preview'] {
  --primary: oklch(0.6231 0.17 152);
  --accent: oklch(0.9619 0.0179 152);
  --accent-foreground: oklch(0.6231 0.17 152);
  --ring: oklch(0.6231 0.17 152);
  --chart-1: oklch(0.6231 0.17 152);
  --sidebar-primary: oklch(0.6231 0.17 152);
  --sidebar-accent: oklch(0.9619 0.0179 152);
  --sidebar-accent-foreground: oklch(0.6231 0.17 152);
  --sidebar-ring: oklch(0.6231 0.17 152);
}

:root[data-env='development'].dark,
:root[data-env='preview'].dark {
  --background: oklch(0.2433 0.0247 152);
  --card: oklch(24.159% 0.01537 152);
  --popover: oklch(26.778% 0.03273 152);
  --primary: oklch(0.6231 0.17 152);
  --accent: oklch(0.6231 0.17 152);
  --accent-foreground: oklch(1 0 0);
  --ring: oklch(0.6231 0.17 152);
  --chart-1: oklch(0.6231 0.17 152);
  --sidebar: oklch(0.2433 0.0247 152);
  --sidebar-primary: oklch(0.6231 0.17 152);
  --sidebar-accent: oklch(0.6231 0.17 152);
  --sidebar-accent-foreground: oklch(1 0 0);
  --sidebar-ring: oklch(0.6231 0.17 152);
}
```
(`next-themes` puts `dark` as a class on `<html>`, so `:root[data-env='development'].dark` is `html.dark[data-env="development"]`; its specificity (0,2,0) beats `.dark` (0,1,0) and `:root` (0,1,0). The selectors are explicit rather than `:not([data-env='production'])` so a document without the attribute stays blue.)

- [ ] **Step 6: DESIGN.md note**

In `docs/design-system/DESIGN.md`, under `### Color`, add after the "Mode-dependent neutrals + brand blue" bullet:
```markdown
- **Environment indicator (not an accent).** Outside production, `:root[data-env='development'], :root[data-env='preview']` in `globals.css` turns the app `--primary`/`--sidebar-*` family green (`oklch(0.6231 0.17 152)`). It is an operator signal so dev is never mistaken for the live site; marketing/funnel themes are unaffected. Never use it as a design color.
```

- [ ] **Step 7: Type-check and lint**

Run: `pnpm tsc && pnpm lint`
Expected: both exit 0.

- [ ] **Step 8: Verify in the browser**

1. Check nothing is already on the port: `ss -ltnp | grep -E ':(3000|3001|3002)\b'` (memory rule: never kill a dev server you did not start). Start `pnpm dev` in the background if the port is free; note the port it prints.
2. `curl -s http://localhost:<port>/ | grep -o 'data-env="[a-z]*"'` → expected `data-env="development"`.
3. In the Playwright MCP browser, navigate to `http://localhost:<port>/api/dev/playwright-session?secret=<DEV_LOGIN_SECRET from .env.local>&redirect=/dashboard` (the sign-in ritual in `memory/reference-playwright-auth.md`), then take a screenshot of `/dashboard`. Expected: the radial glow at the top of the content area and the active sidebar item are green; text remains legible. Toggle the OS/app theme if needed to see both light and dark.
4. Prove the production value without a deploy. Create `scripts/tmp-env-check.ts`:
   ```ts
   import { resolveDbTarget } from '@/shared/config/db-target'
   import { resolveDeploymentEnv } from '@/shared/config/deployment-env'
   import './lib/load-env'

   console.log({ env: resolveDeploymentEnv(), db: resolveDbTarget() })
   ```
   `pnpm tsx scripts/tmp-env-check.ts` → `{ env: 'development', db: 'dev' }`; `VERCEL_ENV=production pnpm tsx scripts/tmp-env-check.ts` → `{ env: 'production', db: 'prod' }`; `DRIZZLE_TARGET=prod pnpm tsx scripts/tmp-env-check.ts` → `{ env: 'development', db: 'prod' }` (the documented gap). This only reads env and opens no connection. Delete the tmp file afterwards.
5. Stop the dev server you started.

- [ ] **Step 9: Commit**

```bash
git add src/shared/config/deployment-env.ts src/shared/config/db-target.ts src/shared/db/index.ts "src/app/(frontend)/layout.tsx" "src/app/(frontend)/globals.css" docs/design-system/DESIGN.md
git commit -m "feat(env): green app accent outside production

The root layout stamps data-env on <html> from VERCEL_ENV (absent locally
= development); one CSS block turns the accent family green for
development and preview. Replaces the 🧪 data marker. The DB singleton's
URL choice moves to resolveDbTarget() so data-following side effects can
share it.

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 4: Gate the R2 purge on the DB target

**Files:**
- Modify: `src/shared/modules/media/core/lib/purge.ts`
- Modify: `src/shared/modules/media/DOCS.md` (`### the-r2-purge-path`)
- Modify: `docs/plans/2026-07-15-r2-dev-prod-blob-consistency-handoff.md` (failure mode 1)

**Interfaces:**
- Consumes: `resolveDbTarget` (Task 3).

- [ ] **Step 1: Add the gate**

Replace `src/shared/modules/media/core/lib/purge.ts` with:
```ts
// THE single R2 purge path for media (MD7). A leaf: it imports the R2 provider
// and the db-target config, nothing else, so a DAL hook can call it without a
// DAL ever importing a service.
import type { R2BucketName } from '@/shared/services/providers/r2/types'
import { resolveDbTarget } from '@/shared/config/db-target'
import { r2Client } from '@/shared/services/providers/r2/client'

interface PurgeableRow {
  bucket: string | null
  pathKey: string | null
  optimizationVariants?: string[] | null
}

/**
 * Delete a media row's R2 original and its variants.
 *
 * Only a process on PROD data actually deletes. Dev and prod share one bucket,
 * and dev is a Neon reset of prod that keeps the same pathKeys, so a dev-side
 * delete must remove the row only — deleting the object would 404 the live
 * site. The gate follows the DATA target, not the deployment environment: a
 * local script on DRIZZLE_TARGET=prod must purge, a preview on the dev DB must
 * not. The skip is logged with the key so an operator can see what dev left
 * behind (see docs/plans/2026-07-15-r2-dev-prod-blob-consistency-handoff.md).
 *
 * Suffixes are the owner's write-time list UNIONED with whatever the row actually
 * recorded (D3): `store.variants` alone fixes new rows, and the union also covers
 * rows written when a variant list was longer. A key that doesn't exist is caught
 * and ignored by the provider, so the extra calls are harmless.
 *
 * Rows with null coordinates (a Cloudflare Stream row, Plan 1b) have no object —
 * skipped, and the caller still removes the DB row.
 */
export async function purgeMediaObject(row: PurgeableRow, variants: readonly string[]): Promise<void> {
  if (!row.bucket || !row.pathKey) {
    return
  }
  if (resolveDbTarget() !== 'prod') {
    console.warn(`[purgeMediaObject] skipped R2 delete (db target is dev, object is shared with prod): ${row.bucket}/${row.pathKey}`)
    return
  }
  const suffixes = [...new Set([...variants, ...(row.optimizationVariants ?? [])])]
  await r2Client.deleteMediaWithVariants(row.bucket as R2BucketName, row.pathKey, suffixes)
}
```

- [ ] **Step 2: Update the media DOCS**

In `src/shared/modules/media/DOCS.md`, `### the-r2-purge-path`, change the first sentence's leaf description from "it imports only the R2 client" to "it imports only the R2 client and `resolveDbTarget` from `@/shared/config/db-target`", and add this paragraph before `**Reference impl**: `core/lib/purge.ts``:
```markdown
**Data-target gate (2026-09-17).** The object is deleted only when `resolveDbTarget() === 'prod'`. Dev and prod share the `tpr-media` bucket and dev is a Neon reset of prod with identical `pathKey`s, so a dev delete removes the row and logs the skipped key instead of removing the object prod serves. The gate keys on the data target, not `data-env`/`VERCEL_ENV`: a local script that must purge on prod runs with `DRIZZLE_TARGET=prod`, and a preview deploy on the dev database must never purge.
```

- [ ] **Step 3: Close failure mode 1 in the handoff doc**

In `docs/plans/2026-07-15-r2-dev-prod-blob-consistency-handoff.md`, at the end of the "1. **CRITICAL — dev deletes destroy prod images.**" paragraph append:
```
**Closed 2026-09-17:** `purgeMediaObject` (`src/shared/modules/media/core/lib/purge.ts`) skips the R2 delete unless `resolveDbTarget() === 'prod'`.
```

- [ ] **Step 4: Type-check and lint**

Run: `pnpm tsc && pnpm lint`
Expected: both exit 0.

- [ ] **Step 5: Verify the skip against a throwaway dev row**

With `pnpm dev` running on the dev DB (Task 3 step 8 setup) and the Playwright browser signed in as super-admin:
1. Open a project's media manager, upload one small image, note its public URL from the rendered `<img src>` (a `media.triprosremodeling.com/projects/…` URL).
2. `curl -sI <url> | head -1` → `HTTP/2 200`.
3. Delete that photo in the UI. Expected in the dev-server terminal: one `[purgeMediaObject] skipped R2 delete (db target is dev …)` line. Expected: the row is gone from the gallery.
4. `curl -sI <url> | head -1` → still `HTTP/2 200` (the object survived).
5. The one blob you just orphaned is the accepted cost of the test; note its key in the commit body so the future sweeper (handoff item 3) can find it.

- [ ] **Step 6: Commit**

```bash
git add src/shared/modules/media/core/lib/purge.ts src/shared/modules/media/DOCS.md docs/plans/2026-07-15-r2-dev-prod-blob-consistency-handoff.md
git commit -m "fix(media): never purge shared R2 objects from a dev-database process

Dev is a Neon reset of prod with identical pathKeys in the shared bucket,
so a dev delete removed the object the live site serves. purgeMediaObject
now deletes only when resolveDbTarget() is prod and logs the skip otherwise.
Closes failure mode 1 of the 2026-07-15 R2 handoff.

Test orphan left in tpr-media: <pathKey from step 5>

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 5: Operator runbook — first real refresh (human runs this)

Not an agent task. Run on `main`, in this order.

- [ ] **Step 1: Decide what happens to the three child branches.** `wt/issue-280` has no worktree → orphan. `wt/issue-285` and `wt/issue-29` belong to live worktrees; deleting their DB branches loses only dev data on those branches (schema is in code; `pnpm dispatch start <issue>` recreates the branch from the refreshed `development`). If either worktree holds unpushed schema experiments you want to keep as data, park them first.
  ```bash
  pnpm dispatch neon-prune                       # deletes wt/issue-280
  neon branches delete wt/issue-285 --project-id polished-shape-00174668   # only if you accept the above
  neon branches delete wt/issue-29  --project-id polished-shape-00174668   # only if you accept the above
  pnpm db:refresh:dev --dry-run                  # must now print the scrub plan and "Dry run complete"
  ```
- [ ] **Step 2: Refresh.**
  ```bash
  pnpm db:refresh:dev
  ```
  Expected: `reset finished`, nine scrub lines with row counts, `Done. development is a scrubbed copy of production.`
- [ ] **Step 3: Re-apply local schema drift if any.**
  ```bash
  pnpm db:push:dev
  ```
- [ ] **Step 4: Verify.**
  - `pnpm dev`, sign in (everyone is signed out of dev after a refresh — sessions were scrubbed), confirm the dashboard is green.
  - No emoji rows remain. Create `scripts/tmp-check-emoji.ts`:
    ```ts
    import process from 'node:process'
    import { Pool } from 'pg'
    import './lib/load-env'

    const pool = new Pool({ connectionString: process.env.DATABASE_DEV_URL })
    const { rows } = await pool.query(`SELECT count(*)::int AS n FROM customers WHERE name LIKE '🧪%'`)
    console.log(rows[0])
    await pool.end()
    ```
    `pnpm tsx scripts/tmp-check-emoji.ts` → `{ n: 0 }`. Delete the tmp file afterwards.
  - Resume a parked worktree with `pnpm dispatch start 285`; it recreates `wt/issue-285` from the refreshed development.
- [ ] **Step 5: Optional hygiene while you are in the Neon CLI.** Refresh the single manual prod snapshot (Free plan allows one):
  ```bash
  neon snapshots delete snap-calm-bird-afia5xgl --project-id polished-shape-00174668
  neon snapshots create --project-id polished-shape-00174668 --branch production --name "post-refresh-standard-$(date +%F)"
  ```
