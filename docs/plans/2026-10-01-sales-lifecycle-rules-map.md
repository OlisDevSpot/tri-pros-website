# Sales lifecycle: rules and event map (customer · meeting · proposal · contract · project)

> **Status:** the tracker for the sales lifecycle rules (owner, 2026-10-05). The rules are specced and built slice by slice (§0); each slice gets its own spec and plan that cite the IDs here, and together they replace `docs/superpowers/specs/2026-10-01-project-meeting-outcomes-design.md` and settle `docs/plans/2026-09-29-approval-project-outcome-handoff.md`. Nothing here is built. Facts are from four read-only audits on 2026-10-01 (at `5ba4bcde`); re-check a `file:line` before relying on it.
> **Legend:** **[ruled]** owner decision · **[proposed]** recommendation awaiting a ruling · **[open]** question in the grill queue (§6).

## 0. Delivery slices (owner, 2026-10-05)

One slice at a time: grill its open items, write its spec, plan it, build it. The order puts the slices that need the fewest rulings first, so building starts while the grill continues on the later ones. A slice's IDs point at §2 (R), §3 (I), §4 (P, M, J), §6 (Q), §8 (A) and §9 (S).

| # | Slice | What it builds | Carries | To settle before its spec | Database |
|---|---|---|---|---|---|
| 1 | **Guards** | Refusals only, on today's values, each with no legitimate caller today or with a way round (R29): `kind` and `token` frozen, a proposal created as a draft, the share-link write allowlist, send only from draft or sent, `approvedAt` stamped by the server, delete guards on proposals and meetings, the kanban's project stage write through `projectCrud.update`, ability checks on project writes, and every refusal worded. Spec: `docs/superpowers/specs/2026-10-05-lifecycle-guards-design.md`. | I1, I11 (`approvedAt` and send only), P3, P8, M6, J2, S44, S45, S49 | Scope ruled 2026-10-05 (R29); the written spec awaits the owner's review. | none |
| 2 | **Outcome policy** | One pure policy (allowed outcomes with reasons, derived outcome, precedence) used by `meetingCrud` and every outcome picker; per-type outcome sets; `site_visit` default; type-aware pipeline mapping. `StatusDropdownCell` and the action select options take a reason. | R2–R4, R26, I6–I8, I12, P1, M1 (default outcome), M4, M5, M7, S8, S10, S32, S34, S37, S43, S51 | Q4, Q5, Q9, S2 | Outcome enum gains `site_visit` and `cancelled_scopes` in one push; prod before the deploy |
| 3 | **Approval route** | One route for every approval path, and the verbs around it: approve, decline, cancel, amend, revert approval, plus `send`. Initial-sale approval creates the project through `projectCrud.create`; `CreateProjectModal` and `CreateProjectForm` go. Statuses gain `cancelled` and `amended`; `cancelled_scopes` becomes reachable from here on. Also the rules slice 1 could not take before revert approval exists: the full status graph, approved never back to draft or sent (P7), and no delete of a project with linked meetings (J3). | R1, R6, R7, R10–R12, R15–R25, R27, R28, I9, I10, I11 (the graph), P4–P7, P9, J1, J3, S46, S9, S12, S16–S30, S33, S35, S36, S50 | Q6, Q7, A4–A8, S17, S18, S19, S28 | The one-approved-per-meeting index (R16) |
| 4 | **Project links** | Assign to Project is a move; a project meeting always has its project, of the same customer; duplicate keeps the project; proposal `kind` after a move. | R5, R8, R14, I2–I5, P2, M1 (link checks), M2, M3, S15, S38, S39, S48 | Q2, Q3, Q8, S5 | Depends on Q3 |
| 5 | **Backfill and figures** | Legacy rows brought under the invariants (dry-run on both databases, a check per invariant); the sale, opened-sale and signed-customer definitions handed to analytics Spec B. | I13, S52–S59 | Q11, Q12, S40, S54, S56–S58 | Data only |

R9 (one structure, one route) and R13 (store facts, derive the rest) bind every slice. Left out until a real case asks: several projects for one customer (S31, S41, S42), a new proposal replacing an earlier meeting's (S13), stale open proposals (F1). `proposals.meeting_id` NOT NULL (S14) stays with the proposal-foundations plan.

**Where the slices meet other work:** the records tables (`docs/plans/2026-09-26-records-management-epic.md` §3.2: the proposals status cell, status pickers, bulk delete), the multi-proposal epic's `send` verb (slice 3), analytics Spec B (slice 5), and the security hotfix batch (the share-link part of slice 1 may ship ahead).

## 1. The entities and their links

| Entity | Key facts |
|---|---|
| **Customer** | One person/household. `customers.pipeline` + derived pipeline (`customers/lib/derived-pipeline-sql.ts:25-33`). "Signed customer" today = EXISTS a project (`customers/lib/signed-customer-sql.ts:5-11`). |
| **Meeting** | `meetingType`: lead types `Fresh`, `Follow-up`, `Rehash`; and `Project`. `customerId` (nullable, set null), `projectId` (nullable, **set null** on project delete, `db/schema/meetings.ts:28`), `meetingOutcome`, `pipeline` (`fresh`/`rehash`/`dead`). |
| **Proposal** | `meetingId` (nullable, set null). `kind`: `initial-sale` / `additional-work`, derived once at insert from `meeting.projectId` (`derive-proposal-kind.ts:6-8`). `status`: `draft` / `sent` / `approved` / `declined`. DB: at most one approved initial-sale **per meeting** (`schema/proposals.ts:94-96`). No direct link to a project. |
| **Contract** | Zoho envelope on a proposal: `contractEnvelopeId`, `contractSentAt/ViewedAt/SignedAt/DeclinedAt`. Signed → proposal auto-approved. |
| **Project** | `customerId` (cascade on customer delete), `ownerId`, `pipelineStage` (free text), scopes, media. Reached from a proposal only via `proposal → meeting → meeting.projectId`. |

The **birthing meeting** is the lead meeting whose approved initial-sale created the project. Today it stays `Fresh` and gains `projectId`.

## 2. Owner rulings so far

| # | Ruling | Date |
|---|---|---|
| R1 | Approving an initial-sale creates a project; approving an additional-work proposal adds to the project of the proposal's meeting. Project creation is a plain `projectCrud.create`; evergreen project rules in its hooks; no `ensure…` helpers; no project form on approval (`CreateProjectModal`/`CreateProjectForm` go). | 2026-09-29 (handoff §1) |
| R2 | The meeting outcome is **value-based**: derived from state; `meetingCrud` refuses any other value; the same derivation drives every outcome editor. | 2026-09-29 (handoff §1) |
| R3 | `site_visit` is the Project meeting's default outcome. Site visits are never leads, never sits, never in the Meetings metric; internal sales analytics only. | 2026-10-01 |
| R4 | Each meeting type offers only its own outcomes. Project: `site_visit`, `proposal_created`, `proposal_sent`, `additional_work`, `reschedule_needed`, `no_show`, `cancelled`. Never on Project: `follow_up_needed`, `nra`, `pns`, … | 2026-10-01 |
| R5 | **Assign to Project = move** a misplaced meeting into an existing project; never creates a project; outcomes the Project type does not allow become `site_visit`. Must exist on every meeting surface. | 2026-10-01 |
| R6 | A positive outcome (`converted_to_project` / `additional_work`) is undone **only** by declining the approved proposal. That sets the new outcome **`cancelled_scopes`**: negative, not terminal, available on lead and Project meetings. | 2026-10-01 |
| R7 | **Proposal `kind` is the source of truth** for sale vs upsell, not `meetingType`. | 2026-10-01 |
| R8 | The project-meeting rule must be enforced somewhere; options to be brainstormed (§6 Q3). | 2026-10-01 |
| R9 | These rules are core business logic: one structure, one source of truth, one route from proposal state to meeting outcome. Shared seams get widened where needed. | 2026-10-01 |
| R10 | Declining an approved **initial-sale** keeps its project and moves it to a cancelled stage (history, media, scopes survive; a re-sign brings it back). "Signed customer" becomes "has an approved initial-sale" (I13). | 2026-10-01 (Q1) |
| R11 | Declining an approved **additional-work** proposal leaves the project untouched. | 2026-10-01 (Q1) |
| R12 | Declining an approved initial-sale is **refused** while approved additional-work exists on its project. | 2026-10-01 (Q1) |
| R13 | Store facts, derive the rest: a stored value is either a record of an event / human decision, or a snapshot taken at a point of commitment. Anything else is derived by one function. | 2026-10-02 |
| R14 | `meetings.projectId` means **the meeting is linked to the project, including the meeting that started it** (option b, "more honest"). A **project meeting** = a meeting linked to a project (canonical). The **birth meeting** is told apart by a derived truth: the linked meeting that holds the project's initial-sale. | 2026-10-02 |
| R17 | Proposal status keeps two distinct "no" words: **`declined`** = never wanted it (before approval); **`cancelled`** = wanted it, approved/signed, then backed out. No `superseded`: an amendment is *cancel the old + approve the new*. | 2026-10-02 (Q13) |
| R18 | A meeting's outcome is `cancelled_scopes` when it holds a `cancelled` proposal and no approved one. Fine on any project meeting (the project carries on); on the birth meeting the project itself is cancelled (R10). Meeting `75304007` is a true cancellation (customer backed out; a fresh proposal was sent just in case). | 2026-10-02 (Q13) |
| R19 | **Amend is one business action**: approving proposal Y as the amendment of approved proposal X cancels X and approves Y in one step; the meeting stays positive, the project stays active, R12 does not apply. Main use: small scope or price tweaks while the rep is still on site for the initial sale; must be grilled and fit every other rule. | 2026-10-02 (Q15) |
| R20 | Proposal status gains **`amended`** (replaces the rejected "superseded"/link idea). Full set: `draft`, `sent`, `approved`, `declined` (never wanted), `cancelled` (approved, then backed out), `amended` (approved, then replaced by a newer approved agreement on the same meeting). Recorded fact, so no metric has to guess. | 2026-10-02 (A1) |
| R21 | An amendment is papered with the **same kind's documents**: initial-sale → a new full HI contract (never an Additional Work Description; it is the most important agreement with the homeowner); additional-work → a new Additional Work Description. Flow in the owner's words: mark the approved proposal amended, create a new proposal, amend, send, sign, approve — same kind throughout. | 2026-10-02 (A2) |
| R22 | X stays `approved` (in force, matching the signed paperwork) until Y is approved/signed; then X → `amended` and Y → `approved` in one step. "Amendment in progress" is derived (an open proposal on a meeting that holds an approved one). Y declined → X untouched. | 2026-10-02 (A2b) |
| R23 | An amended sale keeps its **original date** (first approval on the meeting, carried by the `amended` row) and takes the **current value** (the agreement in force); amending never adds or removes a sale; closer credit unchanged. When the amendment happened = Y's `approvedAt` (backup: Y's `contractSentAt`). | 2026-10-02 (A3) |
| R24 | `amended` = **the same agreement, corrected**: "cancelled because a more recent approved version exists". The sale's date stays the original one. | 2026-10-02 (A3b) |
| R25 | `cancelled` = signed/approved, then cancelled for any reason. It **counts as a sale** but **not as an opened sale** (opened = work actually started). Cancelled-sale figures are derived from stored data. | 2026-10-02 (A3b) |
| R26 | **Outcome precedence**, strongest first: (1) agreement states, locked — `converted_to_project`/`additional_work`, then `cancelled_scopes`; (2) a human's decided pick (`pns`, `npns`, `not_good`, `ftd`, `lost_to_competitor`, `follow_up_needed`, `reschedule_needed`, `no_show`, `cancelled`, `nra`); (3) proposal progress — `proposal_sent`, then `proposal_created`; (4) default — `not_set` (lead) / `site_visit` (project meeting). Stored = the latest hand pick; shown = the first level that applies. No "overwritable" lists. | 2026-10-02 (S8) |
| R27 | **Revert approval** (correction of a mistaken approval, not a cancellation): admin-only, manual approvals only (a Zoho signature is real → `cancelled`); proposal returns to its prior open status (`sent` if sent, else `draft`), `approvedAt` cleared, never counted; the project it created is removed and the meeting unlinked only if nothing else uses it yet, else refused; a reverted amendment restores X to `approved`. Condition: simple to understand and built through the approved architecture and paths (one verb, no side door). | 2026-10-02 (S22) |
| R28 | Approving one option leaves the meeting's other open proposals **as they are** (`sent`/`draft` may stay forever for now). Consequence (proposed): approving any open proposal on a meeting that already holds an approved one **is** an amendment (R16 leaves no other meaning), behind an explicit "this replaces the agreement of <date>" confirmation; a wrong pick is undone with R27. "Amendment in progress" is shown only when that open proposal has a contract envelope (a real signal), not merely because it is open. Readers that treat `sent` as actionable (agent action queue `get-action-queue.ts:137`) skip proposals on meetings that hold an approved agreement. | 2026-10-02 (S9/Q14) |
| R16 | R15 holds for **every** meeting, project meetings included: at most one approved proposal per meeting, any kind; a second scope at the same visit amends. Replaces the "one approved initial-sale per meeting" index. | 2026-10-02 (Q3) |
| R15 | **One agreement per sitting.** A second sale in the same sitting is never approved alongside the first; it **amends** the existing agreement (duplicate → decline the existing → approve the new, or similar). | 2026-10-02 |
| R29 | **Slice 1 carries only safe refusals:** a rule lands there only if no legitimate caller does the refused thing today, or the user keeps a way round. A real contract signature is never refused. P7, J3 and the full status graph wait for slice 3, because each would remove today's only way to correct a mistaken approval before revert approval (R27) exists. | 2026-10-05 |
| R30 | **G4, stamping the approval time (slice 1):** a system stamp (the Zoho signature path) fills an empty `approvedAt`, and the contract path always sends the signing time; a user-context write never sets or overwrites the stamp. Ruling B of the slice 1 plan's Task 4; the plan keeps both variants. | 2026-10-06 |

## 3. Invariants (what must always be true)

Each row: the rule, how today's code breaks it, where enforcement could live.

| # | Invariant | Status | Broken today by | Enforcement candidates |
|---|---|---|---|---|
| I1 | `kind` is set once, at proposal create, and never changes. | [ruled R7] + [proposed] immutability | Update schema keeps `kind`, `token`, `status`, `approvedAt`, `ownerId` writable (`proposals/core/server-spec.ts:11-14`); share-token path writes any of them (§4.1 P4 path E; §6 Q10). | Omit from update schema; `proposalCrud` `update.before` refuses. |
| I2 | `kind` derivation: `additional-work` iff the proposal's meeting already belongs to a project at create time. | [proposed] keep today's rule | Moving a meeting (R5) leaves its draft/sent `initial-sale` proposals behind. | §6 Q2. |
| I3 | A **Project meeting** always has a project (`meetingType = 'Project'` ⇒ `projectId` set). | [ruled R8, how open] | Duplicate keeps type, drops `projectId` (`meetings/dal/server/crud.ts:133-146`); project delete sets null; `crud.create/update` from the wire. | §6 Q3. |
| I4 | A **lead meeting with a project** is that project's birthing meeting (has the approved initial-sale that created it). | [proposed] | `assignToProject` (no proposal check), `projects.business.create` (needs any proposal, any status), reschedule copies `projectId` onto a proposal-less meeting (`meetings.router/business.router.ts:123`), wire writes. | §6 Q3. |
| I5 | A meeting's project belongs to the meeting's customer. | [proposed] | `assignToProject`, `projects.business.create` (customerId from client), wire writes, changing `meeting.customerId` after linking. | `meetingCrud` hooks (same home as I3). |
| I6 | Meeting outcome is **derived** from proposal state whenever proposal state decides it; hand picks only for outcomes no proposal state decides. | [ruled R2] | Server accepts any outcome (`updateMeetingSchema = insertMeetingSchema.partial()`); context panel offers all 15 with no gate (`context-panel.tsx:45`); checker enables `converted_to_project` on any approved proposal of either kind. | One outcome policy (§5) used by `meetingCrud` `update.before` and every picker. |
| I7 | Approved initial-sale on the meeting ⇒ `converted_to_project`; approved additional-work ⇒ `additional_work`; an approved proposal declined with no approved proposal left ⇒ `cancelled_scopes`. | [ruled R6, R7]; precedence [open Q5] | Only the Zoho path derives `additional_work`; nothing derives on initial-sale approval; un-approve and decline never touch the outcome. | Same policy, fired from proposal status changes. |
| I8 | Outcomes allowed per meeting type (R4) + `cancelled_scopes` on both. | [ruled R4] | No type gating anywhere. | Policy. Conflict with I7 when an additional-work proposal is approved on a **lead** (birthing) meeting: §6 Q5. |
| I9 | Approved initial-sale ⇒ a project exists and the birthing meeting points at it. Approved additional-work ⇒ its meeting already has a project. | [ruled R1] | Zoho initial-sale signing, `AssignProjectDialog` approve, wire `status` writes: no project. | Approval seam (§6 Q6). |
| I10 | One definition of **declined**, reached by one route. | [proposed] | Zoho decline only stamps `contractDeclinedAt` and leaves `status = 'sent'` (`lib/contract-events.ts:63-65`); kanban "declined" declines **every** sent proposal of the customer across meetings and kinds (`move-customer-pipeline-item.ts:165-195`). | §6 Q7. |
| I11 | Proposal status moves only along an allowed graph; `approvedAt` set exactly when approved. | [proposed] | Any → any from the status cell, `crud.update`, and send (send re-opens approved/declined to `sent`, email goes out first, `delivery.router.ts:37-66`). `approvedAt`: `AssignProjectDialog` omits it, status cell overwrites it, Zoho keeps the first. | `proposalCrud` `update.before` transition table. |
| I12 | Project meetings never enter the lead pipelines (`rehash`/`dead`). | [proposed] | `OUTCOME_PIPELINE_MAP` (`Record<string,…>`) maps `no_show`/`cancelled` → `rehash`; every project reschedule cancels the original → `rehash`. | Policy (type-aware pipeline mapping). |
| I13 | "Signed customer" = has an approved initial-sale (not "has a project row"). | [proposed] | `signed-customer-sql.ts` feeds lead-source and ad metrics. | One SQL fragment. |

## 4. Event → effects

**Today** is the code; **Target** marks ruled / proposed / open.

### 4.1 Proposal events

| Event | Today | Target |
|---|---|---|
| **P1 Created** (`proposalsRouter.crud.create`, only from `create-new-proposal-view.tsx:87`) | `create.before` reads meeting (SYSTEM), derives `kind`, snaps SOW; financials recomputed. Meeting outcome untouched (nothing ever writes `proposal_created`). `meetingId` + `ownerId` client-supplied. | Meeting outcome re-derived through the policy (`proposal_created` if still at default). [proposed] `meetingId` required server-side (spec A Task 7 already plans NOT NULL). |
| **P2 Duplicated** | Copy minus status/kind/token/contract fields; `kind` **re-derived** from the meeting's current project. Crashes under SYSTEM_CONTEXT (`ctx.session!`). | Re-derive is correct under I2 (a new proposal on a project's meeting is an upsell) [proposed, confirm]. |
| **P3 Sent** (`delivery.sendProposalEmail`) | Email, then `status = 'sent'`, `sentAt`; router calls `deriveOutcomeOnProposalSent` (SYSTEM) only from `not_set`/`proposal_created`. No status guard: approved/declined go back to `sent`. | Only from `draft`/`sent` (I11). Outcome via the single proposal-status → outcome route (R9), not a router callsite. |
| **P4 Approved** — 5 paths: (A) status cell, meeting has project · (B) status cell → `CreateProjectModal` → `projects.business.create` → second client mutation · (C) `AssignProjectDialog` approve · (D) Zoho `completed` (SYSTEM, write-once on `contractSignedAt`) · (E) generic `crud.update`, incl. **share link** | Only B creates a project (4 non-atomic writes; scopes from every proposal on the meeting incl. declined). Only D derives `additional_work`. C sets no `approvedAt`. E bypasses everything. | One approval route for every path [ruled R1]: initial-sale → create project (`projectCrud.create`, hooks hold defaults/owner/scopes), link birthing meeting, outcome `converted_to_project`; additional-work → outcome `additional_work`, project untouched. Owner of the auto-created project, defaults, failure handling: §6 Q6. |
| **P5 Declined, never approved** — status cell; kanban drag (all sent proposals of the customer); Zoho declined (timestamp only) | No meeting effect. | One definition (I10, §6 Q7). Outcome: re-derived (`proposal_sent` → back to whatever proposal state gives) [open]. |
| **P6 Approved → declined ("cancelled scopes")** | Allowed from status cell / wire; project, `meeting.projectId`, positive outcome all stay. | [ruled R6] outcome → `cancelled_scopes` when no approved proposal remains on the meeting. Project: §6 **Q1 (pending)**. |
| **P7 Approved → draft/sent** | Allowed; nothing reverses. | [proposed] refused: decline is the only way out of approved (R6). |
| **P8 Deleted** | No guard for approved/signed/open envelope; envelope not recalled; outcome/project untouched; R2 media orphaned. | [proposed] refuse delete of approved or envelope-bearing proposals; otherwise re-derive the meeting outcome. |
| **P9 Contract events** (create draft / send / recall / discard / resend / viewed / signed / declined) | Signed → auto-approve (P4-D). Declined → timestamp only. Recall/discard clear only `contractEnvelopeId` + `contractSentAt`. | Signed → the one approval route. Declined → I10. |

### 4.2 Meeting events

| Event | Today | Target |
|---|---|---|
| **M1 Created** — form (Fresh/Project; Project needs a project, UI-only), intake (SYSTEM, Fresh), reschedule replacement (SYSTEM, copies type + `projectId`), duplicate (keeps type, drops `projectId`) | Outcome = DB default `not_set`; no pipeline derivation; `create.before` early-returns for SYSTEM. | Default outcome from type (`site_visit` / `not_set`) [ruled R3]; I3–I5 checked [ruled R8]. Duplicate of a Project meeting keeps its project [proposed]. |
| **M2 Type changed** (wire `crud.update`; edit form exists but nothing opens it) | GCal resync only. | Under I3/I4: changing to/from Project is the move (M3), not a free field write [proposed]. |
| **M3 Linked to a project** — `assignToProject` (writes `converted_to_project`), `projects.business.create`, wire writes | No customer / proposal / type checks. | [ruled R5] move into an **existing** project: type → Project, disallowed outcome → `site_visit`. Refused for a birthing meeting [proposed]. Unapproved `initial-sale` proposals on it: §6 Q2. Moving out of a project: [open Q8]. |
| **M4 Outcome hand-picked** — action menu, overview card, table cell, closing step, context panel; `setOutcomeWithReason` for reason outcomes | Server accepts any value; only 2 of 5 pickers gated. | Policy decides allowed + disabled reasons per meeting; server refuses the rest [ruled R2]. |
| **M5 Rescheduled** (only from did-not-occur outcomes) | Replacement created (2nd CAPI `Schedule`); original → `cancelled` → pipeline `rehash`; no transaction. | Project reschedules never touch the lead pipeline (I12) [proposed]. |
| **M6 Deleted** (super-admin) | GCal removed; proposals' `meetingId` set null (they drop out of analytics and pipelines). | Refuse when the meeting has an approved proposal or is a birthing meeting [proposed]; spec A Task 7 makes proposals' FK RESTRICT. |
| **M7 Kanban drag → meeting completed** | Earliest `not_set` meeting of the customer → `follow_up_needed` (no type/project filter). | Lead meetings only (I8) [proposed]. |

### 4.3 Project and customer events

| Event | Today | Target |
|---|---|---|
| **J1 Project created** — `projects.business.create` (form), portfolio editor (no customer/owner/stage), raw script inserts | Owner = whoever clicked; stage `signed`; scopes from all meeting proposals. | Operational projects only from approval (P4) [ruled R1]; portfolio projects stay separate [proposed]. Owner, title, description, scopes from the **approved** proposal: §6 Q6. |
| **J2 Stage changed** — kanban drag (raw write, arbitrary project of the customer, no validation, no permission check) | — | Through `projectCrud.update`, validated stage, the dragged project [proposed]. |
| **J3 Project deleted** | FK nulls `meetings.projectId` with no hooks: outcomes stay positive, kinds stay `additional-work`, I3 broken. | [open Q1/Q3] refuse while it has linked meetings or approved proposals, or never hard-delete operational projects. |
| **C1 Customer deleted** | Raw proposal delete, `meetingCrud.delete` per meeting, projects cascade by FK (R2 media orphaned). | Out of this effort; already on the customers-module list. |

## 5. Where the rules live (structure)

**Today, outcome policy is spread over:** `constants/enums/meetings.ts` (lists, sentiment, sit, `isProjectMeeting`), `domains/pipelines/lib/get-disabled-outcomes.ts` (client-only), `domains/pipelines/lib/outcome-pipeline-map.ts`, `entities/meetings/constants/outcome-options.ts`, and two private "overwritable" lists in `entities/meetings/dal/server/mutations.ts`. **"Is this a project meeting"** is decided three ways: `meetingType === 'Project'` (analytics, create form), `projectId` null/not null (pipelines, kanban, proposals queries, GCal colour, visibility, analytics `hasProject`), and `kind` (sale classification, contracts, Zoho documents).

**Seams that exist:**
- `createCrudDal` hooks: `update.before(data, ctx, { id })` gets no stored row; `previousRow` is prefetched only for after hooks (`create-crud-dal.ts:116-150`). Refusals: `ThrowableDalError({ type: 'precondition-failed', reason })` → `PRECONDITION_FAILED`. Corrected 2026-10-05: `proposal_frozen` fires at three sites (the crud hook, `setCashInDeal`, the incentives service) and other entities refuse too (lead sources, applications); no client words any proposal refusal. The lead-sources crud already reads the stored row inside `update.before` through the factory's own `getById`.
- Cross-entity calls inside hooks already exist (proposal `create.before` reads the meeting; customer `delete.before` deletes meetings).
- No service has a `.business` child yet; `meetingService` and `projectService` don't exist (`projectsService` does).
- `withTx` and `afterCommit` exist and have no callers. Meeting after-hooks dispatch QStash/Ably/GCal before commit, and several hooks write through raw `db`: threading a transaction through today's hooks risks a lock wait between pool connections.
- UI: action-menu select options are static (`entity-actions/types.ts:51-60`); `StatusDropdownCell` takes a boolean checker with no reason; the context panel's field select has no disabled support.
- No test runner; the repo verifies pure rules with `scripts/verify-*.ts` (tsx + `node:assert`).

**Shape under discussion [open Q4]:** one pure policy module (state in → allowed outcomes with reasons, derived outcome, allowed transitions) consumed by the crud hooks, every picker and the backfill; one approval route used by every approval path.

## 6. Grill queue

| # | Question | Notes |
|---|---|---|
| ~~Q1~~ | Approved initial-sale declined: what happens to its project? | **Ruled → R10–R12.** |
| Q2 | When a meeting moves into a project, what happens to its unapproved `initial-sale` proposals (re-derive to `additional-work`, refuse the move, or leave them)? | R7 makes this load-bearing. |
| Q3 | How to enforce the project-meeting rules (I3–I5): app hooks only, DB CHECK + FK changes, or one field (`meetingType` derived from `projectId` + birthing state)? | Options to be presented. |
| Q4 | Structure: where the policy module and the approval route live (entities/meetings vs modules; `<entity>Service.business` children that don't exist yet), and the shared-seam widenings (action select options, `update.before` stored row). | R9. |
| Q5 | Outcome precedence on one meeting with several proposals: e.g. a birthing (lead) meeting with an approved initial-sale and an approved additional-work; a Project meeting with one approved and one declined. Is `additional_work` allowed on a lead meeting now that `kind` decides? | I7 vs I8. |
| Q6 | Auto-created project: owner (meeting owner participant vs approver), title/description defaults, scopes from the approved proposal only, failure handling when a step fails (no transaction spans the hooks), approval with no customer on the meeting. | Handoff §7. |
| Q7 | One definition of declined: does a Zoho contract decline set `status = 'declined'`? Does the kanban drag decline every sent proposal or one? | I10. |
| Q8 | Moving a meeting **out** of a project (Project → lead): allowed? | R5 covers in only. |
| Q9 | `site_visit` as a default vs an explicit pick (default means an unhappened visit counts as a visit; hygiene can't see it). | Owner asked for a recommendation. |
| Q10 | Share-link writes (`proposalsRouter.crud.update` with `ability: null`): close before approval gains side effects. | Security; also #285. |
| Q11 | Analytics: `upsellRate` population (numerator includes upsells on birthing meetings, which are not site visits); `newSalesWithoutProject` once projects auto-create. | |
| ~~Q13~~ | An agreement can stop being in force two ways, both seen in the field: **superseded** (amended; work continues) and **cancelled** (customer backs out). Today cancellation is recorded on the project stage while the proposal stays `approved`. Which fact records each? | **Ruled → R17, R18.** |
| ~~Q14~~ | Unpicked options. | **Ruled → R28.** |
| ~~Q15~~ | Amend as one action or two steps? | **Ruled → R19.** Sub-questions A1–A8 below. |
| Q12 | Rollout and backfill: derived generically from the invariants (no hard-coded ids), dry-run both DBs, verification queries for every invariant in both directions. | |

## 7. Field check (dev DB, scrubbed copy of prod; last meeting 2026-09-28, last proposal 2026-10-01)

Counts: 291 meetings, 116 proposals, 66 projects (24 operational with a customer, 42 portfolio-only).

| Finding | Data | Bears on |
|---|---|---|
| No meeting has more than one approved proposal. | 0 of 102 meetings with proposals. | R16 holds in the field. |
| Every operational project has exactly one birth meeting, **if** "approved" is read from `status` and not `approved_at`. | 19 births by `approved_at`; the other 5 approved initial-sales have `approved_at` NULL (all manual approvals, the `AssignProjectDialog` path). 0 projects without an approved proposal. 0 project meetings scheduled before their birth meeting. | R14 derivation; `approved_at` backfill. |
| One customer = one project so far. | 24 customers, 1 project each. | No multi-project evidence yet. |
| **Amendments happen, done as R15 describes, and both legs are signed in Zoho.** | Meeting `28df0074` (Project): upsell signed 06-23, then "Work change" signed 07-07; the original was set `declined`. Meeting outcome `not_set`. | Q13: a decline after approval meant *superseded*, not *cancelled*. |
| **A true cancellation inside a project that carried on.** | Meeting `75304007` (Project): signed upsell later set `declined` by hand because the customer backed out (owner, 2026-10-02); another proposal sent just in case, still `sent`; project `closed`. Correct outcome: `cancelled_scopes`. Backfill: approved-then-declined → `cancelled`. | R17, R18. |
| **Cancellation is recorded on the project today, not on the proposal.** | 2 projects at stage `cancelled`, 2 at `on_hold`; all four still have their initial-sale `approved`. | Q13: two facts for one event. |
| Options are common: several proposals sent on one lead meeting, one picked. | 5 lead meetings with 2 sent initial-sales (often same day); one Project meeting with 6 proposals (drafts, sent, a declined signed one). | What happens to the unpicked options when one is approved. |
| An initial-sale proposal was written on a birth meeting **after** the sale. | Meeting `d28fc473`: approved 03-05; a second initial-sale created 03-26, declined. | R15/R16 amendment kind (initial-sale on a birth meeting). |
| Approvals land days to months after the sitting. | Initial-sale: avg 13.6 days after the meeting (0–101). Additional work: avg 3.3 days (0–25). 4 of 24 births had earlier lead meetings. | "Sitting" = the meeting as a container, not the day. |
| Project meetings are mostly pure visits. | 29 non-birth project meetings: 12 with no proposal, 15 with one. 21 still `not_set`, 2 wrongly `converted_to_project`. | R3 default; backfill. |
| The two broken rows. | `403f9907` (Project, no project, no proposals) is scheduled 10 days **after** the customer's only project was created (stage `got_full_payment`): it looks like a missing link, not a Fresh meeting. `545fe796` (Fresh, linked, no proposals) is a plain project meeting under R14. | Revisit the earlier "turn into Fresh" ruling. |
| Meeting `pipeline` on project meetings. | 34 project meetings in `fresh`, 0 elsewhere (kanban hides them by `projectId`). Birth meetings: 19 in `fresh`. | I12. |
| Declines. | 18 declined: 16 never approved, 2 approved-then-declined (both above). 0 contract declines recorded. | I10, Q13. |

## 8. Amend: grill list

| # | Question | Status |
|---|---|---|
| A1 | How an amendment is recorded and when it completes. | **Ruled → R20.** Proposed mechanics (confirm with A2): approving Y on a meeting that already holds an approved X *is* the amend (R16 leaves no other meaning); X → `amended` and Y → `approved` in one step; until then X stays in force; Y declined → nothing changes. |
| A2 | Contract papering for an amendment. | **Ruled → R21.** |
| A2b | Order of the amend flip. | **Ruled → R22.** |
| A3 | Analytics: sale date and value after an amend (X's date with Y's value, or Y as a new sale); cancellation metrics must exclude amended X. | **Ruled → R23.** |
| A3b | A `cancelled` sale in analytics. | **Ruled → R24, R25.** |
| A4 | Window: only while the project hasn't started, or any time (e.g. `28df0074` "Work change" two weeks later)? | |
| A5 | One open amendment of X at a time? Chains (amend of an amend)? | |
| A6 | Project effects of amending an initial sale: scopes, title/description defaults, stage. | |
| A7 | The other sent options on the meeting (Q14) when Y is approved. | |
| A8 | Who may amend; the customer-facing page for X once replaced. | |

## 9. Scenario catalog (real-world flows)

Legend: **D** decided (ruling) · **P** proposed, awaiting a ruling · **O** open. "Meeting" = the container (R15 note: a sitting is the meeting, not the day).

### 9.1 Lead and booking
| # | Scenario | Expected behaviour | Status |
|---|---|---|---|
| S1 | New lead booked (intake, dispatcher, Bina pre-fill) | Lead meeting (no project), outcome `not_set`, `fresh` pipeline, campaign graduation, CAPI Schedule. | D (today) |
| S2 | Lead meeting rescheduled before it happens | Replacement booked; original `cancelled`; one booked lead in analytics. Original goes to `rehash` pipeline today while the replacement is `fresh`. | O (S2: should a reschedule's original leave the lead pipelines?) |
| S3 | No-show / cancelled / no rep available | Hand-picked negative, reason note; never a sit. | D (today) |
| S4 | Sat, no proposal (pns, npns, not good, FTD, lost to competitor) | Hand-picked negative with reason; sit. | D (today) |
| S5 | Second sit for the same lead (follow-up) | New lead meeting; Fresh/Follow-up/Rehash order derived from chronology (analytics already does). Stored `meetingType` for lead meetings becomes redundant. | P (derive lead order; retire stored lead types) |
| S6 | Lead revived from rehash months later | New lead meeting, same customer; one person = one lead. | D (today) |
| S7 | Duplicate customer records | Folded into one lead by analytics. | D (today) |

### 9.2 Proposals before a sale
| # | Scenario | Expected behaviour | Status |
|---|---|---|---|
| S8 | Proposal drafted at the meeting, sent | Outcome follows proposal state (`proposal_created` → `proposal_sent`) unless a human pick outranks it. | D (R26) |
| S9 | Several options sent on one meeting; customer picks one | One approved per meeting (R16). Unpicked options: auto-`declined` on approval, or left `sent`? | D (R28) |
| S10 | Customer says no to a sent proposal | `declined` (R17). Meeting outcome falls back to the remaining state. | D (R17) · P (R26: falls to the hand pick, else the default; an unresolved past lead meeting is flagged for a pick) |
| S11 | Proposal edited after sending | Lock ladder: content editable until an envelope exists; edits after that = recall/discard first. | D (today) |
| S12 | Proposal written at meeting 1, signed after meeting 2 | The proposal's meeting is the birth meeting; meeting 2 stays a lead meeting. | P |
| S13 | New proposal written at meeting 2 replacing meeting 1's | Meeting 1's proposal stays `sent` until declined; nothing links them. | O (should creating at meeting 2 decline meeting 1's open proposals?) |
| S14 | Proposal without a meeting | Refused (`meetingId` NOT NULL, spec A Task 7). | P |
| S15 | Proposal duplicated | New draft; `kind` derived from its meeting (I2/R14). | D |

### 9.3 The sale
| # | Scenario | Expected behaviour | Status |
|---|---|---|---|
| S16 | Initial sale signed in Zoho | Approved → project created (`projectCrud.create`), birth meeting linked, outcome `converted_to_project`, customer → projects bucket. | D (R1) · O (Q6 owner, defaults, failure handling) |
| S17 | Initial sale approved manually (no e-signature) | Same as S16. Allowed for everyone, or only admins (paper contracts)? | O |
| S18 | Contract sent, never signed; recalled or expired | Proposal stays `sent`; Zoho recall/expiry not mapped today. | O |
| S19 | Customer refuses to sign in Zoho | Today only `contractDeclinedAt`; should be `declined`. | O (Q7) |
| S20 | Partial signature (one of two signers) | Nothing until all sign. | D (today) |
| S21 | Approval when the meeting has no customer | Refused (a project needs a customer). | P (Q6) |
| S22 | Approved by mistake (wrong row in the status cell) | Admin revert approval (R27). | D (R27) |

### 9.4 Right after the sale
| # | Scenario | Expected behaviour | Status |
|---|---|---|---|
| S23 | On-site tweak to scope or price | Amend: new HI contract, X stays in force until Y signs, then X `amended`, Y `approved`; sale keeps original date, current value. | D (R19–R24) |
| S24 | Customer refuses the amendment | Y `declined`; X untouched. | D (R22) |
| S25 | Amendment of an amendment | Chain by approval date; sale date = first approval. | P (A5) |
| S26 | Two open amendments of X at once | Allow only one open amendment per meeting? | O (A5) |
| S27 | Right-to-cancel (3 business days; 5 for seniors) or financing denied | `cancelled`; counts as a sale, not opened (R25); birth meeting → project cancelled (R10); outcome `cancelled_scopes`. | D |
| S28 | Customer cancels after work started | `cancelled` (R25). Project stage? (not "cancelled" if partially built and billed?) | O |
| S29 | Initial sale cancelled while approved upsells exist | Refused (R12). | D |
| S30 | Customer re-signs on the birth meeting after cancelling | New proposal on the birth meeting (initial-sale) approved → existing project reactivated. | P (R10) |
| S31 | Customer re-signs months later at a **new** lead meeting | New lead meeting → initial-sale → a **second** project, or link to the cancelled one? | O |

### 9.5 Project phase
| # | Scenario | Expected behaviour | Status |
|---|---|---|---|
| S32 | Site visit booked for a project | Project meeting, default `site_visit`, never a lead/sit. | D (R3) |
| S33 | Site visit → upsell signed | `additional_work`; project untouched; upsell sale. | D (R1, R7) |
| S34 | Upsell sent, customer declines | `declined`; meeting falls back to its hand pick, else `site_visit`. | P (R26) |
| S35 | Upsell signed, later cancelled | `cancelled_scopes`; project continues. | D (R18) |
| S36 | Upsell changed (change order, up or down) | Amend with a new Additional Work Description. | D (R19, R21) |
| S37 | Project meeting rescheduled / no-show / cancelled | Never enters lead pipelines. | P (I12) |
| S38 | Meeting booked outside its project by mistake | Move: link to the project; open proposals become additional work by derivation; refused while an envelope is out or for a birth meeting. | P (R5, R13) |
| S39 | Move a meeting out of a project | — | O (Q8) |
| S40 | Project put on hold | Project stage only. Does on-hold count as opened? | O |
| S41 | Project closed, customer wants more work | Upsell on a project meeting of the closed project, or a new project? | O |
| S42 | New job for an existing customer years later | New lead meeting → initial sale → second project. Customer with several projects: kanban shows newest, mixes meetings. | O |

### 9.6 Corrections and admin
| # | Scenario | Expected behaviour | Status |
|---|---|---|---|
| S43 | Wrong outcome picked | Hand-pickable outcomes change freely; derived ones locked. | D (R2) |
| S44 | Proposal deleted | Refused once approved/amended/cancelled or with an envelope. | P (P8) |
| S45 | Meeting deleted | Refused when it holds a committed proposal. | P (M6) |
| S46 | Project deleted | Refused while it has linked meetings / committed proposals. | P (J3) |
| S47 | Customer deleted | Out of scope (customers module). | — |
| S48 | Meeting duplicated | Keeps its project. | P |
| S49 | Share-link holder | Can view and sign; cannot write status/kind. | P (Q10) |
| S50 | Kanban drag to "declined" | Declines every sent proposal of the customer today. | O (Q7) |
| S51 | Kanban drag to "meeting completed" | `follow_up_needed` on a lead meeting only. | P |
| S52 | Legacy data | Backfill from the invariants (approved-then-declined → `cancelled`; `approved_at` gaps; `403f9907`). | P (Q12) |

### 9.7 Figures
| # | Scenario | Expected behaviour | Status |
|---|---|---|---|
| S53 | Sale | Initial-sale or additional-work proposal that is `approved`, `amended` (folded into its chain) or `cancelled`; dated at the chain's first approval; valued at the current agreement (cancelled: last value). | D (R23–R25) |
| S54 | Opened sale | A sale whose work started: not `cancelled`. On-hold? Defined by project stage or by proposal? | O |
| S55 | Close rate | New sales (initial-sale, incl. cancelled) over sits. | P (R25) |
| S56 | Signed customer | Has an initial-sale sale (incl. cancelled?). | O (I13) |
| S57 | Customer pipeline after a cancellation | Projects bucket (cancelled stage) or back to rehash? | O |
| S58 | Site visits, upsell rate, revenue per visit | Past project meetings that occurred; population of the rate. | O (Q9, Q11) |
| S59 | Amendment time | Y's `approvedAt` (backup `contractSentAt`). Does Y keep its own `approvedAt`, with the sale date derived from the chain? | P (R23 vs R24 wording) |

## 10. Future ideas (recorded, not scheduled)

| # | Idea | Source |
|---|---|---|
| F1 | Stale open proposals: a cleanup job, or a deadline after which an action is required or taken automatically (e.g. unpicked options left `sent` after a sale). | Owner, 2026-10-02 (R28) |
