# Permissions & Visibility — Rules Catalog + Scope-Compiler Grounding

> **Status:** Research / pre-implementation reference (2026-08-10). Feeds the CASL-centric
> permissions restructure. This is the **living catalog** of every authorization business
> rule across our core entities — add to it as new rules surface. It is *descriptive of
> today's code* plus the *target CASL expression* for each rule; it does not itself change code.
>
> **Trust but verify:** every "Today" reference below is a `file:line` you can open. Business
> rules drift faster than anything — if a predicate here has diverged from the code, ping and
> fix (see `CLAUDE.md` working principles).

---

## Part 1 — Is the "scope compiler" real? (grounding)

The proposed core: **CASL rules are the single source of truth for authorization**, and an
entity's row-visibility SQL predicate is *compiled from* those rules rather than hand-written.

Pipeline:

```
defineAbilitiesFor(principal)          // policy: rules, some with conditions
  → rulesToAST(ability, 'read', Subject)   // @casl/ability/extra → ucast AST (or null = deny-all)
  → ucast AST (FieldCondition / CompoundCondition / DocumentCondition nodes)
  → Drizzle interpreter (+ custom operators)   // walks AST → drizzle-orm SQL
  → .where(<compiled SQL>)
```

This is **CASL-as-intended**, not a novel invention:

| Claim | Evidence |
|-------|----------|
| `rulesToAST` / `rulesToQuery` are shipped API | `@casl/ability/extra` (installed: `@casl/ability@6.8.0`). `rulesToAST(ability, action, subjectType)` → ucast AST, or `null` if fully denied. |
| "Compile rules → DB filter" is the *mainstream* CASL+DB pattern | `accessibleBy` in `@casl/prisma` & `@casl/mongoose` is `rulesToQuery` productized — the standard way to fetch only accessible records. |
| AST → SQL is a maintained package | `@ucast/sql` interprets ucast AST → SQL `WHERE` for Knex/Objection, Sequelize, MikroORM, TypeORM. Drizzle isn't included → we port one adapter (~40 lines), not the mechanism. |
| Custom cross-table operators are first-class | Documented example registers an operator emitting a computed `WHERE` (`isActive → query.where('publishedAt', …)`). This is exactly our `$participatesInMeeting → EXISTS(...)`. |
| Hand-rolling the converter is blessed | CASL's advanced guide ships a `ruleToSequelize` converter for the no-prebuilt-adapter case — precedent for `ruleToDrizzle`. |

**Already transitively installed:** `@ucast/core`, `@ucast/mongo2js`, `@ucast/mongo`, `@ucast/js`.
`@ucast/sql` is **not** installed (would be added, or we walk the AST directly with drizzle-orm).

**The `$` sign** is MongoDB-query operator syntax (ucast's condition DSL): keys starting with `$`
are *operators* (`$participatesInMeeting`, `$hasNoMeeting`), distinguishing them from *field names*.

**Sources**
- CASL — Ability to database query: https://casl.js.org/v6/en/advanced/ability-to-database-query
- CASL — `@casl/ability/extra` API (`rulesToAST`, `rulesToQuery`): https://casl.js.org/v6/en/api/casl-ability-extra
- `@casl/mongoose` (`accessibleBy`): https://github.com/stalniy/casl/blob/master/packages/casl-mongoose/README.md
- `@ucast/sql`: https://www.npmjs.com/package/@ucast/sql · https://github.com/stalniy/ucast/tree/master/packages/sql
- ucast engine design: https://medium.com/dailyjs/casl-pursuing-perfection-ii-new-engine-128f82ea0

---

## Part 2 — The 7 authorization axes

Authorization is not one mechanism. Every rule below lands on exactly one axis; the facades
must be drawn on these seams, not on "permissions" as a blob.

| # | Axis | Question | Mechanism | Runs where |
|---|------|----------|-----------|-----------|
| 1 | **Capability / verb** | May this role do X at all? | Conditionless CASL rule | Client + server, natively |
| 2 | **Row visibility** | *Which* rows exist for me? | CASL **condition** → `rulesToAST` → Drizzle `WHERE` | **Server authority**; client never recomputes |
| 3 | **Field masking** | May I see/edit *this column*? | CASL field grants (static) **+** SQL `CASE` (dynamic) | Server projection; client affordance |
| 4 | **Per-row action** | May I act on *this specific row*? | CASL condition on a **row-carried field** | Client + server (same rule) |
| 5 | **State-machine transition** | May I move X *to state Y*? | CASL **verb** gate + imperative invariant | Server only (not a `WHERE`) |
| 6 | **Create / precursor** | May I create under *this parent*? | Point-probe of parent's compiled scope | Server only |
| 7 | **Bearer / token principal** | Does this *token* grant access? | Parallel principal, `ability = null` | Server only |

**Non-mechanism hazard — write elevation:** `SYSTEM_CONTEXT` drops row-scope after a coarse verb
check. It is a *discipline problem*, not an axis. See Part 5.

---

## Part 3 — Per-entity business-rules catalog

The **atom**: `userParticipatesInMeeting(userId, meetingIdCol)` = `EXISTS(SELECT 1 FROM
meeting_participants WHERE meeting_id = <col> AND user_id = userId)`
(`src/shared/entities/meetings/dal/server/participants.ts:9`). Meeting/Proposal/Customer/Project
row-visibility are all this atom viewed through a different FK — which is why they collapse to
**one** parameterized operator `$participatesViaMeetingPath` in the target model.

### MEETINGS

| Rule | Today (`file:line`) | Axis | Target CASL expression |
|------|---------------------|------|------------------------|
| Agent sees meetings they participate in | `meetingVisibility` → `userParticipatesInMeeting(userId, meetings.id)` — `entities/meetings/lib/visibility.ts:9` | 2 | `can('read','Meeting',{ $participatesIn: userId })` (operator targets `meetings.id`) |
| Super-admin sees all | omni → `scope=null` — `scope-middleware.ts:26` | 2 | conditionless `can('read','Meeting')` → AST `null` → no `WHERE`. No special-case. |
| **Manager sees all (not omni, not participant)** | ❌ **cannot be expressed** — fails both omni and participation | 2 | conditionless `can('read','Meeting')`. *The requirement that motivated this restructure.* |
| Who may create / update | `can('create'|'update','Meeting')` — `abilities.ts` (agent, dispatcher) | 1 | unchanged conditionless verbs |
| "Owns" (assignment) → self vs system account | `can('own','Meeting')` → `resolve-owner.ts:14` | 1 | unchanged. Dispatcher's **absence** of `own Meeting` routes bookings to system account (load-bearing). |
| Participant add/remove/promote — single-owner cardinality, co-owner auto-promote | `assign Meeting` verb + imperative state machine + DB partial-unique idx `meeting_one_owner_idx`/`meeting_one_co_owner_idx` — `meetings.router/participants.router.ts:62-215` | **5** | CASL gates the **verb** only; transition legality stays a service state machine. Do **not** fold into the row engine. |
| `getParticipants` membership probe | `isOmni || isParticipant(meetingId,userId)` — `participants.router.ts:41` | 6 | point-probe of the meeting's compiled scope |
| `getInternalUsers` returns agents/super-admins only | `cannot('assign','Meeting')` gate + `role ∈ {agent,super-admin}` — `reads.router.ts:35` | 1 | verb gate unchanged |

### CUSTOMERS

| Rule | Today (`file:line`) | Axis | Target CASL expression |
|------|---------------------|------|------------------------|
| Agent sees customers they've met with | `userCanSeeCustomer(userId, customers.id)` — one join deeper: `meetings ⋈ meeting_participants` on `customerId` — `entities/customers/dal/server/visibility.ts:9` | 2 | `can('read','Customer',{ $participatesViaMeetingPath:{ through:'customerId' } })` |
| Dispatcher sees the leads pool | `leadsPoolVisibility()` = `pipeline='active' AND NOT EXISTS meeting` — `visibility.ts:22`; selected by `ability.can('read','LeadsPool')` branch — `lib/visibility.ts:8` | 2 | dispatcher rule: `can('read','Customer',{ pipeline:'active', $hasNoMeeting:true })`. The **role branch dissolves into rule authorship** (two OR'd rules across roles). |
| Agent may edit only `age` | `can('update','Customer',['age'])` — enforced in CRUD factory `create-crud-router.ts:195` | 3-static | unchanged (`permittedFieldsOf`) |
| Dispatcher may edit contact fields | `can('update','Customer',[name,phone,email,address,city,state,zip,pipelineStage])` | 3-static | unchanged |
| **Phone visible only if a `sent`/`approved` proposal exists** | `gatedPhoneSql` = `CASE WHEN EXISTS(sent proposal) THEN phone ELSE NULL END` — `phone-gating-sql.ts:51`; bypass `canSeeUngatedPhone` (omni \| leadsPool \| token) — `:37`. Applied `customers/dal/server/queries.ts:51`. UI also gets `hasSentProposal:boolean`. Rule doc: `customers/DOCS.md:26`. | **3-dynamic** | **Per-row threshold stays a SQL `CASE`** (depends on sibling-table state). **Bypass is CASL**: `can('read','Customer','phone')` ungated for omni/dispatcher/token. Compose: `mask = caslUngated ? raw : thresholdCase`. |
| No agent may create a Customer | absence of `can('create','Customer')` | 1 | unchanged |

### PROPOSALS

| Rule | Today (`file:line`) | Axis | Target CASL expression |
|------|---------------------|------|------------------------|
| Agent sees proposals for meetings they're in | `proposalVisibility` → `userParticipatesInMeeting(userId, proposals.meetingId)` — `modules/proposals/core/lib/visibility.ts:9` | 2 | `can('read','Proposal',{ $participatesViaMeetingPath:{ through:'meetingId' } })` |
| Homeowner reads their proposal | **token path** — `shareable` middleware, `proposal.token === input.token`, `ability=null` — `shareable-middleware.ts`; `spec.shareable.tokenColumn='token'` | **7** | stays a **bearer principal** (not CASL) |
| Homeowner read-only vs agent edit (view-mode) | `can('update','Proposal') ? 'agent':'homeowner'` — `use-view-mode.ts:15`, `proposal/index.tsx:74` | 1 | unchanged verb check (client + server) |
| Proposal-media manage (upload/list/reorder/setVisibility/delete) | `update Proposal` verb + parent-scope probe on **every** op — `proposals.router/media.router.ts:18`; `assertProposalInScope`/`assertProposalMediaInScope` — `proposal-media-files/dal/server/authz.ts:12` | 1 + 6 | verb (axis 1) + parent point-probe (axis 6). Declare `parent:{spec:proposalSpec, fk:'proposalId'}`; engine supplies the bridge. |
| Media file internal-vs-homeowner exposure | writes `proposalMediaFiles.visibility` enum — `media.router.ts:64` | *content flag* | **not authorization** — a data attribute the homeowner render path reads. Keep out of the permission layer. |
| Proposal-views: agents read, homeowner records | agents `isInScope(proposalSpec)` — `proposal-views/dal/server/queries.ts:36`; homeowner `recordView` on `systemProcedure` + token equality — `views.router.ts:44` | 6 + 7 | agents → parent probe (axis 6); homeowner → token principal (axis 7) |

### PROJECTS

| Rule | Today (`file:line`) | Axis | Target CASL expression |
|------|---------------------|------|------------------------|
| Agent sees projects for meetings they're in | `projectParticipationScope` = `meetings ⋈ mp` on `projectId` — `entities/projects/lib/visibility.ts:11`, `projectVisibility:31` | 2 | `can('read','Project',{ $participatesViaMeetingPath:{ through:'projectId' } })` |
| ⚠️ **Pipeline query ALSO grants `ownerId=me OR isPublic=true`** | hand-rolled SQL **wider than canonical** — `features/customer-pipelines/dal/server/get-customer-pipeline-items.ts:367`. Canonical `projectVisibility` uses **only** participation; ignores `projects.ownerId` & `projects.isPublic` (both exist on the table). | 2 | **UNRESOLVED — see Fork/Open Q.** Reconcile before authoring the rule. |
| Pure-portfolio projects filtered even for omni | `hasAssociatedMeeting()` = `EXISTS(meetings WHERE projectId=projects.id)` — `visibility.ts:44` | *business filter* | **not authorization** — a "real vs portfolio" filter; keep beside the scope, not inside it. |
| Project-media | anticipated `mediaFiles.projectId` bridge, **never wired** (no spec) | 6 | declare `parent` on a project-media spec; engine bridges. |

### Sub-entities (owned tables) — how each is scoped today

None declare `parent` in a spec; none has its own `visibility` fragment (except customer_notes).
All rely on point-probing the parent, riding the parent gate, or are unscoped.

| Sub-entity | Parent | FK | Today |
|------------|--------|----|-------|
| `customer_profiles` | customer | `customerId` | No spec. Read via leftJoin on scoped customer. **Written unscoped** via `SYSTEM_CONTEXT` — see Part 5. |
| `customer_enrichment` | customer | `customerId` | No spec. Bare `eq(customerId)` after parent passed scope. |
| `customer_lead_attribution` | customer | `customerId` | No spec. leftJoin on scoped customer. |
| `customer_notes` | customer | `customerId` | **Own fragment** `userCanSeeCustomer(userId, customerNotes.customerId)` — `customer-notes/lib/visibility.ts:16`. Re-derives customer visibility inline vs bridging. |
| `proposal_views` | proposal | `proposalId` | No spec. Read gated by `isInScope(proposalSpec)`. **Writes fully unscoped** (`recordProposalView` bare insert). |
| `proposal_media_files` | proposal | `proposalId` | No spec. Parent probe joins `proposals`, filters `ctx.scope ?? undefined` (**leaks on null scope**). |
| `media-files` / project media | project | `projectId` | **No spec at all.** Bridge anticipated, never wired. |

---

## Part 4 — Role → capability matrix (CASL inventory)

Source: `src/shared/domains/permissions/abilities.ts` (`defineAbilitiesFor`). **Zero `cannot()` rules;
zero object-conditions today** — all subjects are plain strings, "own record" scoping is done in
the DAL, not CASL. Only field restrictions: agent `update Customer ['age']`; dispatcher contact fields.

- **super-admin** — `can('manage','all')` (omni; the widest fan-out flag).
- **agent** — `access Dashboard`; read/create/update on Meeting/Proposal/Application/Project/Activity;
  `own Meeting`; read Customer (+`update ['age']`), CustomerProfile r/u, CustomerNote CRUD (author-gated),
  Calendar manage, VoIP reads/creates. No `create Customer`, no deletes except Activity & CustomerNote.
- **dispatcher** — `access Dashboard`; `read LeadsPool` (fan-out flag); read Customer (+update contact
  fields); Meeting read/create/update but **no `own Meeting`** (bookings → system account); VoIP subset.
  No Proposal/Project/Calendar/CustomerProfile.
- **homeowner** — `read Proposal`, `read User`. Real gate is the **token path**, not CASL.
- **user** (default) — `read User` only.

**Fan-out flags (hidden coupling to eliminate):**
- `can('read','LeadsPool')` drives **3** behaviors in 3 files: (a) row-visibility switch
  (`customers/lib/visibility.ts:11`), (b) phone ungating (`phone-gating-sql.ts:44`), (c) pipeline-set
  restriction to `['leads']` (`get-accessible-pipelines.ts:19`). → make **3 explicit rules**.
- `can('manage','all')` (omni) — collapsed to `scope=null` in **4** copies: `scope-middleware.ts:26`,
  `helpers.ts:68`, `scope.ts:71`, `shareable-middleware.ts:64`, plus ~15 ad-hoc `isOmni` call sites.
  → conditionless rule yields `null` AST naturally; the 4 copies disappear.
- `can('access','Dashboard')` — internal-vs-external split (routing + nav + `agentProcedure` gate).
- `can('own','Meeting')` — self-assign vs system account (`resolve-owner.ts:14`).
- `can('assign','Meeting')` — participant management (only super-admin holds it today).

**Subjects:** `AppSubject = EntityName | 'all' | 'Calendar' | 'CustomerPipeline' | 'Dashboard' |
'LeadsPool' | 'User'`. Abstract (non-table) subjects: `all`, `Dashboard`, `Calendar`,
`CustomerPipeline`, `LeadsPool`, `User`.

---

## Part 5 — Open questions, forks & drift to reconcile

**Fork A — Aggregate-root inheritance vs independent per-row checks.**
`get-customer-profile.ts` gates the *customer* then returns its meetings/proposals/notes/projects
**unscoped** (children ride the parent gate). `get-customer-pipeline-items.ts` re-checks
participation on *each* child. Contradictory. The `subEntitySpec` engine commits to **inheritance**
(`childFk IN (SELECT parent.pk WHERE parentScope)`). Decision needed: do true owned sub-entities
(profile, notes, attribution) inherit wholesale (yes, likely), while Meeting/Proposal/Project are
**peer roots** that merely reference the customer and must pass their own scope (so the profile page
is currently over-trusting on those three)? **This one ruling reconciles ~5 drift sites.**

**Fork B — `LeadsPool` as magic flag vs explicit rules.** (See Part 4.) Decide to replace the
3-way fan-out with 3 authored rules.

**⚠️ Projects predicate drift.** `get-customer-pipeline-items.ts:367` grants
`ownerId=me OR isPublic=true OR <participation>`, but canonical `projectVisibility` uses **only**
participation and ignores `ownerId`/`isPublic`. **One is wrong.** Business question: *should project
owners and public projects be visible independent of meeting participation?* Answer determines the
rule.

**Live vulnerabilities the new system must subsume (do not lose):**
- `meeting-flow.router.ts:40` — `upsertCustomerProfile(SYSTEM_CONTEXT, …)`: verb checked
  (`update CustomerProfile`) but **row scope dropped** → an agent can write ANY customer's profile by id.
- `contracts.router.ts:218` — `customerCrud.update(SYSTEM_CONTEXT, …)` writes `customers.age` unscoped
  (comment: visibility "already established" upstream — carry a delegated scope instead).
- `proposal_views` / `customer_profiles` — unscoped writes.
- `authz.ts:23` & legacy `isInScope` (`scope.ts:90`) — filter on `ctx.scope ?? undefined`; **null scope
  ⇒ predicate dropped ⇒ row returned unconditionally.**
- `isVisible` `scope.ts:68` — `if (!ctx.session) return true` (SYSTEM_CONTEXT unrestricted).

**Fix direction — the Principal abstraction:** unify `{session,ability}` (role), `{token}` (bearer),
`SYSTEM` (trusted) under one `Principal`. Token paths carry a **token-scope**, not `null`, so
"verb-checked but row-unscoped" stops being expressible by accident.

---

## Part 6 — Target facades (deep modules) this catalog implies

1. **The Policy** — one `defineAbilitiesFor(principal)`, now *with conditions*. Roles + row-conditions
   + field-grants live here and nowhere else. Deletes the `lib/visibility.ts` role branches and the
   `LeadsPool` fan-out.
2. **The Scope Compiler** — `resolveScope(spec, principal) → SQL | null`: `rulesToAST('read',subject)`
   → Drizzle interpreter hosting custom operators (`$participatesIn`, `$participatesViaMeetingPath`,
   `$hasNoMeeting`). `spec.visibility` the *function* disappears; the spec declares its `subject` + FK
   paths. Absorbs `resolveEffectiveScope`, all four `lib/visibility.ts`, and all 4 omni null-collapses.
3. **The Point-Probe** — `isVisible(spec, principal, id)`: same compiler + `pk=id`. Sub-entities declare
   `parent`; kills the hand-probes.
4. **The Field Mask** — `maskFields(spec, principal)`: static `permittedFieldsOf` + a registry of dynamic
   masks (phone). Keeps the `CASE` behind a declared mask.
5. **The Principal** — see Part 5. Fixes the `SYSTEM_CONTEXT` hazard class.
6. **The Client Mirror** — same ability + operators with in-memory impls reading a server-hydrated
   `viewerCan`/`viewerParticipates` flag. Axes 1/3-static/4 evaluate natively; axis-2 cross-table
   conditions read the flag; server stays the authority.

**Payoff:** the *manager* role becomes 4 conditionless lines in the Policy, zero code elsewhere; the
four participation predicates collapse to **one** parameterized operator + `leadsPool`.
