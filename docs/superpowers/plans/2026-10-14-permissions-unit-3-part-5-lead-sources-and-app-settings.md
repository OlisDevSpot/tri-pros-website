# Permissions unit 3 part 5: Lead sources and AppSetting — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** `LeadSource` and `AppSetting` run on compiled CASL rules, every hand-written lead-source read and write in the lead-sources router ANDs the compiled reach, and the one agent-reachable lead-source reader (`getSourceCampaignSummaries`) becomes super-admin only.

**Architecture:** `'LeadSource'` and `'AppSetting'` join `COMPILED_SUBJECTS`, so `createCrudDal` scopes both specs through `permit`; their `visibility` functions (both `sql\`false\``) are deleted. No rule is added: only super-admin's `manage all` reaches either subject, so the compiled filter is `true` for super-admin and `false` for every other role. The router's `{ ...ctx, scope: null }` spreads become `ctx`; the CRUD update hook reads the current row under its own context instead of `SYSTEM_CONTEXT`.

**Tech Stack:** Next.js 15 app router, tRPC 11, Drizzle (Postgres/Neon), `@casl/ability` 6.8.0, better-auth.

**Spec:** `docs/superpowers/specs/2026-10-05-permissions-structure-design.md` (§6–§7), tracker `docs/plans/2026-08-10-casl-scope-compiler-epic.md` (D-02, D-07, D-15, D-16, D-24; §4 Unit 3 "what is left" items 2 and 4). Design approved by the owner in chat 2026-10-14, with the ruling that Applications are left to the proposal applications epic (recorded in the tracker §4, item 1).

## Global Constraints

- Never `pnpm build`. Each task ends with `pnpm tsc` and `pnpm lint` passing, run from the worktree root.
- No test runner and no unit tests in the permissions library. Verification is `pnpm tsc`, `pnpm lint`, `src/shared/domains/permissions/type-checks/must-not-compile.ts` (under `pnpm tsc`), the DB-free tsx probe and GET-only API probes as dev role fixtures.
- No database writes for testing, the dev database included. Never print a phone, an email, an intake token, a slug or a row id in any output.
- No backwards compatibility: a change removes what it replaces in the same commit. No aliases, no wrappers kept for old call sites.
- Comments say why, never what, and never cite plans, specs, tasks or tracker ids. No file banners. A comment this plan makes false (anything saying lead sources resolve to omni, `scope: null`, or "visibility predicate") is rewritten or deleted in the same edit.
- New names need the owner's agreement. This part adds no exported name. Any new exported name: stop and ask.
- `@casl/ability` stays 6.8.0.
- NO outcome or pipeline-derivation logic on this branch.
- Git: stay on `refactor/285-refactor-permissions-casl-scope-compiler`. Never `git stash`, `git reset`, `git checkout <file>` or `git restore`. Stage by explicit path. Conventional commits ending with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`. The pre-commit hook takes about 110 s: use a 300000 ms timeout on `git commit`. Push after each commit (`git push -q origin HEAD`).
- Do not kill or restart the owner's dev server (port 3003). It hot-reloads.
- Run tsx probes from inside the worktree: `NODE_OPTIONS="--conditions=react-server" node_modules/.bin/tsx --tsconfig tsconfig.json <file>`.
- `DEV_LOGIN_SECRET` goes into a shell only: `export DEV_LOGIN_SECRET="$(sed -n 's/^DEV_LOGIN_SECRET=//p' /home/olis-solutions/olis-v3/nextjs/tri-pros-website/.env.local | tr -d '"')"`. Never echo it.

## Review Focus

1. **A super-admin changes a lead source's slug, then saves again without changing it.** Expected: the first save rotates the intake token, the second does not; a slug already used by another source answers PRECONDITION_FAILED. The hook's current-row read now runs under the caller's context (it was `SYSTEM_CONTEXT`). Pinned in Task 1 Step 3 (code) and the owner's hand check H1.
2. **A super-admin enters, then clears, a spend-grid cell.** Expected: both saves succeed; `setLeadSourceSpend` reads the source through `leadSourceCrud.getById(ctx, …)`, which is now the compiled read reach. Pinned in the owner's hand check H2.
3. **An agent or dispatcher calls `voipCampaignsRouter.getSourceCampaignSummaries` directly.** Expected: FORBIDDEN (was 200 with every source's name, slug, policy and counts); the super-admin campaigns overview still loads. Pinned in Task 2 Step 3.
4. **A non-super-admin reaches a lead-source or app-setting read through any path.** Expected: the compiled filter is `false`, so a list is empty and a single read is not found, even if a procedure gate were missing. Pinned in Task 1 Step 6 (DB-free probe, all five roles).
5. **A homeowner submits a lead-source intake form or a funnel.** Expected: unchanged; the public intake lookups by slug and token (`landing.router`, `intake/page.tsx`, `customer-intake.service.ts`) take no actor and are not touched by this plan. Pinned in Task 1 Step 7 (the diff-scope grep) and the owner's hand check H3.

---

## File map

| File | Task | Change |
|---|---|---|
| `.superpowers/permissions-probes/lead-source-rules.ts` | 1 | exists (written while planning, git-ignored): DB-free per-role probe |
| `.superpowers/permissions-probes/part5-checks.cjs` | 1 | create: GET-only per-role probe (git-ignored) |
| `src/shared/dal/server/lib/scope.ts` | 1 | `'LeadSource'`, `'AppSetting'` compiled |
| `src/shared/entities/lead-sources/lib/server-spec.ts` | 1 | `visibility` dropped |
| `src/shared/entities/lead-sources/lib/visibility.ts` | 1 | deleted |
| `src/shared/entities/app-settings/lib/server-spec.ts` | 1 | `visibility` dropped |
| `src/shared/entities/app-settings/lib/visibility.ts` | 1 | deleted |
| `src/shared/entities/lead-sources/dal/server/crud.ts` | 1 | `SYSTEM_CONTEXT` → the hook's `ctx`; comment |
| `src/trpc/routers/lead-sources.router.ts` | 1 | `scope: null` spreads gone; 6 reads and 2 writes AND `permit` |
| `src/trpc/DOCS.md`, `docs/codebase-conventions/dal-conventions.md`, `docs/codebase-conventions/trpc-procedures.md`, `docs/plans/2026-09-26-sales-calculators-epic.md` | 1 | compiled-family lists; the stale `visibility.ts` citation |
| `src/trpc/routers/voip-campaigns.router.ts` | 2 | `getSourceCampaignSummaries` on `superAdminProcedure` |
| tracker, DISTILLED, memory | 3 | record |

**Not in this plan (named so nobody reads them in):** the ctx-free lead-source DAL readers and writer (`listLeadSources`, `getLeadSourceById`, `getLeadSourceBySlug` in `dal/server/queries.ts`, `listLeadSourceSpend`, `setVoipCampaignsPolicy`): their callers are public intake, jobs, analytics and super-admin routes, and moving raw reads behind the owning DAL is unit 5's lint wall (D-24); the public intake lookups by slug and token (`landing.router/index.tsx`, `src/app/(frontend)/intake/page.tsx`, `customer-intake.service.ts`, `enroll-source-batch.ts`): public by design; the lead-source name joined onto customer and meeting rows (`customer-field-sql.ts`, `pipeline-items.ts`, customer and meeting `queries.ts`, `meeting-field-sql.ts`): a display column of those rows; the router's `customers` / `meetings` / `projects` / `proposals` aggregate reads (super-admin analytics, Ledger 1, unit 5); `voipCampaignsRouter.listCampaigns`, `listContactFields`, `listEnrolledLeads` (also on `agentProcedure`, VoIP part); Applications (left to the applications epic, owner 2026-10-14); the lead-source picker on the customer profile calling the super-admin `leadSourcesRouter.list` (UI, not a permission hole).

---

### Task 1: LeadSource and AppSetting on compiled rules

**Files:**
- Create: `.superpowers/permissions-probes/part5-checks.cjs` (git-ignored)
- Run (exists): `.superpowers/permissions-probes/lead-source-rules.ts` (git-ignored)
- Modify: `src/shared/dal/server/lib/scope.ts:23`
- Modify: `src/shared/entities/lead-sources/lib/server-spec.ts`
- Delete: `src/shared/entities/lead-sources/lib/visibility.ts`
- Modify: `src/shared/entities/app-settings/lib/server-spec.ts`
- Delete: `src/shared/entities/app-settings/lib/visibility.ts`
- Modify: `src/shared/entities/lead-sources/dal/server/crud.ts:1-70`
- Modify: `src/trpc/routers/lead-sources.router.ts` (imports; `spendRouter.set`; `list`, `getById`, `getStats`, `getCustomers`, `getStatusCounts`, `getAnalytics`, `create`, `update`, `rotateToken`, `archive`, `duplicate`, `delete`)
- Modify: `src/trpc/DOCS.md:56`, `docs/codebase-conventions/dal-conventions.md:46`, `docs/codebase-conventions/trpc-procedures.md:40`, `docs/plans/2026-09-26-sales-calculators-epic.md:197`

**Interfaces:**
- Consumes: `permit(ctx, action, spec, fields?)` from `@/shared/dal/server/lib/permissions/permit` (returns `{ sql, probe, test }`; `sql` already ANDs the read reach into an `update`/`delete` reach); `leadSourceServerSpec` from `@/shared/entities/lead-sources/lib/server-spec`.
- Produces: `COMPILED_SUBJECTS` containing `'LeadSource'` and `'AppSetting'`; `part5-checks.cjs` (run as `node .superpowers/permissions-probes/part5-checks.cjs`), used again in Task 2.

- [ ] **Step 1: Write the GET-only probe and record the baseline BEFORE any code change**

`.superpowers/permissions-probes/part5-checks.cjs`:

```js
// Lead-source and campaign-summary reads per role. GET-only (every other method is aborted); prints counts and
// codes only: never an id, a slug, a token, a phone or an email.
const { chromium } = require('/home/olis-solutions/olis-v3/nextjs/tri-pros-website/.worktrees/issue-285/node_modules/playwright')
const BASE = 'http://localhost:3003'
const secret = process.env.DEV_LOGIN_SECRET
const q = async (ctx, path, input) => {
  const qs = input === undefined ? '' : `?input=${encodeURIComponent(JSON.stringify({ json: input }))}`
  const r = await ctx.request.get(`${BASE}/api/trpc/${path}${qs}`, { timeout: 180000 })
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
    const saList = await q(sa, 'leadSourcesRouter.list', { includeInactive: true })
    const S = (saList.data ?? [])[0]?.id
    out.picked = { source: Boolean(S) }
    const probe = async (ctx) => {
      const list = await q(ctx, 'leadSourcesRouter.list', { includeInactive: true })
      const one = S ? await q(ctx, 'leadSourcesRouter.getById', { id: S }) : null
      const stats = S ? await q(ctx, 'leadSourcesRouter.getStats', { id: S }) : null
      const counts = S ? await q(ctx, 'leadSourcesRouter.getStatusCounts', { id: S }) : null
      const analytics = S ? await q(ctx, 'leadSourcesRouter.getAnalytics', { id: S }) : null
      const customers = S ? await q(ctx, 'leadSourcesRouter.getCustomers', { id: S, pagination: { limit: 20, offset: 0 } }) : null
      const grid = await q(ctx, 'leadSourcesRouter.spend.grid', { months: ['2026-09', '2026-10'] })
      const summaries = await q(ctx, 'voipCampaignsRouter.getSourceCampaignSummaries')
      const sc = r => r && { status: r.status, code: r.code }
      return {
        list: { ...sc(list), rows: Array.isArray(list.data) ? list.data.length : null, totalLeads: Array.isArray(list.data) ? list.data.reduce((n, s) => n + s.totalLeads, 0) : null },
        getById: one && { ...sc(one), found: Boolean(one.data) },
        getStats: sc(stats),
        getStatusCounts: counts && { ...sc(counts), all: counts.data?.all ?? null },
        getAnalytics: sc(analytics),
        getCustomers: customers && { ...sc(customers), total: customers.data?.total ?? null },
        spendGrid: { ...sc(grid), sources: grid.data?.sources?.length ?? null, entries: grid.data?.entries?.length ?? null },
        summaries: { ...sc(summaries), rows: Array.isArray(summaries.data) ? summaries.data.length : null },
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

If `getCustomers` answers BAD_REQUEST on the input shape, read `customerListInputSchema` in `src/shared/entities/customers/dal/server/queries.ts` and fix the probe's input, not the router.

Run, with the owner's dev server up on 3003:

```bash
export DEV_LOGIN_SECRET="$(sed -n 's/^DEV_LOGIN_SECRET=//p' /home/olis-solutions/olis-v3/nextjs/tri-pros-website/.env.local | tr -d '"')"
node .superpowers/permissions-probes/part5-checks.cjs | tee .superpowers/permissions-probes/part5-baseline.txt
NODE_OPTIONS="--conditions=react-server" node_modules/.bin/tsx --tsconfig tsconfig.json .superpowers/permissions-probes/lead-source-rules.ts | tee .superpowers/permissions-probes/part5-rules-baseline.txt
```

Expected baseline: super-admin 200 on every lead-sources procedure and on `summaries`; agent and dispatcher FORBIDDEN on every lead-sources procedure and **200** on `summaries` (the hole Task 2 closes). The rules probe prints `COMPILED_SUBJECTS = [Customer, CustomerNote, Meeting, Proposal, Project]`; super-admin `read lead source : true`, `update lead source : (true and true)`; every other role `false` / `(false and false)`; the four `can` flags `true` only for super-admin.

`lead-source-rules.ts` (already on disk; shown so a reader of this plan knows what it checks):

```ts
import type { UserRole } from '@/shared/constants/enums'
import type { ScopedContext } from '@/shared/dal/server/types'

import { PgDialect } from 'drizzle-orm/pg-core'

import { assertRulesCompile } from '@/shared/dal/server/lib/permissions/check-rules'
import { permit } from '@/shared/dal/server/lib/permissions/permit'
import { COMPILED_SUBJECTS } from '@/shared/dal/server/lib/scope'
import { defineAbilitiesFor } from '@/shared/domains/permissions/abilities'
import { appSettingServerSpec } from '@/shared/entities/app-settings/lib/server-spec'
import { leadSourceServerSpec } from '@/shared/entities/lead-sources/lib/server-spec'

const USER = '11111111-1111-4111-8111-111111111111'
const dialect = new PgDialect()
const render = (s: ReturnType<typeof permit>['sql']) => dialect.sqlToQuery(s).sql.replace(/\s+/g, ' ')
const ctxFor = (role: UserRole): ScopedContext => ({ actor: { ability: defineAbilitiesFor({ id: USER, role }), userId: USER }, scope: null })

assertRulesCompile()
console.log(`COMPILED_SUBJECTS = [${[...COMPILED_SUBJECTS].join(', ')}]`)
for (const role of ['super-admin', 'agent', 'dispatcher', 'homeowner', 'user'] as UserRole[]) {
  const ctx = ctxFor(role)
  const ab = ctx.actor.ability
  console.log(`\n── ${role}`)
  console.log({
    readLeadSource: ab.can('read', 'LeadSource'),
    updateLeadSource: ab.can('update', 'LeadSource'),
    readAppSetting: ab.can('read', 'AppSetting'),
    updateAppSetting: ab.can('update', 'AppSetting'),
  })
  console.log('read lead source   :', render(permit(ctx, 'read', leadSourceServerSpec).sql))
  console.log('update lead source :', render(permit(ctx, 'update', leadSourceServerSpec, ['token']).sql))
  console.log('delete lead source :', render(permit(ctx, 'delete', leadSourceServerSpec).sql))
  console.log('read app setting   :', render(permit(ctx, 'read', appSettingServerSpec).sql))
  console.log('update app setting :', render(permit(ctx, 'update', appSettingServerSpec).sql))
}
```

Also record the AC counts before the change:

```bash
git grep -n "SYSTEM_CONTEXT" -- src | grep -v "import " | wc -l
git grep -n "ctx\.scope\|scope: null" -- src | wc -l
git grep -n "visibility:" -- 'src/**/server-spec.ts' | wc -l
```

Expected: 18, 40, 10 (on `4dfe73349`; if main moved since, record what you see).

- [ ] **Step 2: Compile the two subjects and delete their visibility functions**

`src/shared/dal/server/lib/scope.ts:23`:

```ts
export const COMPILED_SUBJECTS: ReadonlySet<EntitySubject> = new Set<EntitySubject>(['AppSetting', 'Customer', 'CustomerNote', 'LeadSource', 'Meeting', 'Proposal', 'Project'])
```

`src/shared/entities/lead-sources/lib/server-spec.ts`: delete the line `import { leadSourceVisibility } from './visibility'` and the line `  visibility: leadSourceVisibility,`. Nothing else changes.

`src/shared/entities/app-settings/lib/server-spec.ts`: delete the line `import { appSettingVisibility } from './visibility'` and the line `  visibility: appSettingVisibility,`.

```bash
git rm -q src/shared/entities/lead-sources/lib/visibility.ts src/shared/entities/app-settings/lib/visibility.ts
```

The startup check under `COMPILED_SUBJECTS` in `scope.ts` throws if a compiled spec still declares `visibility`, so a missed line fails at boot.

- [ ] **Step 3: The CRUD update hook reads under its caller's context**

`src/shared/entities/lead-sources/dal/server/crud.ts`:

Import line 5 becomes:

```ts
import { ThrowableDalError } from '@/shared/dal/server/types'
```

The doc comment above `leadSourceCrud` becomes:

```ts
/**
 * Stable CRUD handlers for the lead-sources entity. All lifecycle business
 * logic lives here (config factory), not on the spec.
 */
```

In `hooks.update`, the signature and the current-row read become (the rest of the hook is unchanged):

```ts
      async before(data, ctx, { id }) {
        if (data.slug === undefined) {
          return data
        }
        if (slugify(data.slug, { maxLen: 64 }) !== data.slug) {
          throw new ThrowableDalError({
            type: 'precondition-failed',
            reason: 'Use lowercase letters, numbers, and hyphens only.',
          })
        }
        const current = dalVerifySuccess(await crudHandlers.getById(ctx, { id: String(id) }))
```

The comment block above the hook stays as it is.

- [ ] **Step 4: The router passes its context and ANDs the reach on every hand-written lead-source query**

`src/trpc/routers/lead-sources.router.ts`:

Add to the imports (alphabetical position among the `@/shared/...` imports, as the sorter wants):

```ts
import { permit } from '@/shared/dal/server/lib/permissions/permit'
import { leadSourceServerSpec } from '@/shared/entities/lead-sources/lib/server-spec'
```

`spendRouter.set`:

```ts
    .mutation(async ({ ctx, input }) => {
      dalToTrpc(await setLeadSourceSpend(ctx, input))
      return { success: true as const }
    }),
```

`list`: the handler takes `ctx` (`.query(async ({ ctx, input }) => {`) and the `where` becomes:

```ts
        .where(and(
          isNull(leadSourcesTable.archivedAt),
          includeInactive ? undefined : eq(leadSourcesTable.isActive, true),
          permit(ctx, 'read', leadSourceServerSpec).sql,
        ))
```

`getById`, `getStats`, `getStatusCounts`, `getAnalytics`, `getCustomers`: each handler takes `ctx` (`async ({ ctx, input })`), and each existence read's `where` becomes:

```ts
        .where(and(eq(leadSourcesTable.id, input.id), permit(ctx, 'read', leadSourceServerSpec).sql))
```

`getCustomers` additionally passes `ctx` to `listCustomers`:

```ts
      return dalToTrpc(await listCustomers(
        ctx,
        { ...query, filters: { ...query.filters, sourceId: src.id, segment } },
      ))
```

`create` (the comment above it loses its `scope: null` sentence):

```ts
  // Cast: the Zod input lacks the slug + token that create.before fills in.
  create: superAdminProcedure
    .input(createInput)
    .mutation(async ({ ctx, input }) =>
      dalToTrpc(await leadSourceCrud.create(
        ctx,
        input as unknown as Insert<typeof leadSourcesTable>,
      ))),
```

`update`:

```ts
      return dalToTrpc(await leadSourceCrud.update(ctx, { id, data }))
```

`rotateToken`:

```ts
  rotateToken: superAdminProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const [updated] = await db
        .update(leadSourcesTable)
        .set({ token: generateToken() })
        .where(and(eq(leadSourcesTable.id, input.id), permit(ctx, 'update', leadSourceServerSpec, ['token']).sql))
        .returning()
```

`archive`:

```ts
  archive: superAdminProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const [updated] = await db
        .update(leadSourcesTable)
        .set({ archivedAt: new Date().toISOString() })
        .where(and(eq(leadSourcesTable.id, input.id), permit(ctx, 'update', leadSourceServerSpec, ['archivedAt']).sql))
        .returning()
```

`duplicate` and `delete`:

```ts
      dalToTrpc(await leadSourceCrud.duplicate(ctx, { id: input.id }))),
```

```ts
      dalToTrpc(await leadSourceCrud.delete(ctx, { id: input.id }))
```

If `pnpm tsc` rejects `['token']` or `['archivedAt']` as a field of `LeadSource`, read `FieldOf` in `src/shared/domains/permissions/specs.ts` and report it; do not cast.

- [ ] **Step 5: The docs this change makes false**

`src/trpc/DOCS.md:56`: the list `(Customer, CustomerNote, Meeting, Proposal)` becomes `(AppSetting, Customer, CustomerNote, LeadSource, Meeting, Proposal, Project)`; the sentence after it is unchanged except that a super-admin-only compiled family keeps `superAdminProcedure`. Replace the first sentence with:

```md
A compiled family (AppSetting, Customer, CustomerNote, LeadSource, Meeting, Proposal, Project) has no scope step: its sub-routers use `agentProcedure` (or `superAdminProcedure` for a super-admin-only family, or `proposalShareableProcedure` where a share link may call) directly, and the DAL scopes through `permit(ctx, action, spec)`.
```

`docs/codebase-conventions/dal-conventions.md:46`: `Compiled families (Customer, CustomerNote, Meeting, Proposal, Project)` → `Compiled families (AppSetting, Customer, CustomerNote, LeadSource, Meeting, Proposal, Project)`.

`docs/codebase-conventions/trpc-procedures.md:40`: `A compiled family (Customer, CustomerNote, Meeting, Proposal, Project)` → `A compiled family (AppSetting, Customer, CustomerNote, LeadSource, Meeting, Proposal, Project)`.

`docs/plans/2026-09-26-sales-calculators-epic.md:197`: `and its visibility is \`FALSE\` for everyone except super-admin (\`src/shared/entities/app-settings/lib/visibility.ts\`)` → `and no role but super-admin (\`manage all\`) holds an \`AppSetting\` rule (\`src/shared/domains/permissions/rules/\`)`.

- [ ] **Step 6: Type-check, lint, and re-run both probes**

```bash
pnpm tsc && pnpm lint
NODE_OPTIONS="--conditions=react-server" node_modules/.bin/tsx --tsconfig tsconfig.json .superpowers/permissions-probes/lead-source-rules.ts
node .superpowers/permissions-probes/part5-checks.cjs
```

Expected: tsc and lint PASS. Rules probe: `COMPILED_SUBJECTS = [AppSetting, Customer, CustomerNote, LeadSource, Meeting, Proposal, Project]`; every other line equal to `part5-rules-baseline.txt`. GET probe: equal to `part5-baseline.txt` field for field (super-admin counts unchanged; agent and dispatcher FORBIDDEN on lead sources; `summaries` still 200 for them until Task 2). Any difference in a super-admin count is a defect: stop and report.

- [ ] **Step 7: AC counts and the diff-scope check**

```bash
git grep -n "SYSTEM_CONTEXT" -- src | grep -v "import " | wc -l
git grep -n "ctx\.scope\|scope: null" -- src | wc -l
git grep -n "visibility:" -- 'src/**/server-spec.ts' | wc -l
git grep -n "leadSourceVisibility\|appSettingVisibility" -- src | wc -l
git diff --name-only HEAD -- 'src/trpc/routers/landing.router' 'src/app/(frontend)/intake' src/shared/services
```

Expected: 17 (was 18), 33 (was 40), 8 (was 10), 0, and no file listed by the last command.

- [ ] **Step 8: Commit**

```bash
git add src/shared/dal/server/lib/scope.ts src/shared/entities/lead-sources/lib/server-spec.ts src/shared/entities/app-settings/lib/server-spec.ts src/shared/entities/lead-sources/dal/server/crud.ts src/trpc/routers/lead-sources.router.ts src/trpc/DOCS.md docs/codebase-conventions/dal-conventions.md docs/codebase-conventions/trpc-procedures.md docs/plans/2026-09-26-sales-calculators-epic.md
git commit -m "$(cat <<'EOF'
refactor(permissions): lead sources and app settings run on compiled rules

Both subjects join COMPILED_SUBJECTS and lose their sql`false` visibility
functions; only super-admin's manage all reaches them. The lead-sources router
passes its context instead of scope: null and ANDs the compiled reach on its
hand-written reads and writes; the CRUD update hook reads the current row under
its caller's context instead of SYSTEM_CONTEXT.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
EOF
)"
git push -q origin HEAD
```

(The two `git rm` deletions from Step 2 are already staged.)

---

### Task 2: Campaign summaries are super-admin only

**Files:**
- Modify: `src/trpc/routers/voip-campaigns.router.ts:43`

**Interfaces:**
- Consumes: `part5-checks.cjs` from Task 1.
- Produces: nothing new.

- [ ] **Step 1: Confirm the only consumers are the super-admin campaigns surfaces**

```bash
git grep -n "getSourceCampaignSummaries" -- src
```

Expected: `src/app/(frontend)/dashboard/campaigns/page.tsx` (which redirects anyone without `manage all`), `src/features/campaigns-admin/**`, and the router. Any other consumer: stop and report.

- [ ] **Step 2: Move the procedure**

`src/trpc/routers/voip-campaigns.router.ts`:

```ts
  getSourceCampaignSummaries: superAdminProcedure.query(async () => {
```

Nothing else on the line or in the body changes. `superAdminProcedure` is already imported on line 21.

- [ ] **Step 3: Type-check, lint, probe**

```bash
pnpm tsc && pnpm lint
node .superpowers/permissions-probes/part5-checks.cjs
```

Expected: tsc and lint PASS. GET probe equal to Task 1 Step 6's output except `agent.summaries` and `dispatcher.summaries`: `{ status: 403, code: 'FORBIDDEN', rows: null }`. Super-admin `summaries` unchanged.

- [ ] **Step 4: The campaigns page still loads for super-admin**

```js
// Run once with node; prints the path and whether the overview rendered without a page error.
const { chromium } = require('/home/olis-solutions/olis-v3/nextjs/tri-pros-website/.worktrees/issue-285/node_modules/playwright')
;(async () => {
  const b = await chromium.launch()
  const ctx = await b.newContext()
  await ctx.route('**/*', r => (['GET', 'HEAD'].includes(r.request().method()) ? r.continue() : r.abort()))
  const p = await ctx.newPage()
  const errors = []
  p.on('pageerror', e => errors.push(String(e).slice(0, 120)))
  await p.goto(`http://localhost:3003/api/dev/playwright-session?secret=${encodeURIComponent(process.env.DEV_LOGIN_SECRET)}&role=super-admin&redirect=/dashboard/campaigns`, { waitUntil: 'networkidle', timeout: 180000 })
  console.log({ path: new URL(p.url()).pathname, pageErrors: errors.length })
  await b.close()
})()
```

Save it as `.superpowers/permissions-probes/part5-campaigns-page.cjs` and run `node .superpowers/permissions-probes/part5-campaigns-page.cjs`. Expected: `{ path: '/dashboard/campaigns', pageErrors: 0 }`.

- [ ] **Step 5: Commit**

```bash
git add src/trpc/routers/voip-campaigns.router.ts
git commit -m "$(cat <<'EOF'
fix(permissions): campaign summaries are super-admin only

getSourceCampaignSummaries returned every lead source's name, slug, campaign
policy and lead counts to any agent or dispatcher who called the API; its only
screen is the super-admin campaigns page.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
EOF
)"
git push -q origin HEAD
```

---

### Task 3: Owner checks and the record

**Files:**
- Modify: `docs/plans/2026-08-10-casl-scope-compiler-epic.md` (§0 "What the tree runs", §0 status row, §4 Unit 3 "what is left" items 2 and 4, Appendix A)
- Modify: `docs/plans/2026-09-07-casl-re-grounding/DISTILLED-2026-10-01.md` (§7 item 2)
- Modify: `/home/olis-solutions/.claude/projects/-home-olis-solutions-olis-v3-nextjs-tri-pros-website/memory/project-permissions-casl-compiler.md` and its `MEMORY.md` line
- Delete: this plan file, after the owner accepts

- [ ] **Step 1: Ask the owner for the hand checks (they write to the dev database; the owner does them)**

- **H1** As super-admin, open a lead source's settings, change the slug, save: the intake URL's token changes. Save again without changing anything: the token stays. Try a slug another source uses: "That slug is already in use."
- **H2** On the spend grid, enter an amount in one cell, then clear it: both saves succeed and the cell shows blank after a reload.
- **H3** Open one active lead source's intake URL in a private window and submit the form: the customer appears under that source.
- **H4** Duplicate a lead source, then delete the copy: both succeed. Delete a source with customers attached: the toast names the count.
- **H5** Rotate a token and archive a source (on copies): both succeed.

Record each result. A failure goes back to the owning task; do not record the part as done.

- [ ] **Step 2: Record**

Tracker §4, Unit 3 "what is left": items 2 (Lead sources) and 4 (AppSetting) become one line each saying built by part 5 with the two commit SHAs, the probe results (super-admin counts equal to baseline; agent and dispatcher `summaries` 200 → FORBIDDEN), the AC counts (`SYSTEM_CONTEXT` 18 → 17, `ctx.scope` / `scope: null` 40 → 33, `visibility:` specs 10 → 8) and the hand-check results. §0 "What the tree runs": add `LeadSource` and `AppSetting` to the compiled list and remove them from the legacy list. §0 status row "Next": the VoIP part. Appendix A: one dated line. DISTILLED §7 item 2: lead sources and AppSetting done, Applications with the applications epic, VoIP next. Memory: replace the "Next session" sentence of the PART 4 CLOSED paragraph's successor with a PART 5 paragraph (built, SHAs, owner rulings of 2026-10-14: Applications left to the epic; summaries super-admin only) and update the `MEMORY.md` index line.

Commit the tracker and DISTILLED (`docs(permissions): record unit 3 part 5`), then `git rm` this plan file in a second commit once the owner has accepted the part, and push.
