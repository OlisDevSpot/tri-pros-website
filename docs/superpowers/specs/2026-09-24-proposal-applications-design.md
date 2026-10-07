# Proposal Applications — Design

> **Status:** design approved by the owner 2026-09-24. Not planned, nothing built. The field-by-field session (§12) runs before the form and review-page tasks are planned.
> **Replaces:** the July engine + runner spec (`2026-07-30-tpr-assistance-engine-runner-design.md`, deleted) and the meeting-scoped model in §6 of `docs/plans/2026-09-20-multi-proposal-meeting-flow-epic.md` (moved here verbatim as Appendix A). Resolves that tracker's Q22, Q24 and Q25.

## 1. What an application is

An **application** is one proposal applying to one **program**. The agent fills it in with the homeowner. A reviewer then approves it by writing **proposal incentives** (`discount` or `exclusive-offer` rows in `proposal_incentives`) onto that proposal, and the proposal's price recalculates. A proposal can hold applications to several programs at once, and their incentives stack.

It is a child unit of the proposals module: `src/shared/modules/proposals/applications/`, alongside `incentives`, `media` and `views`.

Where an application starts:
- the meeting-flow **Programs** tab (being built in a separate session, see §10), and
- a proposal entity action, "Apply to program", wherever proposal actions render.

## 2. Owner rulings (2026-09-24)

| # | Ruling |
|---|---|
| A1 | Applications belong to a **proposal**, not a meeting. Replaces C33/C34's meeting scope and resolves Q22. |
| A2 | **Every** application is approved by a person. Nothing approves automatically. |
| A3 | The **reviewer writes the incentives** when approving. Programs carry no incentive package that drives writes. |
| A4 | Programs **stack freely**. There are no exclusivity rules. |
| A5 | **Duplicating** a proposal copies its applications, their answers and their granted incentives. |
| A6 | Reviewer = anyone who can **update the proposal**: its agent, through the proposal's visibility, or a super-admin. |
| A7 | Approval is **refused while the proposal is frozen**, meaning it is anywhere on the lock ladder. The reviewer discards or recalls the envelope first. |
| A8 | The **agent fills it in with the homeowner, in the app**. There is no homeowner self-service in this epic. |
| A9 | Programs are **code constants in the applications unit**. The application stores a `program` accessor. |
| A10 | First release programs: `tpr-monthly-special`, `energy-saver-plus`, `existing-customer-savings-plus`, `tpr-assistance`, `showcase`. The `type` column goes. |
| A11 | **`qualify()` is dropped.** A person decides. |
| A12 | Granted incentives are **editable anywhere**, including in the funding form, and stay linked to their application. |
| A13 | Granted incentives are **global rows now**, with `sow_item_id` NULL (C61). After W4 the reviewer may attach one to a proposal scope item. This settles Q24 and Q25. With applications per proposal, Q25's fan-out across alternatives no longer arises. |
| A14 | **Revoking** an approved application, or deleting one, **deletes** its linked incentive rows and recalculates the price. |
| A15 | The reviewer can **send a submitted application back to draft**. After a rejection, a new application to the same program may be started. |
| A16 | The application form is a set of **fields**. Some are **shared customer facts** stored on the customer (`customers` / `customer_profiles`) and reused by every application for that customer. The rest are stored on the application itself because they are specific to the program. |
| A17 | Shared facts are **read live**. An application does not snapshot them at submit. |
| A18 | Shared facts are **written on each step save**. Program-specific answers autosave to the draft. |
| A19 | **Date of birth and age both exist, and date of birth wins.** When `date_of_birth` is set, the age is derived from it. Otherwise `age` is used. |
| A20 | **This epic owns the backend and the shared UI**: unit, service, API, form component, review page and proposal action. The Programs tab consumes them. |

## 3. Data model

### 3.1 `applications` (re-parented)

| Column | Type | Notes |
|---|---|---|
| `id` | uuid PK | |
| `proposal_id` | uuid NOT NULL → `proposals.id` ON DELETE CASCADE | **replaces `meeting_id`** |
| `program` | text, enum of the 5 program accessors | **replaces `type`**. The closed vocabulary lives in the unit's `constants/`, and the column uses `text({ enum })`, never pgEnum. |
| `status` | text enum `draft \| submitted \| approved \| rejected \| withdrawn \| revoked` | default `draft`. `revoked` is new. |
| `draft_answers_JSON` | jsonb, nullable | Engine state for **program-specific** fields only. Shared facts never land here (A18). |
| `submitted_at` | timestamptz, nullable | Set on each submit. Kept when the application is sent back. |
| `decided_at` | timestamptz, nullable | Set on approve, reject and revoke. |
| `decided_by_user_id` | text → `user.id` ON DELETE SET NULL, nullable | The reviewer. |
| `created_at`, `updated_at` | | |

Constraints:
- `CHECK (status IN ('draft','withdrawn') OR submitted_at IS NOT NULL)`, as today.
- `CHECK (status NOT IN ('approved','rejected','revoked') OR decided_at IS NOT NULL)`.
- Partial unique index on `(proposal_id, program) WHERE status IN ('draft','submitted','approved')`. At most one active application per proposal and program, while rejected, withdrawn and revoked applications stay as history.
- The insert schema omits `status`, `submitted_at`, `decided_at` and `decided_by_user_id`. Only the lifecycle verbs move status.

### 3.2 `application_answers` (unchanged shape)

Holds **program-specific** answers only: `UNIQUE(application_id, question_key)`, `value text`, `position`. Shared facts are never copied here (A17).

### 3.3 `x_application_trades` (dropped)

The proposal's scope of work already says which trades are involved. `TRADES_QUESTION_KEY` and the reserved-key split in `submitApplication` go with it.

### 3.4 `proposal_incentives` (+1 column)

| Column | Type | Notes |
|---|---|---|
| `application_id` | uuid, nullable → `applications.id` ON DELETE CASCADE | Set on rows an approval wrote. NULL on hand-authored rows. Deleting an application deletes its grants (A14). |

This is the concrete form of G7's "future `source` column". `sow_item_id` stays NULL on granted rows until W4 (C61, A13).

### 3.5 `customers` (+1 column) and the age resolver

- **`date_of_birth`** `date`, nullable. `age` stays.
- The customers entity gets **one resolver in two forms**, matching the shape of `proposal-lock.ts`:
  - a row form `resolveCustomerAge({ dateOfBirth, age }, today)`, which returns whole years from the date of birth when it is set, else `age`, else `null`;
  - a SQL form for selects, which is `COALESCE(date_part('year', age(current_date, date_of_birth))::int, age)`.
- Every age **reader** switches to the resolver. The one DAL read is `proposals/core/dal/server/queries.ts` (`age: customers.age` → `customerAge`). It feeds the contracts router, the Zoho Sign document registry, and the senior check in `proposal-context.ts`. Changing that select to the SQL form covers them all.
- **Writers** are unchanged. The contracts share-token flow and the customer edit form keep writing `age`. Nothing writes a derived age back into `age`.
- Agents get a field-level `update Customer` grant on `dateOfBirth` next to `age` (`permissions/rules/agent.ts`).
- Where date of birth is collected is decided in the field session (§12).

### 3.6 `customer_profiles`

New shared-fact columns (utility bills, people on title, and so on) are decided in the field session. Rule: every shared fact is a **typed column** (`text({ enum })`, integer cents, integer counts) on `customers` or `customer_profiles`, never a key/value table. These facts are read elsewhere and carry vocabularies, so under ADR-0005 they are columns.

## 4. Unit layout

```
src/shared/modules/proposals/applications/
  server-spec.ts        entityName APPLICATION, caslSubject = proposalServerSpec.caslSubject,
                        parent { spec: proposalServerSpec, fk: applications.proposalId }, no visibility
  service.ts            ...applicationCrud + lifecycle verbs (§5)
  dal/server/crud.ts    createCrudDal(applicationServerSpec)
  dal/server/queries.ts list by proposal, getWithAnswers
  dal/server/mutations.ts  the multi-row writes the engine cannot express (submit explode,
                        approve/revoke incentive writes, clone for duplicate)
  constants/programs.ts the 5 programs (§8)
  constants/fields.ts   the field registry (§8)
  constants/statuses.ts applicationStatuses, co-located here from shared/constants/enums (W4 R8)
  lib/constants.ts      APPLICATION entity name
  schemas/index.ts      draft schema, verb inputs
```

- The root `proposals/service.ts` adds `get applications()`, following the getter rule its header explains.
- tRPC: a leaf `src/trpc/routers/proposals.router/applications.router.ts`, mounted as `proposals.applications`. It is a thin adapter to the service on `proposalProcedure`, with the inline `ctx.ability` check `incentives.router.ts` uses: reads need `read Proposal`, and every write and every lifecycle verb needs `update Proposal`.
- Deleted:
  - `src/shared/entities/applications/` (including `DOCS.md`);
  - `src/trpc/routers/applications.router/` and its mount in `app.ts`;
  - `shared/constants/enums/applications.ts` and `shared/types/enums/applications.ts`;
  - the `Application` CASL subject and its agent grants (`permissions/rules/agent.ts`).
- The docs that cite `entities/applications` are updated in the same change:
  - `docs/marketing/assistance-offer.md`
  - `docs/plans/2026-09-14-construction-catalog-centralization-design.md`
  - `docs/plans/2026-09-15-construction-data-standardization-epic.md`
  - `docs/plans/2026-09-10-thin-seams-audit.md`
  - `docs/plans/2026-09-20-multi-proposal-meeting-flow-epic.md`
- Visibility follows the proposal parent through `resolveEffectiveScope`. `lib/visibility.ts` is not needed.

## 5. Lifecycle and service verbs

```
draft ──submit──▶ submitted ──approve──▶ approved ──revoke──▶ revoked
  ▲                 │   │
  └───sendBack──────┘   └──reject──▶ rejected
draft | submitted ──withdraw──▶ withdrawn
```

Every verb:
- reads the application through the proposal's scope, returning `not-found` when the proposal is invisible;
- checks its from-status, returning `precondition-failed` with a reason code;
- returns the updated row.

| Verb | From | Effect |
|---|---|---|
| `start({ proposalId, program })` | — | Inserts a `draft`. The partial unique index refuses a second active application. |
| `saveStep({ applicationId, values })` | `draft` | Splits `values` by field binding (§8). Shared facts are written through the customers entity's own write paths (§9). Program fields are merged into `draft_answers_JSON`. |
| `submit({ applicationId })` | `draft` | In one transaction: explodes the program answers into `application_answers` (upsert), then sets `submitted`, `submitted_at`. |
| `sendBack({ applicationId })` | `submitted` | Sets `draft`. Answers and the draft stay. |
| `approve({ applicationId, incentives })` | `submitted` | Refuses a frozen proposal (`proposal_frozen`). In one transaction: sets `approved` with `decided_at`/`decided_by_user_id`, inserts `incentives` as global rows with `application_id` set, appended after the proposal's existing positions. After commit, re-runs `recomputeProposalFinancials`. `incentives` may be empty. |
| `reject({ applicationId })` | `submitted` | Sets `rejected` with `decided_at`/`decided_by_user_id`. |
| `revoke({ applicationId })` | `approved` | Refuses a frozen proposal. Deletes the rows where `application_id` matches, sets `revoked` with `decided_at`/`decided_by_user_id`, and recalculates. |
| `withdraw({ applicationId })` | `draft`, `submitted` | Sets `withdrawn`. |

Generic CRUD `delete` stays available. The FK cascade removes the grants, and a `delete.after` hook on `applicationCrud` re-runs the proposal rollup (the same pattern the incentives crud hooks use), so a delete through any caller keeps the price right.

## 6. Incentive integration

- **Round trip through the funding form (A12).**
  - The `Incentive` domain schema (`proposals/core/schemas`) gains an optional `applicationId`.
  - `incentiveRowsToDomain` emits it and `domainIncentivesToRows` writes it.
  - `proposalIncentivesService.replace` validates that every `applicationId` in its input belongs to an application of **that proposal** in status `approved`. Otherwise it returns `precondition-failed` with `invalid_application_link`. A client therefore cannot attach a row to another proposal's application or forge a grant.
  - A user who deletes a granted row in the funding form simply removes it. `revoke` later deletes whatever is still linked.
- **Rollup.** Granted rows are ordinary global rows, and `recomputeProposalFinancials` already sums them. No rollup change is needed before W4.
- **Lock ladder.** `approve` and `revoke` apply `isProposalFrozen`, as `replace` does (A7).

## 7. Duplicate (A5)

The proposals `duplicate.after` hook (`proposals/core/dal/server/crud.ts`) clones in this order:

1. The source's applications, with status, timestamps and reviewer carried over, and `proposal_id` set to the copy. Their `application_answers` are cloned too. The result is a `sourceApplicationId → copyApplicationId` map.
2. The global incentive rows, with `application_id` remapped through that map. `cloneGlobalIncentiveRows` gains the map parameter.
3. One rollup recalculation, as today.

Step 1 is a DAL function in `applications/dal/server/mutations.ts`, because a DAL module never imports a service. The steps run sequentially with no transaction, following the W4 ruling R.1 the hook already follows.

## 8. Programs and the field registry

- **Program** (`constants/programs.ts`) has an `accessor`, a `name` and `tagline`, the presentation copy moved from `features/meeting-flow/constants/programs.ts`, and `steps`: an ordered list of steps, each listing **field keys**.
  - There is no `qualify`.
  - The old `incentives` package survives only as presentation copy describing what a program typically offers. Nothing writes from it (A3).
- **Field** (`constants/fields.ts`) is one registry entry per question, holding `key`, `label`, `input` (the step-UI kind), a zod `schema`, and a **binding**:
  - `{ store: 'customer', column }`, a `customers` column such as `dateOfBirth` or `age`;
  - `{ store: 'customerProfile', column }`, a `customer_profiles` column;
  - `{ store: 'application' }`, a program-specific answer.
- Bindings to customer tables are typed against the table's patch schema, so a binding to a non-existent column fails `pnpm tsc`.
- The form pre-fills customer-bound fields from the customer's current values (A17), so a shared fact answered once shows as answered on every later application for that customer.

## 9. Writing shared facts

`saveStep` resolves the customer as **proposal → meeting → customer** on the server. It never takes a client-supplied customer id. It then writes through the customers entity's existing paths:
- `upsertCustomerProfile` for `customer_profiles`, gated by `update Customer` on its `profile` field;
- the customers CRUD `update` for `customers` columns, gated by the field-level `update Customer` grant.

A failed shared-fact write fails the step save. The agent sees the error and nothing is half-saved in the draft.

## 10. UI surfaces, and the handover to the Programs tab

Built in this epic:
- **The application form**:
  - one component on `shared/domains/multi-step-flow`, driven by a program's steps and the field registry;
  - a DB persistence adapter over `saveStep`.
  - `StepShell` is full-page today. It gets an embeddable variant so the form can sit inside the Programs tab and inside a dialog or sheet.
- **The proposal action "Apply to program"** is added to `PROPOSAL_ACTIONS` with permission `['update', 'Proposal']`. It opens a program picker showing each program's status for this proposal, then the form.
- **The review page `/dashboard/applications/{applicationId}`** shows:
  - the program-specific answers;
  - the customer's live shared facts;
  - an incentive editor (`discount` / `exclusive-offer`, reusing the funding form's incentive inputs);
  - the proposal's lock state;
  - approve, reject, send back and revoke.

The Programs tab session consumes the form component, the program constants and `proposals.applications.*`. When the tab switches over, this epic removes:
- `selectedProgram` / `programQualified` from `meetingFlowStateSchema`, and then the `flowStateJSON` column itself, through the column-drop protocol (tracker D1);
- `features/meeting-flow/lib/qualify-programs.ts`, `constants/energy-trades.ts` (feature-layering bug B1 goes with it) and `constants/programs.ts`;
- the interim `@deprecated` Programs-tab path (tracker F16 / C36).

## 11. Migration and rollout

- The prod `applications` table exists and is **empty** (owner, 2026-09-24).
- Rollout: change the schema directly, `pnpm db:push:dev`, then `db:push:prod` on the owner's explicit go. No backfill.
- `x_application_trades` is dropped in the same push.

## 12. Deferred to the field-by-field session (before the form and review-page plan)

- Each program's steps and field list, including `tpr-assistance` (source: `docs/marketing/assistance-offer.md`) and `showcase` (source: `docs/marketing/showcase-offer.md`).
- The shared-fact columns to add: monthly electric / gas / water bills, people on title, household size, and so on.
- Whether years in home stays the existing `yearsInHomeRanges` bucket or becomes an exact value.
- Where date of birth is collected, beyond the application form.
- The UI design of the review page and the program picker. This follows the UI work method: user flow first, then the design skills.

The backend work (§3–§7, §9, and the age resolver) does not wait on this session.

## 13. Verification

The repo has no test runner. Each task is verified with `pnpm tsc` and `pnpm lint`, plus these manual checks against dev:
1. **Lifecycle:** walk every transition in §5 and confirm that each illegal transition returns its reason code.
2. **Approve:** approve on an unfrozen proposal and see `final_tcp_cents` drop by the discount total. Approve on a frozen one and get `proposal_frozen`.
3. **Funding-form round trip:** save the funding form and confirm `application_id` survives on granted rows. A forged `applicationId` gets `invalid_application_link`.
4. **Revoke:** linked rows are deleted and the price recalculates.
5. **Duplicate:** applications, answers and granted rows copy with remapped `application_id`, and the copy's price matches the source's.
6. **Age resolver:** date of birth set gives a derived age; date of birth unset gives `age`. The contract envelope's senior check reads the resolved value.
7. **Permissions:** a dispatcher cannot reach `proposals.applications.*`. An agent outside the proposal's visibility gets `not-found`.

## 14. Drift since approval — checked against the code on 2026-10-01; settle these when planning

Nothing in this spec is built yet. `programs.ts`, `qualify-programs.ts` and `energy-trades.ts` are still in `features/meeting-flow`, and `entities/applications` and the `Application` grants are unchanged. Rulings made after this spec change how the plan is laid out:

1. **Service layout (modules consolidation, 2026-09-29).**
   - CRUD slots stay on the unit service, and reads go under `.queries`.
   - Cross-entity verbs go in a `business` child service (never a one-verb `…Service`). `approve` and `revoke` write incentives and re-run the rollup, so they are cross-entity.
   - Rules true of every row stay in crud hooks: the `delete.after` rollup, and status moves only through the verbs.
   - The unit reaches its parent proposal through the proposals module's DAL, not `proposalService`. This avoids an import cycle; `incentives.replace → proposalService.getById` is the cycle that already exists.
   - Ask the owner at plan time where `.business` sits for a unit; it has only been ruled for root services.
2. **Reaching the customer (§9) depends on proposal-foundations Task 7.**
   - Proposals have no `customer_id`.
   - `proposals.meeting_id` is still `ON DELETE SET NULL` (`db/schema/proposals.ts`) until Task 7 makes it `RESTRICT`.
   - Until then, a proposal can lose its meeting and therefore its customer. `saveStep` must refuse shared-fact writes on such a proposal (`precondition-failed: proposal_has_no_meeting`), or the plan must schedule this work after Task 7.
3. **One profile write path.** The customers module spec (`2026-09-29-customers-module-design.md`) makes `customer_profiles` writes one scoped path with an optional meeting broadcast. Its Phase 0 fixes the meeting-flow profile write, which currently takes a client `customerId` under `SYSTEM_CONTEXT`. §9 uses that path and must not copy the meeting-flow router.
4. **Meetings bulk delete.** The records bulk spec (`2026-09-28-records-bulk-actions-and-entity-tables-design.md`) skips meetings with `hasApplications` because meeting deletes cascade applications. That stops being true once applications belong to proposals, so drop the clause. It isn't built yet, so nothing in code needs changing.
5. **Homeowner visibility of granted incentives.**
   - On the redesigned proposal page (`2026-10-01-proposal-page-design.md`, D19), global incentives render in "Applies to the whole project", and that includes rows an approval wrote.
   - Its R1 leak means the token path still sends incentive `notes` to homeowners until H10 (#285 / spec F) ships. Until then, the review page's incentive editor treats `notes` as text the homeowner will read.
6. **Binding per scope item (A13)** waits on W4. The W4 spec is awaiting owner review, and the single pricing-mode ruling blocks it.

---

## Appendix A — §6 of the multi-proposal meeting-flow tracker, moved verbatim (2026-09-24)

> ## 6. Applications follow-up epic — captured context (not built in this epic)
>
> Owner context from 2026-09-22 (C33–C35), kept here until the applications epic has its own tracker; move it there verbatim and leave a pointer.
>
> - **What an application is.** A multi-step flow, run in the meeting, that collects information from the homeowner so the customer's meeting can **qualify for discounts/incentives**. Each application **references the program it runs for**; programs are meeting-flow constants (`features/meeting-flow/constants/programs.ts`: `tpr-monthly-special`, `energy-saver-plus`, `existing-customer-savings-plus`) for now, possibly a table later. A meeting can have **several** applications.
> - **What exists today.** `applications` table (`src/shared/db/schema/applications.ts`: `type ∈ tpr_assistance | showcase`, `status ∈ draft | submitted | approved | rejected | withdrawn`, `meetingId` NOT NULL cascade, `draftAnswersJSON`), its entity at `src/shared/entities/applications/` (DOCS: sub-project #1 persistence + draft lifecycle wired; #2 form engine and #3 review/decision not built). No `program` column yet; `type` is not the program.
> - **Review.** A separate `/dashboard/applications/{applicationId}` page (current plan). Reviewer = a meeting participant or a super-admin. The UI shows **every scope selected across all of the meeting's proposals, de-duplicated**; approving creates **proposal incentive rows** attached to the right proposal SOW item (P7 id now, W4 `sow_item_id` later) or global, so the proposal calculation picks them up (`recomputeProposalFinancials`).
> - **Open (Q22, Q24, Q25):** per meeting vs per proposal; the truncated ruling; fan-out of one approval across alternatives; incentive lifecycle on duplicate / scope removal / delete / assign-to-meeting.
> - **Interim in this epic:** the Programs tab per Q23 → F16.

The 2026-09-24 rulings in §2 supersede the meeting scope, the meeting-participant reviewer and the cross-proposal de-duplicated review described above.
