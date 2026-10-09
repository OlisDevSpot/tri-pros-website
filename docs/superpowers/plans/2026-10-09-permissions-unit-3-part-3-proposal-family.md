# Permissions unit 3 part 3: the Proposal family — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Proposals, their views, media and incentives, and the share link run on compiled CASL rules: agents reach the proposals of meetings they sit in, dispatchers reach none, and a share link holds only its own proposal's share-link rules.

**Architecture:** `'Proposal'` joins `COMPILED_SUBJECTS`, so `createCrudDal` scopes the proposal spec and its three sub-entities through `permit`. Every hand-written reader of the family ANDs `permit(ctx, …).sql`. The token path stops being a legacy row filter (`scope = eq(token, …)`, which compiled slots ignore) and becomes `bearerContext(spec, token)`: a context whose ability holds `proposalBearerRules(id)`. A session wins over a token. The scope of work leaves to a share-link holder only as the homeowner's copy, without our job cost lines.

**Tech Stack:** Next.js 15 app router, tRPC 11, Drizzle (Postgres/Neon), `@casl/ability` 6.8.0, `@upstash/ratelimit`, better-auth.

**Spec:** `docs/superpowers/specs/2026-10-05-permissions-structure-design.md` (§5.1 bearer rules, §5.3 read field lists, §6, §7 share links and `systemContext`), tracker `docs/plans/2026-08-10-casl-scope-compiler-epic.md` (D-11, D-29, §5.1 S1 S2 S3 S8 S12 S15 S19, §5.3, Q12, M-R1/M-R2). Design approved by the owner in chat 2026-10-09 (recorded in the tracker §4, Unit 3, "Part 3 design"). Research notes: `.superpowers/permissions-probes/part3-research.md` (git-ignored).

## Global Constraints

- Never `pnpm build`. Each task ends with `pnpm tsc` and `pnpm lint` passing.
- No test runner and no unit tests in the permissions library. Verification is `pnpm tsc`, `pnpm lint`, `src/shared/domains/permissions/type-checks/must-not-compile.ts`, the DB-free tsx probes, and GET-only browser/API probes as dev role fixtures.
- No database writes for testing, the dev database included (it holds real phones and emails). Never print a phone, an email or a share token in any output. Never probe PII tables through Bash.
- No backwards compatibility: a change removes what it replaces in the same commit. No aliases, no wrappers kept for old call sites.
- Comments say why, never what, and never cite plans, specs, tasks or tracker ids. No file banners. Delete a banner in a file you touch if it only restates the file.
- One React component per file. Named exports only. No constants or helpers inside component files.
- New names need the owner's agreement. Agreed for this part: `bearerContext`, `proposalBearerRules`, `BEARER_RULES`, `toHomeownerProposalView`, `withoutCostLines`, `shareRouteContext`, `SHARE_LINK_LIMITS`, and the system reasons `webhook:zoho-sign`, `derived:proposal-sent`, `derived:homeowner-age`, `derived:envelope-documents` (`sync:quickbooks` exists). Any other new exported name: stop and ask.
- `@casl/ability` stays 6.8.0. `@casl/react` is imported only in `src/shared/domains/permissions/client.tsx`.
- NO outcome or pipeline-derivation logic on this branch.
- Git: stay on `refactor/285-refactor-permissions-casl-scope-compiler`. Never `git stash`, `git reset`, `git checkout <file>` or `git restore`. Stage by explicit path. Conventional commits ending with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`. The pre-commit hook takes about 110 s: use a 300000 ms timeout on `git commit`. Push after each commit (`git push -q origin HEAD`).
- Do not kill or restart the owner's dev server (port 3003). It hot-reloads.
- Run tsx probes from inside the worktree: `NODE_OPTIONS="--conditions=react-server" node_modules/.bin/tsx --tsconfig tsconfig.json <file>`.
- `DEV_LOGIN_SECRET` goes into a shell only: `export DEV_LOGIN_SECRET="$(sed -n 's/^DEV_LOGIN_SECRET=//p' /home/olis-solutions/olis-v3/nextjs/tri-pros-website/.env.local | tr -d '"')"`. Never echo it.

## Review Focus

1. **A signed-in agent opens a share link that carries `?token=`.** Expected: they act as staff (session wins) — the agent view, the Agreement panel and the envelope card work exactly as without the token. Pinned in Task 2 Step 13 (probe as agent with a token) and Task 6.
2. **A homeowner on a share link uses every control.** Expected: the page renders the price exactly as before (starting price, deposit, cash in deal, misc price, incentives, section prices), the finance option and cash-in-deal saves succeed, the age form saves and the document list reconciles, "request to move forward" notifies. Pinned in Task 2 Step 13 (read half) and the owner's hand checks in Task 6 (write half).
3. **A share-link holder sends any other column.** Expected: `crud.update` with `status`, `token`, `ownerId`, `meetingId`, `projectJSON` or `envelopeDocumentIds` answers FORBIDDEN naming the column; `applyEnvelopeContext` with `envelopeDocumentIds` answers FORBIDDEN. Pinned in Task 1 Step 6 (DB-free rules probe) and Task 6.
4. **A wrong token and an unknown proposal id.** Expected: the same answer on `getFullView`, `recordView`, the PDF and the summary routes — nothing reveals which ids exist. Pinned in Task 4 Step 8.
5. **A dispatcher anywhere proposals appear.** Expected: every proposal procedure answers NOT_FOUND or an empty list; the meetings list carries `proposalCount` 0 and `proposalStatuses` []; the profile, kanbans and action queue carry no proposal. Pinned in Task 3 Step 9 and Task 6.

---

## File map

| File | Task | Change |
|---|---|---|
| `src/shared/domains/permissions/rules/bearer.ts` | 1 | create: `proposalBearerRules`, `BEARER_RULES` |
| `src/shared/domains/permissions/rules/system.ts` | 1 | four new `SystemReason` values |
| `src/shared/dal/server/lib/contexts.ts` | 1 | `bearerContext(spec, token)` |
| `src/shared/dal/server/lib/permissions/check-rules.ts` | 1 | boot check walks the bearer rules too |
| `src/shared/domains/permissions/type-checks/must-not-compile.ts` | 1 | two lines |
| `src/shared/dal/server/lib/scope.ts` | 2 | `'Proposal'` compiled; `isVisible`, `isInScope` deleted |
| `src/shared/modules/proposals/core/server-spec.ts`, `core/lib/visibility.ts` | 2 | `visibility` dropped; file deleted |
| `src/shared/domains/permissions/rules/agent.ts`, `homeowner.ts` | 2 | conditioned read; homeowner read deleted |
| `src/trpc/lib/middleware/shareable-middleware.ts` | 2 | session wins, else `bearerContext`, else UNAUTHORIZED |
| `src/trpc/routers/proposals.router/procedures.ts` | 2 | only `proposalShareableProcedure` remains |
| `src/trpc/routers/proposals.router/{business,contracts,delivery,funding,incentives,media,views}.router.ts` | 2 | procedure bases; contracts system reasons + field probe; homeowner view |
| `src/shared/modules/proposals/core/dal/server/{queries,mutations,crud}.ts` | 2 | `permit` everywhere; create probes the meeting |
| `src/shared/modules/proposals/core/lib/to-homeowner-proposal-view.ts` | 2 | create |
| `src/shared/modules/proposals/{media,incentives}/service.ts`, `views/dal/server/queries.ts` | 2 | `permit` probes and filters |
| `src/shared/modules/media/core/dal/server/media-ops.ts`, `src/shared/modules/media/service.ts`, project media callers | 2 | take the row filter from the caller |
| `src/features/customer-pipelines/dal/server/move-customer-pipeline-item.ts`, `src/trpc/routers/customer-pipelines.router.ts`, `src/shared/dal/server/lib/helpers.ts` | 2 | takes `ctx`; `buildUserContext` deleted |
| `src/shared/entities/customers/dal/server/pipeline-items.ts` | 3 | proposal reach on the three proposal reads |
| `src/shared/entities/meetings/dal/server/{meetings-with-proposals,queries}.ts` | 3 | proposal reach |
| `src/features/agent-dashboard/dal/server/get-action-queue.ts`, `src/trpc/routers/dashboard.router.ts` | 3 | takes `ctx`; proposal reach |
| `src/trpc/routers/customer-pipelines.router.ts` (`getCustomerProjects`), `src/trpc/routers/projects.router/business.router.ts` | 3 | proposal reach |
| `src/shared/modules/proposals/core/lib/{share-link-rate-limit,share-route-context}.ts` | 4 | create |
| `src/trpc/routers/proposals.router/{views,delivery}.router.ts`, `src/shared/modules/proposals/views/service.ts` | 4 | recordView on the share procedure; limits; S8 |
| `src/app/api/proposals/[proposalId]/{pdf,summary}/route.ts` | 4 | session-or-share-link context; uniform 404 |
| `src/trpc/routers/ai.router/index.ts` | 4 | agent procedure + update probe |
| `src/shared/components/contract-status-panel/ui/proposal-card.tsx` | 4 | stops sending the token |
| `src/shared/services/accounting.service.ts`, `src/shared/services/providers/zoho-sign/lib/documents/registry.ts`, `src/shared/services/providers/upstash/jobs/sync-zoho-sign-status.ts` | 5 | system reasons |
| tracker, spec, DISTILLED, memory | 6 | record |

**Not in this plan (named so nobody reads them in):** agents' writable proposal columns (`status`, `createdAt`, … stay writable for staff; unit 4); the agent's raw customer phone inside `getFullView` (phone gating, unit 4); the project-side proposal media import (`listImportableProposalMedia`, `importFromProposal`) and the projects kanban's project predicate (part 4); the AI job's write landing at the top level of `projectJSON` instead of `projectJSON.data` (a feature bug for when the route is used); `getContractStatus` handing the share link the Zoho request id (an internal id; masking of ids beyond the proposal columns is unit 5's); Application (stays legacy).

---

### Task 1: Share-link rules and `bearerContext`

**Files:**
- Create: `src/shared/domains/permissions/rules/bearer.ts`
- Modify: `src/shared/domains/permissions/rules/system.ts`
- Modify: `src/shared/dal/server/lib/contexts.ts`
- Modify: `src/shared/dal/server/lib/permissions/check-rules.ts`
- Modify: `src/shared/domains/permissions/type-checks/must-not-compile.ts`

**Interfaces:**
- Produces: `proposalBearerRules(proposalId: string): PermissionRule[]`; `BEARER_RULES: Partial<Record<EntitySubject, (rowId: string) => PermissionRule[]>>`; `bearerContext(spec: AnyServerSpec, token: string): Promise<ScopedContext | null>`; `SystemReason` gains `'webhook:zoho-sign' | 'derived:proposal-sent' | 'derived:homeowner-age' | 'derived:envelope-documents'`.

- [ ] **Step 1: Write the wrong-on-purpose lines first**

In `must-not-compile.ts`, inside the existing `defineRules((can, cannot) => { … })` block that already holds `can('read', 'Proposal', { id: proposalId })` (around line 146), add:

```ts
  // @ts-expect-error a read field list names columns and sub-entity fields; cost lines live inside projectJSON
  can('read', 'Proposal', ['costLines'], { id: proposalId })
```

In the block of checks that must compile (where `ability.can(...presentMeeting)` sits), add:

```ts
// The homeowner's copy of the scope of work is chosen by this check.
ability.can('read', 'Proposal', 'projectJSON')
```

- [ ] **Step 2: Run tsc to see the baseline holds**

Run: `pnpm tsc`
Expected: PASS (the `@ts-expect-error` line errors as intended, the must-compile line compiles).

- [ ] **Step 3: Add the system reasons**

In `rules/system.ts`, extend the union (keep the existing order, append):

```ts
    | 'derived:meeting-notification'
    | 'webhook:zoho-sign'
    | 'derived:proposal-sent'
    | 'derived:homeowner-age'
    | 'derived:envelope-documents'
```

- [ ] **Step 4: Create the bearer rules**

`src/shared/domains/permissions/rules/bearer.ts`:

```ts
import type { EntitySubject } from '@/shared/domains/permissions/specs'
import type { PermissionRule } from '@/shared/domains/permissions/types'

import { defineRules } from './define-rules'

/**
 * A share link is one homeowner looking at one proposal. They read what the page shows them, never
 * our internal ids or the raw scope of work (its cost lines are our job costs), and they choose how to pay.
 */
export function proposalBearerRules(proposalId: string): PermissionRule[] {
  return defineRules((can) => {
    can('read', 'Proposal', [
      'id',
      'label',
      'status',
      'kind',
      'token',
      'startingTcpCents',
      'depositAmountCents',
      'cashInDealCents',
      'miscPriceCents',
      'finalTcpCents',
      'financeOptionId',
      'priceDisplayMode',
      'envelopeDocumentIds',
      'sentAt',
      'contractSentAt',
      'contractViewedAt',
      'contractSignedAt',
      'contractDeclinedAt',
      'approvedAt',
      'createdAt',
      'updatedAt',
      // The view row the holder's own visit creates is handed back to them.
      'views',
    ], { id: proposalId })
    can('update', 'Proposal', ['financeOptionId', 'cashInDealCents', 'views'], { id: proposalId })
  })
}

/** The share-link rules of every shareable subject, keyed by subject. */
export const BEARER_RULES: Partial<Record<EntitySubject, (rowId: string) => PermissionRule[]>> = {
  Proposal: proposalBearerRules,
}
```

If `tsc` rejects a listed field (a column key differs from the schema), open `src/shared/db/schema/proposals.ts`, use the exact TypeScript key, and keep the list otherwise unchanged.

- [ ] **Step 5: Add `bearerContext`**

Replace the body of `src/shared/dal/server/lib/contexts.ts` with:

```ts
import type { PgColumn, PgTable } from 'drizzle-orm/pg-core'

import type { AnyServerSpec, ScopedContext } from '../types'
import type { SystemReason } from '@/shared/domains/permissions/rules/system'

import { eq } from 'drizzle-orm'

import { db } from '@/shared/db'
import { abilityFromRules } from '@/shared/domains/permissions/ability-from-rules'
import { BEARER_RULES } from '@/shared/domains/permissions/rules/bearer'
import { systemRules } from '@/shared/domains/permissions/rules/system'

import { subjectOf } from './define-spec'
import { pkColumnOf } from './permissions/core'

/** An unrestricted context for jobs, webhooks and server-derived writes. The reason rides on the rule, so every privileged site is named. */
export function systemContext(reason: SystemReason): ScopedContext {
  return { actor: { ability: abilityFromRules(systemRules(reason)), userId: null }, scope: null }
}

/**
 * The context a share link gives its holder: that one row's share-link rules. Nothing when the token
 * names no row, so a wrong token and a missing row look the same.
 */
export async function bearerContext(spec: AnyServerSpec, token: string): Promise<ScopedContext | null> {
  const rulesFor = BEARER_RULES[subjectOf(spec)]
  const tokenColumnName = spec.shareable?.tokenColumn
  if (!rulesFor || !tokenColumnName) {
    throw new Error(`[bearerContext] ${spec.entityName} has no share-link rules`)
  }
  // Drizzle's PgTable does not expose its columns as a keyed record.
  const tokenColumn = (spec.table as unknown as Record<string, PgColumn | undefined>)[tokenColumnName]
  if (!tokenColumn) {
    throw new Error(`[bearerContext] '${tokenColumnName}' is not a column of ${spec.entityName}'s table`)
  }
  const [row] = await db
    .select({ id: pkColumnOf(spec) })
    .from(spec.table as PgTable)
    .where(eq(tokenColumn, token))
    .limit(1)
  return row ? { actor: { ability: abilityFromRules(rulesFor(String(row.id))), userId: null }, scope: null } : null
}
```

Keep the existing `systemContext` docstring if it differs only in wording.

- [ ] **Step 6: Walk the bearer rules in the boot check**

In `src/shared/dal/server/lib/permissions/check-rules.ts`, replace the `for (const role of userRoles) { const ability = defineAbilitiesFor(…) … }` loop header so the same body runs over every role's ability and every bearer rule set:

```ts
import { abilityFromRules } from '@/shared/domains/permissions/ability-from-rules'
import { BEARER_RULES } from '@/shared/domains/permissions/rules/bearer'
// … existing imports

const PLACEHOLDER_ID = '00000000-0000-4000-8000-000000000000'

export function assertRulesCompile(): void {
  // … specBySubject as today
  const rulesets = [
    ...userRoles.map(role => ({ name: role, ability: defineAbilitiesFor({ id: PLACEHOLDER_ID, role }) })),
    ...Object.entries(BEARER_RULES).map(([subject, rulesFor]) => ({ name: `${subject} share link`, ability: abilityFromRules(rulesFor!(PLACEHOLDER_ID)) })),
  ]
  for (const { name, ability } of rulesets) {
    for (const raw of ability.rules) {
      // … the existing body, with `role` in the error message replaced by `name`
    }
  }
}
```

The constant sits in a server lib file, not a component; it replaces the inline literal.

Then write the DB-free probe `.superpowers/permissions-probes/bearer-rules.ts` (git-ignored; it only builds abilities and SQL strings, it never queries):

```ts
import { subject } from '@casl/ability'

import { abilityFromRules } from '@/shared/domains/permissions/ability-from-rules'
import { proposalBearerRules } from '@/shared/domains/permissions/rules/bearer'

const id = '11111111-1111-4111-8111-111111111111'
const other = '22222222-2222-4222-8222-222222222222'
const ability = abilityFromRules(proposalBearerRules(id))
const own = subject('Proposal', { id }) as never
const foreign = subject('Proposal', { id: other }) as never
const checks: [string, boolean, boolean][] = [
  ['read own row', ability.can('read', own), true],
  ['read foreign row', ability.can('read', foreign), false],
  ['read raw projectJSON', ability.can('read', 'Proposal', 'projectJSON'), false],
  ['read ownerId', ability.can('read', own, 'ownerId'), false],
  ['update financeOptionId', ability.can('update', own, 'financeOptionId'), true],
  ['update cashInDealCents', ability.can('update', own, 'cashInDealCents'), true],
  ['update views', ability.can('update', own, 'views'), true],
  ['update status', ability.can('update', own, 'status'), false],
  ['update token', ability.can('update', own, 'token'), false],
  ['update envelopeDocumentIds', ability.can('update', own, 'envelopeDocumentIds'), false],
  ['update projectJSON', ability.can('update', own, 'projectJSON'), false],
  ['update foreign financeOptionId', ability.can('update', foreign, 'financeOptionId'), false],
  ['delete own', ability.can('delete', own), false],
]
let failed = 0
for (const [name, actual, expected] of checks) {
  const ok = actual === expected
  failed += ok ? 0 : 1
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}: ${actual}`)
}
process.exit(failed)
```

- [ ] **Step 7: Run tsc, lint and the probe**

Run: `pnpm tsc && pnpm lint && NODE_OPTIONS="--conditions=react-server" node_modules/.bin/tsx --tsconfig tsconfig.json .superpowers/permissions-probes/bearer-rules.ts`
Expected: tsc PASS, lint PASS (warnings only), every probe line PASS, exit 0.

- [ ] **Step 8: Commit**

```bash
git add src/shared/domains/permissions/rules/bearer.ts src/shared/domains/permissions/rules/system.ts src/shared/dal/server/lib/contexts.ts src/shared/dal/server/lib/permissions/check-rules.ts src/shared/domains/permissions/type-checks/must-not-compile.ts
git commit -m "feat(permissions): share-link rules for a proposal and bearerContext, checked at boot

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
git push -q origin HEAD
```

---

### Task 2: Turn the Proposal family over

One change, because the token path's legacy row filter is ignored by compiled slots: turning the spec over without the share path, or without the family's hand readers, would open every proposal.

**Files:**
- Modify: `src/shared/dal/server/lib/scope.ts`
- Modify: `src/shared/modules/proposals/core/server-spec.ts`; Delete: `src/shared/modules/proposals/core/lib/visibility.ts`
- Modify: `src/shared/domains/permissions/rules/agent.ts`, `src/shared/domains/permissions/rules/homeowner.ts`
- Modify: `src/trpc/lib/middleware/shareable-middleware.ts`
- Modify: `src/trpc/routers/proposals.router/procedures.ts` and every sub-router importing from it
- Modify: `src/shared/modules/proposals/core/dal/server/queries.ts`, `mutations.ts`, `crud.ts`
- Create: `src/shared/modules/proposals/core/lib/to-homeowner-proposal-view.ts`
- Modify: `src/trpc/routers/proposals.router/business.router.ts`, `contracts.router.ts`, `media.router.ts`, `incentives.router.ts`, `views.router.ts`, `delivery.router.ts`, `funding.router.ts`
- Modify: `src/shared/modules/proposals/media/service.ts`, `src/shared/modules/proposals/incentives/service.ts`, `src/shared/modules/proposals/views/dal/server/queries.ts`
- Modify: `src/shared/modules/media/core/dal/server/media-ops.ts`, `src/shared/modules/media/service.ts`, `src/shared/modules/projects/media/service.ts`, `src/shared/modules/projects/core/dal/server/crud.ts`
- Modify: `src/features/customer-pipelines/dal/server/move-customer-pipeline-item.ts`, `src/trpc/routers/customer-pipelines.router.ts` (the `moveCustomerPipelineItem` call), `src/shared/dal/server/lib/helpers.ts`

**Interfaces:**
- Consumes: `bearerContext`, `proposalBearerRules`, the four system reasons (Task 1).
- Produces: `toHomeownerProposalView(ability: AppAbility, view: ProposalWithCustomer): ProposalWithCustomer` and `withoutCostLines(projectJSON: ProjectSection): ProjectSection` (Task 4 uses both); `proposalShareableProcedure` = session wins, else bearer; `listMediaByOwner(table, ownerColumn, where: SQL | undefined, ownerId)`, `reorderMedia(table, where: SQL | undefined, updates)`, `mediaService.list(store, where, ownerId)`, `mediaService.reorder(store, where, updates)`; `moveCustomerPipelineItem({ ctx, customerId, fromStage, toStage, pipeline })`.

- [ ] **Step 1: Compile the subject and drop the legacy predicate**

`scope.ts`: `new Set<EntitySubject>(['Customer', 'CustomerNote', 'Meeting', 'Proposal'])`.

`server-spec.ts`: delete `visibility: proposalVisibility,` and its import; delete `src/shared/modules/proposals/core/lib/visibility.ts` (`git rm`). Also reword the comment above `updateProposalSchema`: it says "update-path field gating is owned by permissions epic #285" — replace with `// Staff write any column the rules allow; a share link's rules name its few columns.` (no tracker citation).

- [ ] **Step 2: The rules**

`agent.ts`, replace the three bare Proposal lines:

```ts
    // A proposal is reached through the meeting it was made in; the row filter and the UI read this one rule.
    can('read', 'Proposal', { $participatesViaMeeting: { via: 'meetingId', userId } })
    can('create', 'Proposal')
    can('update', 'Proposal')
```

`homeowner.ts`: delete `can('read', 'Proposal')` and rewrite the file comment to the reason that remains: `// No code assigns this role; a homeowner reaches their proposal through its share link.` Keep `can('read', 'User')`.

The comment in `agent.ts` near the voip rules that says row scoping is done by visibility predicates "until these families convert" stays (other families are still legacy).

- [ ] **Step 3: The share procedure**

Replace `src/trpc/lib/middleware/shareable-middleware.ts` with:

```ts
import type { AnyServerSpec } from '@/shared/dal/server/types'

import { TRPCError } from '@trpc/server'

import { bearerContext } from '@/shared/dal/server/lib/contexts'
import { createMiddleware } from '@/trpc/init'

/**
 * A session wins: staff who open a share link act as staff. Without one, the token must name a row,
 * and the request then holds only that row's share-link rules. A wrong token and a missing row answer the same.
 */
export function shareableMiddleware(spec: AnyServerSpec) {
  return createMiddleware(async ({ ctx, next, getRawInput }) => {
    if (ctx.session) {
      return next({ ctx: { ...ctx, session: ctx.session } })
    }
    // Read before validation: which credential applies decides the context the input runs under.
    const rawInput = await getRawInput() as Record<string, unknown> | undefined
    const token = typeof rawInput?.token === 'string' ? rawInput.token : ''
    const bearer = token ? await bearerContext(spec, token) : null
    if (!bearer) {
      throw new TRPCError({ code: 'UNAUTHORIZED', message: 'A valid share link or a signed-in session is required' })
    }
    return next({ ctx: { ...ctx, actor: bearer.actor, scope: null } })
  })
}
```

Replace `src/trpc/routers/proposals.router/procedures.ts` with:

```ts
import { proposalServerSpec } from '@/shared/modules/proposals/core/server-spec'

import { baseProcedure } from '../../init'
import { shareableMiddleware } from '../../lib/middleware/shareable-middleware'

/** Staff by session, or a homeowner by the proposal's share link. */
export const proposalShareableProcedure = baseProcedure.use(shareableMiddleware(proposalServerSpec))
```

In every proposals sub-router: `proposalProcedure` and `proposalMediaProcedure` → `agentProcedure` (import from `'../../init'`); `proposalPublicProcedure` → `baseProcedure`. `git grep -n "proposalProcedure\|proposalMediaProcedure\|proposalPublicProcedure" -- src` must print nothing but `proposalShareableProcedure` lines afterwards.

- [ ] **Step 4: The module's readers and writes**

`core/dal/server/queries.ts`: add

```ts
import { permit } from '@/shared/dal/server/lib/permissions/permit'
import { proposalServerSpec } from '@/shared/modules/proposals/core/server-spec'
```

and replace each `ctx.scope ?? undefined` (seven sites: `getFullView`, `listProposals`, `getProposalsByIds`, `getProposalsByMeetingId`, `getProposalsByInvoiceIds`, `getProposalByInvoiceId`, `getByContractEnvelopeId`) with `permit(ctx, 'read', proposalServerSpec).sql`. In `listProposals` compute it once: `const reach = permit(ctx, 'read', proposalServerSpec).sql` and use `and(reach, searchWhere, filterWhere)`. Rewrite the docstring of `getProposalLockSignals` to `/** Unscoped on purpose: it exposes nothing beyond lock signals, and the update it guards applies the actor's reach. */`.

If importing `server-spec.ts` into `queries.ts` creates an import cycle (`tsc` or the dev server will report it), stop and report; do not work around it.

`core/dal/server/mutations.ts`, `setCashInDeal`: replace `ctx.scope ?? undefined` with `permit(ctx, 'update', proposalServerSpec, ['cashInDealCents']).sql` (same two imports). The raw `db.update` after the scoped select stays; add above it `// The select above is the reach check: an unreachable or unwritable row is not found.`

`core/dal/server/crud.ts`, `create.before`: replace the `meetingCrud.getById(SYSTEM_CONTEXT, …)` read with the actor's read, so a proposal can only be made on a meeting the creator reaches:

```ts
        // The meeting is read as the creator: a proposal on a meeting they cannot reach is not found.
        const meeting = dalVerifySuccess(await meetingCrud.getById(ctx, { id: input.meetingId }))
        if (!meeting) {
          throw new ThrowableDalError({ type: 'not-found' })
        }
        const kind = deriveProposalKind(meeting.projectId ?? null)
        const token = generateShareToken()
        const enriched = snapSowFromMeeting(input, meeting.flowStateJSON ?? null)
```

Rename the hook's `_ctx` parameter to `ctx`. Drop `SYSTEM_CONTEXT` from the import (keep `ThrowableDalError`). A dispatcher's meeting read projects `flowStateJSON` away; dispatchers have no `create Proposal`, so the compiled create refuses them before this hook runs — confirm by reading `createImpl` in `create-crud-dal.ts` (assert runs first); if it does not, stop and report.

- [ ] **Step 5: The homeowner's copy**

Create `src/shared/modules/proposals/core/lib/to-homeowner-proposal-view.ts`:

```ts
import type { AppAbility } from '@/shared/domains/permissions/types'
import type { ProposalWithCustomer } from '@/shared/modules/proposals/core/dal/server/queries'
import type { ProjectSection } from '@/shared/modules/proposals/core/types'

import { projectToReadFields } from '@/shared/dal/server/lib/permissions/project'
import { proposalServerSpec } from '@/shared/modules/proposals/core/server-spec'
import 'server-only'

/** The scope of work without our job costs: the homeowner sees section prices, never what the work costs us. */
export function withoutCostLines(projectJSON: ProjectSection): ProjectSection {
  return {
    ...projectJSON,
    data: {
      ...projectJSON.data,
      sow: projectJSON.data.sow.map(section => ({ ...section, financials: { ...section.financials, costLines: [] } })),
    },
  }
}

/**
 * What leaves to a reader who may not see the raw scope of work: the columns their read rule lists,
 * their own contact details (the page asks them to confirm these), the incentives and the homeowner gallery,
 * and the scope of work without cost lines. Staff get the view unchanged.
 */
export function toHomeownerProposalView(ability: AppAbility, view: ProposalWithCustomer): ProposalWithCustomer {
  if (ability.can('read', 'Proposal', 'projectJSON')) {
    return view
  }
  const { customer, incentives, media, meetingProjectId: _meetingProjectId, projectFirstContractSentAt: _contractSentAt, ...columns } = view
  return {
    ...projectToReadFields(ability, proposalServerSpec, columns, columns),
    customer,
    incentives,
    media,
    projectJSON: withoutCostLines(view.projectJSON),
  } as ProposalWithCustomer
}
```

If the `ProjectSection` type path differs, use the type `ProposalWithCustomer['projectJSON']` instead. If lint rejects the unused renamed bindings, destructure only what is kept and build `columns` with a small omit of the two keys instead.

Before relying on it, list what the homeowner path reads: `git grep -n "meetingId\|ownerId\|qbInvoiceId\|qbPaymentStatus\|contractEnvelopeId\|calcVersion\|meetingProjectId\|projectFirstContractSentAt\|costLines" -- src/features/proposal-flow/ui/components/proposal src/shared/components/contract-status-panel src/features/proposal-flow/hooks`. Any hit that renders in the customer view (`viewMode === 'customer'` or the homeowner contract view) must be reported before continuing; agent-only components (the Internal Financials modal, the envelope card) are fine because staff get the full view.

`business.router.ts`, `getFullView`:

```ts
  getFullView: proposalShareableProcedure
    .input(z.object({ id: z.string().uuid(), token: z.string().optional() }))
    .query(async ({ ctx, input }) => {
      const view = dalToTrpc(await getFullView(ctx, input))
      return view ? toHomeownerProposalView(ctx.actor.ability, view) : null
    }),
```

`list` → `agentProcedure`; `getFinanceOptions` → `baseProcedure`.

- [ ] **Step 6: Contracts**

`contracts.router.ts`, `applyEnvelopeContext`: delete the `ctx.actor.userId === null` block. After the `getFullView` not-found and customer checks, before the frozen check, add:

```ts
      // The document selection is the agent's: a share link's rules do not name the column.
      if (input.envelopeDocumentIds !== undefined && !(await permit(ctx, 'update', proposalServerSpec, ['envelopeDocumentIds']).probe(input.id))) {
        throw new TRPCError({ code: 'FORBIDDEN', message: 'Envelope document selection is agent-only.' })
      }
```

Replace the age write's `SYSTEM_CONTEXT` with `systemContext('derived:homeowner-age')` and its comment with `// Keyed off the proposal the caller reached above, never a client-supplied customer id.` Replace the selection write's `ctx` with `systemContext('derived:envelope-documents')` and add above it `// The reconciled selection follows from the age and the registry, not from what the caller may write.` Imports: `permit`, `proposalServerSpec`, `systemContext` from `@/shared/dal/server/lib/contexts`; remove `SYSTEM_CONTEXT`. The five envelope lifecycle procedures move to `agentProcedure` (Step 3).

- [ ] **Step 7: Views (stats read)**

`views/dal/server/queries.ts`, `getProposalViews`: replace the `isInScope` probe and the unscoped select with the views reach:

```ts
    if (!(await permit(ctx, 'read', proposalServerSpec).probe(input.proposalId))) {
      throw new ThrowableDalError({ type: 'not-found' })
    }

    const views = await db
      .select()
      .from(proposalViews)
      .where(and(eq(proposalViews.proposalId, input.proposalId), permit(ctx, 'read', proposalViewServerSpec).sql))
      .orderBy(desc(proposalViews.viewedAt))
```

Import `permit`, `proposalViewServerSpec` from `@/shared/modules/proposals/views/server-spec`, `and`; remove `isInScope`. Rewrite the docstring to `/** View stats for a proposal the actor reaches: totals, last view, source breakdown and the rows, newest first. */`. `recordView` is Task 4.

- [ ] **Step 8: Media**

`media-ops.ts`: change both signatures to take the row filter from the caller (a store serves two families, one compiled, one not):

```ts
/** Rows for one owner, ordered by `sortOrder`, narrowed by the caller's row filter. */
export function listMediaByOwner(table: MediaTable, ownerColumn: PgColumn, where: SQL | undefined, ownerId: string): Promise<DalReturn<Record<string, unknown>[]>> {
  return dalDbOperation(async () =>
    db.select().from(table).where(and(eq(ownerColumn, ownerId), where)).orderBy(asc(table.sortOrder)) as Promise<Record<string, unknown>[]>)
}

/** Reorder in one transaction: a row outside `where` matches nothing (no probe, no throw). Empty input is a no-op. */
export function reorderMedia(table: MediaTable, where: SQL | undefined, updates: { id: number, sortOrder: number }[]): Promise<DalReturn<void>> {
  return dalDbOperation(async () => {
    if (updates.length === 0) {
      return
    }
    await db.transaction(async (tx) => {
      for (const { id, sortOrder } of updates) {
        await tx.update(table).set({ sortOrder }).where(and(eq(table.id, id), where))
      }
    })
  })
}
```

Drop the `ScopedContext` import if unused; import `SQL` as a type.

`media/service.ts` (shared): `reorder(store, where: SQL | undefined, updates)` → `reorderMedia(store.table, where, updates)`; `list(store, where: SQL | undefined, ownerId)` → `listMediaByOwner(store.table, store.ownerColumn, where, ownerId)`.

Project callers keep their legacy filter: `projects/media/service.ts` passes `ctx.scope ?? undefined` to `mediaService.list` and `mediaService.reorder`; `projects/core/dal/server/crud.ts` passes `undefined` where it passed `{ ...ctx, scope: null }` (the purge must be exhaustive — keep its comment, reworded to the new parameter).

`proposals/media/service.ts`: delete `assertParentVisible`, the `isVisible` import and the `create` override (the spread slot is the compiled create, which probes the proposal's `update` on `media` before it inserts; say so in one line of the header comment); rewrite the header comment so it no longer describes `isVisible`, `ctx.scope` or "#285" (keep only the lines that still say why: the R2 lifecycle lives on the CRUD hooks). Then:

```ts
  async buildUploadTarget(ctx, input) {
    return dalDbOperation(async () => {
      if (!(await permit(ctx, 'update', proposalServerSpec, ['media']).probe(input.proposalId))) {
        throw new ThrowableDalError({ type: 'not-found' })
      }
      return mediaService.buildUploadTarget(proposalMediaStore, { ownerId: input.proposalId, filename: input.filename, mimeType: input.mimeType })
    })
  },

  async list(ctx, input) {
    return dalDbOperation(async () => {
      if (!(await permit(ctx, 'read', proposalServerSpec).probe(input.proposalId))) {
        throw new ThrowableDalError({ type: 'not-found' })
      }
      return dalVerifySuccess(await mediaService.list(proposalMediaStore, permit(ctx, 'read', proposalMediaServerSpec).sql, input.proposalId)) as ProposalMediaFile[]
    })
  },

  async reorder(ctx, input) {
    return mediaService.reorder(proposalMediaStore, permit(ctx, 'update', proposalMediaServerSpec).sql, input.updates)
  },

  async retryOptimization(ctx, input) {
    return dalDbOperation(async () => {
      if (!(await permit(ctx, 'update', proposalMediaServerSpec).probe(input.id))) {
        throw new ThrowableDalError({ type: 'not-found' })
      }
      await mediaService.retryOptimization(proposalMediaStore, input.id)
    })
  },
```

Keep the existing explicit parameter and return types on each method. `media.router.ts`: delete `assertCanUpdate`, its comment and every call; `ScopedContext` and `TRPCError` imports go if unused; the banner line `// src/trpc/routers/proposals.router/media.router.ts` goes.

- [ ] **Step 9: Incentives**

`incentives/service.ts`, `replace`: before the `getById`, add the field probe so the reach and the field decide, not a hand verb check:

```ts
      if (!(await permit(ctx, 'update', proposalServerSpec, ['incentives']).probe(input.proposalId))) {
        throw new ThrowableDalError({ type: 'not-found' })
      }
```

(Keep the `getById` read for the lock signals.) `incentives.router.ts`: delete the `ability.cannot('update', 'Proposal')` block, the `TRPCError` import, and the banner lines that describe it.

- [ ] **Step 10: The kanban's decline move**

`move-customer-pipeline-item.ts`: replace `user: VisibilityScope` in `MoveParams` with `ctx: ScopedContext`; replace each `const ctx = buildUserContext(user, …)` (four sites) by using the parameter; in the `proposal_sent → declined` branch replace `ctx.scope ?? undefined` with `permit(ctx, 'update', proposalServerSpec).sql`. Remove the `buildUserContext`, `VisibilityScope` and now-unused spec imports. In `customer-pipelines.router.ts` pass `ctx` (`await moveCustomerPipelineItem({ ...input, ctx })`).

`helpers.ts`: `git grep -n "buildUserContext" -- src` must show only its definition; delete it and its now-unused imports (`isCompiled`, `resolveEffectiveScope`, `VisibilityScope` if unused).

- [ ] **Step 11: Delete the last legacy probes**

`git grep -n "isVisible\|isInScope" -- src` must show only their definitions in `scope.ts`. Delete both functions (and `pkColumn` in `scope.ts` if nothing else uses it; `resolveEffectiveScope` and `bridgeToParent` stay for the other legacy families).

- [ ] **Step 12: tsc, lint, greps**

Run: `pnpm tsc && pnpm lint`
Expected: PASS.

Run these; each expectation must hold:

```bash
git grep -n "ctx.scope" -- src/shared/modules/proposals src/trpc/routers/proposals.router   # nothing
git grep -n "SYSTEM_CONTEXT" -- src/shared/modules/proposals src/trpc/routers/proposals.router   # only views.router.ts recordView (Task 4) and comments
git grep -n "proposalVisibility\|buildUserContext\|isInScope\|isVisible(" -- src   # nothing
git grep -n "cannot('update', 'Proposal')" -- src   # nothing
```

Then the dev server boot check through its hot reload (do not restart it): `curl -s -o /dev/null -w "%{http_code}\n" http://localhost:3003/` → 200, and `curl -s -o /dev/null -w "%{http_code}\n" http://localhost:3003/dashboard` → 200.

- [ ] **Step 13: GET-only read probes**

Extend `.superpowers/permissions-probes/post-merge-checks.cjs` into `.superpowers/permissions-probes/part3-checks.cjs` (same GET-only route-abort guard, counts and codes only, never print tokens). As super-admin: take one proposal id `P` from `proposalsRouter.business.list` and its token `T` from `proposalsRouter.business.getFullView` (keep `T` in memory only). Then assert:

| Probe | Expected |
|---|---|
| anonymous `business.getFullView {id: P, token: T}` | 200; no `ownerId`, `meetingId`, `qbInvoiceId`, `contractEnvelopeId`, `calcVersion`, `meetingProjectId` keys; every `projectJSON.data.sow[].financials.costLines` has length 0; `customer` present; `startingTcpCents` present |
| anonymous `business.getFullView {id: P, token: 'x'}` and `{id: <random uuid>, token: 'x'}` | both 401 UNAUTHORIZED |
| anonymous `crud.getById {id: P, token: T}` | 200, no `projectJSON` key |
| super-admin `business.getFullView {id: P}` | 200, `projectJSON` present with its cost lines unchanged (count > 0 where the anonymous one had 0, if the proposal has any) |
| agent `business.getFullView {id: P, token: T}` | the agent's own answer without the token (session wins): same status as `{id: P}` |
| dispatcher `business.list` | `total` 0 |
| dispatcher `business.getFullView {id: P}` | 200 with `null` |
| homeowner and user `business.list` | 403 FORBIDDEN |

Run with `DEV_LOGIN_SECRET` exported (Global Constraints). Expected: every row as stated. A failing row is a defect in this task.

- [ ] **Step 14: Commit**

Stage every file touched in this task by path (including the `git rm` of `visibility.ts`), then:

```bash
git commit -m "feat(permissions): the Proposal family runs on compiled rules; a share link holds only its proposal's share-link rules, and a session wins over it

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
git push -q origin HEAD
```

---

### Task 3: Readers outside the module

**Files:**
- Modify: `src/shared/entities/customers/dal/server/pipeline-items.ts`
- Modify: `src/shared/entities/meetings/dal/server/meetings-with-proposals.ts`
- Modify: `src/shared/entities/meetings/dal/server/queries.ts`
- Modify: `src/features/agent-dashboard/dal/server/get-action-queue.ts`, `src/trpc/routers/dashboard.router.ts`
- Modify: `src/trpc/routers/customer-pipelines.router.ts` (`getCustomerProjects`)
- Modify: `src/trpc/routers/projects.router/business.router.ts`

**Interfaces:**
- Consumes: the compiled Proposal read (Task 2).
- Produces: `getActionQueue(ctx: ScopedContext): Promise<ActionItem[]>`.

- [ ] **Step 0: Baseline**

Before editing, run as super-admin `meetingsRouter.reads.list {pagination:{limit:500,offset:0}}` (GET) and record the sum of `proposalCount` and the `total` in the task report. Step 9 compares against it.

- [ ] **Step 1: Kanban arms**

`pipeline-items.ts`: add `proposalReach: SQL` to `PipelineBranchArgs` with the doc `/** The Proposal read reach, for every proposal read. */`, set it in `getCustomerPipelineItems` to `permit(ctx, 'read', proposalServerSpec).sql`, and delete the `// … the proposal arms keep participation until the Proposal family converts` clause from the comment above `args`. Replace `args.isOmni ? undefined : userParticipatesInMeeting(args.userId, proposals.meetingId)` with `args.proposalReach` in the fresh arm's two proposal reads, and AND `args.proposalReach` into the projects arm's proposal read (`.where(and(inArray(proposals.meetingId, meetingIds), args.proposalReach))`). `userId` and `isOmni` stay (the projects arm's project predicate uses them until the Project family). Remove `userParticipatesInMeeting` from the imports only if no other use remains.

- [ ] **Step 2: Profile and project history**

`meetings-with-proposals.ts`: replace the `ctx.actor.ability.cannot('read', 'Proposal') || meetingRows.length === 0` gate with `meetingRows.length === 0` and AND the reach into the proposal read's where:

```ts
        .where(and(
          sql`${proposals.meetingId} IN (${sql.join(meetingRows.map(m => sql`${m.id}`), sql`, `)})`,
          permit(ctx, 'read', proposalServerSpec).sql,
        ))
```

Rewrite the docstring's last sentence to: `Each meeting carries the proposals the actor reaches: an agent sees the proposals of meetings they sit in, a role with no proposal rule sees none.`

- [ ] **Step 3: Meeting list and detail**

`meetings/dal/server/queries.ts`: in `listMeetings` and `getByIdWithJoins` compute `const proposalReach = permit(ctx, 'read', proposalServerSpec).sql` and rewrite the four proposal subqueries on the unaliased table so the reach composes (drizzle qualifies these columns inside a select-field subquery; checked 2026-10-09):

```ts
          proposalCount: sql<number>`(SELECT count(*) FROM ${proposals} WHERE ${proposals.meetingId} = ${meetings.id} AND ${proposalReach})`.as('proposal_count'),
          hasSentProposal: sql<boolean>`EXISTS (SELECT 1 FROM ${proposals} WHERE ${proposals.meetingId} = ${meetings.id} AND ${proposals.status} = 'sent' AND ${proposalReach})`.as('has_sent_proposal'),
          hasApprovedProposal: sql<boolean>`EXISTS (SELECT 1 FROM ${proposals} WHERE ${proposals.meetingId} = ${meetings.id} AND ${proposals.status} = 'approved' AND ${proposalReach})`.as('has_approved_proposal'),
          proposalStatuses: sql<ProposalStatus[]>`COALESCE((SELECT json_agg(${proposals.status} ORDER BY ${proposals.createdAt}, ${proposals.id}) FROM ${proposals} WHERE ${proposals.meetingId} = ${meetings.id} AND ${proposalReach}), '[]'::json)`.as('proposal_statuses'),
```

(`getByIdWithJoins` has the first three only.) Leave `hasSentProposalSql()` (the phone gate) alone. In `listMeetings`, a role with no proposal rule must not filter by proposal status (the answer set would say which meetings have which proposals):

```ts
    // Filtering by proposal status would tell a role without proposals which meetings have them.
    const filters = ctx.actor.ability.can('read', 'Proposal') ? input.filters : { ...input.filters, proposalStatus: undefined }
```

and pass `filters` to `MEETING_FIELD_SQL.where`. If the filters type does not accept `undefined` for that key, omit the key instead.

Before writing, render the new select with the offline check in `.superpowers/permissions-probes/subquery-qualify.ts` (extend it to print the `listMeetings` field SQL for an agent ability) and confirm the reach renders against `"proposals"`. If it does not, stop and report.

- [ ] **Step 4: Action queue**

`get-action-queue.ts`: change the signature to `getActionQueue(ctx: ScopedContext)`; derive `canSeeUngated = canSeeUngatedPhone(ctx.actor.ability)`, `userId = ctx.actor.userId ?? ''` and `isOmni = ctx.actor.ability.can('manage', 'all')` at the top for the meeting half (unchanged, part 2 deferred it); in the sent-proposals read replace `isOmni ? undefined : userParticipatesInMeeting(userId, proposals.meetingId)` with `permit(ctx, 'read', proposalServerSpec).sql`. `dashboard.router.ts`: `getActionQueue: agentProcedure.query(async ({ ctx }) => getActionQueue(ctx))`, dropping the now-unused imports.

- [ ] **Step 5: Pipeline sidebar and project create**

`customer-pipelines.router.ts`, `getCustomerProjects`: AND `permit(ctx, 'read', proposalServerSpec).sql` into the proposals select's where. The projects select stays (part 4).

`projects.router/business.router.ts`: `getProposalsByMeetingId({ ...ctx, scope: null }, …)` → `getProposalsByMeetingId(ctx, …)` and delete the "unscoped read" comment: the creator reads the meeting's proposals they reach.

- [ ] **Step 6: tsc and lint**

Run: `pnpm tsc && pnpm lint`
Expected: PASS.

- [ ] **Step 7: Greps**

```bash
git grep -n "userParticipatesInMeeting(.*proposals" -- src   # nothing
git grep -n "cannot('read', 'Proposal')" -- src/shared/entities   # nothing
```

- [ ] **Step 8: Boot check**

`curl -s -o /dev/null -w "%{http_code}\n" http://localhost:3003/dashboard` → 200.

- [ ] **Step 9: GET-only probes**

Add to `part3-checks.cjs`:

| Probe | Expected |
|---|---|
| dispatcher `meetingsRouter.reads.list {pagination:{limit:500,offset:0}}` | every row `proposalCount` 0 and `proposalStatuses` [] |
| dispatcher `meetingsRouter.reads.list` with `filters: { proposalStatus: ['sent'] }` | same `total` as without the filter |
| dispatcher `customerPipelinesRouter.getCustomerPipelineItems {pipeline:'fresh'}` | every row `proposalCount` 0, `proposals` [] |
| dispatcher `customerPipelinesRouter.getCustomerProfile` on a customer that has proposals (pick one as super-admin) | `allProposals` length 0, every meeting's `proposals` [] |
| dispatcher `dashboardRouter.getActionQueue` | no item of a sent-proposal kind |
| super-admin `meetingsRouter.reads.list` | `total` and the sum of `proposalCount` equal the Step 0 baseline |

Expected: every row as stated.

- [ ] **Step 10: Commit**

```bash
git add src/shared/entities/customers/dal/server/pipeline-items.ts src/shared/entities/meetings/dal/server/meetings-with-proposals.ts src/shared/entities/meetings/dal/server/queries.ts src/features/agent-dashboard/dal/server/get-action-queue.ts src/trpc/routers/dashboard.router.ts src/trpc/routers/customer-pipelines.router.ts src/trpc/routers/projects.router/business.router.ts
git commit -m "feat(permissions): every proposal read outside the module takes the proposal reach, so dispatchers receive no proposal data and agents only their meetings' proposals

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
git push -q origin HEAD
```

---

### Task 4: The share link's own routes, limits, and two loose ends

**Files:**
- Create: `src/shared/modules/proposals/core/lib/share-link-rate-limit.ts`
- Create: `src/shared/modules/proposals/core/lib/share-route-context.ts`
- Modify: `src/trpc/routers/proposals.router/views.router.ts`, `src/shared/modules/proposals/views/service.ts`
- Modify: `src/trpc/routers/proposals.router/delivery.router.ts`
- Modify: `src/app/api/proposals/[proposalId]/pdf/route.ts`, `src/app/api/proposals/[proposalId]/summary/route.ts`
- Modify: `src/trpc/routers/ai.router/index.ts`
- Modify: `src/shared/components/contract-status-panel/ui/proposal-card.tsx`

**Interfaces:**
- Consumes: `bearerContext`, `toHomeownerProposalView` (Tasks 1–2).
- Produces: `SHARE_LINK_LIMITS: { view: Ratelimit, moveForward: Ratelimit, document: Ratelimit }`; `shareRouteContext(token: string | null): Promise<{ ctx: ScopedContext, viaShareLink: boolean } | null>`.

- [ ] **Step 1: Limits**

`share-link-rate-limit.ts`:

```ts
import { Ratelimit } from '@upstash/ratelimit'
import { Redis } from '@upstash/redis'

import env from '@/shared/config/server-env'
import 'server-only'

const redis = new Redis({ url: env.UPSTASH_REDIS_REST_URL, token: env.UPSTASH_REDIS_REST_TOKEN })

// Keyed by the token: one link is one homeowner. A view notifies staff, a move-forward request emails
// them, and a document is rendered on our server.
export const SHARE_LINK_LIMITS = {
  view: new Ratelimit({ redis, limiter: Ratelimit.slidingWindow(30, '1 h'), prefix: 'share-link:view' }),
  moveForward: new Ratelimit({ redis, limiter: Ratelimit.slidingWindow(5, '1 h'), prefix: 'share-link:move-forward' }),
  document: new Ratelimit({ redis, limiter: Ratelimit.slidingWindow(30, '1 h'), prefix: 'share-link:document' }),
}
```

- [ ] **Step 2: Route context**

`share-route-context.ts`:

```ts
import type { ScopedContext } from '@/shared/dal/server/types'

import { bearerContext } from '@/shared/dal/server/lib/contexts'
import { getRequestActor } from '@/shared/domains/permissions/server/get-request-actor'
import { proposalServerSpec } from '@/shared/modules/proposals/core/server-spec'
import 'server-only'

/** The same order as the share procedure, for route handlers: a session wins, else the token's share link, else nothing. */
export async function shareRouteContext(token: string | null): Promise<{ ctx: ScopedContext, viaShareLink: boolean } | null> {
  const { session, actor } = await getRequestActor()
  if (session) {
    return { ctx: { actor, scope: null }, viaShareLink: false }
  }
  const bearer = token ? await bearerContext(proposalServerSpec, token) : null
  return bearer ? { ctx: bearer, viaShareLink: true } : null
}
```

- [ ] **Step 3: recordView**

`views.router.ts`:

```ts
  recordView: proposalShareableProcedure
    .input(recordViewSchema)
    .mutation(async ({ ctx, input }) => {
      // Staff opening the page is not a homeowner's visit.
      if (ctx.session) {
        return
      }
      const { success } = await SHARE_LINK_LIMITS.view.limit(input.token)
      if (!success) {
        return
      }
      dalToTrpc(await proposalService.views.record(ctx, input))
    }),
```

(`getProposalViews` stays on `agentProcedure`.) Remove `SYSTEM_CONTEXT` and `baseProcedure` imports if unused; rewrite the banner to the one reason that is not obvious, or delete it.

`views/service.ts`, `record`: delete the token compare (the context is the share link's); the `getFullView` not-found stays. Rewrite the header comment's "Authorization" paragraph to: `Authorization: the caller's context decides — a share link reaches only its own proposal and may add views to it.` Keep the recipients paragraph. `RecordProposalViewInput` keeps `token` (the procedure reads it), but `record` no longer uses it — if lint flags the unused field, leave the type as is: it documents the procedure input.

- [ ] **Step 4: Request to move forward, and the proposal email**

`delivery.router.ts`, `requestToMoveForward`: at the top of the handler:

```ts
      if (!ctx.session) {
        const { success } = await SHARE_LINK_LIMITS.moveForward.limit(input.token)
        if (!success) {
          throw new TRPCError({ code: 'TOO_MANY_REQUESTS', message: 'Your request was already sent. Please wait before sending it again.' })
        }
      }
```

`sendProposalEmail`: drop `token` from `sendEmailSchema`; at the top of the handler read the proposal through the actor and send its own token:

```ts
      // The link carries the proposal's own token, never one the caller supplies.
      const current = dalToTrpc(await proposalCrud.getById(ctx, { id: input.proposalId }))
      if (!current) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Proposal not found' })
      }
```

and pass `token: current.token` to `emailService.sendProposalEmail`. Replace `deriveOutcomeOnProposalSent(SYSTEM_CONTEXT, …)` with `deriveOutcomeOnProposalSent(systemContext('derived:proposal-sent'), …)` and its three-line comment with `// The meeting's outcome follows from the send; the sender's meeting reach does not decide it.` Remove the `@migration` marker line.

`proposal-card.tsx`: remove `token` from the `sendProposal.mutateAsync({ … })` call; remove the `token` prop or variable only if nothing else in the file uses it.

- [ ] **Step 5: PDF and summary routes**

`pdf/route.ts`:

```ts
  const { proposalId } = await params
  const token = new URL(req.url).searchParams.get('token')

  const share = await shareRouteContext(token)
  const result = share ? await getFullView(share.ctx, { id: proposalId }) : null
  // One answer for a wrong token and a missing proposal, so nothing reveals which ids exist.
  if (!share || !result?.success || !result.data) {
    return Response.json({ error: 'Not found' }, { status: 404 })
  }
  if (share.viaShareLink && token && !(await SHARE_LINK_LIMITS.document.limit(token)).success) {
    return Response.json({ error: 'Too many requests' }, { status: 429 })
  }
  const proposal = result.data
```

then `pdfService.generateProposalPdf(share.ctx, { proposalId })`. Remove `SYSTEM_CONTEXT`.

`summary/route.ts`: same opening; then `const proposal = toHomeownerProposalView(share.ctx.actor.ability, result.data)`. Delete the `TODO` line. Remove `SYSTEM_CONTEXT`.

- [ ] **Step 6: The AI summary route**

`ai.router/index.ts`:

```ts
  dispatchProjectSummaryJob: agentProcedure
    .input(z.object({
      proposalId: z.string().uuid(),
      // … the existing proposalFormValues line and its comment
    }))
    .mutation(async ({ ctx, input }) => {
      // The job writes the summary into the proposal's scope of work.
      if (!(await permit(ctx, 'update', proposalServerSpec, ['projectJSON']).probe(input.proposalId))) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Proposal not found' })
      }
      await generateAISummaryJob.dispatch({ proposalId: input.proposalId, proposalFormValues: input.proposalFormValues })
    }),
```

Imports: `TRPCError`, `permit`, `proposalServerSpec`, `agentProcedure` (drop `baseProcedure`).

- [ ] **Step 7: tsc, lint, greps**

Run: `pnpm tsc && pnpm lint`
Expected: PASS.

```bash
git grep -n "SYSTEM_CONTEXT" -- src/shared/modules/proposals src/trpc/routers/proposals.router src/app/api/proposals   # nothing but comments
git grep -n "proposal.token !== \|\.token !== token" -- src   # nothing
```

- [ ] **Step 8: GET-only probes**

Add to `part3-checks.cjs` (anonymous context, GET only; `T` from super-admin as in Task 2; never print `T`):

| Probe | Expected |
|---|---|
| `GET /api/proposals/P/pdf?token=T` | 200, `content-type` application/pdf |
| `GET /api/proposals/P/pdf?token=x` | 404 |
| `GET /api/proposals/<random uuid>/pdf?token=x` | 404 |
| `GET /api/proposals/P/pdf` (no token) | 404 |
| `GET /api/proposals/P/summary?token=T` | 200; body has no `costLines` text |
| `GET /api/proposals/<random uuid>/summary?token=x` | 404 |
| super-admin `GET /api/proposals/P/pdf` (no token) | 200 (session wins) |

`recordView`, `requestToMoveForward`, `sendProposalEmail` and the AI route write or send: they are the owner's hand checks in Task 6, never probed.

- [ ] **Step 9: Commit**

```bash
git add src/shared/modules/proposals/core/lib/share-link-rate-limit.ts src/shared/modules/proposals/core/lib/share-route-context.ts src/trpc/routers/proposals.router/views.router.ts src/shared/modules/proposals/views/service.ts src/trpc/routers/proposals.router/delivery.router.ts "src/app/api/proposals/[proposalId]/pdf/route.ts" "src/app/api/proposals/[proposalId]/summary/route.ts" src/trpc/routers/ai.router/index.ts src/shared/components/contract-status-panel/ui/proposal-card.tsx
git commit -m "feat(permissions): views, documents and move-forward requests go through the share link with per-link limits; the proposal email sends the proposal's own token; the AI summary needs an editor

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
git push -q origin HEAD
```

---

### Task 5: Name the background sites

**Files:**
- Modify: `src/shared/services/accounting.service.ts`
- Modify: `src/shared/services/providers/zoho-sign/lib/documents/registry.ts`
- Modify: `src/shared/services/providers/upstash/jobs/sync-zoho-sign-status.ts`

- [ ] **Step 1: QuickBooks**

`accounting.service.ts`: the six proposal sites (`getProposalsByIds`, the three `proposalCrud.update`, `getProposalsByInvoiceIds`, `getProposalByInvoiceId`) take `systemContext('sync:quickbooks')`. Build it once at the top of `createAccountingService` as `const quickbooks = systemContext('sync:quickbooks')` and pass `quickbooks`. The two `projectCrud` sites keep `SYSTEM_CONTEXT` (the Project family classifies them).

- [ ] **Step 2: Zoho Sign**

`registry.ts`: the SOW PDF generator → `pdfService.generateSowPdf(systemContext('derived:envelope-documents'), …)`. `sync-zoho-sign-status.ts`: `contractService.applyContractEvent(systemContext('webhook:zoho-sign'), …)`. Remove `SYSTEM_CONTEXT` imports left unused.

- [ ] **Step 3: tsc, lint, count**

Run: `pnpm tsc && pnpm lint`
Expected: PASS.

Run: `git grep -n "SYSTEM_CONTEXT" -- src | grep -v "import \|export const SYSTEM_CONTEXT\|^\S*:\s*//\|\* " | wc -l` and record the number in the task report (34 call sites before this part, 2026-10-09).

- [ ] **Step 4: Commit**

```bash
git add src/shared/services/accounting.service.ts src/shared/services/providers/zoho-sign/lib/documents/registry.ts src/shared/services/providers/upstash/jobs/sync-zoho-sign-status.ts
git commit -m "refactor(permissions): QuickBooks and Zoho Sign proposal sites run under named system reasons

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
git push -q origin HEAD
```

---

### Task 6: Checks, record, owner gate (controller-led)

- [ ] **Step 1: Full probe run**

Run `part3-checks.cjs` end to end and `rules-matrix.ts` (extend it with the agent's and dispatcher's compiled Proposal read SQL and the bearer's projection of a fake row). Record every result in the SDD ledger.

- [ ] **Step 2: Owner hand checks (W-list), handed to the owner**

| # | Who | Do | Expect |
|---|---|---|---|
| W1 | homeowner (incognito, share link) | open the link | page and prices as before; no internal financials |
| W2 | homeowner | change the finance option; change cash in deal | both save |
| W3 | homeowner | enter age in the agreement panel | saves; document list updates |
| W4 | homeowner | request to move forward | staff notified once; a sixth request within the hour is refused |
| W5 | agent (signed in) | open the same link with `?token=` | agent view; envelope card works |
| W6 | agent | send a proposal email | the link in the email opens the proposal |
| W7 | agent | create a proposal on a meeting they sit in; upload media; edit incentives | all work |
| W8 | dispatcher | browse meetings, customers, kanbans, dashboard | no proposal anywhere; nothing errors |
| W9 | super-admin | everything above | unchanged |

- [ ] **Step 3: Record**

Tracker §0, §4 Unit 3 ("Part 3 built"), §5.1 (S1 guarded, S2, S3 columns + cost lines, S8, S12 proposals, S15 proposal side, S19 closed), §5.3 rows (envelope selection, proposal children), §5.4 seams (`shareableMiddleware`, `isVisible`, `isInScope`, `buildUserContext` gone), D-29 (the bearer list keeps the customer-facing prices; owner 2026-10-09), Q12 (the homeowner's own contact details ride with the homeowner view; ruled 2026-10-09), Appendix A; spec status and §12 rows; DISTILLED §1; memory. Then `git merge main` at the boundary, tsc + lint, re-run the probes, delete this plan and the SDD workspace.
