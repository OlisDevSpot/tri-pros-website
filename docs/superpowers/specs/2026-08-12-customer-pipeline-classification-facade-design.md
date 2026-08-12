# Customer Pipeline Classification Facade — Design Spec

> ⚠️ **STATUS: DEFERRED / DRAFT — NOT an approved design (user ruling 2026-08-12).**
> Deferred as non-blocking; superseded by a larger `domains/pipelines` architecture rethink.
> **Known errors to fix on pickup:** (1) file locations are wrong; (2) this draft wrongly keeps
> `meetings.pipeline` as a stored/materialized column — per the user, **pipeline is a purely
> DERIVED in-code fact, and both `customers.pipeline` and `meetings.pipeline` stored columns
> should go away**; (3) scoped as a bolt-on, but the real work is making `domains/pipelines` the
> central engine + UI owner reusable across entities/features (not buried in `customers-pipelines`).
> The **reusable part of this doc is §6's call-site inventory** (from the 3 parallel mappers).
> Tracking: memory `project-pipelines-domain-rethink`. Do a fresh brainstorm before implementing.

**Date:** 2026-08-12
**Status:** DEFERRED / DRAFT (see banner)
**Author:** brainstorm session (issue-285 worktree)
**Related:** unblocks the dispatcher visibility predicate in the CASL scope-compiler epic (`docs/plans/2026-08-10-casl-scope-compiler-epic.md`, Phase 1 plan `2026-08-11-casl-phase-1-per-entity-cutover.md`, Task 7). Prereq for re-pointing Task 6's dispatcher Customer rule.

---

## 1. Problem

A customer's **derived 5-bucket pipeline** (`projects | fresh | leads | rehash | dead`) is the business-facing "customer lifecycle" classification. Today it is defined **inconsistently and partly on a dead column**:

- `src/shared/entities/customers/lib/derived-pipeline-sql.ts` (`derivedPipelineSql`/`derivedPipelineWhere`) reads `customers.pipeline = 'rehash'/'dead'` — a column **no application code ever writes** (confirmed exhaustively: zero writers; always the schema default `'active'`). Its `rehash`/`dead` arms are **dead branches** → the customers-list filter, lead-source segment KPIs, and the not-yet-wired `$inDerivedPipeline` CASL operator all silently return **zero** rehash/dead rows.
- `src/features/customer-pipelines/dal/server/get-customer-pipeline-items.ts` (the kanban board — the implementation that actually works) ignores `customers.pipeline` and derives rehash/dead from **`meetings.pipeline`**, which *is* written by `OUTCOME_PIPELINE_MAP` in the meeting `update.before` hook.

So there are **two divergent customer-pipeline implementations** that can never agree while `customers.pipeline` stays unwritten, plus dead JS mirrors (`deriveMeetingPipeline`, `deriveCustomerPipelines`) that are the right idea but unwired.

Separately, the business definition of the buckets is not codified as a single source of truth, and the "negative outcome → rehash vs dead" split is hand-encoded in a **non-exhaustive** `Record<string, …>` (`OUTCOME_PIPELINE_MAP`) that silently defaults unknown outcomes to "no change."

**The user's mandate:** codify "meeting outcome → sentiment → what it means for the customer lifecycle" as **one centralized facade** every call-site pulls from, with the three layers defined individually but unified behind one seam.

## 2. The three layers (facade shape)

| Layer | Home | Content |
|---|---|---|
| **1 — Raw outcome** | `src/shared/constants/enums/meetings.ts` (unchanged, canonical) | `meetingOutcomes` enum, `selectable`/`derived` partition. DB-adjacent source of truth (`pgEnum` built from it). Reuse. |
| **2 — Sentiment + terminality** | `src/shared/constants/enums/meetings.ts` (extend) | `MEETING_OUTCOME_SENTIMENT` (unchanged 4-value: positive/neutral/negative/unset) **plus** a new co-located `TERMINAL_NEGATIVE_OUTCOMES` set + `isTerminalOutcome()`, and derived outcome-sets (`POSITIVE_OUTCOMES`, `NEGATIVE_OUTCOMES`, `NON_NEGATIVE_OUTCOMES`). |
| **3 — Lifecycle meaning** | `src/shared/domains/pipelines/` (existing domain) | One canonical `outcome → meeting-pipeline` map (exhaustive), one JS customer classifier, one SQL customer classifier. Every pipeline read call-site pulls from here. |

**Terminology (canonical, user ruling 2026-08-12):** business abbreviations are recorded in memory `reference-meeting-outcome-abbreviations.md` and MUST be documented in code (`enums/meetings.ts` comments + `customers/DOCS.md`): `pns`=pitch no sale, `npns`=no pitch no sale, `ftd`=financially torn down, `nra`=no rep available, `not_good`≈"ng".

## 3. Taxonomy (Layer 2)

Sentiment stays **4-value** (protects `isNegativeOutcome` + `outcomeRequiresReason` + all UI color/stat consumers — terminal outcomes remain `negative` and still require a reason).

- **Positive** (sentiment `positive`): `converted_to_project`, `additional_work`.
- **Neutral** (sentiment `neutral`): `follow_up_needed`, `proposal_created`, `proposal_sent`.
- **Unset**: `not_set`.
- **Negative** (sentiment `negative`, 8): `not_good`, `pns`, `npns`, `ftd`, `no_show`, `lost_to_competitor`, `cancelled`, `nra`.
  - **Terminal-bad** (new subset → `dead`, "stop pursuing"): `lost_to_competitor`, `not_good`, `ftd`.
  - **Recallable** (the rest → `rehash`, back to dispatcher pool): `cancelled`, `no_show`, `pns`, `npns`, `nra`.

New exports in `enums/meetings.ts`, all **exhaustively derived** from `MEETING_OUTCOME_SENTIMENT` + the terminal literal so a new outcome forces a compile error:

```ts
export const TERMINAL_NEGATIVE_OUTCOMES = ['lost_to_competitor', 'not_good', 'ftd'] as const
export function isTerminalOutcome(o: MeetingOutcome): boolean // membership in TERMINAL_NEGATIVE_OUTCOMES
export const POSITIVE_OUTCOMES: MeetingOutcome[]      // sentiment === 'positive'
export const NEGATIVE_OUTCOMES: MeetingOutcome[]      // sentiment === 'negative' (= existing isNegativeOutcome set)
export const NON_NEGATIVE_OUTCOMES: MeetingOutcome[]  // sentiment !== 'negative'
```

`TERMINAL_NEGATIVE_OUTCOMES` MUST be a subset of `NEGATIVE_OUTCOMES` — assert this at module load (fail-loud) so a typo can't silently create a non-negative "terminal" outcome.

## 4. Classification rule (Layer 3) — ONE definition, two renderings

**Ordered, first-match-wins** (precedence baked into order; validated against user rulings 2026-08-12):

```
projects  ← has a project OR ≥1 positive-outcome meeting
leads     ← no meetings
fresh     ← has meeting(s) + ≥1 non-negative (neutral/unset), no positive
dead      ← has meeting(s), ALL negative, ≥1 terminal-bad
rehash    ← has meeting(s), ALL negative, NO terminal-bad
```

Governing principle (user): **any single non-negative meeting pulls a customer out of the rehash/dead space entirely** — a brand-new booked meeting (`not_set`) ⇒ **fresh**, never leads.

### 4a. SQL classifier — `customerPipelineSql(customerIdCol)`

Parameterized on the correlating customer-id column (resolves the current literal-`"customers"."id"` alias-leak by making the caller pass the column):

```sql
CASE
  WHEN EXISTS(SELECT 1 FROM projects p WHERE p.customer_id = <C>)
    OR EXISTS(SELECT 1 FROM meetings m WHERE m.customer_id = <C> AND m.meeting_outcome IN (:positive))
    THEN 'projects'
  WHEN NOT EXISTS(SELECT 1 FROM meetings m WHERE m.customer_id = <C>)
    THEN 'leads'
  WHEN EXISTS(SELECT 1 FROM meetings m WHERE m.customer_id = <C> AND m.meeting_outcome NOT IN (:negative))
    THEN 'fresh'
  WHEN EXISTS(SELECT 1 FROM meetings m WHERE m.customer_id = <C> AND m.meeting_outcome IN (:terminal))
    THEN 'dead'
  ELSE 'rehash'
END
```

- `customerPipelineSql()` defaults `<C>` to `customers.id` (customer-subject queries).
- `customerPipelineWhere(buckets, customerIdCol?)` → `inArray(customerPipelineSql(col), buckets)` (empty → `undefined`, composes with `and`).
- Meeting-subject correlation (for the dispatcher Meeting rule) passes `meetings.customerId` as `<C>`.
- The `:positive` / `:negative` / `:terminal` outcome-string lists come from Layer 2's sets — the SQL and JS classifiers consume the **same** exported arrays, so they cannot drift.

### 4b. JS classifier — `deriveCustomerPipeline(input): Pipeline`

Single-bucket (reconciles the dead multi-bucket `deriveCustomerPipelines`):

```ts
export function deriveCustomerPipeline(input: {
  outcomes: readonly MeetingOutcome[] // one per meeting the customer has
  hasProject: boolean
}): Pipeline
```

Same ordered rules as 4a. For UI optimistic updates / background jobs / anywhere a single customer's bucket is needed without SQL. The existing dead `deriveMeetingPipeline`/`deriveCustomerPipelines` are deleted (or rewired into this).

### 4c. Per-meeting map — `OUTCOME_PIPELINE_MAP` rewritten exhaustive

`src/shared/domains/pipelines/lib/outcome-pipeline-map.ts` becomes `Record<MeetingOutcome, MeetingPipeline | null>` (exhaustive → new outcomes force a compile error), derived from Layer 2:

- terminal-bad → `'dead'`; recallable-negative → `'rehash'`; everything else → `null` (no meeting-pipeline change).
- **Taxonomy change vs today:** `not_good` and `ftd` move from `'rehash'` → `'dead'` (they're now terminal). `lost_to_competitor` stays `'dead'`. This keeps the meeting-level `meetings.pipeline` (consumed by proposals/meetings list filters) aligned with the customer classifier.

This preserves the existing write path (the meeting `update.before` hook keeps calling the map) — no write-side change — while making the map canonical and exhaustive.

## 5. Facade surface (Layer 3 module, `src/shared/domains/pipelines/`)

```ts
// lib/customer-pipeline.ts (new)
customerPipelineSql(customerIdCol?: PgColumn | SQL): SQL           // 4a
customerPipelineWhere(buckets: readonly Pipeline[], customerIdCol?): SQL | undefined
deriveCustomerPipeline(input: { outcomes, hasProject }): Pipeline  // 4b

// lib/outcome-pipeline-map.ts (rewritten, 4c)
OUTCOME_PIPELINE_MAP: Record<MeetingOutcome, MeetingPipeline | null>

// existing, kept: constants/pipeline-registry.ts (PIPELINE_LABELS, pipelineConfigs),
//                 lib/get-accessible-pipelines.ts, lib/compute-fresh-stage.ts
```

`src/shared/entities/customers/lib/derived-pipeline-sql.ts` is **replaced**: callers reimport `customerPipelineSql`/`customerPipelineWhere` from `domains/pipelines`. (Rationale: the classifier is consumed cross-domain — customers, lead-sources, voip-campaign-contacts, permissions — so the shared `pipelines` domain is the correct home, not `customers/lib`.) A thin re-export shim from the old path MAY be kept short-term to reduce churn, but the target is direct imports.

## 6. Call-site migration (the "route everything through the facade" deliverable)

Every read call-site the mappers found routes through the facade. Behavior **fix** (not regression) — rehash/dead buckets start returning correct rows:

**Consume `customerPipelineSql/Where` (rewritten to meeting-derived):**
- `src/trpc/routers/customers.router/business.router.ts` (customers list filter + projection)
- `src/trpc/routers/lead-sources.router.ts` (`getCustomers` filter + projection)
- `src/shared/entities/customers/dal/server/queries.ts` (`isCustomerInLeads`, `listEnrollableLeadsBySource`)
- `src/shared/entities/voip-campaign-contacts/lib/lead-campaign-status.ts` + `dal/server/queries.ts` (enrollment eligibility — preserve the unaliased-`customers` contract via the explicit column param)
- `src/features/customer-pipelines/dal/server/get-customer-pipeline-items.ts` (the board — its 4 hand-written per-bucket subqueries collapse onto the shared classifier; **highest-value unification**)
- `src/features/lead-sources/lib/segment-sql.ts` (`dead`/`active` segmentation KPIs — currently reads dead `customers.pipeline`; re-express `dead` via the classifier; preserves the `active + signed + dead = all` invariant)

**Reconcile the visibility predicates (one source of truth):**
- `leadsPoolVisibility()` → re-express as `customerPipelineWhere(['leads'])` (drops the tautological `pipeline='active'` conjunct).
- The CASL `$hasNoMeeting` operator (Phase-0 leftover) is **orphaned** — it omitted the `pipeline='active'` conjunct and no rule uses it; delete or leave unused (do not build on it).
- `userCanSeeCustomer()` is orthogonal (meeting-participation visibility) — unchanged, but documented as the composition partner.

**Delete dead code:** `deriveMeetingPipeline`, `deriveCustomerPipelines` (rewire into `deriveCustomerPipeline` or remove). The inline meetings-list pipeline branch (`meetings/dal/server/queries.ts` filterWhere) shares the meeting-level fragment rather than re-hand-rolling.

## 7. How CASL Phase 1 resumes on top

Once the facade lands, Phase 1 Task 7 (and the re-point of Task 6) build directly on it:

- **Dispatcher × Customer** (re-do Task 6's rule): `customerPipelineWhere(['leads','rehash'], customers.id)` — now returns real rehash rows.
- **Dispatcher × Meeting** (Task 7): `customerPipelineWhere(['leads','rehash'], meetings.customerId)` — dispatcher sees a meeting iff its customer is in the recall pool (≈ rehash, since a customer with a meeting can't be leads).
- The `$inDerivedPipeline` CASL operator is generalized to take the correlating customer-id column from the subject (`customers.id` for Customer, `meetings.customer_id` for Meeting) and emit `customerPipelineWhere`. (Operator change belongs to the resumed Phase 1 work; this spec defines the helper it calls.)
- Equivalence gates for those tasks then compare against `customerPipelineWhere(...)`, not the old broken `derivedPipelineWhere`.

## 8. Scope boundary

**IN:** Layer 2 taxonomy extension; Layer 3 canonical classifier (JS + parameterized SQL + exhaustive outcome map); rewrite `derivedPipelineSql` → meeting-derived; route §6 call-sites through the facade; reconcile `leadsPoolVisibility`; delete dead code; docs (`enums/meetings.ts` comments, `customers/DOCS.md` pipeline-classification section + fix the stale `@deprecated` note, the abbreviations).

**DEFERRED (separate follow-ups, NOT this sub-project):**
- **Write-side transition table** — the 5+ scattered outcome setters (`deriveOutcomeOnProposalSent`/`…AdditionalWorkApproved`, the two raw `converted_to_project` writes, the drag-driven `follow_up_needed`), the derived-outcome dropdown escape hatch, the `follow_up_needed`-without-reason inconsistency, and the missing `proposal_created` setter. Real, but not needed for classification/visibility.
- **Physically dropping `customers.pipeline`** — a DB migration + prod push. After this sub-project the column is unread by derivation; dropping it is a clean follow-up.
- **`meetings.pipeline` de-materialization** (JIT vs stored) — out of scope; it stays a written column with its own meeting-level consumers, now fed by the canonical map.

## 9. Verification (no test runner — repo ruling)

`pnpm tsc && pnpm lint` green + manual `EXPLAIN`/`.toSQL()` diffs. Specifically:
- The exhaustive `Record<MeetingOutcome, …>` types make the taxonomy self-checking (a missing outcome fails to compile).
- The `TERMINAL_NEGATIVE_OUTCOMES ⊆ NEGATIVE_OUTCOMES` assert runs at module load.
- `.toSQL()` parity: `customerPipelineSql(customers.id)` produces the intended 5-bucket CASE; `customerPipelineWhere(['leads','rehash'], meetings.customerId)` correlates on `meetings.customer_id`.
- Behavior-change QA note: rehash/dead buckets in the customers list + lead-source KPIs will start returning **non-zero** rows (the fix). Spot-check a known rehash customer appears.
- No new test framework; no `pnpm build`.

## 10. Open risks

1. **Behavior change is visible** — surfaces that showed empty rehash/dead (list filter, KPIs) will populate. This is the intended fix, but flag for the user before merge.
2. **`projects` bucket definition** — defined as `has project OR ≥1 positive outcome`. `converted_to_project`/`assignToProject` always set the outcome, so the two are near-equivalent; the OR is belt-and-suspenders. Confirm no surface expects "positive outcome but NOT projects."
3. **`get-customer-pipeline-items` uses `meetings.pipeline` for its per-bucket routing today; migrating it to the outcome-derived classifier must preserve the `projectId IS NULL` exclusion** (a project-linked meeting shouldn't count toward rehash/dead). The classifier's `projects`-first ordering handles this at the customer level, but verify the board's per-bucket item lists still exclude project-linked meetings where intended.
4. **Home-directory move** (`customers/lib` → `domains/pipelines`) touches many imports; keep a re-export shim if churn is a concern.
