# Permissions Unit 2 — One Actor Per Request — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Every server surface (tRPC, server components, layout guards) gets the current user's identity and ability from one cached `getRequestActor()`; the DAL context carries that actor; the browser checks permissions with rules the server built, never rebuilt from a role.

**Architecture:** `Actor { ability, userId }` replaces `session` + `ability` on `ScopedContext` and on the tRPC context. The legacy row filter (`ctx.scope`, `spec.visibility`, the per-entity scope procedures) keeps enforcing and leaves in unit 3. `AppAbility` becomes CASL's ability with `can` / `cannot` typed from the spec list, on server and client alike. The client gets `@casl/react` behind one `'use client'` module whose provider is fed packed rules by the server.

**Tech Stack:** Next.js 15.5.9 (App Router, React 19), tRPC v11, better-auth 1.6.9, `@casl/ability` 6.8.0, `@casl/react` 7.0.1 (added here), TanStack Query 5.104, Drizzle, TypeScript 5, pnpm.

**Spec:** `docs/superpowers/specs/2026-10-05-permissions-structure-design.md` (§5.5, §7, §8, §9, §10, §11 row 2). Tracker: `docs/plans/2026-08-10-casl-scope-compiler-epic.md` §4, "Unit 2".

---

## Decisions for the owner (read before approving)

These are the places where the tree forced a choice the spec did not make, or made differently. Each is built into the tasks below as recommended. Overrule any of them and I rework the affected task before execution.

**D1. The provider is NOT fed from the root layout (departs from spec §8).**
Spec §8 reads the actor in the root layout. In the tree that has two costs the spec did not weigh:

- `src/app/(frontend)/layout.tsx` is the root of every route and reads nothing per request today. Reading the session there (`headers()`) makes every route dynamic. The public site's static and ISR pages (`revalidate = 60 / 180`, `generateStaticParams` on portfolio and services) would become a server render on every visit.
- `src/app/(frontend)/dashboard/layout.tsx` deliberately does not wait for the session: three `Suspense` slots read it, so the shell streams while the database wakes (the 2026-09-29 cold-start work; measured on prod then: cold first byte 4.31 s → 1.65 s). A root-layout read would block the whole document on the session again.

Recommended, and what the tasks build: the server feeds the provider at the boundaries that already read the session (the three dashboard slots, the proposal-flow layout). Everywhere else (public pages, dialogs mounted above those slots) the provider follows the browser's session read, as it does today, and asks the server for that user's rules through one new query. The browser never builds rules from a role. Cost: one small extra request per hard page load for a signed-in user; none for an anonymous visitor.

**D2. Session changes are followed without a reload (departs from spec §8's `router.refresh()` line).**
Main's `ServerAbilityProvider` (2026-09-29) already follows the browser's session read after first paint, so a sign-out, a ban, a role change or an expired session shows without a reload. The new provider keeps that behaviour. `router.refresh()` is not needed and is not added.

**D3. `subject()` lives in a plain module, not in the `'use client'` module (corrects spec §8).**
A function exported from a `'use client'` file cannot be called on the server. `permissions/subject.ts` is plain; the client module exports only `AbilityProvider` and `useAbility()`.

**D4. `<Can>` is not built in this unit.** No component uses it today. It is added with its first call site.

**D5. `ability.can` / `cannot` are typed on the server too, not only on the client.**
One `AppAbility` type whose checks are typed from the spec list: an action its subject does not have, an unknown subject, a mistyped field and a row-level `read` check on an operator subject are compile errors everywhere. Proven by a throwaway probe on this tree (0 errors after three call sites were adjusted; 14 new must-not-compile lines live).

**D6. Interim entries in the map of subjects without a spec.**
`CustomerProfile` (`read`, `update`) and `CustomerLeadAttribution` (`read`) are subjects in today's rules but have no entity spec. They join `Activity` in the one map of subjects without a spec until unit 3's Customer family turns them into fields of `Customer`. `assign` is recorded as a capability on `Meeting` and on `Proposal` (the proposal "Assign Rep" action checks it today).

**D7. `ScopedContext` is `{ actor, scope, tx? }` after this unit.** `session` and `ability` leave now; `scope` leaves in unit 3 with the legacy engine, as the tracker says.

**D8. The share-link token branch keeps today's behaviour exactly.**
A token still wins over a session, and the token holder may still read and update the row the token names (hole S2 stays open until unit 3's Proposal family, as the tracker records). What changes is the shape: instead of `ability: null` meaning "skip the checks", the holder gets an actor whose ability says `read` and `update` on that subject, and the generic CRUD router checks it like any other.

**D9. One cast, in `subjectOf`.** Typing the erased spec's subject as `EntitySubject` is circular in TypeScript (TS4109, proven by the probe). `subjectOf` returns `EntitySubject` through a commented cast. Unit 3 removes it when `permit` takes a member of `ServerSpecs`.

**D10. Two small things outside permissions, deleted because this unit replaces them:** `src/shared/domains/auth/lib/get-cached-session.ts` (replaced by `getRequestActor`) and `src/shared/domains/auth/lib/utils.ts` (`requireAuth` / `requireUnauth`: session readers with no caller).

**New names introduced (yours to agree):** `abilityFromRules(rules)` (the one place an ability is built from rules), `StockAbility` (CASL's own ability type, for the builder and the React provider only), `Permission` (a verb and its subject as one value: what a nav item, a column or an action carries), `permissionsRouter.rules` (the query in D1), and the files `permissions/actor.ts`, `permissions/subject.ts`, `permissions/client.tsx`, `permissions/server/get-request-actor.ts`. `Actor`, `getRequestActor`, `AbilityProvider`, `useAbility`, `subject` are the spec's.

**Not in this unit:** the startup checks of spec §5.6 (they are vacuous until a rule has a condition or a `cannot`; they land with the first one in unit 3); one rules file per role; `bearerContext`, "a session wins", `systemContext(reason)`; route handlers (none reads a session today, so none changes; the token-authenticated PDF and summary routes are unit 3); the three hand-written client copies of server rules (unit 4); the `hasMounted` guard in the proposal navbar.

---

## Global Constraints

- Never `pnpm build`. Verification is `pnpm tsc` and `pnpm lint`.
- No test runner and no unit tests. The only test file is `src/shared/domains/permissions/type-checks/must-not-compile.ts`, checked by `pnpm tsc`.
- No database writes for testing, dev database included. Browser checks are read-only.
- No backwards compatibility: no alias, re-export, wrapper, unused parameter, `any` fallback or dual shape. A task removes what it replaces in the same change.
- No behaviour change a user can observe. Legacy enforcement (`ctx.scope`, `spec.visibility`, `resolveEffectiveScope`, the per-entity scope procedures, `SYSTEM_CONTEXT` call sites) is not redesigned.
- `@casl/ability` stays at 6.8.0. `@casl/react` is added at exactly 7.0.1 and imported in exactly one module: `src/shared/domains/permissions/client.tsx`.
- Comments say why, never what. No file banners. No citations of plans, specs, tasks or docs from code.
- One React component per file. No file-level constants or helper functions in component files. Named exports only. One exception, from spec §8: `permissions/client.tsx` holds the provider component and the `useAbility` hook together, because `@casl/react` may be imported in one module only.
- Stay on branch `refactor/285-refactor-permissions-casl-scope-compiler` in `.worktrees/issue-285`. Stage by explicit path. Never `git stash`, `git reset` or `git checkout` a file. No PR, no merge into main.
- Conventional commits. End every commit message with `Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>`.
- Some files are CRLF. Edit with the Edit tool or `sed -i`, never a script that rewrites a whole file; run `git diff --shortstat` after scripted edits and stop if a file shows a whole-file diff.
- Do not touch `src/app/(frontend)/globals.css`.

## Review Focus

No task's type-check exercises these. Each is pinned to a step in the task that owns the code.

1. **A share link opened by a signed-in agent.** The token must still win: the proposal renders, and choosing envelope documents is still refused on that path. (Task 3 Step 11 review line; Task 7 browser check C5.)
2. **System callers.** A job or webhook under `SYSTEM_CONTEXT` must pass every gate it passes today and still see ungated phones. The context now carries a `manage all` ability instead of `null`. (Task 3 Step 12 table, re-derived by the reviewer.)
3. **A component that calls `useAbility()` outside the provider.** The old hook returned a deny-all default; `@casl/react`'s throws. Every tree must sit under the root `Providers`. (Task 5 Step 9.)
4. **An anonymous visitor on a public page.** No rules request, and the root layout must stay free of per-request reads. (Task 5 Step 10; Task 7 browser check C1.)
5. **A dialog opened right after a dashboard load.** Dialogs mount above the server-fed slots, so their gated actions appear once the rules query lands, as they appear today once the session fetch lands. They must appear. (Task 7 browser check C3.)

---

## File Structure

| File | Responsibility after this unit |
|---|---|
| `src/shared/domains/permissions/types.ts` | The one map of subjects without a spec; `AppSubject`, `AppAction`, `Permission`, `StockAbility`, `PermissionRule`, `AppAbility` derived from the spec list |
| `src/shared/domains/permissions/abilities.ts` | `defineAbilitiesFor(user)`, `abilityFromRules(rules)`, `ENTITY_NAMES` |
| `src/shared/domains/permissions/subject.ts` (new) | Typed `subject(type, row)` |
| `src/shared/domains/permissions/actor.ts` (new) | `Actor` |
| `src/shared/domains/permissions/server/get-request-actor.ts` (new) | The one session read and ability build per request |
| `src/shared/domains/permissions/client.tsx` (new) | `AbilityProvider`, `useAbility()`; the only importer of `@casl/react` |
| `src/shared/domains/permissions/rules/define-rules.ts` | Typed `can` / `cannot`; rejects a condition value that may be `null` |
| `src/shared/dal/server/types.ts` | `ScopedContext { actor, scope, tx? }`, `SYSTEM_CONTEXT` |
| `src/trpc/types.ts`, `src/trpc/init.ts`, `src/trpc/lib/create-http-context.ts` | Context `{ session, actor, scope }`; a ladder that only narrows |
| `src/trpc/routers/permissions.router.ts` (new) | `rules`: the signed-in user's packed rules |
| Deleted | `permissions/context.ts`, `permissions/hooks.ts`, `components/providers/casl-provider.tsx`, `components/providers/server-ability-provider.tsx`, `auth/lib/get-cached-session.ts`, `auth/lib/utils.ts` |

---

### Task 1: The spec and the tracker follow this plan

Docs only. Done first so every later reviewer reads a spec that matches what is being built.

**Files:**
- Modify: `docs/superpowers/specs/2026-10-05-permissions-structure-design.md` (§2, §3, §8, §9)
- Modify: `docs/plans/2026-08-10-casl-scope-compiler-epic.md` (Unit 2 and Unit 3 blocks in §4)

**Interfaces:**
- Consumes: nothing.
- Produces: the spec text later tasks and reviewers are held to.

- [ ] **Step 1: Spec §2, add two rows** after the `defineAbilitiesFor(user)` row:

```markdown
| `abilityFromRules(rules)` | The one place an ability is built from rules. The server and the browser both use it, so they match rules the same way. |
| `subject(type, row)` | Tags a row with its subject for a row-level check. A plain module: the server may call it too. |
```

- [ ] **Step 2: Spec §3, replace the `permissions/` block** of the layers listing with:

```
src/shared/domains/permissions/     client-safe unless marked
  specs.ts                          type-only list of every spec, and the types derived from it
  types.ts                          subjects without a spec, and the ability types derived from the list
  operators.ts                      operator names, payload types, the subjects each may sit on (no SQL)
  rules/define-rules.ts             typed can / cannot
  rules/<role>.ts                   one file per role that has rules
  rules/bearer.ts                   rules for a share-link holder, per shareable entity
  rules/system.ts                   manage all, with a reason
  abilities.ts                      defineAbilitiesFor(user), abilityFromRules(rules), the conditions matcher, the startup checks
  subject.ts                        typed subject(type, row)
  actor.ts                          Actor
  client.tsx                        'use client': AbilityProvider, useAbility()
  server/get-request-actor.ts       server-only
```

- [ ] **Step 3: Spec §8, replace the whole section body** (everything between the `## 8. Client` heading and the `## 9.` heading) with:

~~~markdown
```tsx
// server: a boundary that has already read the session
const { session, actor } = await getRequestActor()
<AbilityProvider
  user={session ? { id: session.user.id, role: session.user.role } : null}
  rules={packRules(actor.ability.rules)}
>…</AbilityProvider>

// client
const ability = useAbility()
ability.can('create', 'Proposal')
ability.can('update', subject('CustomerNote', note))
ability.can('update', subject('Customer', customer), 'profile.hoa')
```

- `@casl/react` 7.0.1 is added (decision 11 stands); `@casl/ability` stays at 6.8.0. It is imported in exactly one `'use client'` module, `permissions/client.tsx`, which exports our `AbilityProvider` and the typed `useAbility()`.
- **Where the rules come from.** The root layout reads nothing per request, so public pages keep their static rendering and the dashboard shell streams before the session is read. The root `AbilityProvider` starts with no rules. Each server boundary that reads the session (the dashboard's three session slots, the proposal-flow layout) feeds a nested provider the packed rules, so gated UI is in the first paint there. Anywhere else (public pages, dialogs mounted above those boundaries) the provider follows the browser's session read and asks the server for that user's rules through `permissionsRouter.rules`. The browser never builds rules from a role.
- A provider keeps following the browser's session read after the first paint: a sign-out, a role change or an expired session shows without a reload.
- `ability.can` and `ability.cannot` are typed from the specs on the server and the client alike. They reject: an action its subject does not have; an unknown subject; a field that is not in `FieldOf<S>`; a row-level `read` check on a subject whose read rule may carry an operator.
- `subject(type, row)` lives in `permissions/subject.ts`, a plain module. It rejects a row without that entity's `conditionColumns`. It is applied where the row is used, not before it crosses the wire: the tag does not survive serialization.
- `<Can>` is added with its first call site.
- The client-side ability rebuilds are deleted in unit 2. The three hand-written copies of server rules (`get-accessible-pipelines.ts`, `use-customer-note-action-configs.ts`, `can-see-phone.ts`) are deleted in unit 4.
~~~

- [ ] **Step 4: Spec §9, add one row** after the row that begins "Condition, operator or whole conditions argument that may be `undefined`":

```markdown
| Condition value that may be `null` (the literal `null` is legal); a check that asks an action its subject does not have | compile |
```

- [ ] **Step 5: Tracker, replace the three sub-bullets of the Unit 2 block** ("Carried from unit 1's review", "New from main at the unit 1 merge", "AC") with:

```markdown
  - **Plan:** `docs/superpowers/plans/2026-10-05-permissions-unit-2-one-actor-per-request.md`. Its "Decisions for the owner" list is where it departs from the first wording of spec §8.
  - **AC:** `defineAbilitiesFor` is called by `getRequestActor` (the request's actor) and by `rolesWithAbility` (a question about roles, not about the current user) and by nothing else; the browser never calls it; `auth.api.getSession` appears in `get-request-actor.ts` only; `git grep` for `ctx.ability`, `systemProcedure`, `scopeMiddleware(` and `ability: null` = 0 in `src/`; tsc + lint green.
```

- [ ] **Step 6: Tracker, append to the Unit 3 "Carried from unit 1's review" bullet** (same paragraph, at its end):

```markdown
 **Carried from unit 2:** typing `permit`'s spec by list membership removes the cast in `subjectOf`. The Proposal family replaces three legacy translations: the token branch of `shareableMiddleware` (a token wins over a session; the holder's ability is bare `read` + `update`), the `ctx.actor.userId === null` gate in `contracts.router.ts` (it becomes a field rule), and `isVisible` treating a missing user as unrestricted. The Customer family deletes `CustomerProfile` and `CustomerLeadAttribution` from `SubjectsWithoutSpec` when they become fields of `Customer`.
```

- [ ] **Step 7: Commit**

```bash
git add docs/superpowers/specs/2026-10-05-permissions-structure-design.md docs/plans/2026-08-10-casl-scope-compiler-epic.md
git commit -m "docs(permissions): spec and tracker follow the unit 2 plan

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 2: Ability types derived from the spec list

`AppSubject`, `AppAction` and `AppAbility` stop coming from `ENTITY_NAMES` and a hand-kept union. The whole design below was type-checked on this tree by a probe: apply it as written.

**Files:**
- Rewrite: `src/shared/domains/permissions/types.ts`
- Modify: `src/shared/domains/permissions/rules/define-rules.ts:1-45`
- Modify: `src/shared/domains/permissions/abilities.ts:1-7,57-67,180-183`
- Create: `src/shared/domains/permissions/subject.ts`
- Modify: `src/shared/dal/server/lib/define-spec.ts:5,56-59`
- Modify: `src/shared/domains/permissions/lib/roles-with-ability.ts`
- Modify: `src/shared/components/entities/entity-actions/types.ts:4,14`
- Modify: `src/shared/components/entities/entity-actions/lib/visible-actions.ts:5`
- Modify: `src/shared/components/data-table/lib/use-entity-columns.tsx:7,51,96`
- Modify: `src/trpc/lib/create-crud-router.ts:4,116-155`
- Test: `src/shared/domains/permissions/type-checks/must-not-compile.ts` (append)

**Interfaces:**
- Consumes: `EntitySubject`, `RowOf`, `ConditionColumnOf`, `FieldOf` from `permissions/specs.ts`; `ReadOperators` from `permissions/operators.ts`.
- Produces:
  - `types.ts`: `CrudAction`, `SubjectsWithoutSpec`, `ExtraEntityActions`, `AppSubject`, `AppAction`, `Permission`, `StockAbility`, `PermissionRule`, `AppAbility`.
  - `abilities.ts`: `abilityFromRules(rules: PermissionRule[]): StockAbility`; `defineAbilitiesFor(user: { id: string, role: UserRole } | null): AppAbility` (unchanged signature).
  - `subject.ts`: `subject<S extends EntitySubject, TRow>(type: S, row: TRow): TRow & ForcedSubject<S>`.
  - `define-spec.ts`: `subjectOf(spec: ServerSpec): EntitySubject`.
  - `roles-with-ability.ts`: `rolesWithAbility(...permission: Permission): UserRole[]`.

- [ ] **Step 1: Record today's rules, to prove later that none changed.** This task retypes the loader; it must not change a single rule.

```bash
mkdir -p "$SCRATCH" && npx tsx -e "import('./src/shared/domains/permissions/abilities.ts').then((m) => { for (const role of ['user', 'homeowner', 'agent', 'super-admin', 'dispatcher']) console.log(role, JSON.stringify(m.defineAbilitiesFor({ id: 'u1', role }).rules)); console.log('nobody', JSON.stringify(m.defineAbilitiesFor(null).rules)) })" > "$SCRATCH/rules-before.txt"
wc -l "$SCRATCH/rules-before.txt"
```

`$SCRATCH` is the session scratchpad directory, never a path inside the repo. Expected: 6 lines.

- [ ] **Step 2: Write the failing fixtures.** Append to `src/shared/domains/permissions/type-checks/must-not-compile.ts`, and add the two imports to its import block (`import type { AppAbility, Permission } from '@/shared/domains/permissions/types'` with the other type imports; `import { subject } from '@/shared/domains/permissions/subject'` with the value imports):

```ts
// ── checks ─────────────────────────────────────────────────────────────────

declare const ability: AppAbility
declare const somePermission: Permission
declare const nullableUserId: string | null
declare const noteRow: { id: string, authorId: string | null, content: string }

export function checksThatMustCompile() {
  ability.can('create', 'Proposal')
  ability.can('manage', 'all')
  ability.cannot('manage', 'CustomerPipeline')
  ability.cannot('assign', 'Meeting')
  ability.can('assign', 'Proposal')
  ability.can('own', 'Meeting')
  ability.can('read', 'User')
  ability.can('update', 'CustomerProfile')
  ability.can('update', 'Customer', 'age')
  ability.can('update', 'Proposal', 'views')
  ability.can('update', 'Proposal', 'views.viewedAt')
  ability.can(...somePermission)
  ability.can('update', subject('CustomerNote', noteRow))
  ability.can('update', subject('CustomerNote', { authorId: null }))
  ability.can('update', subject('Proposal', { id: 'proposal-1' }), 'financeOptionId')
  ability.can('read', subject('CustomerNote', noteRow))
  ability.can('delete', subject('Application', {}))
}

// @ts-expect-error a field that is not a column or path of the subject
ability.can('update', 'Customer', 'agee')
// @ts-expect-error a sub-entity path that does not exist
ability.can('update', 'Proposal', 'views.nope')
// @ts-expect-error an action that is not asked of an entity
ability.can('access', 'Customer')
// @ts-expect-error an unknown subject
ability.can('read', 'Custmer')
// @ts-expect-error an unknown action
ability.cannot('edit', 'Customer')
// @ts-expect-error a field on a subject that has no spec
ability.can('read', 'User', 'name')
// @ts-expect-error `own` belongs to Meeting
ability.can('own', 'Proposal')
// @ts-expect-error a row that lacks the subject's condition column
subject('CustomerNote', { id: 'note-1' })
// @ts-expect-error a row tagged as an unknown subject
subject('Custmer', {})
// @ts-expect-error a read rule on Proposal may carry an operator, which only SQL can evaluate
ability.can('read', subject('Proposal', { id: 'proposal-1' }))
// @ts-expect-error a mistyped field on a row check
ability.can('update', subject('CustomerNote', noteRow), 'contnt')

defineRules((can, cannot) => {
  can('read', 'CustomerNote', { authorId: null })
  // @ts-expect-error a condition value that may be null
  can('read', 'CustomerNote', { authorId: nullableUserId })
  // @ts-expect-error a cannot condition that may be null
  cannot('update', 'CustomerNote', { authorId: nullableUserId })
  // @ts-expect-error a condition value that may be null, after a field list
  can('update', 'Proposal', ['views'], { id: nullableUserId })
})
```

- [ ] **Step 3: Run the type-check and see it fail.**

Run: `pnpm tsc`
Expected: FAIL. Errors include `Cannot find module '@/shared/domains/permissions/subject'`, `Module '"@/shared/domains/permissions/types"' has no exported member 'Permission'`, and `Unused '@ts-expect-error' directive` on the lines the current loose types accept.

- [ ] **Step 4: Rewrite `src/shared/domains/permissions/types.ts`** in full:

```ts
import type { ForcedSubject, MongoAbility, RawRuleOf } from '@casl/ability'

import type { ReadOperators } from './operators'
import type { ConditionColumnOf, EntitySubject, FieldOf, RowOf } from './specs'

export type CrudAction = 'create' | 'delete' | 'read' | 'update'

/** Subjects that have no entity spec: feature gates, and records whose table has no spec yet. Verbs only. */
export interface SubjectsWithoutSpec {
  all: 'manage'
  Dashboard: 'access'
  Calendar: 'manage'
  CustomerPipeline: 'read'
  LeadsPool: 'read'
  User: 'read'
  Activity: CrudAction
  CustomerProfile: 'read' | 'update'
  CustomerLeadAttribution: 'read'
}

/** Capabilities on an entity that are not about a row. */
export interface ExtraEntityActions {
  Meeting: 'assign' | 'own'
  Proposal: 'assign'
}

export type AppSubject = EntitySubject | keyof SubjectsWithoutSpec

type ActionOn<S extends AppSubject> = S extends EntitySubject
  ? CrudAction | (S extends keyof ExtraEntityActions ? ExtraEntityActions[S] : never)
  : S extends keyof SubjectsWithoutSpec ? SubjectsWithoutSpec[S] : never

// `manage` is CASL's "every action": only `manage all` grants it, and a check may ask it of any subject.
export type AppAction = ActionOn<AppSubject> | 'manage'

/** A verb and the subject it is asked of, as one value: what a nav item, a column or an action carries. */
export type Permission = { [S in AppSubject]: [action: ActionOn<S> | 'manage', subject: S] }[AppSubject]

// A condition on a column the row does not carry reads `undefined` and never matches.
type SubjectRow<S extends EntitySubject> = Pick<RowOf<S>, ConditionColumnOf<S> & keyof RowOf<S>> & ForcedSubject<S>

// A `read` rule on these subjects may carry an operator, which only SQL can evaluate.
type RowAction<S extends EntitySubject> = S extends keyof ReadOperators ? Exclude<CrudAction, 'read'> : CrudAction

interface AbilityCheck {
  (...permission: Permission): boolean
  <S extends EntitySubject>(action: CrudAction, subject: S, field: FieldOf<S>): boolean
  <S extends EntitySubject>(action: RowAction<S>, subject: SubjectRow<S>, field?: FieldOf<S>): boolean
}

/** CASL's own ability type. Only the code that builds an ability, or hands one to CASL's React provider, needs it. */
export type StockAbility = MongoAbility<[AppAction, AppSubject | ForcedSubject<EntitySubject>]>

export type PermissionRule = RawRuleOf<StockAbility>

/** The app's ability: CASL's, with `can` and `cannot` typed from the specs. */
export type AppAbility = Omit<StockAbility, 'can' | 'cannot'> & { can: AbilityCheck, cannot: AbilityCheck }
```

- [ ] **Step 5: `define-rules.ts`: take the shared types, reject a maybe-null condition.**

Replace lines 1-24 (the imports, `PermissionRule`, `CrudAction`, `SubjectsWithoutSpec`, `ExtraEntityActions`) with:

```ts
import type { ReadOperators } from '@/shared/domains/permissions/operators'
import type { ConditionColumnOf, EntitySubject, FieldOf, RowOf } from '@/shared/domains/permissions/specs'
import type { CrudAction, ExtraEntityActions, PermissionRule, SubjectsWithoutSpec } from '@/shared/domains/permissions/types'
```

Replace the comment block and the three type lines that start at `// An entity with no condition columns has an EMPTY conditions type` and end at the `Rejected` line with:

```ts
// An entity with no condition columns has an EMPTY conditions type, and an empty object type
// accepts any object. So the given conditions are captured as `TGiven`, and three kinds of key are
// turned into `never`: a key outside `TAllowed`; a key whose value may be `undefined`, which would
// drop the filter it stands for; and a key whose value may be `null` without being the literal
// `null`, which would turn "this user's rows" into "rows with no user" when the id is missing.
// When nothing is rejected the result is `TGiven` untouched, because intersecting with `{}` would
// switch off the "no properties in common" check. An empty conditions object is rejected too: a
// rule without conditions is written without the argument.
type MaybeUndefinedKey<TGiven> = { [K in keyof TGiven]-?: undefined extends TGiven[K] ? K : never }[keyof TGiven]
type MaybeNullKey<TGiven> = { [K in keyof TGiven]-?: null extends TGiven[K] ? ([TGiven[K]] extends [null] ? never : K) : never }[keyof TGiven]
type Rejected<TGiven, TAllowed> = Exclude<keyof TGiven, keyof TAllowed> | MaybeUndefinedKey<TGiven> | MaybeNullKey<TGiven>
```

Leave the rest of the file as it is. `defineRules` still returns `PermissionRule[]`, now the type from `types.ts`.

- [ ] **Step 6: `abilities.ts`: one builder.**

Line 1 comment becomes:

```ts
// Client-safe: the browser builds its ability from the rules the server sends, with `abilityFromRules`.
```

Line 3 becomes `import type { AppAbility, PermissionRule, StockAbility } from './types'`.

Replace the opening of `defineAbilitiesFor` (the `AbilityBuilder` line through the `if (!user)` block) and its final `return build()` so the function reads:

```ts
/** The one place an ability is built from rules, so the server and the browser match them the same way. */
export function abilityFromRules(rules: PermissionRule[]): StockAbility {
  return createMongoAbility<StockAbility>(rules)
}

export function defineAbilitiesFor(user: PermissionUser | null): AppAbility {
  const { can, rules } = new AbilityBuilder<StockAbility>(createMongoAbility)

  if (!user) {
    return abilityFromRules(rules)
  }

  switch (user.role) {
    // every case stays exactly as it is
  }

  return abilityFromRules(rules)
}
```

- [ ] **Step 7: Create `src/shared/domains/permissions/subject.ts`:**

```ts
import type { ForcedSubject } from '@casl/ability'

import type { ConditionColumnOf, EntitySubject, RowOf } from '@/shared/domains/permissions/specs'

import { subject as tagSubject } from '@casl/ability'

/** Tags a row with its subject so a rule's conditions can be tested on it. Tag where the row is used: the tag does not survive serialization. */
export function subject<S extends EntitySubject, TRow extends Pick<RowOf<S>, ConditionColumnOf<S> & keyof RowOf<S>>>(type: S, row: TRow): TRow & ForcedSubject<S> {
  return tagSubject(type, row)
}
```

- [ ] **Step 8: `define-spec.ts`: `subjectOf` returns a real subject.** Add `import type { EntitySubject } from '@/shared/domains/permissions/specs'` beside the `EntityName` import, and replace the function:

```ts
/** The CASL subject a spec is checked under: its own, or its parent's for a sub-entity. */
export function subjectOf(spec: ServerSpec): EntitySubject {
  // The erased spec type only knows `EntityName`: typing its subject as `EntitySubject` is circular,
  // because that type is derived from the specs themselves. A spec left out of the list gets a
  // subject no rule names, so CASL denies it.
  return ('subject' in spec ? spec.subject : subjectOf(spec.parent.spec)) as EntitySubject
}
```

- [ ] **Step 9: The three places that carry a verb and a subject as data.**

`src/shared/components/entities/entity-actions/types.ts`: import `Permission` instead of `AppAction, AppSubject`; `permission?: [AppAction, AppSubject]` becomes `permission?: Permission`.

`src/shared/components/entities/entity-actions/lib/visible-actions.ts:5`:

```ts
  return !action.permission || ability.can(...action.permission)
```

`src/shared/components/data-table/lib/use-entity-columns.tsx`: import `Permission` instead of `AppAction, AppSubject`; `permission?: Permission`; line 96 becomes:

```ts
      if (config.permission && !ability.can(...config.permission)) {
```

`src/shared/domains/permissions/lib/roles-with-ability.ts` in full:

```ts
import type { UserRole } from '@/shared/constants/enums'
import type { Permission } from '@/shared/domains/permissions/types'

import { userRoles } from '@/shared/constants/enums'
import { defineAbilitiesFor } from '@/shared/domains/permissions/abilities'

/** A SQL `role IN (…)` needs role strings; deriving them from the abilities keeps the two from drifting. */
export function rolesWithAbility(...permission: Permission): UserRole[] {
  return userRoles.filter(role => defineAbilitiesFor({ id: '', role }).can(...permission))
}
```

- [ ] **Step 10: `create-crud-router.ts`: the legacy gate asks CASL's rule index.** Its subject and field are known only at run time, which the typed `can` refuses.

Line 4 becomes `import type { AppAbility, AppAction } from '@/shared/domains/permissions/types'`.

Replace `assertCan` and `assertCanUpdateFields` (from the `/** Not for \`update\`` comment to the end of the file) with:

```ts
// The subject and the field are known only at run time here, which the typed `can` refuses.
// This is what `can` does inside CASL.
function isGranted(ability: AppAbility, action: AppAction, spec: ServerSpec, field?: string): boolean {
  const rule = ability.relevantRuleFor(action, subjectOf(spec), field)
  return rule != null && !rule.inverted
}

/** Not for `update`: a slot-level check would let a field-restricted grant bypass per-field intent. */
function assertCan(ability: AppAbility, slot: SlotName, spec: ServerSpec): void {
  const action = SLOT_ACTIONS[slot]
  if (!isGranted(ability, action, spec)) {
    throw new TRPCError({
      code: 'FORBIDDEN',
      message: `You do not have permission to ${action} ${spec.entityName}`,
    })
  }
}

/**
 * CASL field semantics: an unrestricted grant passes every field; a field-restricted grant
 * (`can('update', 'X', ['a', 'b'])`) passes only those; `manage all` passes every field.
 * Undefined values are skipped — "not attempting to write this field", same as the input shape.
 */
function assertCanUpdateFields(ability: AppAbility, spec: ServerSpec, data: Record<string, unknown>): void {
  for (const [field, value] of Object.entries(data)) {
    if (value === undefined) {
      continue
    }
    if (!isGranted(ability, 'update', spec, field)) {
      throw new TRPCError({
        code: 'FORBIDDEN',
        message: `You do not have permission to update ${spec.entityName}.${field}`,
      })
    }
  }
}
```

The call sites inside the router body are untouched in this task (`ctx.ability` is still `AppAbility | null` there and still guarded by `if (ctx.ability)`).

- [ ] **Step 11: Type-check and lint.**

Run: `pnpm tsc`
Expected: PASS, no output after the `tsc --noEmit` line.

Run: `pnpm lint`
Expected: PASS. If import order is reported, run `pnpm lint --fix` and re-run.

- [ ] **Step 12: The rules did not change.**

```bash
npx tsx -e "import('./src/shared/domains/permissions/abilities.ts').then((m) => { for (const role of ['user', 'homeowner', 'agent', 'super-admin', 'dispatcher']) console.log(role, JSON.stringify(m.defineAbilitiesFor({ id: 'u1', role }).rules)); console.log('nobody', JSON.stringify(m.defineAbilitiesFor(null).rules)) })" > "$SCRATCH/rules-after.txt"
diff "$SCRATCH/rules-before.txt" "$SCRATCH/rules-after.txt" && echo identical
```

Expected: `identical`.

- [ ] **Step 13: Prove three of the new fixture lines are live.** For each line below, delete its `// @ts-expect-error` comment, run `pnpm tsc`, confirm the named error appears, and put the comment back:

| Line | Expected |
|---|---|
| `ability.can('update', 'Customer', 'agee')` | an error on that line: no overload matches |
| `subject('CustomerNote', { id: 'note-1' })` | an error on that line: `authorId` is missing |
| `can('read', 'CustomerNote', { authorId: nullableUserId })` | an error on that line: no overload matches |

Run `pnpm tsc` once more after restoring. Expected: PASS.

- [ ] **Step 14: Commit**

```bash
git add src/shared/domains/permissions/types.ts src/shared/domains/permissions/rules/define-rules.ts src/shared/domains/permissions/abilities.ts src/shared/domains/permissions/subject.ts src/shared/domains/permissions/type-checks/must-not-compile.ts src/shared/domains/permissions/lib/roles-with-ability.ts src/shared/dal/server/lib/define-spec.ts src/shared/components/entities/entity-actions/types.ts src/shared/components/entities/entity-actions/lib/visible-actions.ts src/shared/components/data-table/lib/use-entity-columns.tsx src/trpc/lib/create-crud-router.ts
git commit -m "refactor(permissions): ability types derive from the spec list; can and cannot are typed

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 3: The actor on the DAL context and the tRPC context

One compile-coupled change: `ScopedContext` and the tRPC context drop `session`-as-identity and `ability` for `actor`. `pnpm tsc` passes only when every step is done. Nothing a caller can observe changes.

**What `ability: null` meant, and what replaces it.** Today a missing ability means "the system" (`SYSTEM_CONTEXT`) or "a share-link holder" (the token branch). After this task every context has a real ability:

| Caller | `actor.ability` | `actor.userId` |
|---|---|---|
| Signed-in user | their role's rules | their id |
| Anonymous request | no rules | `null` |
| `SYSTEM_CONTEXT` | `manage all` | `null` |
| Share-link holder (token branch) | `read` + `update` on the shareable subject | `null`, even when a session exists: the token wins today, and it keeps winning |

**Files:**
- Create: `src/shared/domains/permissions/actor.ts`
- Create: `src/shared/domains/permissions/server/get-request-actor.ts`
- Modify: `src/shared/dal/server/types.ts:7-26`
- Modify: `src/shared/dal/server/lib/helpers.ts:1-9,42-54`
- Modify: `src/shared/dal/server/lib/scope.ts:35-50`
- Modify (DAL readers): `src/shared/entities/activities/dal/server/queries.ts:24-30`, `src/shared/entities/customer-notes/dal/server/crud.ts:25-52`, `src/shared/entities/customer-notes/lib/assert-note-author.ts`, `src/shared/entities/customers/dal/server/pipeline-items.ts:50-53`, `src/shared/entities/customers/dal/server/queries.ts:48`, `src/shared/entities/customers/lib/phone-gating-sql.ts:35-44`, `src/shared/entities/meetings/dal/server/crud.ts:39-53,83,126,177`, `src/shared/entities/meetings/lib/resolve-owner.ts`, `src/shared/entities/meetings/dal/server/queries.ts:104,218`, `src/shared/entities/voip-campaign-contacts/dal/server/queries.ts:230`, `src/shared/modules/proposals/core/dal/server/crud.ts:101`, `src/features/customer-pipelines/dal/server/move-customer-pipeline-item.ts:22-46,101,135,166`, `src/shared/db/schema/meetings.ts:74` (comment)
- Modify (tRPC): `src/trpc/types.ts`, `src/trpc/init.ts`, `src/trpc/lib/create-http-context.ts`, `src/trpc/lib/middleware/shareable-middleware.ts`, `src/trpc/lib/middleware/scope-middleware.ts`, `src/trpc/lib/create-crud-router.ts:47-112`
- Modify (routers): every file under `src/trpc/routers/` that reads `ctx.ability` (17 files, found by the command in Step 9), plus `src/trpc/routers/proposals.router/views.router.ts`

**Interfaces:**
- Consumes: `abilityFromRules`, `defineAbilitiesFor`, `AppAbility` from Task 2; `subjectOf` from Task 2.
- Produces:
  - `interface Actor { ability: AppAbility, userId: string | null }` from `@/shared/domains/permissions/actor`.
  - `getRequestActor(): Promise<{ session: BetterAuthSession | null, actor: Actor }>` from `@/shared/domains/permissions/server/get-request-actor`.
  - `interface ScopedContext { actor: Actor, scope: SQL | null, tx?: Tx }`.
  - `buildUserContext(user: VisibilityScope, spec: ServerSpec): ScopedContext` where `VisibilityScope` is the existing `{ userId: string, ability: AppAbility }`.
  - tRPC context `{ session: BetterAuthSession | null, actor: Actor, scope: SQL | null, req?: Request, resHeaders: Headers }`; `protectedProcedure` narrows `session` to non-null.
  - `canSeeUngatedPhone(ability: AppAbility): boolean`; `resolveMeetingOwnerId(userId: string, ability: AppAbility): Promise<string>`.
  - `moveCustomerPipelineItem({ customerId, fromStage, toStage, pipeline, user })` where `user: VisibilityScope`.

- [ ] **Step 1: Create `src/shared/domains/permissions/actor.ts`:**

```ts
import type { AppAbility } from './types'

/**
 * Who is acting. Reach comes from `ability`; `userId` only stamps data (author, owner).
 * It is `null` for a share-link holder, for the system and for an anonymous request.
 */
export interface Actor {
  ability: AppAbility
  userId: string | null
}
```

- [ ] **Step 2: Create `src/shared/domains/permissions/server/get-request-actor.ts`:**

```ts
import type { Actor } from '@/shared/domains/permissions/actor'

import type { BetterAuthSession } from '@/shared/domains/auth/server'

import { headers } from 'next/headers'
import { cache } from 'react'

import { auth } from '@/shared/domains/auth/server'
import { defineAbilitiesFor } from '@/shared/domains/permissions/abilities'
import 'server-only'

interface RequestActor {
  session: BetterAuthSession | null
  actor: Actor
}

// Memoized per server render, so a layout, its pages, their guards and the tRPC prefetch context
// share one session read and one ability build. In a route handler React's `cache` does not
// memoize, and tRPC's adapter already builds its context once per HTTP batch.
export const getRequestActor = cache(async (): Promise<RequestActor> => {
  const session = await auth.api.getSession({ headers: await headers() })
  const ability = defineAbilitiesFor(session ? { id: session.user.id, role: session.user.role } : null)
  return { session, actor: { ability, userId: session?.user.id ?? null } }
})
```

- [ ] **Step 3: `src/shared/dal/server/types.ts`: the context.** Remove the `BetterAuthSession` import (line 9) and the `AppAbility` import if nothing else in the file uses it (`VisibilityScope` does: keep it). Add `import type { Actor } from '@/shared/domains/permissions/actor'` with the type imports and `import { abilityFromRules } from '@/shared/domains/permissions/abilities'` as a value import. Replace lines 13-26 with:

```ts
export interface ScopedContext {
  actor: Actor
  /** `null` = no visibility restriction (system/omni). */
  scope: SQL | null
  /** Present ⇒ run on the caller's ambient transaction. Absent ⇒ autocommit on `db`. */
  tx?: Tx
}

// No user and every action: jobs, webhooks and server-derived writes.
export const SYSTEM_CONTEXT: ScopedContext = {
  actor: { ability: abilityFromRules([{ action: 'manage', subject: 'all' }]), userId: null },
  scope: null,
}
```

- [ ] **Step 4: `src/shared/dal/server/lib/helpers.ts`: `buildUserContext` takes the user it is for.** Remove the `UserRole` and `defineAbilitiesFor` imports; import `VisibilityScope` with the other types from `'../types'`. Replace the function:

```ts
/** A context for `user` whose row filter is `spec`'s: for probing an entity other than the one `ctx.scope` was resolved for. */
export function buildUserContext(user: VisibilityScope, spec: ServerSpec): ScopedContext {
  const isOmni = user.ability.can('manage', 'all')
  return {
    actor: { ability: user.ability, userId: user.userId },
    scope: isOmni ? null : resolveEffectiveScope(spec, user),
  }
}
```

- [ ] **Step 5: `src/shared/dal/server/lib/scope.ts`: `isVisible`.** Replace its first three statements (the two early returns and the `const scope` line) with:

```ts
  const { ability, userId } = ctx.actor
  if (userId === null) {
    return true // no user: the system, or a share-link holder whose row the token already pinned
  }
  if (ability.can('manage', 'all')) {
    return true // omni
  }
  const scope = resolveEffectiveScope(spec, { userId, ability })
```

- [ ] **Step 6: The DAL readers.** Each row is one edit; the behaviour column says why it is the same behaviour.

| File | Before | After | Same because |
|---|---|---|---|
| `activities/dal/server/queries.ts` `activityOwnerScope` | `if (!ctx.ability \|\| ctx.ability.can('manage', 'all'))` … `eq(activities.ownerId, ctx.session?.user.id ?? '')` | `if (ctx.actor.ability.can('manage', 'all'))` … `eq(activities.ownerId, ctx.actor.userId ?? '')` | the system now carries `manage all` |
| `customer-notes/dal/server/crud.ts` create `before` | `const userId = ctx.session?.user.id` / `const isOmni = ctx.ability?.can('manage', 'all') ?? false` / `(!userId \|\| isOmni) ? SYSTEM_CONTEXT : buildUserContext(userId, ctx.session!.user.role, customerServerSpec)` | `const { ability, userId } = ctx.actor` / `const isOmni = ability.can('manage', 'all')` / `(userId === null \|\| isOmni) ? SYSTEM_CONTEXT : buildUserContext({ userId, ability }, customerServerSpec)` | same branches |
| same hook, last line | `authorId: userId ?? input.authorId ?? null` | unchanged text (`userId` is now `string \| null`) | — |
| `customer-notes/lib/assert-note-author.ts` | `const userId = ctx.session?.user.id` / `const isAdmin = ctx.ability?.can('manage', 'all') ?? false` | `const { ability, userId } = ctx.actor` / `const isAdmin = ability.can('manage', 'all')` | see the note under the table |
| `customers/dal/server/pipeline-items.ts:51-53` | `userId: ctx.session?.user.id ?? ''` / `isOmni: !ctx.ability \|\| ctx.ability.can('manage', 'all')` / `canSeeUngatedPhone(ctx.ability)` | `userId: ctx.actor.userId ?? ''` / `isOmni: ctx.actor.ability.can('manage', 'all')` / `canSeeUngatedPhone(ctx.actor.ability)` | the system carries `manage all` |
| `customers/dal/server/queries.ts:48`, `meetings/dal/server/queries.ts:104,218`, `voip-campaign-contacts/dal/server/queries.ts:230` | `canSeeUngatedPhone(ctx.ability)` | `canSeeUngatedPhone(ctx.actor.ability)` | — |
| `customers/lib/phone-gating-sql.ts` `canSeeUngatedPhone` | `(ability: AppAbility \| null)` with `if (!ability) return true` | `(ability: AppAbility)`: `return ability.can('manage', 'all') \|\| ability.can('read', 'LeadsPool')` | `manage all` covers the system; no share-link read calls it |
| `meetings/dal/server/crud.ts` create `before` | `ctx.session?.user.id ?? null` for `setBy`; `if (!ctx.session) return { ...input, setBy }`; `ownerId: await resolveMeetingOwnerId(ctx)` | `const { ability, userId } = ctx.actor`; `setBy = input.setBy === undefined ? userId : input.setBy`; `if (userId === null) return { ...input, setBy }`; `ownerId: await resolveMeetingOwnerId(userId, ability)` | same branches |
| `meetings/lib/resolve-owner.ts` | `(ctx: ScopedContext)`: `if (ctx.ability?.can('own', 'Meeting')) return ctx.session!.user.id` | `(userId: string, ability: AppAbility)`: `if (ability.can('own', 'Meeting')) return userId` | the caller already ruled out a missing user |
| `meetings/dal/server/crud.ts:83` | `if (ctx.ability?.cannot('assign', 'Meeting'))` | `if (ctx.actor.ability.cannot('assign', 'Meeting'))` | `manage all` is not refused |
| `meetings/dal/server/crud.ts:126` | `excludeUserId: ctx.session?.user.id` | `excludeUserId: ctx.actor.userId ?? undefined` | — |
| `meetings/dal/server/crud.ts:177` | `ownerId: ctx.session?.user.id ?? source.ownerId` | `ownerId: ctx.actor.userId ?? source.ownerId` | — |
| `modules/proposals/core/dal/server/crud.ts:101` | `ownerId: ctx.session!.user.id` | `ownerId: ctx.actor.userId ?? source.ownerId` | today a caller with no session crashes on the `!`; now it keeps the source's owner |

Note on `assert-note-author.ts`: under `SYSTEM_CONTEXT` it throws forbidden today (no user, no ability) and passes after this change (`manage all`). No code calls `customerNoteCrud.update` or `.delete` with `SYSTEM_CONTEXT` (`git grep -n "customerNoteCrud\.\(update\|delete\)" -- src` returns nothing), so nothing observable changes. Confirm that grep is still empty before committing.

In the same files, comments that say "no session" or "no ability" about the system are reworded to "no user" / "the system" where the adjacent code changed. Four comments name the old fields and are caught by the Step 10 greps unless reworded:

| Comment | Becomes |
|---|---|
| `src/shared/db/schema/meetings.ts:74` `// Un-omitted: hooks.create.before defaults from ctx.session.` | `// Un-omitted: hooks.create.before defaults it from the acting user.` |
| `src/shared/entities/customers/lib/phone-gating-sql.ts:11` `gatedPhoneSql(canSeeUngatedPhone(ctx.ability))` | `gatedPhoneSql(canSeeUngatedPhone(ctx.actor.ability))` |
| `src/shared/entities/meetings/dal/server/crud.ts:53` `// row.ownerId, not ctx.session.user.id, so …` | `// row.ownerId, not the acting user's id, so …` (rest of the sentence unchanged) |
| `src/shared/entities/meetings/lib/resolve-owner.ts:9-10` `Caller guarantees ctx.session (authed path only); SYSTEM_CONTEXT is handled by the hook's passthrough before this is called.` | `The caller passes a real user: the hook returns early when there is none.` |

- [ ] **Step 7: `move-customer-pipeline-item.ts`.** In `MoveParams`, replace `userId: string` and `userRole: UserRole` with `user: VisibilityScope` (import the type from `@/shared/dal/server/types`; drop the `UserRole` import if unused). Destructure `user` instead of `userId, userRole`. Each of the four `buildUserContext(userId, userRole, <spec>)` calls becomes `buildUserContext(user, <spec>)`.

- [ ] **Step 8: The tRPC context and ladder.**

`src/trpc/types.ts`: replace everything from the `// ── tRPC-specific context types` rule to the end of the file, and the two type imports above it (`BetterAuthSession`, `AppAbility`) with `BetterAuthSession` and `Actor`:

```ts
/** What every procedure starts with. `protectedProcedure` narrows `session` to non-null; nothing rebuilds the actor. */
export interface BaseTRPCContext {
  session: BetterAuthSession | null
  actor: Actor
  /** The row filter a per-entity procedure resolves. `null` = unrestricted. */
  scope: SQL | null
}

export interface HTTPTRPCContext extends BaseTRPCContext {
  req?: Request
  resHeaders: Headers
}
```

Also fix the file's top comment: it lists `AuthedContext`, which is deleted (no importer).

`src/trpc/lib/create-http-context.ts` in full:

```ts
import type { HTTPTRPCContext } from '@/trpc/types'

import { cache } from 'react'

import { getRequestActor } from '@/shared/domains/permissions/server/get-request-actor'

export const createHTTPTRPCContext = cache(async (ctx: { req?: Request, resHeaders: Headers }): Promise<HTTPTRPCContext> => ({
  ...(await getRequestActor()),
  scope: null,
  req: ctx.req,
  resHeaders: ctx.resHeaders,
}))

// For server-component prefetching through the options proxy in `src/trpc/server.ts`. There is no
// adapter Request, so `req` stays undefined: a procedure that reads `ctx.req` must not be prefetched.
export const createRSCTRPCContext = cache(async (): Promise<HTTPTRPCContext> => ({
  ...(await getRequestActor()),
  scope: null,
  req: undefined,
  resHeaders: new Headers(),
}))
```

`src/trpc/init.ts`: remove the `defineAbilitiesFor` import and the whole `systemProcedure` block (comment and export). Replace the three procedures with:

```ts
// Any signed-in user. Narrows `session`; the actor was built once, with the context.
export const protectedProcedure = baseProcedure.use(async ({ ctx, next }) => {
  if (!ctx.session) {
    throw new TRPCError({
      code: 'UNAUTHORIZED',
      message: 'You must be signed in to perform this action',
    })
  }

  return await next({ ctx: { ...ctx, session: ctx.session } })
})

// Internal users: the guard for dashboard and CRM endpoints.
export const agentProcedure = protectedProcedure.use(async ({ ctx, next }) => {
  if (ctx.actor.ability.cannot('access', 'Dashboard')) {
    throw new TRPCError({
      code: 'FORBIDDEN',
      message: 'You do not have permission to access this resource',
    })
  }

  return await next({ ctx })
})

// Super-admin only. Gate privileged, cross-source operations here, not with a role check in the handler.
export const superAdminProcedure = agentProcedure.use(async ({ ctx, next }) => {
  if (ctx.actor.ability.cannot('manage', 'all')) {
    throw new TRPCError({
      code: 'FORBIDDEN',
      message: 'Super-admin access required.',
    })
  }

  return await next({ ctx })
})
```

`src/trpc/lib/middleware/scope-middleware.ts`: delete `scopeMiddleware` (no caller) with its `TRPCError` and `createMiddleware` imports. Keep `resolveVisibilityScope` unchanged. The file's first two comment lines become:

```ts
// The legacy row filter for one spec and one user. Shared by `createCrudRouter` and the per-entity procedures.
```

`src/trpc/lib/middleware/shareable-middleware.ts`: replace the imports of `defineAbilitiesFor` with `import { subjectOf } from '@/shared/dal/server/lib/define-spec'` and `import { abilityFromRules } from '@/shared/domains/permissions/abilities'`. Keep the token-column lookup. Replace the doc comment and everything from `return createMiddleware` to the end with:

```ts
  // What a token allows today: read and update, on the row it names. `scope` pins the row.
  const bearerAbility = abilityFromRules([{ action: ['read', 'update'], subject: subjectOf(spec) }])

  return createMiddleware(async ({ ctx, next, getRawInput }) => {
    // Cast: tRPC v11's getRawInput() returns Promise<unknown> by design —
    // input hasn't been Zod-validated yet. We peek at the token field before
    // validation for the dual-credential branching decision.
    const rawInput = await getRawInput() as Record<string, unknown> | undefined
    const token = rawInput?.token as string | undefined

    // A token wins over a session: staff who open a share link act as its holder.
    if (token && tokenColumn) {
      return next({
        ctx: {
          ...ctx,
          actor: { ability: bearerAbility, userId: null },
          scope: eq(tokenColumn, token),
        },
      })
    }

    if (!ctx.session) {
      throw new TRPCError({
        code: 'UNAUTHORIZED',
        message: 'A valid token or authenticated session is required',
      })
    }

    const isOmni = ctx.actor.ability.can('manage', 'all')
    const scope = isOmni ? null : resolveEffectiveScope(spec, { userId: ctx.session.user.id, ability: ctx.actor.ability })

    return next({ ctx: { ...ctx, session: ctx.session, scope } })
  })
}
```

and the function's doc comment becomes `/** Token path → the holder's ability and \`scope = eq(tokenColumn, token)\`. Session path → the request's actor and its row filter. */`.

`src/trpc/lib/create-crud-router.ts` router body: `authedProcedure` passes `ability: ctx.actor.ability`; the two `if (ctx.ability) { … }` guards go and their bodies run unconditionally with `ctx.actor.ability`; the three `assertCan(ctx.ability, …)` calls take `ctx.actor.ability`:

```ts
  const authedProcedure = agentProcedure.use(async ({ ctx, next }) =>
    next({ ctx: { ...ctx, scope: resolveVisibilityScope(config.spec, { userId: ctx.session.user.id, ability: ctx.actor.ability }) } }))
```

```ts
      .query(async ({ ctx, input }) => {
        assertCan(ctx.actor.ability, 'getById', config.spec)
```

```ts
        const { id, data } = input as { id: TId, data: z.input<TUpdate>, token?: string }

        assertCanUpdateFields(ctx.actor.ability, config.spec, data as Record<string, unknown>)
```

- [ ] **Step 9: The routers.** First the plain reads, mechanically:

```bash
git grep -lE "ctx\.ability" -- src/trpc/routers | xargs sed -i 's/ctx\.ability/ctx.actor.ability/g'
git diff --shortstat -- src/trpc/routers
```

Expected: 17 files changed, 28 insertions and 28 deletions. A file with hundreds of changed lines is a line-ending rewrite: stop and report.

Then these by hand:

| File | Edit |
|---|---|
| `proposals.router/contracts.router.ts:142-143` | The comment and condition become: `// No user on a shareable procedure means the share-token path.` / `if (ctx.actor.userId === null && input.envelopeDocumentIds !== undefined) {` |
| `proposals.router/media.router.ts:24-28` | `assertCanUpdate`: `if (ctx.actor.ability.cannot('update', 'Proposal')) {` |
| `customer-pipelines.router.ts:36-41` | the `moveCustomerPipelineItem` call passes `user: { userId: ctx.session.user.id, ability: ctx.actor.ability }` in place of `userId` and `userRole` |
| `customer-pipelines.router.ts:94` | `buildUserContext({ userId: ctx.session.user.id, ability: ctx.actor.ability }, meetingServerSpec)` |
| `customer-pipelines.router.ts:125` | `{ actor: ctx.actor, scope: null },` |
| `meeting-flow.router.ts:58` | `buildUserContext({ userId: ctx.session.user.id, ability: ctx.actor.ability }, meetingServerSpec)` |
| `projects.router/business.router.ts:60-64` | `buildUserContext({ userId: ctx.session.user.id, ability: ctx.actor.ability }, meetingServerSpec)` |
| `proposals.router/views.router.ts` | import `baseProcedure` instead of `systemProcedure`; `recordView: baseProcedure`; its comment becomes `// No session here: the share token proves the caller, and the service checks it.` |
| the five `*/procedures.ts` files | delete the comment paragraphs that explain why the scope step is not `.use(scopeMiddleware(spec))` (the function is gone); in the remaining doc comments "Session + ability guaranteed" becomes "Session guaranteed"; `proposals.router/procedures.ts:42` becomes `/** Token-or-session. Token path → the holder's ability and \`ctx.scope = eq(token, …)\`. Session path → the request's actor and its row filter. */` |

- [ ] **Step 10: Type-check, lint and the invariants.**

Run: `pnpm tsc`
Expected: PASS.

Run: `pnpm lint`
Expected: PASS (`pnpm lint --fix` for import order, then re-run).

The system context is built when its module loads, so an import cycle would leave it without an ability. Check the module loads:

```bash
npx tsx -e "import('./src/shared/dal/server/types.ts').then(m => console.log(m.SYSTEM_CONTEXT.actor.ability.can('manage', 'all'), m.SYSTEM_CONTEXT.actor.userId))"
```

Expected: `true null`.

Run each; every one must print nothing:

```bash
git grep -nE "ctx\??\.ability" -- 'src/*.ts' 'src/*.tsx'
git grep -nE "ctx\??\.session\b" -- src/shared src/features
git grep -n "systemProcedure\|scopeMiddleware(\|ability: null\|AuthedContext" -- 'src/*.ts' 'src/*.tsx'
git grep -n "defineAbilitiesFor" -- src/trpc src/shared/dal
```

- [ ] **Step 11: Read the token branch against today's behaviour** and record the result in the task report. For a request to `proposals.crud.getById`, `proposals.crud.update`, `getFullView`, `setCashInDeal`, `getContractStatus`, `evaluateEnvelopeContext`, `applyEnvelopeContext` and `requestToMoveForward` with a token, with and without a session cookie: the same procedure admits it, `ctx.scope` is the same `eq(tokenColumn, token)`, the CRUD router's read and field checks pass for every column (bare `read` and `update`), and `applyEnvelopeContext` still refuses `envelopeDocumentIds`.

- [ ] **Step 12: Read every `SYSTEM_CONTEXT` reader against today's behaviour** and record the result in the task report: each row of the Step 6 table, with the system's `manage all` ability and `userId: null` substituted, takes the branch it takes today.

- [ ] **Step 13: Commit.** Stage by explicit path: the two new files, the DAL files of Steps 3-7, the tRPC files of Step 8, and the router files `git diff --name-only -- src/trpc/routers` lists.

```bash
git commit -m "refactor(permissions): one actor on the DAL and tRPC contexts; the ladder only narrows

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 4: Server components and guards share the request's actor

**Files:**
- Modify: `src/shared/domains/permissions/lib/protect-dashboard-page.ts`
- Modify: `src/app/(frontend)/dashboard/analytics/page.tsx:24`, `src/app/(frontend)/dashboard/campaigns/page.tsx:25`, `src/app/(frontend)/dashboard/lead-sources/page.tsx:25`
- Modify: `src/features/agent-dashboard/ui/components/dashboard-session-content.tsx`, `dashboard-session-sidebar.tsx`, `dashboard-session-mobile-nav.tsx`
- Modify: `src/app/(frontend)/proposal-flow/layout.tsx:1,11,18-20`
- Modify: `src/app/(frontend)/intake/page.tsx:2,8,21-27`
- Delete: `src/shared/domains/auth/lib/get-cached-session.ts`, `src/shared/domains/auth/lib/utils.ts`

**Interfaces:**
- Consumes: `getRequestActor()` and `Actor` from Task 3.
- Produces: `DashboardAuthState = { status: 'unauthenticated' } | { status: 'authenticated', session: BetterAuthSession, actor: Actor }`.

- [ ] **Step 1: `protect-dashboard-page.ts` in full:**

```ts
import type { Actor } from '../actor'
import type { BetterAuthSession } from '@/shared/domains/auth/server'

import { redirect } from 'next/navigation'

import { getRequestActor } from '../server/get-request-actor'

export type DashboardAuthState
  = | { status: 'unauthenticated' }
    | { status: 'authenticated', session: BetterAuthSession, actor: Actor }

export async function protectDashboardPage(): Promise<DashboardAuthState> {
  const { session, actor } = await getRequestActor()

  // A logged-out agent may land here: the layout shows a sign-in prompt, so no redirect.
  if (!session) {
    return { status: 'unauthenticated' }
  }

  // Signed in but not internal: they do not belong in the dashboard.
  if (actor.ability.cannot('access', 'Dashboard')) {
    redirect('/')
  }

  return { status: 'authenticated', session, actor }
}
```

- [ ] **Step 2: The three super-admin pages.** In `analytics/page.tsx:24`, `campaigns/page.tsx:25` and `lead-sources/page.tsx:25`, `authState.ability.cannot('manage', 'all')` becomes `authState.actor.ability.cannot('manage', 'all')`.

- [ ] **Step 3: The three dashboard session slots.** In each of `dashboard-session-content.tsx`, `dashboard-session-sidebar.tsx` and `dashboard-session-mobile-nav.tsx`: import `getRequestActor` from `@/shared/domains/permissions/server/get-request-actor` instead of `getCachedSession`, and `const session = await getCachedSession()` becomes `const { session } = await getRequestActor()`. In their comments, "getCachedSession" becomes "getRequestActor" where the sentence still holds; nothing else in these files changes in this task.

- [ ] **Step 4: `proposal-flow/layout.tsx`.** Remove the `headers` and `auth` imports; import `getRequestActor`. Lines 18-19 become:

```ts
  const { session } = await getRequestActor()
```

- [ ] **Step 5: `intake/page.tsx`.** Remove the `headers` and `auth` imports; import `getRequestActor`. The bare-`/intake` branch becomes:

```ts
  if (!source || !token) {
    const { actor } = await getRequestActor()

    if (actor.ability.can('manage', 'all')) {
      redirect(ROOTS.dashboard.leadSources())
    }

    redirect('/')
  }
```

- [ ] **Step 6: Delete the two replaced files.**

```bash
git grep -n "get-cached-session\|getCachedSession\|auth/lib/utils\|requireAuth\|requireUnauth" -- 'src/*.ts' 'src/*.tsx'
```

Expected: only the two files themselves. Then:

```bash
git rm src/shared/domains/auth/lib/get-cached-session.ts src/shared/domains/auth/lib/utils.ts
```

- [ ] **Step 7: Type-check, lint, invariant.**

Run: `pnpm tsc` then `pnpm lint`
Expected: PASS both.

Run: `git grep -n "auth\.api\.getSession" -- src`
Expected: exactly one line, in `src/shared/domains/permissions/server/get-request-actor.ts`.

- [ ] **Step 8: Commit**

```bash
git add src/shared/domains/permissions/lib/protect-dashboard-page.ts "src/app/(frontend)/dashboard/analytics/page.tsx" "src/app/(frontend)/dashboard/campaigns/page.tsx" "src/app/(frontend)/dashboard/lead-sources/page.tsx" src/features/agent-dashboard/ui/components/dashboard-session-content.tsx src/features/agent-dashboard/ui/components/dashboard-session-sidebar.tsx src/features/agent-dashboard/ui/components/dashboard-session-mobile-nav.tsx "src/app/(frontend)/proposal-flow/layout.tsx" "src/app/(frontend)/intake/page.tsx"
git commit -m "refactor(permissions): server components and guards read the request's actor

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 5: The browser checks with rules the server built

**Files:**
- Modify: `package.json`, `pnpm-lock.yaml` (add `@casl/react` 7.0.1)
- Create: `src/trpc/routers/permissions.router.ts`
- Modify: `src/trpc/routers/app.ts`
- Create: `src/shared/domains/permissions/client.tsx`
- Modify: `src/shared/components/providers/index.tsx:3`
- Modify: `src/features/agent-dashboard/ui/components/dashboard-session-content.tsx`, `dashboard-session-sidebar.tsx`, `dashboard-session-mobile-nav.tsx`, `dashboard-mobile-nav.tsx`, `mobile-dock.tsx`, `app-sidebar.tsx:44,78-81`
- Modify: `src/app/(frontend)/proposal-flow/layout.tsx`
- Modify: the 30 files that import `useAbility` from `@/shared/domains/permissions/hooks` (import path only)
- Delete: `src/shared/components/providers/casl-provider.tsx`, `src/shared/components/providers/server-ability-provider.tsx`, `src/shared/domains/permissions/context.ts`, `src/shared/domains/permissions/hooks.ts`

**Interfaces:**
- Consumes: `getRequestActor()` (Task 3); `abilityFromRules`, `AppAbility`, `StockAbility`, `PermissionRule` (Task 2); `ctx.actor` on the tRPC context (Task 3).
- Produces:
  - `permissionsRouter.rules`: input `{ userId: string, role: UserRole }`, output the packed rules of the request's actor, or `[]` when the request is not that user in that role.
  - `AbilityProvider` props: `{ children }` plus either `{ user: { id: string, role: UserRole } | null, rules: PackRule<PermissionRule>[] }` (from a server boundary) or neither (the root).
  - `useAbility(): AppAbility` from `@/shared/domains/permissions/client`.

- [ ] **Step 1: Add the dependency, pinned.**

Run: `pnpm add @casl/react@7.0.1 --save-exact`
Expected: `package.json` gains `"@casl/react": "7.0.1"`; `pnpm-lock.yaml` changes. No other dependency line changes: check with `git diff package.json`.

- [ ] **Step 2: Create `src/trpc/routers/permissions.router.ts`:**

```ts
import { packRules } from '@casl/ability/extra'
import z from 'zod'

import { userRoles } from '@/shared/constants/enums'

import { baseProcedure, createTRPCRouter } from '../init'

export const permissionsRouter = createTRPCRouter({
  // The browser names who it believes is signed in, and caches the answer under that name. A request
  // that is not that user in that role gets no rules, so one user's rules are never kept under another's.
  rules: baseProcedure
    .input(z.object({ userId: z.string(), role: z.enum(userRoles) }))
    .query(({ ctx, input }) => {
      const user = ctx.session?.user
      if (user?.id !== input.userId || user.role !== input.role) {
        return []
      }
      return packRules(ctx.actor.ability.rules)
    }),
})
```

Register it in `src/trpc/routers/app.ts`: add `import { permissionsRouter } from './permissions.router'` in alphabetical position and `permissionsRouter,` in the router object after `meetingsRouter,`.

- [ ] **Step 3: Create `src/shared/domains/permissions/client.tsx`:**

```tsx
'use client'

import type { PackRule } from '@casl/ability/extra'

import type { UserRole } from '@/shared/constants/enums'
import type { AppAbility, PermissionRule, StockAbility } from '@/shared/domains/permissions/types'

import { unpackRules } from '@casl/ability/extra'
import { AbilityProvider as StockAbilityProvider, useAbility as useStockAbility } from '@casl/react'
import { skipToken, useQuery } from '@tanstack/react-query'
import { useDeferredValue, useMemo, useState } from 'react'

import { useSession } from '@/shared/domains/auth/client'
import { abilityFromRules } from '@/shared/domains/permissions/abilities'
import { useTRPC } from '@/trpc/helpers'

interface SignedInUser {
  id: string
  role: UserRole
}

type AbilityProviderProps = { children: React.ReactNode } & (
  // From a server boundary that read the session: its user, and the rules the server built for them.
  | { user: SignedInUser | null, rules: PackRule<PermissionRule>[] }
  // Nothing was read on the server (a static page): the rules are fetched once the browser knows who is signed in.
  | { user?: undefined, rules?: undefined }
)

/**
 * Provides the viewer's ability. The rules always come from the server: from the `rules` prop while
 * the browser's session read agrees with the server's `user`, from a query once it does not.
 */
export function AbilityProvider({ user, rules, children }: AbilityProviderProps) {
  const session = useSession()
  const [known, setKnown] = useState<SignedInUser | null>(user ?? null)

  // `isPending` is not "first read": better-auth raises it again on every refetch while its data is
  // null, so after a sign-out it would bring the server's user back. And a 5xx or network failure
  // settles with null data, which is not a sign-out. So the last settled answer is kept: the
  // server's until the first read lands, then each successful or 401 read, never a failed one.
  const readFailed = session.error != null && session.error.status !== 401
  if (!session.isPending && !readFailed) {
    const read = session.data?.user ?? null
    if (read?.id !== known?.id || read?.role !== known?.role) {
      setKnown(read ? { id: read.id, role: read.role } : null)
    }
  }

  const isServerUser = rules !== undefined && known?.id === user?.id && known?.role === user?.role

  const trpc = useTRPC()
  const fetched = useQuery(trpc.permissionsRouter.rules.queryOptions(
    known && !isServerUser ? { userId: known.id, role: known.role } : skipToken,
    { staleTime: Infinity },
  ))

  const packed = isServerUser ? rules : known ? fetched.data : undefined

  // A context change that lands right after hydration reaches every Suspense boundary still
  // hydrating below, and React drops the server HTML of any that waits on data and shows its
  // fallback. Deferred, the change waits for those boundaries to hydrate.
  const settled = useDeferredValue(packed)
  const ability = useMemo(() => abilityFromRules(settled ? unpackRules(settled) : []), [settled])

  return (
    <StockAbilityProvider value={ability}>
      {children}
    </StockAbilityProvider>
  )
}

/** The viewer's ability. Its `can` and `cannot` are typed from the specs. */
export function useAbility(): AppAbility {
  return useStockAbility<StockAbility>()
}
```

If `pnpm tsc` reports that the query's data and the `rules` prop are different packed-rule types, annotate the query handler's return in `permissions.router.ts` as `PackRule<PermissionRule>[]` (import both types there) and re-run.

- [ ] **Step 4: The root provider.** In `src/shared/components/providers/index.tsx`, line 3 becomes:

```ts
import { AbilityProvider } from '@/shared/domains/permissions/client'
```

The JSX is unchanged: `<AbilityProvider>` with no props, inside `TRPCReactProvider`.

- [ ] **Step 5: The server boundaries feed their provider.** In each file import `packRules` from `@casl/ability/extra` and `AbilityProvider` from `@/shared/domains/permissions/client`.

`dashboard-session-content.tsx` body:

```tsx
export async function DashboardSessionContent({ children }: { children: React.ReactNode }) {
  const { session, actor } = await getRequestActor()
  if (!session) {
    return <DashboardSignIn />
  }
  return (
    <AbilityProvider user={{ id: session.user.id, role: session.user.role }} rules={packRules(actor.ability.rules)}>
      <PushSubscriptionBanner />
      {children}
    </AbilityProvider>
  )
}
```

`dashboard-session-sidebar.tsx` body:

```tsx
export async function DashboardSessionSidebar() {
  const { session, actor } = await getRequestActor()
  if (!session) {
    return null
  }
  return (
    <AbilityProvider user={{ id: session.user.id, role: session.user.role }} rules={packRules(actor.ability.rules)}>
      <AppSidebar user={session.user} />
    </AbilityProvider>
  )
}
```

`dashboard-session-mobile-nav.tsx` body:

```tsx
export async function DashboardSessionMobileNav() {
  const { session, actor } = await getRequestActor()
  if (!session) {
    return null
  }
  return (
    <AbilityProvider user={{ id: session.user.id, role: session.user.role }} rules={packRules(actor.ability.rules)}>
      <DashboardMobileNav />
    </AbilityProvider>
  )
}
```

Its comment's last sentence ("it hands the dock its user so the tabs are right in the first paint…") becomes: "it feeds the dock's permissions, so the tabs are right in the first paint instead of waiting on the browser's session fetch."

`proposal-flow/layout.tsx`: read `const { session, actor } = await getRequestActor()`, delete the `abilityUser` constant and its comment's second half, and replace `<ServerAbilityProvider user={abilityUser}>` … `</ServerAbilityProvider>` with:

```tsx
    <AbilityProvider
      user={session ? { id: session.user.id, role: session.user.role } : null}
      rules={packRules(actor.ability.rules)}
    >
      {/* children unchanged */}
    </AbilityProvider>
```

Keep the one-line why above it: `// The agent/homeowner view is gated on the ability; fed from this session, the agent's view is in the first paint.`

- [ ] **Step 6: The sidebar and the dock stop rebuilding the ability.**

`app-sidebar.tsx`: remove the `defineAbilitiesFor` import; add `import { useAbility } from '@/shared/domains/permissions/client'`; the `navConfig` memo becomes:

```tsx
  const ability = useAbility()
  const navConfig = useMemo(() => getSidebarNav(ability), [ability])
```

`mobile-dock.tsx`: remove the `UserRole` and `defineAbilitiesFor` imports and the `user` prop (interface member and its comment, destructuring); add the `useAbility` import; the `tabs` memo becomes:

```tsx
  const ability = useAbility()
  const tabs = useMemo(() => getMobileDockTabs(getSidebarNav(ability)), [ability])
```

`dashboard-mobile-nav.tsx`: remove the `user` prop and the `UserRole` import; render `<MobileDock onActionCenterClick={() => setIsActionCenterOpen(true)} />`.

- [ ] **Step 7: Every `useAbility` import moves to the client module.**

```bash
git grep -l "@/shared/domains/permissions/hooks" -- src | xargs sed -i "s#@/shared/domains/permissions/hooks#@/shared/domains/permissions/client#"
git diff --shortstat
git grep -n "permissions/hooks\|permissions/context" -- src
git grep -n "from './hooks'\|from './context'" -- src/shared/domains/permissions
```

Expected: 30 files with one changed line each from the `sed`. The two greps print only lines in the four files deleted in the next step (`permissions/hooks.ts`, and the two old providers importing `permissions/context`).

- [ ] **Step 8: Delete what is replaced.**

```bash
git rm src/shared/components/providers/casl-provider.tsx src/shared/components/providers/server-ability-provider.tsx src/shared/domains/permissions/context.ts src/shared/domains/permissions/hooks.ts
```

- [ ] **Step 9: No tree renders outside the provider.** `@casl/react`'s hook throws without a provider; the old one returned a deny-all default.

```bash
find src/app -name "global-error.tsx" -o -name "layout.tsx" | sort
git grep -ln "renderToStaticMarkup\|renderToString\|@react-email/render" -- src
```

Expected: no `global-error.tsx`; every `layout.tsx` listed is under `src/app/(frontend)/`, whose root layout wraps `children` in `Providers`; the second command prints nothing. If either shows something else, list every component that tree renders that calls `useAbility` and report before continuing.

- [ ] **Step 10: The root layout still reads nothing per request.**

```bash
git grep -n "getRequestActor\|next/headers\|cookies()" -- "src/app/(frontend)/layout.tsx" src/shared/components/providers/index.tsx "src/app/(frontend)/(site)/layout.tsx"
```

Expected: prints nothing.

- [ ] **Step 11: Type-check, lint, invariants.**

Run: `pnpm tsc` then `pnpm lint`
Expected: PASS both (`pnpm lint --fix` for import order).

```bash
git grep -n "defineAbilitiesFor" -- src | grep -v "^src/shared/domains/permissions/abilities.ts"
git grep -n "@casl/react" -- src
```

Expected: the first prints exactly two files, `permissions/server/get-request-actor.ts` and `permissions/lib/roles-with-ability.ts` (import line and call line each). The second prints one import line, in `permissions/client.tsx`.

- [ ] **Step 12: Commit.** Stage by explicit path: `package.json`, `pnpm-lock.yaml`, the two new files, `app.ts`, `providers/index.tsx`, the files of Steps 5-6, and the files `git diff --name-only` lists for Step 7.

```bash
git commit -m "feat(permissions): the browser checks with rules the server built, through @casl/react

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 6: Documents that describe the old shape

Only text that pending work cites or that would now teach something false. ADR-0002 is not rewritten: its stale names are recorded in the tracker.

**Files:**
- Modify: `src/trpc/DOCS.md` (lines near 22, 91-104, 169-177, 317, 364)
- Modify: `docs/how-to/add-an-entity.md:166,245`
- Modify: `src/shared/modules/proposals/core/DOCS.md:60`
- Modify: `docs/plans/2026-08-10-casl-scope-compiler-epic.md` (§0 status rows, §5.5 stale-reference ledger)

**Interfaces:** none.

- [ ] **Step 1: `src/trpc/DOCS.md`.** Make these replacements:

| Where | Becomes |
|---|---|
| every `ability: ctx.ability` in a code sample | `ability: ctx.actor.ability` |
| the comment `Token path → \`ctx.scope = eq(token, …)\`, \`ctx.ability = null\`.` | `Token path → the holder's ability and \`ctx.scope = eq(token, …)\`.` |
| the "Naming" sentence that lists `systemProcedure` | "…shareable and public variants are `<entity>ShareableProcedure` / `<entity>PublicProcedure`. An endpoint whose caller is proven outside the session (a share token, a webhook signature) uses `baseProcedure` and says so in a comment." |
| the "Token present" bullet's tail `sets \`ctx.scope = eq(tokenColumn, token)\`, \`ctx.ability…` | "sets `ctx.scope = eq(tokenColumn, token)` and gives the request the holder's actor: an ability with `read` and `update` on that entity, and no user id." |
| the sentence "CASL gating in han…" about `if (ctx.ability)` | "The CRUD router checks the actor's ability on both paths." |
| the paragraph at line 317 | "`src/trpc/server.ts`'s options proxy resolves its context via `createRSCTRPCContext` (`src/trpc/lib/create-http-context.ts`), which takes the session and the actor from `getRequestActor()`: the same request memo the dashboard slots and `protectDashboardPage()` use, so a prefetching page reads the session and builds the ability once. Never hand-roll a ctx for the proxy; a ctx without request headers yields `session: null` and every `agentProcedure` call through `prefetch` throws UNAUTHORIZED. `req` is `undefined` in RSC context, so a procedure that reads `ctx.req` (clientIp rate limits in funnels/intake/customers.createFromIntake) must not be server-prefetched." |
| the pitfall at line 364 about `if (ctx.ability)` | delete the bullet |

Then run `git grep -n "ctx\.ability\|systemProcedure\|getCachedSession" -- src/trpc/DOCS.md`. Expected: prints nothing.

- [ ] **Step 2: `docs/how-to/add-an-entity.md`.** Line 166's sample passes `ability: ctx.actor.ability`. Line 245's "Don't write `if (ctx.ability.can('manage', 'all')) ...` inline" becomes "Don't write `if (ctx.actor.ability.can('manage', 'all')) ...` inline".

- [ ] **Step 3: `src/shared/modules/proposals/core/DOCS.md:60`.** The sentence "CASL is `null` on token path — token IS authorization." becomes "On the token path the request acts as the share-link holder: an ability with `read` and `update` on the proposal, and no user id."

- [ ] **Step 4: Tracker.** In §0, the "What the tree runs" row: `ScopedContext { session, ability, scope }` becomes `ScopedContext { actor, scope }`, and `shareableMiddleware` (token ⇒ `ability: null`) becomes `shareableMiddleware` (token ⇒ a holder actor with bare `read` + `update`). In §5.5, add ADR-0002's `ctx.ability` samples (lines 23, 108, 119) to its stale-name row.

- [ ] **Step 5: Commit**

```bash
git add src/trpc/DOCS.md docs/how-to/add-an-entity.md src/shared/modules/proposals/core/DOCS.md docs/plans/2026-08-10-casl-scope-compiler-epic.md
git commit -m "docs: tRPC context, entity recipe and proposal share-link notes describe the actor

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 7: Whole-unit verification

Read-only. No database writes, no form submissions.

**Files:** none changed. Screenshots go to the session scratchpad, not the repo.

**Interfaces:** none.

- [ ] **Step 1: The static checks, on the finished tree.**

```bash
pnpm tsc && pnpm lint
git grep -nE "ctx\??\.ability" -- src
git grep -n "systemProcedure\|scopeMiddleware(\|ability: null\|AuthedContext\|ServerAbilityProvider\|AbilityContext\|getCachedSession" -- src
git grep -n "auth\.api\.getSession" -- src
git grep -c "@ts-expect-error" -- src/shared/domains/permissions/type-checks/must-not-compile.ts
```

Expected: tsc and lint pass; the two greps print nothing; `auth.api.getSession` is in `get-request-actor.ts` only; the fixture count is 78 (64 before this unit, 14 added in Task 2).

- [ ] **Step 2: Start the dev server** on this worktree's port. Check nothing holds it first.

```bash
ss -ltnp | grep 3003 || pnpm dev
```

`PORT=3003` comes from `.env.local`. If the port is taken by this worktree's own dev server, restart it so it serves the finished tree. If a class looks missing, stop the server, `rm -rf .next`, start again.

- [ ] **Step 3: Browser checks.** Run them from a local script with the `playwright` dev dependency, written to the session scratchpad. Sign in through `http://localhost:3003/api/dev/playwright-session?secret=<DEV_LOGIN_SECRET from .env.local>&role=<role>`. Take a screenshot of each check.

The script must make writes impossible, not merely avoid them: tRPC sends queries as GET and mutations as POST, so it aborts and logs every POST to `/api/trpc/` (`page.route('**/api/trpc/**', route => route.request().method() === 'POST' ? route.abort() : route.continue())`). This matters for C5: a homeowner opening a share link records a view and notifies the rep, and that mutation must not reach the server. The report lists every aborted POST.

| # | As | Do | Expect |
|---|---|---|---|
| C1 | nobody (fresh context) | open `/` | the page renders; the navbar shows no dashboard link; the network log has no request whose URL contains `permissionsRouter.rules` |
| C2 | `role=agent` | open `/dashboard`, then `/dashboard/customers` | the sidebar and the mobile dock (narrow viewport) list the same items as on main for an agent; no "Lead Sources", "Analytics" or "Campaigns"; the customers table renders with its row menus |
| C3 | `role=agent` | on `/dashboard/customers`, open a customer's profile dialog within a second of the page load | the dialog's gated actions (edit, add note) are present, at the latest once `permissionsRouter.rules` has answered |
| C4 | `role=super-admin` | open `/dashboard/lead-sources` and `/dashboard/analytics` | both render; the sidebar shows the super-admin items |
| C4b | `role=agent` | open `/dashboard/lead-sources` | redirected to `/dashboard`, as on main |
| C5 | `role=agent`, then nobody | open a proposal's share link (`/proposal-flow/…?token=…`; read the URL off a proposal the agent can see, and send nothing) | signed in: the agent view renders. In a fresh context with no session: the homeowner view renders. Neither shows an error state. The only aborted POST is the view record |
| C6 | `role=dispatcher` | open `/dashboard` | the dispatcher's sidebar items, as on main; no proposals or projects entries |
| C7 | `role=agent` | open `/` | the navbar shows the dashboard link after the session read and the rules query land |

For "as on main": compare against `http://localhost:3000` if the main checkout's dev server is running; otherwise against `getSidebarNav` read with that role's rules in `abilities.ts`.

- [ ] **Step 4: Report.** One line per check with its screenshot path, plus the output of Step 1. A check that fails is reported as failed with what was seen; it is not retried into a pass by changing the check.

---

## After the last task

These happen once the whole-unit review is clean, in this order: mark Unit 2 done in the tracker with its commits; update the spec's status line and the distilled record's next step; delete this plan file (shipped); merge main INTO the branch; `pnpm tsc` and `pnpm lint` on the merged tree; push the branch to origin.
