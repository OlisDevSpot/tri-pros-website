# Applications — Business Rules

An **Application** is an agent-run, in-home promotion application (`type`: `tpr_assistance`; `showcase` is stubbed for a future phase) that persists to the DB and links to a meeting. Meeting (1) → Applications (many). This entity is the **persistence substrate** only: the multi-step form engine and UI are sub-project #2, and the review/approval + decision email are sub-project #3.

This directory holds: the draft-state schema (`schemas/index.ts`), enum re-exports and reserved keys (`lib/constants.ts`), the visibility predicate + server spec (`lib/`), CRUD + business DAL (`dal/server/`). Backend module layout mirrors `proposals/`. The server spec at `lib/server-spec.ts` is consumed by `createEntityRouter` in `src/trpc/routers/applications.router/index.ts`, which is already wired (CRUD + business reads + draft lifecycle).

## Lifecycle

```
   draft  ──submit──►  submitted  ──►  approved   (sub-project #3)
     │                     │      ──►  rejected   (sub-project #3)
     │                     │
     └──────withdraw───────┴──►  withdrawn   (terminal; pre-decision abandon)
```

`status` has five values: `draft | submitted | approved | rejected | withdrawn`. This phase (sub-project #1) wires three transitions:

- **`saveDraft`** — repeatable autosave, gated to `status === 'draft'`.
- **`submitApplication`** — `draft → submitted` (see [`#draft-commit-split`](#draft-commit-split)).
- **`withdraw`** — `draft | submitted → withdrawn`, a pre-decision abandon with no further transitions out.

`approved` / `rejected` and their decision columns (decided-by, decided-at, rejection reason, etc.) do not exist yet — they land in sub-project #3. Until then, nothing in this codebase writes those two status values.

Status transitions are convention-enforced in the DAL mutation functions themselves (`saveDraft`, `submitApplication`, `withdraw`), not by a DB CHECK on allowed transitions. The DB enforces one related invariant: **`submitted_at` is non-null for any status other than `draft`/`withdrawn`** (see `applications_submitted_at_ck` below).

## Rules

### draft-commit-split

Draft state lives entirely in `applications.draft_answers_JSON` — the engine
state `{ _v, currentStepId, history, answers }` (`ApplicationDraft`,
`schemas/index.ts`) that sub-project #2's DB `StepPersistenceAdapter`
load/persists. `answers` is a dynamic `questionKey → raw value` map; it is
scratch until submit.

On **submit** (`submitApplication`), one transaction:

1. Reads and Zod-parses the current `draftAnswersJSON` (fails closed with
   `precondition-failed: nothing_to_submit` if null).
2. Splits `answers` into two destinations: every key except the reserved
   trades key becomes an `application_answers` row
   (`INSERT … ON CONFLICT (application_id, question_key) DO UPDATE`,
   idempotent — safe to re-run); the reserved key
   (`TRADES_QUESTION_KEY`) holds `{ tradeId, tradeName }[]` (Notion page id +
   name snapshot) and is inserted into `x_application_trades`
   (`onConflictDoNothing`).
3. Flips `status = 'submitted'` and stamps `submitted_at` with a JS
   `new Date().toISOString()` (never raw SQL `NOW()`).

The draft blob (`draft_answers_JSON`) is **left intact** afterward — it is not
cleared or nulled. It becomes an inert historical record; from submit onward,
`application_answers` + `x_application_trades` are the source of truth that
sub-project #3's review panel reads.

`saveDraft` is gated to `status === 'draft'` (`precondition-failed:
application_not_draft` otherwise), so a submitted application's answers are
immutable via the draft-autosave path — the only way to change committed
answers post-submit is a future explicit edit path (not built in this phase).

**Why**: ADR-0005 — in-progress form state is sparse and always whole-fetched
(one engine reads/writes the entire blob at once), so JSONB is the right shape
while drafting. Committed answers are a dynamic-key map that the review panel
(#3) reads per-row — a child table with `UNIQUE(application_id, question_key)`
gives idempotent upsert and per-answer addressability that a JSONB blob
doesn't. Multi-select trades are aggregatable (e.g. "how many applications
selected Kitchen?"), so they need a real junction table, never a JSON array
buried in an answer value.
**Reference impl**: `dal/server/mutations.ts:submitApplication` (modeled on
proposals' `replaceProposalIncentives` — read-current → transactional
upsert-and-flip).
**Enforced by**: `applications_submitted_at_ck` CHECK (`applications.ts`); the
`status === 'draft'` guards in `saveDraft` and `submitApplication`.

### trades-question-key-seam

`TRADES_QUESTION_KEY` (`lib/constants.ts`, value `'trades'`) is the ONE answer
key `submitApplication` special-cases. When exploding `draftAnswersJSON.answers`,
the entry under this exact key is treated as an array of
`{ tradeId: string, tradeName: string }` and routed to `x_application_trades`
instead of becoming `application_answers` rows. Every other key is a
free-text/scalar answer.

**Trades are Notion-managed.** Notion is the runtime source of truth for the
trade catalog; trade ids are **Notion page UUIDs (strings)**, not the
static-seed Postgres `trades.id`. So `x_application_trades.tradeId` is a `text`
Notion id with **no FK** to the Postgres `trades` table (mirroring
`x_project_scopes.scopeId`), and `tradeName` snapshots the label at submit
because marketing renames trades in Notion freely. Sub-project #2's
multi-select-trades step reads the Notion-backed picker
(`notionRouter.trades.getAll` → `constructionDataService.getTrades()`) and
**must** write `{ tradeId, tradeName }` objects under
`draftAnswersJSON.answers['trades']` — any other key name silently falls
through to the generic answer path and never reaches the trades junction.
See memory `reference-trades-notion-vs-postgres`.

**Why**: keeps trades joinable/aggregatable and out of the free-text answer
table (see [`#draft-commit-split`](#draft-commit-split)'s ADR-0005 rationale).
It is the single cross-phase contract between this backend (sub-project #1)
and the engine/UI (sub-project #2) — the constant is the seam, not a shared
type or event.
**Reference impl**: the split loop in `dal/server/mutations.ts:submitApplication`;
the constant + its doc comment in `lib/constants.ts`.
**Enforced by**: convention — documented here so #2 can't drift; nothing
prevents a differently-named key from silently becoming a plain answer row
instead of a trade selection, so the constant must be imported, never
re-typed as a string literal.

### visibility-via-meeting-participation

Applications have no `ownerId` column. Visibility is
`userParticipatesInMeeting(userId, applications.meetingId)`
(`lib/visibility.ts:applicationVisibility`), resolved by `scopeMiddleware`
into `ctx.scope` for every entity procedure. Non-omni agents see an
application only if they participate in its meeting (any role) — mirroring
proposals' "meeting participation is the gate" rule.

Child rows (`application_answers`, `x_application_trades`) carry no
independent visibility of their own. They are always reached through the
scoped parent: every DAL function that touches a child row first re-probes
the parent under `ctx.scope` (`and(eq(applications.id, id), ctx.scope ?? undefined)`)
before reading or writing the child table — see `dal/server/mutations.ts` and
`dal/server/queries.ts:getApplicationWithAnswers`, both of which select the
scoped parent row before touching `application_answers` / `x_application_trades`.

**Why**: an application belongs to a meeting's participants; there is no
independent owner concept to hang visibility off of. Reusing the meeting
scope instead of inventing an `ownerId` keeps applications consistent with
how proposals already do it.
**Reference impl**: `lib/visibility.ts:applicationVisibility` →
`@/shared/entities/meetings/dal/server/participants:userParticipatesInMeeting`.
**Enforced by**: `applicationServerSpec.visibility` (wired into
`scopeMiddleware`); the scope-probe in every business DAL function that reads
or mutates a child row.

## Anti-patterns

- ❌ Storing trade selections as a JSON array in an `application_answers` row
  — breaks aggregation; use the `x_application_trades` junction via
  `TRADES_QUESTION_KEY` (see [`#trades-question-key-seam`](#trades-question-key-seam)).
- ❌ Writing a multi-select-trades step under any key other than the literal
  `TRADES_QUESTION_KEY` constant — it silently becomes a dead answer row
  instead of a trade selection.
- ❌ FK-ing `x_application_trades.tradeId` to the Postgres `trades.id` — trades
  are Notion-managed (Notion page UUIDs); the Postgres `trades` table is a
  static seed nothing reads at runtime. Store the Notion id as `text` (+ a name
  snapshot). See memory `reference-trades-notion-vs-postgres`.
- ❌ Reading or writing `application_answers` / `x_application_trades` without
  first probing the parent `applications` row under `ctx.scope`.
- ❌ Calling `saveDraft` or re-deriving committed answers after
  `status !== 'draft'` — the split is one-way; committed rows are immutable
  via the draft path.
- ❌ Setting `updated_at` by hand, or using raw SQL `NOW()` for `submitted_at`
  — always a JS `new Date().toISOString()` (see `submitApplication`).
- ❌ Adding `approved` / `rejected` transitions, decision columns, or an
  `ownerId` column here — those are sub-project #3's territory; this phase
  only wires `draft → submitted` and `{draft, submitted} → withdrawn`.
- ❌ Clearing or nulling `draft_answers_JSON` on submit — it is intentionally
  left intact as an inert historical record, not wiped.

## See also

- Design spec: `docs/superpowers/specs/2026-07-30-applications-data-model-backend-design.md`
- Core-extraction (Phase 1, sub-project #2's engine): `docs/superpowers/specs/2026-07-29-multi-step-flow-core-extraction-design.md`
- ADR-0005 — JSONB vs column vs child table (the storage-shape decision behind [`#draft-commit-split`](#draft-commit-split))
- `docs/codebase-conventions/dal-conventions.md` — `DalReturn<T>` + `ScopedContext` pattern used in this entity's DAL
- [`../meetings/DOCS.md`](../meetings/DOCS.md) — `userParticipatesInMeeting`, the shared visibility primitive this entity reuses
- [`../proposals/DOCS.md`](../proposals/DOCS.md) — structural precedent this entity's backend module layout and visibility rule mirror

**Last updated:** 2026-07-30 — initial (sub-project #1: data model + backend).
