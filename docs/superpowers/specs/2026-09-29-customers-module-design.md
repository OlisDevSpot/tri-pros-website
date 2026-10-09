# Customers Module — Design

**Date:** 2026-09-29 · **Status:** spec written, owner review pending · **Timing:** owner picks the slot after review.

**Replaces** row **M1** of `docs/plans/2026-09-26-records-management-epic.md` ("`modules/customers` path-only promotion, after #285"). M1 was a folder move; this spec keeps that move and adds the module's service, its lint-enforced interface, and four customer rules.

**Gate:** Phases 1–3 wait for #285 to merge (it touches 16 customer files, records epic D12/H3). **Phase 0 has no #285 dependency** and can ship whenever the owner picks.

This is also the **pilot** for folding every `src/shared/entities/<x>/` into `src/shared/modules/<x>/`. §7 is the recipe the remaining modules follow.

---

## 1. Decisions (owner, 2026-09-28/29)

| ID | Decision |
|---|---|
| **D1** | **One tree.** `src/shared/entities/` goes away over time. A module with one unit is `modules/<m>/core/`. Reverses `docs/codebase-conventions/service-architecture.md#entities-vs-modules` ("promote only when a child appears"). |
| **D2** | **The service is the module's server interface for code outside `modules/`.** Routers, jobs, webhooks, RSC pages, features and scripts call `<m>Service`. They never import `modules/<m>/**/dal/server/**`. |
| **D3** | **Inside `modules/`, any file may import any module's DAL.** Cross-module CRUD hooks (customer delete → `meetingCrud.delete`, proposal create → `meetingCrud.getById`, meeting create → `getSystemOwnerId`) stay as they are. Revisit once more modules are in. (The `data.ts` / `sql/` / business-verb alternatives were mapped and set aside: https://claude.ai/artifact/AaDhQrEstDxs4cdywX9y4c.) |
| **D4** | **Type-only imports from a DAL are allowed everywhere.** The lint rule sets `allowTypeImports`. |
| **D5** | **Lint enforces D2 for a list of sealed modules.** Customers is first. Each later module joins the list when its outside callers are rewired (§7). |
| **D6** | **Import cycles are checked** with `import/no-cycle` (`eslint-plugin-import` + `eslint-import-resolver-typescript` as direct devDependencies), over sealed modules. Units reach their parent through their own module's DAL, not through the root service. |
| **D7** | **Service shape:** the root spreads the core unit's CRUD slots, puts reads under a `queries` namespace, and exposes the `notes` unit and the `business` child as getters. Verbs live in `business` (owner rule, 2026-09-28: never a one-verb `<entity><Verb>Service`). |
| **D8** | **Service names are singular:** `customerService`, `customerNoteService`. `projectsService` → `projectService` happens when projects is sealed (§7), not here. |
| **D9** | **Routers stay in `src/trpc/routers/`**, one router tree per module, shaped like the service. |
| **D10** | **Meetings decide which pipeline a customer is in** (§5.1). `customers.pipeline` retires. |
| **D11** | **Intake keeps one customer row per submission**, and a failed submit leaves nothing behind, so a retry can't double (§5.2). |
| **D12** | **Do-not-call is per phone number, checked at send** (§5.3). |
| **D13** | **The live access holes found during the audit ship in this spec** (Phase 0), not as separate hotfixes. |

## 2. Phases

| Phase | What | Depends on | Commit shape |
|---|---|---|---|
| **0** | Close five access holes (§3) | nothing | one commit per hole |
| **1** | Structure: path-only move, then the service, router moves and caller rewiring (§4) | #285 merged | path-only commit (mechanically verifiable), then service commits |
| **2** | Lint: the module interface rule and the cycle check (§4.6, §4.7) | Phase 1 | one commit, plus `package.json` devDependencies |
| **3** | Customer rules: pipeline, intake, do-not-call, profile (§5) | Phase 1 | one commit per rule |
| **4** | Docs (§6) | with each phase | in the phase that makes them true |

Two implementation plans: **Plan A = Phase 0** (runs whenever the owner picks), **Plan B = Phases 1–3** (after #285). Phase 0 edits the pre-move paths (`src/shared/entities/customers/…`); Plan B's path-only commit carries those edits along.

## 3. Phase 0 — access holes

Each is small and file-local. None changes the module layout. Each hole names its fix and how to check it.

| # | Hole | Evidence | Fix | Check |
|---|---|---|---|---|
| **H1** | An anonymous caller can queue a paid AI job that overwrites any proposal's `projectJSON`. | `src/trpc/routers/ai.router/index.ts:7` is a `baseProcedure`. The chain `generateAISummaryJob` → `aiService.generateProjectSummary` → `aiClient.generateProjectSummary` writes `proposals` with raw `db` (`providers/ai/client.ts:96-113`). No client calls the procedure. | Delete the unused chain: `aiRouter` (and its line in `app.ts`), `generate-ai-summary` job plus its registration in `app/api/qstash-jobs/route.ts`, `ai.service.ts` (the other three methods are stubs that throw), and `aiClient.generateProjectSummary`. Keep the rest of the AI provider if anything else uses it. | `grep` finds no reference to any deleted name; `pnpm tsc`. |
| **H2** | The public intake endpoints take any lead source and never check the intake token. Anyone can book a meeting (which syncs to the shared calendar) and push a number into the dialer when that source auto-enrolls. They can also get upload URLs into the homeowner-files bucket. | `customers.router/business.router.ts:78` (`createFromIntake`, `customerPublicProcedure` = `baseProcedure`) takes `leadSourceSlug` and `mode` from input. `intake.router.ts:26` (`getRecordingUploadUrl`) is public. The token and `isActive` are checked only when `app/(frontend)/intake/page.tsx:32-40` renders. | Without a session, both procedures require `{ leadSourceSlug, token }` and verify them on the server: slug exists, `isActive`, constant-time token compare. Any mismatch returns the same NOT_FOUND. The page passes `token` down to the form; the form sends it. With a session (the dashboard Add Customer sheet), the procedure trusts the session and skips the token. | Submit without a token → rejected. Submit with the page's token → works. Dashboard sheet works. |
| **H3** | Campaign texts go out without a do-not-call check. | `services/voip/campaigns/sms-cadence.service.ts:44` checks only `unenrolledAt` before `dialerProvider.sendSms` (`:92`). A customer flagged do-not-call whose unenroll failed keeps getting texts. | Before sending, check the phone with a phone-level query in the customers DAL (`isPhoneDnc`, §5.3). If blocked, skip the send and unenroll with reason `opted_out`. §5.3 later swaps the query for `customerService.queries.canContact`. | Flag a test customer do-not-call on dev → cadence skips them. |
| **H4** | Any agent can fetch any customer's call recording. | `customer-pipelines.router.ts:65` `getRecordingUrl` reads by `customerId` with raw `db` and no visibility check. | Check that the customer is visible to the caller (customer visibility scope) before presigning. In Phase 1 the procedure moves to the customers router (§4.4). | An agent who can't see the customer gets NOT_FOUND. |
| **H5** | Any agent can write any customer's profile, given its id. | `meeting-flow.router.ts:26-54` `updateCustomerProfile` writes through `SYSTEM_CONTEXT`. It never checks that the meeting is visible or that `meeting.customerId === customerId`. | Check that the meeting is visible to the caller and belongs to that customer; write with the caller's customer scope. §5.4 then replaces the procedure. | Mismatched `meetingId`/`customerId` → FORBIDDEN. |

## 4. Phase 1 — structure

### 4.1 Layout

Path-only first: `git mv` plus import rewrites, zero behavior change, verified with a path-normalized diff (the same method as the proposals and projects moves).

```
src/shared/modules/customers/
  service.ts                      customerService
  business/service.ts             customerBusinessService   (Phase 1: intake verbs; Phase 3 adds the rules)
  core/                           ← src/shared/entities/customers/**
    server-spec.ts                ← lib/server-spec.ts   (unit-root rule, service-architecture.md#server-spec-lives-at-the-unit-root)
    DOCS.md, components/, constants/, hooks/, lib/, schemas/, types.ts, types/, dal/customer-fields.ts, dal/server/**
  notes/                          ← src/shared/entities/customer-notes/**
    server-spec.ts                ← lib/server-spec.ts
    service.ts                    customerNoteService = { ...customerNoteCrud }
    constants/, dal/server/crud.ts, hooks/, lib/, schemas/
```

`src/shared/services/customer-intake.service.ts` moves to `modules/customers/business/service.ts` in the path-only commit; its export is renamed in the service commit.

**Belong to other modules** but move with customers for now (the path-only commit moves the whole directory): `core/lib/get-meeting-time-label.ts` (meetings), `core/components/lists/project-entity-card.tsx` (projects), `core/components/lead-source-picker.tsx` (lead-sources). Each leaves when its owner is sealed (§7). **Deleted** in Phase 1 (no importers): `core/components/lists/proposal-row.tsx`, `findOrCreateCustomerFromHomeowner` (`dal/server/queries.ts:203`).

### 4.2 The service

```ts
export const customerService = {
  ...customerCrud,                       // getById · create · update · delete · duplicate
  queries: {
    list, search, getProfile, getPipelineItems, getRecordingUrl,
    findByPhone, listEnrollableBySource, analyticsFacts, adPerformance, measurement, // the reads outside callers use today
  },
  get notes() { return customerNoteService },
  get business() { return customerBusinessService },
} satisfies SpecCrudHandlers<typeof customerServerSpec>
```

- `queries` lists only the reads that code outside the module calls. A read used only inside the module stays a DAL function. The exact list comes from the caller rewiring (§4.5); the names above are today's.
- `search` moves out of `customers.router/business.router.ts:46-75` (raw `db` in the router) into `core/dal/server/queries.ts` unchanged.
- The input schemas routers need move out of `dal/server/*` into `core/schemas/` (public), for example `customerListInputSchema`.
- Getter rule as in `modules/proposals/service.ts`: reference an imported service only inside a method or getter.

### 4.3 The business child (Phase 1 content)

`customerBusinessService` holds the moved intake service unchanged in Phase 1 (`ingestLead`), so routers stop importing `services/customer-intake.service`. Phase 3 reshapes it (§5.2) and adds do-not-call and profile verbs.

### 4.4 Routers

| Procedure today | After | Why |
|---|---|---|
| `customers.business.list` / `.search` / `.createFromIntake`, `customers.profile.upsert`, `customers.crud.*` | same paths; bodies call `customerService` | D2 |
| `customerNotes.crud.*` | same path; `createCrudRouter` gets `customerNoteService` | D2 |
| `customerPipelines.getCustomerProfile` | `customers.profile.get` | a customer read served from a feature-named router (records epic D12) |
| `customerPipelines.getRecordingUrl` | `customers.recordings.getUrl` (scoped, H4) | customer data |
| `intake.getRecordingUploadUrl` | `customers.recordings.getUploadUrl` (token-checked, H2) | the recording belongs to the customer's intake |
| `customerPipelines.getCustomerPipelineItems` | stays; calls `customerService.queries.getPipelineItems` | the kanban is a feature router over a customer read |
| `customerPipelines.moveCustomerPipelineItem`, `.moveCustomerToPipeline`, `.getCustomerProjects`, `.assignToProject` | unchanged here | these write meetings, proposals and projects; they move with meetings (records epic M2) and the approval work |
| `meetingFlow.updateCustomerProfile` | deleted in Phase 3 (§5.4) | one profile path |

`intake.router.ts` is deleted once its one procedure moves. Client call sites are updated in the same commit as each procedure move.

### 4.5 Caller rewiring

23 files outside `modules/` import a customers DAL for values today (16 more import types only and keep working through D4). Each value import changes to `customerService`:

- **Routers (11):** `customers.router/{crud,profile,business}`, `customer-notes.router`, `customer-pipelines.router`, `meeting-flow.router`, `landing.router`, `lead-sources.router`, `meetings.router/business`, `projects.router/business`, `proposals.router/contracts`.
- **Services and jobs (6):** `notification.service`, `measurement.service`, `accounting.service`, `voip/campaigns/enrollment.service`, `voip/campaigns/lib/resolve-customer`, `upstash/jobs/enroll-source-batch`. (`customer-intake.service` moves into the module and is no longer an outside caller.) Plus `voip/campaigns/sms-cadence.service`, which gains a customers DAL import in Phase 0 (H3).
- **Features (2):** `features/analytics/dal/server/load-analytics-facts.ts`, `features/customer-pipelines/dal/server/move-customer-pipeline-item.ts`.
- **`src/shared/domains/analytics/sources/local/*` (3):** this directory has no importers outside itself. **Delete** `src/shared/domains/analytics/` rather than rewire it; if something turns out to use it, rewire instead.

The rewiring list is re-measured at build time (`grep` for value imports of `@/shared/modules/customers/*/dal/server`); the lint rule (§4.6) is the final check.

### 4.6 The interface rule

A new rule in `eslint.config.js`, aliased from the built-in `no-restricted-imports` (the same technique as `project/no-inline-table-config`, which exists because flat config keeps only the last config's value for a rule name). The alias gets its own plugin namespace, because `project` is already registered once.

- `files`: `src/**/*.{ts,tsx}`, `scripts/**/*.ts`; `ignores`: `src/shared/modules/**`.
- One pattern per sealed module: `group: ['@/shared/modules/<m>/*/dal/server/**']`, `allowTypeImports: true`, message naming `<m>Service`.
- `const SEALED_MODULES = ['customers']` sits at the top of the file with a one-line comment on how a module joins.

### 4.7 The cycle check

- devDependencies: `eslint-plugin-import` and `eslint-import-resolver-typescript` (both already in the tree through `eslint-config-next`, at 2.32.0 and 3.10.1; add them directly at those versions). **Confirm with the owner before editing `package.json`** (the option was approved in principle, 2026-09-29).
- Registered under its own namespace (antfu already owns `import/` through `eslint-plugin-import-lite`).
- `no-cycle` runs on `src/shared/modules/<sealed>/**` with the TypeScript resolver and `ignoreExternal`; type-only imports don't count.
- First run: every cycle it reports inside customers is fixed or, if it goes through another module that isn't sealed yet, listed in §7 for that module.

## 5. Phase 3 — customer rules

### 5.1 Pipeline: meetings decide

**Today, four live rules and two dead helpers.**
- The customers tables read `customers.pipeline` (`core/lib/derived-pipeline-sql.ts:25-33`), which no app code writes.
- The kanban reads `meetings.pipeline`, which meeting outcomes write, one query per lane (`core/dal/server/pipeline-items.ts:47-76`).
- The dispatcher leads pool uses `customers.pipeline = 'active' AND no meetings` (`core/dal/server/visibility.ts:22-27`).
- The lead-source segments use `customers.pipeline` (`lead-sources/lib/segment-sql.ts:13-26`).
- `domains/pipelines/lib/derive-customer-pipelines.ts` and `derive-meeting-pipeline.ts` have no importers.

A no-show shows as **Fresh** in the customers table and **Rehash** on the kanban.

**The rule.** A customer belongs to a set of pipelines, derived from meetings and projects:

| Pipeline | Member when |
|---|---|
| projects | the customer has a project |
| fresh | a meeting with `pipeline = 'fresh'` and no project |
| rehash | a meeting with `pipeline = 'rehash'` and no project |
| dead | a meeting with `pipeline = 'dead'` and no project |
| leads | no meeting and no project |

- A customer's **pipeline** (one value, the table column) is the first member in the order **projects > fresh > rehash > dead > leads**.
- A **pipeline filter** matches a customer that is a member of any selected pipeline.
- The kanban keeps showing a customer in each lane they belong to (CONTEXT.md Pipeline terms: one stage per pipeline).

**Change from today's kanban:** a customer with a project and no meeting leaves the Leads lane.

**One home.** `core/lib/pipeline-sql.ts` exports `inPipelineSql(p)` and `customerPipelineSql()`. It replaces `derived-pipeline-sql.ts`, and every reader uses it:
- `listCustomers` and the `pipeline` filter (`customer-field-sql.ts`)
- the kanban lane queries in `pipeline-items.ts`
- `isCustomerInLeads`, `listEnrollableLeadsBySource`
- `leadsPoolVisibility` (becomes `inPipelineSql('leads')`)
- campaign eligibility `isEligibleSql` (`voip-campaign-contacts/lib/lead-campaign-status.ts:52`)
- the lead-source segments: signed = projects; dead = pipeline dead; active = pipeline leads, fresh or rehash

`EXISTS_PROJECT` keeps its role as "signed" and moves into the same file.

**`customers.pipeline` retires.** No reader is left, so the column and its default go in the same change (non-defensive migration: consumers move and the old column is deleted together). Prod has 26 rows with a non-`active` value (15 rehash and 5 dead with meetings, whose meetings now decide; 6 rehash with no meeting, which become plain leads — owner accepted, 2026-09-29). `pnpm db:push:dev`; the prod push is the owner's.

**Deleted:** `derive-customer-pipelines.ts`, `derive-meeting-pipeline.ts`.

**Not here:**
- The single-meeting rule copied into `meeting-field-sql.ts:37-42` and `proposals/core/dal/server/queries.ts:166-178` moves with meetings (§7).
- The kanban leads lane being unscoped, and `getAccessiblePipelines` hiding lanes only in the UI, are #285's to fix (role gates).

### 5.2 Intake: one `ingestLead`

**Today.**
- Four live paths go through the intake service: public intake, dashboard Add Customer, funnel and bina. Landing (`landing.router/index.tsx:103`) calls `customerCrud.create` itself and inserts its note with raw `db` (`:136`).
- No path finds an existing customer first.
- The service commits the customer before the attribution and the meeting, so a failure after the customer row returns 500 and a retry creates a second customer.

**The verb.** `customerService.business.ingestLead(ctx, input, channel)`. Routers and the bina route are thin adapters that pick a channel and call it.

**Writes.** One DAL mutation in `core/dal/server/mutations.ts` writes the customer, its attribution row and the intake notes in **one transaction**. The notes are system notes written inside that DAL function, so `customerNoteCrud`'s visibility probe doesn't apply. If any of them fails, nothing is committed and the caller can retry cleanly.

**After the commit:**
- The meeting (`intake-*` channels, when asked) is created through `meetingCrud`.
- If the meeting fails, the verb returns the customer id with `meetingError`, and the caller shows "customer saved, meeting not created" instead of 500. This way a retry never doubles the customer.
- Jobs are `await`ed `dispatch` calls, never a bare `void` (on serverless a bare `void` promise can be dropped when the response returns).

**Channel policy.** Rows marked *keep* are today's intentional differences. Rows marked *fix* are drift being corrected. Rows marked *owner* need your call.

| | intake-public | intake-dashboard | funnel | website | bina |
|---|---|---|---|---|---|
| Entry | `customers.business.createFromIntake`, no session | same, with session | `funnels.submitLead` | `landing.scheduleConsultation`, `.generalInquiry` | `app/api/webhooks/bina/route.ts` |
| Source | slug + token, active (H2) | slug from the sheet, active | slug must be in `FUNNEL_LEAD_SOURCE_SLUGS` (server constant the client builder imports), active — *fix* | fixed `website`, active | fixed `bina`, active — *fix* (`isActive` unchecked today) |
| Phone line check | mobile-or-landline | mobile-or-landline | mobile-only — *keep* | mobile-or-landline when a phone is given — *fix* (`scheduleConsultation` has none) | none — *keep* (vendor lead); comment says why |
| Rate limit | IP, 5/h | none — *fix* (office blocked after 5 adds/h) | IP + phone, 5/h — *keep* | IP, 5/h — *fix* (none today; it spends paid Twilio lookups) | none — *keep* (secret header) |
| Attribution kind | generic | generic | funnel | **website** (new kind) — *fix* (no row today) | bina |
| Allowed lead-meta keys | `mp3RecordingKey`, `closedBy`, `scheduledFor`, `requestedTrades` | same | funnel keys only — *fix* (full schema accepted today) | none | built on the server |
| Meeting | optional | optional | no | no | no — *keep* (D9 of the bina work) |
| Meeting owner | `getSystemOwnerId()` — *fix* (hardcoded email today) | session user | — | — | — |
| Note author | system | session user — *fix* (`null` today) | system | system | system |
| New-lead notification | no | no | yes — *keep* | internal + confirmation emails — *keep*, sent by the adapter | yes — *fix* (owner, 2026-09-29) |
| Auto-enroll (source setting) | yes | yes | yes | no — *keep for now* (owner, 2026-09-29: deferred) | yes |
| Meta conversion | no | no | `Lead` when `eventId` — *keep* | no | no |
| On failure | throw | throw | throw | log; emails still send — *keep* | log, 200 — *keep* |
| Name | min 1 | min 1 | first + last | min 1 — *fix* (empty allowed today) | first + last |

Other intake fixes:
- The bina secret compare becomes constant-time.
- `phoneVerification` is recorded on every channel that runs the line check.

**Not here:** finding existing customers by phone (D11 keeps one row per submission; analytics already folds duplicates into one lead).

### 5.3 Do-not-call: per phone, owned by customers

⚠️ **Stale ref.** `CONTEXT.md:31-33` says do-not-call is "a shared canonical registry of phone numbers… both systems INSERT into it". The code at `src/shared/db/schema/customers.ts:42-50` stores it as three columns on `customers` (`dncOptedOutAt`, `dncReason`, `dncAddedByUserId`), written only through `src/shared/services/voip/compliance.service.ts`, and voip-in-house never writes it. §6 fixes CONTEXT.md to match the code.

**Customers owns the flag and the question "may we contact this number?"**

| Piece | Where | Replaces |
|---|---|---|
| `dncReasons = ['customer_request','stop_keyword','admin','ftc']` + `DncReason`; column typed `text('dnc_reason', { enum: dncReasons })` (TS only, no migration) | `core/constants/dnc.ts` | the TS union in `compliance.service.ts:12-16` |
| `phoneIsDncSql(phoneColumn)`: true when **any** customer row with that phone is flagged; a row with no phone is judged by its own flag | `core/lib/dnc-sql.ts` | `isDncBlocked` (`eligibility.ts:39-41`), the `isNull` in `queries.ts:138`, the raw strings in `lead-campaign-status.ts:35-72` |
| `isPhoneDnc(phone)` query; `markDnc({ customerId, reason, byUserId })` (sets the row; idempotent); `clearDnc({ customerId })` (clears **every** row with that phone, or the number stays blocked) | `core/dal/server/{queries,mutations}.ts` | the raw `db` in `compliance.service.ts:41-88` |
| `customerService.queries.canContact(phone)`; `customerService.business.markDnc`, `.clearDnc` | service | `complianceService.canOutboundTo/addToDnc/removeFromDnc` |
| `dnc*` columns removed from `updateCustomerSchema` (`server-spec.ts:17`) | spec | the super-admin bypass through generic `crud.update` |

**Voip keeps the campaign side and calls customers:**
- **STOP keywords:** one `isStopKeyword` in `voip/campaigns/lib/is-stop-keyword.ts`. Its set is the union of today's two: `stop, stopall, unsubscribe, cancel, end, quit, optout, opt-out, opt out, revoke, remove`. It keeps the first-token matching. `voip-messages.service.ts` `isOptOutKeyword` (no callers) is deleted.
- **`campaignEnrollmentService.optOut(customerId, reason)`:** calls `customerService.business.markDnc`, then `unenroll`, and **checks the unenroll result** (today's three copies ignore it, `justcall/route.ts:57,88`, `bulk-dnc.ts:20-21`). If unenroll fails it returns the error, so the job retries and the admin count is honest.
- **The JustCall disposition "DNC / Do Not Call"** records reason `customer_request`. It records `stop_keyword` today.
- **Checks before contact:** enrollment (`enrollment.service.ts:126`) and the SMS cadence (H3) call `customerService.queries.canContact`.
- **`compliance.service.ts` is deleted.** `ftcScrubBatch` is a stub that throws. The dormant Twilio services (`voip-calls`, `voip-messages`) only get their imports repointed.

**Stays in voip:** unenroll and dialer calls, provider disposition mapping, keyword parsing, cadence decisions, `bulk-dnc` orchestration, and the campaign-status ordering (enrolled ranks above dnc).

**Not here:** a do-not-call badge on the customer profile, and an audit trail for who cleared a flag.

### 5.4 Profile: one write path

- `customers.profile.upsert` takes an optional `meetingId`.
- It calls `customerService.business.updateProfile(ctx, { customerId, data, meetingId? })`, which:
  1. writes through `upsertCustomerProfile` with the caller's customer scope (unchanged DAL);
  2. when `meetingId` is given, checks the meeting is visible to the caller and belongs to the customer, then publishes the Ably `meeting:<id>` / `meeting.updated` event (moved from `meeting-flow.router.ts:49-52`).
- **Callers:**
  - The meeting-flow context panel calls `customers.profile.upsert` with its `meetingId`. `meetingFlow.updateCustomerProfile` is deleted.
  - `CustomerProfileModal` takes an optional `meetingId` prop. The meeting-flow customer chip (`customer-chip.tsx:39`) passes it, so editing from the chip updates the live meeting too. Today that edit leaves the meeting stale for every viewer.

## 6. Docs (in the phase that makes them true)

| Doc | Change | Phase |
|---|---|---|
| `docs/adr/0006-one-module-tree.md` (new) | Why: one tree (D1), the service as the interface for outside code (D2), DAL open inside `modules/` (D3), sealed-list rollout (D5). The rules themselves live in the lint config. | 2 |
| `docs/codebase-conventions/service-architecture.md` | `#entities-vs-modules` is replaced by a pointer to ADR-0006. Fix two stale lines: `:12` says construction is "planned, not yet built" (`modules/construction/service.ts` exists); `:374` lists a `construction-data` service that doesn't exist. | 2 |
| `CONTEXT.md` | Do-not-call section describes the code (columns on `customers`, owned by the customers module, per-phone check). `:11,15,27` say CloudTalk; the code binds JustCall (the CloudTalk move is planned, not built). New Pipeline-terms entry: **Customer pipeline**, the first of projects > fresh > rehash > dead > leads. | 3 |
| `modules/customers/core/DOCS.md` (moved) | Update the pipeline and do-not-call rules it states; delete the file if nothing cites it after this ships (CLAUDE.md rule). | 3 |
| `docs/plans/2026-09-26-records-management-epic.md` | Row M1 points to this spec. | on approval |

## 7. The recipe for the remaining modules

Written for whoever seals the next module. Each step is one commit.

1. **Path-only move:** `git mv src/shared/entities/<x>` → `modules/<m>/core` (children → their unit), server-spec to the unit root, import rewrites. Verify with a path-normalized diff.
2. **Service:** root `service.ts` (CRUD spread, `queries`, unit getters, `business` getter), unit `service.ts` files, singular names (D8).
3. **Rewire outside callers:** `grep` value imports of `@/shared/modules/<m>/*/dal/server` from outside `modules/`; move router-inlined `db` reads into the DAL; move input schemas to `schemas/`.
4. **Seal:** add `<m>` to `SEALED_MODULES`; `pnpm lint` must pass with the interface rule and `no-cycle`.
5. Only then change behavior, one rule per commit.

**Known work per module** (found in the 2026-09-28 audit; re-check at the time):

| Module | Units | Carries |
|---|---|---|
| meetings (records M2) | core, participants | the 170-line participants flow in `meetings.router/participants.router.ts:51`; reschedule and set-outcome already live in `meetingService.business` (`modules/meetings/`, started ahead of this move for visit messages, with a `messages` unit); what remains is moving the core from `entities/meetings` to `modules/meetings/core`; the 2-hour in-progress window defined in five places (`meetings/constants/scheduling.ts`, `map-to-gcal.ts:45`, `pipeline-items.ts:212-217`, `get-meeting-time-label.ts:18,22`, `compute-fresh-stage.ts`); `get-meeting-time-label.ts` moves here from customers; the stage-move writes in `features/customer-pipelines/dal/server/move-customer-pipeline-item.ts`; `use-outcome-reason` / `use-reschedule` from `shared/hooks`; the single-meeting pipeline rule copied into `meeting-field-sql.ts` and proposals queries. The customers ↔ meetings DAL imports (`customers/dal/server/crud.ts:11` ↔ `meetings/dal/server/queries.ts:6,25-26`) meet the cycle check here. |
| proposals, projects (already modules; sealing only) | — | ~30 outside callers import their DALs (routers, services, features, `app/sitemap.ts`, the portfolio page); `projects.router/crud.router.ts` bypasses `projectsService`; rename `projectsService` → `projectService`; `incentives/service.ts:46` reaches the parent through `proposalService` (switch to the DAL, D6); `contracts.service.ts` and `zoho-sign/lib/documents/*` rules become a proposals `contracts` unit; `project-entity-card.tsx` moves here from customers; `finance-options` folds into proposals. **Separate bug:** deleting a customer cascades its projects in Postgres (`db/schema/projects.ts:33`), so `projectCrud`'s R2 photo purge never runs. |
| lead-sources | core, spend | `lead-sources.router.ts` (728 lines, 11 procedures with raw `db`, two near-duplicate analytics queries at `:345` / `:531`, `rotateToken` / `archive` skip hooks); `intake/page.tsx:33` token check becomes a verb; `lead-source-picker.tsx` moves here from customers; `voip-campaigns.router.ts:88` writes `lead_sources`. The customers ↔ lead-sources ↔ voip-campaigns references form a ring to cut first. |
| activities | core | legacy; the owner plans a rework. Move as-is; Google Calendar sync stays router-side with a note. |
| users | core, accounts, push-subscriptions | `agent-settings.router` reads `user` with raw `db`; `meetings reads.getInternalUsers` too. |
| voip-campaigns | campaigns, contacts, contact-fields | `services/voip/campaigns/*`; the entity-lib ↔ service-lib import cycle (`sms-merge-tokens.ts:1`); `LeadStatus` declared twice; campaigns-admin hooks hold entity verbs. |
| voip (in-house Twilio) | dids, calls, messages, link-tokens | live for visit messages: the main line sends them and receives replies (two routes, three jobs). Move as-is. |
| `domains/` | — | `analytics` deleted in this spec (§4.5); `multi-step-flow` is used only by a dev page; `funnels` is a feature; `pipelines` mixes UI with rules that belong to meetings and customers. |

## 8. Verification

- **Every commit:** `pnpm tsc` and `pnpm lint` (never `pnpm build`).
- **Phase 1 path-only commit:** a path-normalized diff shows only import-path changes.
- **Phase 2:** `pnpm lint` passes with customers sealed. A deliberate outside import of `@/shared/modules/customers/core/dal/server/queries` fails; an `import type` from it passes.
- **Phase 3, analytics:** `pnpm tsx scripts/verify-analytics-rules.ts` (analytics reads customer facts and duplicate grouping).
- **Browser** (Playwright via `/api/dev/playwright-session`):
  - public intake with and without a token;
  - dashboard Add Customer;
  - funnel submit;
  - both landing forms;
  - for one customer with a no-show meeting: the customers table pipeline column, the Rehash filter, and the kanban lane agree;
  - a profile edit in the meeting flow reaches a second open viewer;
  - mark and clear do-not-call from campaigns admin.
- **Data:** the 26 legacy `customers.pipeline` rows are checked before the column drop (counts in §5.1). Read-only prod query, 2026-09-29.

## 9. Open for the owner

1. **`package.json`** (§4.7): confirm the two devDependencies when Phase 2 starts.
2. **Timing:** Phase 0 can go now; Phases 1–3 wait for #285.

**Settled 2026-09-29:** bina leads send the new-lead notification like the funnel. Website leads are not auto-enrolled for now; the `ingestLead` channel policy leaves the switch in one place so turning it on later is a one-line change.
