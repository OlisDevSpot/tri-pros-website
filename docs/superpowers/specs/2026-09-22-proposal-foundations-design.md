# Proposal Foundations — Design (Epic Spec A)

> **Epic:** `docs/plans/2026-09-20-multi-proposal-meeting-flow-epic.md` — the master tracker is canonical for decisions (C-ids) and requirement items (P/F/S/H/D/K/V ids). This spec designs **spec A** only; §9 lists what the other specs pick up.
> **Owns:** P1–P8, P10, P12, P13 · D11 · H15 (definition + agent-side application; see §5 SA5), H16 · K2.
> **Baseline:** `main` at `372448a7` (2026-09-22). Blocked by nothing; blocks specs B, C, D, E, F, G.
> **Constraint:** no meeting-flow UI change; no change to how the homeowner link is built or authorized (C25 — the access mechanism is deferred; #285 owns token-path security, C19/C24); no realtime work (C41); W4-aware everywhere — every shape introduced here is the one W4 turns into rows. **W4 (SOW normalization) is in design now and ships soon** — §4.11 is the alignment contract: every seam here lands on W4's locked names and its 2026-09-09 rulings (`docs/plans/2026-08-25-wave-4-pre-design-amendments.md` §R), and spec A is sized to land before W4's cutover (SA15).
> **Status:** design derived from tracker decisions C3, C4, C5, C18, C20, C27, C29, C38, C43, C44, C45 (grilled 2026-09-20/22); the refinements this spec adds are listed in §5 and mirrored into the tracker as C47–C61 (C56–C61 = the W4 alignment, added 2026-09-22 after the owner's review note "spec looks solid; align with W4"). Owner's go given 2026-09-22 ("start spec A, keeping the W4 re-grounding `docs/plans/2026-09-22-wave-4-re-grounding.md` in mind"). **Plan written:** `docs/superpowers/plans/2026-09-22-proposal-foundations.md` — its plan-time settlements are SA17–SA21 below (tracker C62–C66).

---

## 1. Why this exists

The meeting flow is about to work on **a selected proposal from the first tap** (C6–C8) instead of collecting state on the meeting and minting one proposal at the end. Six things about proposals stand in the way, all visible in code at `372448a7`:

1. **A proposal cannot be empty.** `projectDataSchema.sow` is `z.array(sowSchema).min(1)` (`modules/proposals/core/schemas/index.ts:79`) and the form's default is a placeholder section with `trade.id: ''` (`:225`). A proposal created in Who We Are has no trade yet (C6, C27 "Blank").
2. **Sending has no gate.** `sendProposalEmail` (`trpc/routers/proposals.router/delivery.router.ts:38-67`) emails, then unconditionally writes `status: 'sent'` + `sentAt`; it works on approved and declined rows from the API (only the UI hides the button). The rep's message is handed to the email template and never stored (`email.service.ts:55-81`).
3. **SOW sections have no identity and no place for the rep's inputs.** Sections are addressed by array position; pain points and notes live on the meeting (`flowStateJSON.tradeSelections`) and reach the proposal only as `"Address: …"` strings in `projectObjectives` (`features/meeting-flow/lib/build-proposal-defaults.ts:68-77`). W4 will give sections rows (`proposal_sow_items`) and needs stable ids (`proposal_incentives.sow_item_id`, W4 amendment A6).
4. **Duplicate behaves differently per caller.** The engine's `duplicateImpl` copies `spec.table` only (`shared/dal/server/lib/create-crud-dal.ts:262-297`); incentive cloning + rollup re-drive live in a `proposalService.duplicate` override (`modules/proposals/service.ts:60-72`). The router is wired to the bare DAL in the working tree (`proposals.router/crud.router.ts:24`, contradicting its own header at `:6-12`), so `crud.duplicate` silently drops the incentives today (tracker X7).
5. **Every created proposal looks like a real draft.** With a proposal minted per started sit (C6), one-off proposals that were never touched would contaminate every listing across the app (C43).
6. **A proposal can exist without a meeting.** `meetingId` is nullable with `onDelete: 'set null'` (`db/schema/proposals.ts:74-75`) and `create.before` has a live no-meeting branch (`core/dal/server/crud.ts:29-32`). Visibility, the homeowner page and "Assign to meeting" all derive from the meeting (C38).

Spec A fixes all six on the server and in the proposal-flow form, so specs C–G build on a proposal that can be empty, addressed by section id, seeded explicitly, duplicated identically from anywhere, hidden while untouched, and always attached to a meeting.

## 2. Scope

**In:** the items in the header. Concretely: the SOW section shape (§4.1), the readiness predicate (§4.2), send as a service verb + `sent_message` (§4.3), `pre-draft` + promotion (§4.4), the listing/visibility predicate module and its agent-side consumers (§4.5), the CRUD-shaped SOW child service (§4.6), the seed function and the retirement of the auto-snapshot (§4.7), the `duplicate.after` engine hook and the proposals duplicate config (§4.8), `meetingId` NOT NULL + `restrict` (§4.9), the proposals DOCS rewrite (K2).

**Out (owned elsewhere):** the create dialog and switcher (spec C, F2–F4); Specialties writing through the SOW service (spec D, F5); `initialRequestedTrades` (spec D, D3 — the seed reads `flowStateJSON.tradeSelections` until then, same shape by C39); `dealStructure` retirement and the funding half of `buildProposalDefaults` (spec E, D8/D9 — §5 SA6); the homeowner-side application of the visibility predicate (spec F, H11 — §5 SA5); token-path field gating and projection (#285, C19); the prod push (Push 1, with spec D's `meetings` half — §8).

## 3. Target structure

```
src/shared/dal/server/
  types.ts                         CrudConfig.duplicate gains `after?` + DuplicateAfterMeta (a duplicate-config key, not a slot hook — SA20) (§4.8)
  lib/create-crud-dal.ts           duplicateImpl threads `source` into the new hook                    (§4.8)

src/shared/modules/proposals/
  core/schemas/index.ts            sowSchema: id, painPoints, notes; sow: no min(1); defaults sow: []  (§4.1)
  core/types.ts                    SOW type follows the schema (unchanged file, new fields)
  core/lib/create-empty-sow-section.ts   generates `id`                                               (§4.1)
  core/lib/proposal-readiness.ts   NEW — getProposalReadiness / assertProposalReady (domain `sow` in)   (§4.2)
  core/lib/proposal-pre-draft.ts   NEW — shouldPromotePreDraft (the lock gate's twin)                 (§4.4)
  core/lib/regenerate-sow-section-ids.ts  NEW — pure; used by duplicate.overrides                     (§4.8)
  core/lib/proposal-visibility.ts  NEW — isListable / isHomeownerVisible + SQL forms (status subsets live in constants/enums/proposals.ts — SA21) (§4.5)
  core/constants/readiness-reason-labels.ts  NEW — agent copy under the disabled Send / Create Draft   (§4.2)
  core/lib/seed-sow-sections.ts    NEW — requested trades → SOW sections (pure)                        (§4.7)
  core/lib/snap-sow-from-meeting.ts DELETED                                                            (§4.7)
  core/dal/server/crud.ts          create.before (no-meeting branch gone, status pre-draft), update.before (promotion), duplicate.after (incentives + rollup), duplicate.exclude (+sentMessage), duplicate.overrides (pre-draft + regenerated section ids)
  core/dal/server/queries.ts       listProposals default `status <> 'pre-draft'` unless includePreDraft (§4.5)
  core/lib/proposal-lock.ts        unchanged — sentMessage is NOT a locked field                       (§4.3)
  sow/service.ts                   NEW unit — proposalService.sow.{getById, create, update, delete}, engine-shaped; W4 adds server-spec + crud here (§4.6, §4.11)
  sow/schemas/index.ts             NEW — sowSectionFieldsSchema / InsertSchema / UpdateSchema (strict; no id, no financials)
  sow/dal/server/queries.ts        NEW — getProposalBySowSectionId (blob locator; W4 replaces it with row reads)
  incentives/dal/server/mutations.ts  cloneGlobalIncentiveRows ADDED (the hook's DAL twin — SA20)
  incentives/service.ts            `clone` verb DELETED (zero callers once the root override dies — SA20)
  service.ts                       `duplicate` override DELETED; `send` verb ADDED; `sow` child getter (§4.3, §4.6, §4.8)
  core/DOCS.md                     K2 rewrite (§4.10)

src/shared/db/schema/proposals.ts  meetingId NOT NULL + restrict; sentMessage text                     (§4.9, §4.3)
src/shared/constants/enums/proposals.ts   proposalStatuses gains 'pre-draft'; LISTABLE_STATUSES + HOMEOWNER_VISIBLE_STATUSES live here (§4.4, §4.5)

src/trpc/routers/proposals.router/
  crud.router.ts                   crud: proposalService (header comment becomes true again)          (§4.8)
  delivery.router.ts               sendProposalEmail → thin adapter over proposalService.send          (§4.3)
  contracts.router.ts              createContractDraft asserts readiness                              (§4.2)
  sow.router.ts                    NOT in spec A — spec D creates it (sow.{create,update,delete}); W4 adds sow.replace to the same leaf (§4.6)

src/features/proposal-flow/
  ui/components/form/sow-field.tsx (and siblings)   zero-section empty state; sections keyed by id     (§4.1)
  ui/components/proposal/heading.tsx   shows the stored send message                                   (§4.3)
  lib/... / meeting-flow/lib/build-proposal-defaults.ts   trades half → seedSowSections; funding half stays until spec E (§4.7)

scripts/backfill-sow-section-ids.ts   one-time, idempotent; dev first, prod on explicit go            (§4.1)
scripts/tmp-smoke-proposal-foundations.ts   session-scoped smoke script (never committed)             (§7)
scripts/verify-proposal-foundations.ts      committed pure checks (node:assert) for every helper        (§7)
```

## 4. Contracts

### 4.1 SOW section shape (P1, P3, P5, P7 · C3, C4, C5)

```ts
export const sowSchema = z.object({
  id: z.string().uuid(),                       // NEW — stable identity; becomes proposal_sow_items.id in W4
  contentJSON: z.string(),
  html: z.string(),
  scopes: z.array(constructionItemSchema),
  title: z.string(),
  trade: constructionItemSchema,
  financials: sowFinancialsSchema,
  painPoints: z.array(z.string()).default([]), // NEW — homeowner-visible (C29)
  notes: z.string().optional(),                // NEW — rep-private (C29)
})
// projectDataSchema.sow: z.array(sowSchema)   — min(1) removed (C4)
// proposalFormBaseDefaultValues.project.data.sow: []
```

- **Ids.** `createEmptySowSection()` assigns `crypto.randomUUID()`; the form's field array keys by `id`, never by index. Stored blobs without ids are **backfilled once** by `scripts/backfill-sow-section-ids.ts` (idempotent: only sections lacking `id`; `--dry-run`; dev, then prod on its own go) so the schema can require `id` without a read-time default (a read-time default would mint a different id per read — no identity). Until the prod backfill runs, prod reads of old rows fail Zod → the backfill is part of Push 1's runbook, before the code that requires ids deploys (§8). The id is part of the form's submitted payload and survives every save unchanged; it is regenerated in exactly two places — the form's duplicate-section action (`project-fields.tsx:61-62` already regenerates cost-line and incentive ids; the section id joins them) and proposal duplicate (§4.8). Array index is the section's order (W4's `position`): `sow.create` appends, `sow.delete` compacts, `sow.update` never reorders.
- **Rep inputs.** `painPoints` is **required** (no `.default` — the form schema feeds `zodResolver`, and a defaulted key splits Zod input/output types; SA21) and the one-time backfill stamps `[]` beside the id; `notes` is optional. Classification only (C29): `notes` joins the never-to-homeowner list that #285's projection enforces; `painPoints` is homeowner-visible and read **from the sections** by homeowner surfaces (the `projectObjectives` copy dies with `buildProposalDefaults`' trades half, §4.7).
- **No `_v`.** `projectJSON` gains no schema-version stamp (`jsonb-columns.md#mandatory-schema-version` waived, SA19): W4 freezes the column, and the backfill is the shape marker.
- **Zero sections.** A proposal with `sow: []` is valid. The form renders an empty state ("No scope of work yet — add a trade") instead of a placeholder section. Readers audited (fact sheet §2): `heading.tsx:63`, `map-proposal-row-to-card-data.ts:39`, `assemble-envelope.ts:251` are optional-chained; PDF/financials iterate; the raw positional SQL in `features/customer-pipelines/dal/server/get-customer-profile.ts:99,101` (`->'sow'->0->'trade'->>'label'`) yields `null` for an empty SOW — the profile row shows "No scope yet"; the hack itself is W4's (amendment B5), not this spec's.
- **W4 alignment (§4.11):** `id` is lifted verbatim into `proposal_sow_items.id` — the backfill makes W4's data migration a pure lift (no minting, no remap), so any `sow_item_id` written after spec A survives W4; array index → `position`; `painPoints` → an identity-free value array column on the row (sanctioned per Addendum B: replaced whole, never SQL-queried) and `notes` → a text column; trade/scopes stay Notion string ids with a label snapshot (B8, unchanged here).

### 4.2 Readiness predicate (P2 · C4)

`core/lib/proposal-readiness.ts` — pure, the shape of `proposal-lock.ts`:

```ts
export type ReadinessReason = 'no-sow-section' | 'declined'
export interface ReadinessInput { status: ProposalStatus; sow: Pick<SOW, 'trade'>[] }   // the DOMAIN sow list, never the column
export function getProposalReadiness(input: ReadinessInput):
  { ready: true } | { ready: false; reasons: ReadinessReason[] }
export function assertProposalReady(input: ReadinessInput): void   // throws ThrowableDalError({ type: 'precondition-failed', reason: `proposal_not_ready:${reasons.join(',')}` })
```

Callers pass the assembled SOW — today `row.projectJSON.data.sow`, after W4 `toSowInputs(row)` (W4's locked JIT read helper, the `toFundingInputs` twin) — so the predicate never learns that `projectJSON` exists and W4 changes one call site, not the rule (SA12).

Rules v1: (1) at least one SOW section whose `trade.id` is non-empty; (2) status is not `declined` (the lock ladder calls declined permanent — re-sending would resurrect it). An **approved** proposal is ready: re-delivering a signed proposal's link is legitimate and touches no status (§4.3).

Enforced at: `proposalService.send` (§4.3 — inside `dalDbOperation`, so `assertProposalReady`'s `ThrowableDalError` becomes a `DalReturn` error and `dalToTrpc` maps it to `PRECONDITION_FAILED` with the reason as message, `trpc/lib/dal-to-trpc.ts:9-27`) and **`contractService.createDraft`** (`services/contracts.service.ts:21` — right after its own `getFullView`; the router loads no row, so the gate lives in the service — SA18). `createDraft` throws `ThrowableDalError`; the two router procedures that reach it (`createContractDraft`, `resendContract`) catch it and hand it to `dalToTrpc(dalError(…))`, so the client gets the same `PRECONDITION_FAILED: proposal_not_ready:…`. The UI disables Send / Create Draft and shows the reason (`core/constants/readiness-reason-labels.ts`, threaded as a `readiness` prop into the agreement panel). Ad-hoc `sow.length` checks anywhere else are forbidden — same discipline as the lock ladder.

### 4.3 Send as a service verb + `sent_message` (P2, H16 · C44, C45)

Schema: `sentMessage: text('sent_message')` — nullable, **lifecycle** (not in `frozenProposalLockedFields`, so a locked proposal can still be re-sent with a message; in `duplicate.exclude`, a copy was never sent).

```ts
// modules/proposals/service.ts
send(ctx, input: { id: string; recipient: { email: string; customerName: string }; message?: string })
  : Promise<DalReturn<Proposal>>
```

Steps, in this order (sequential, no transaction — W4 ruling R.1):
1. `getFullView(ctx, { id })` → not found ⇒ `not-found`.
2. `assertProposalReady(row)` (§4.2).
3. `proposalCrud.update(ctx, { id, data })` where `data = { sentMessage: message ?? null, ...(row.status === 'pre-draft' || row.status === 'draft' ? { status: 'sent', sentAt: now } : {}) }` — **first send only** stamps `sentAt` and moves status; a resend re-stores the message and re-delivers. `pre-draft → sent` skips `draft` (P12).
4. `deriveOutcomeOnProposalSent(SYSTEM_CONTEXT, { meetingId: row.meetingId })` — unchanged (`entities/meetings/dal/server/mutations.ts:26-47`).
5. `emailService.sendProposalEmail({...})` — **unchanged mechanism**: the same template, the same `ROOTS.public.proposalReview(id, row.token)` link built from the row's own token (the client no longer needs to supply it; C25 defers the mechanism; #285 owns the token path).

**Write before deliver** (SA3): under C20 the homeowner page shows a proposal only once it is `sent`; delivering first and writing second would let the homeowner open a link to a proposal the page refuses to show. If delivery fails after the write, the row stays `sent` and the verb surfaces the provider error; the rep resends (the UI already offers Resend).

Router: `deliveryRouter.sendProposalEmail` keeps its procedure name and `sendEmailSchema` input (SA4) and becomes a thin adapter: `proposalService.send(ctx, { id: input.proposalId, recipient: { email, customerName }, message })` (`input.token` is accepted and ignored until the access grill removes it). The client hook `use-send-proposal.ts` and its one caller (`contract-status-panel/ui/proposal-card.tsx`, the `message` textarea) are unchanged.

Display: `features/proposal-flow/ui/components/proposal/heading.tsx` renders `sentMessage` as "A note from {companyInfo.name}" when present (`getFullView` carries no owner name) — customer view and agent view alike (it was written for the customer).

### 4.4 `pre-draft` status + promotion (P12 · C43)

`proposalStatuses = ['pre-draft', 'draft', 'sent', 'approved', 'declined']` (text enum; no DB CHECK exists — code + Zod only). Column default stays `'draft'` (SA7): the hook is the rule, the default is the fallback for raw inserts; existing rows are untouched (we cannot know which were never edited).

- **Born `pre-draft`:** `create.before` sets `status: 'pre-draft'` on every create — blank, seeded, and duplicate (`duplicate.overrides` sets `status: 'pre-draft'` instead of `'draft'`).
- **Promotion `pre-draft → draft`** lives in `update.before`, after the lock gate: if the payload `touchesFrozenLockedFields` (`proposal-lock.ts:59-75` — label, `projectJSON`, the six funding scalars, `priceDisplayMode`, `envelopeDocumentIds`, `financeOptionId`, `meetingId`) and the row's current status is `pre-draft`, the hook returns `{ ...input, status: 'draft' }`. The rule is one pure helper, `core/lib/proposal-pre-draft.ts` → `shouldPromotePreDraft(signals: Pick<Proposal, 'status'>, data): boolean` (= `status === 'pre-draft' && data.status === undefined && touchesFrozenLockedFields(data)` — a payload that sets `status` itself is respected, SA21), called right after the gate. The lock probe (`getProposalLockSignals`) already runs for exactly these payloads and already selects `status`, so promotion costs no extra query. **Promotion is the lock gate's twin (SA13):** same probe, same site, same field set. W4 moves the gate for child rows (`proposal_sow_items`, `proposal_cost_lines` — amendment B7 / handoff q8) and the promotion moves with it: whatever write the lock ladder would refuse on a frozen proposal promotes a pre-draft. Lifecycle-only writes (status, timestamps, contract ids, `sentMessage`) never promote. SOW child writes (§4.6) go through `proposalService.update` → promote. Media uploads do not (separate lock-exempt router; a photo is not authorship — SA10).
- **Send from `pre-draft`** goes straight to `sent` (§4.3).
- **Consumers fixed** (fact sheet §3): `contract-status-panel/lib/get-status-badge.ts:28-41` gains a `pre-draft` case (its `default: null` would render nothing); `compute-fresh-stage.ts:30` (`every(s => s === 'declined')`) receives only listable statuses because its source query is filtered (§4.5) — no second implementation in the function. `columns-registry.tsx:87-99`'s status dropdown disables `pre-draft` (`isStatusDisabled` — a birth state, never hand-set) and `proposal-table-filter-config.ts:25-28` offers `LISTABLE_STATUSES` only (the default listing hides pre-drafts, so the value would filter to nothing) — SA21. `PROPOSAL_STATUS_COLORS` / `PROPOSAL_ROW_STYLES` / the overview-card dot gain the key.
- **Not built:** auto-deletion of stale pre-drafts. Filtered, not deleted.

### 4.5 Listing and homeowner visibility (P13, H15 · C20, C43)

`core/lib/proposal-visibility.ts` — one module, row and SQL forms; the two status subsets live beside `proposalStatuses` in `src/shared/constants/enums/proposals.ts` (client-safe, enum co-location — SA21) and the module imports them:

```ts
// constants/enums/proposals.ts
export const LISTABLE_STATUSES         = ['draft', 'sent', 'approved', 'declined'] as const satisfies readonly ProposalStatus[]
export const HOMEOWNER_VISIBLE_STATUSES = ['sent', 'approved', 'declined'] as const satisfies readonly ProposalStatus[]
// core/lib/proposal-visibility.ts
export function isListableProposal(p: Pick<Proposal, 'status'>): boolean
export function isHomeownerVisibleProposal(p: Pick<Proposal, 'status'>): boolean
export function listableProposalSql(col: SQL | AnyPgColumn): SQL         // `status IN (<LISTABLE_STATUSES>)` — col = the column or sql`p.status` in a raw subquery
export function homeownerVisibleProposalSql(col: SQL | AnyPgColumn): SQL // `status IN (<HOMEOWNER_VISIBLE_STATUSES>)`
```

**Applied in spec A — every agent-side read that lists or counts proposals:**

| Read | file:line | Change |
|---|---|---|
| `listProposals` | `core/dal/server/queries.ts:164-278` | `buildFilterWhere` is opt-in per key with no default primitive (`dal/server/lib/query/filters.ts:31-56`), so the DAL adds `listableProposalSql()` to the WHERE **unless** `input.includePreDraft === true` (new optional input, threaded through the list procedure; only the meeting flow passes it — D6/S5) |
| meeting `proposalCount` | `entities/meetings/dal/server/queries.ts:179,292` | count only listable (the `hasSentProposal`/`hasApprovedProposal` EXISTS at `:180-181,293-294` are status-specific and unchanged) |
| pipeline items | `features/customer-pipelines/dal/server/get-customer-pipeline-items.ts:187-204` | `count`, `array_agg(DISTINCT status)`, `bool_or(...)` over listable rows only (this is what keeps `compute-fresh-stage.ts:30` correct) |
| customer profile | `features/customer-pipelines/dal/server/get-customer-profile.ts:89-160` | listable rows only |
| customer timeline | `entities/customers/lib/build-timeline-events.ts:54-63` | emit `proposal_created` events for listable proposals only |
| agent dashboard | `features/agent-dashboard/**` reads (`get-action-queue.ts`, `dashboard-proposals.tsx`) | via `listProposals` where they use it; direct queries get the SQL fragment |

The plan's first task greps `from(proposals)` / `proposals.id` across `src/` and lists every hit against this table so none is missed.

**Defined here, applied by spec F (SA5):** `isHomeownerVisibleProposal` / `homeownerVisibleProposalSql` are consumed by spec F's single token resolver (H11) — the token path today compares tokens by hand in four places (`shareable-middleware.ts:39-48`, `views/service.ts:57-66`, the PDF and AI-summary routes), and wiring a status check into each is the scattered-compare problem H11 exists to remove. #285 owns the token path's security posture (C19/C24).

### 4.6 SOW child service — engine-shaped, content-only (P6, S6 · C5, C8, C56)

New unit `modules/proposals/sow/` (the shape of `incentives/`, `media/`), reached as `proposalService.sow`. Its verbs carry the **engine's slot signatures** (`dal/server/types.ts` `CrudHandlers`) from day one, so W4 replaces their bodies with a `...proposalSowItemCrud` spread and changes no caller:

```ts
// modules/proposals/sow/service.ts
export type SowSectionFields = Omit<SOW, 'id' | 'financials'>            // trade, scopes, title, contentJSON, html, painPoints, notes
export interface SowSectionInsert extends SowSectionFields { proposalId: string; id?: string }

getById(ctx, { id }): DalReturn<SOW | undefined>                          // id = section id
create(ctx, input: SowSectionInsert): DalReturn<SOW>                      // appends (array index = W4 `position`)
update(ctx, { id, data: Partial<SowSectionFields> }): DalReturn<SOW>
delete(ctx, { id }): DalReturn<void>
```

- **Content only.** `SowSectionFields` has no financial keys: `sectionPrice`, cost lines and section incentives are written by the **whole-SOW save** only — today the editor's `projectJSON` write, in W4 `replaceProposalSow` / `proposals.sow.replace` (the locked names, amendments §R.5). W4 makes cost lines and section incentives sibling rows (`proposal_cost_lines`, `proposal_incentives(sow_item_id)`) with their own replace-all; keeping money out of the per-section verbs means they never become a second financial write path and W4 designs one rollup story, not two. The Zod input for `create`/`update` derives from `sowSchema.omit({ id, financials }).strict()` (`sow/schemas/index.ts`: `sowSectionFieldsSchema`, `sowSectionInsertSchema`, `sowSectionUpdateSchema`), so a payload carrying `financials` is rejected, not silently stored.
- **Bodies today (blob-backed).** `create`: `proposalService.getById(ctx, { id: input.proposalId })` (scoped — an invisible proposal is `not-found`, the media unit's parent-probe rule) → append `{ ...createEmptySowSection(), ...fields, id }` to `projectJSON.data.sow` → `proposalService.update(ctx, { id: proposalId, data: { projectJSON } })`. `getById` / `update` / `delete`: resolve the owning proposal from the section id with one scoped query (`sow/dal/server/queries.ts:getProposalBySowSectionId` — `project_JSON->'data'->'sow' @> '[{"id": <id>}]'::jsonb` AND `ctx.scope`; section ids are uuids, unique across proposals; the table is a few hundred rows — this locator is an internal detail that dies with the blob) → rebuild the array → the same `proposalService.update`. Routing through the update slot means the lock gate, the `pre-draft` promotion (§4.4) and the rollup re-drive all fire (`crud.ts:50-75`).
- `update` replaces the named fields from `data`; nested arrays (`scopes`, `painPoints`) are **replaced wholesale, never shallow-merged** (`jsonb-columns.md#never-shallow-merge-nested`). "Toggle a scope" is `update({ id, data: { scopes } })` with the full new list — and **replacing `scopes` drops the section's cost lines whose `relatedScopeId` is no longer among the new scope ids** (the server twin of the editor's cascade, `sow-field.tsx:82-92`; section incentives untouched — SA17, W4's R7 keeps it). Unknown `id` ⇒ `not-found`. `create` with an `id` already present on any proposal ⇒ `precondition-failed: sow_section_exists`.
- No transaction (W4 ruling R.1): each verb is one read and one write. Two agents editing the **same proposal** concurrently can lose an update until W4 makes sections rows — a known, W4-resolved hazard, recorded in the DOCS. A single device's rapid edits are serialized by its own write queue (the Specialties provider debounces and never overlaps writes).
- **W4 landing.** The unit gains `server-spec.ts` (`parent: { spec: proposalServerSpec, fk: proposalSowItems.proposalId }`, parent `caslSubject`, no own visibility — the `incentives/` shape as built) and `dal/server/crud.ts` (config-factory hooks carrying the child-row lock gate + promotion, §4.4 / B7 / q8); `service.ts` becomes `{ ...proposalSowItemCrud, replace /* = replaceProposalSow */, clone }`. The four verbs above ARE the spread; nothing that calls them changes. The engine's fifth slot (`duplicate`) arrives with it (W4 decides whether a section duplicate clones its cost lines).
- The proposal editor (Solution tab, spec E; today's edit view) stays a whole-document writer of `projectJSON` — one form submit — until W4's `sow.replace` takes that save over. Spec A adds **no** whole-SOW verb of its own: `sow.*` is for per-section edits from surfaces that never hold the whole document (Specialties, spec D).

tRPC exposure lands with spec D (its first consumer) as **`proposals.router/sow.router.ts` → `proposalsRouter.sow.{create,update,delete}`** (`proposalProcedure` mutations) — the same `sow` leaf W4's locked `proposals.sow.replace` joins, so the client sees one namespace. Spec A ships the service + smoke test only (no dead procedures).

### 4.7 Seed function; the auto-snapshot retires (P8, S3 · C27)

`core/lib/seed-sow-sections.ts`:

```ts
export function seedSowSections(requested: TradeSelection[]): SOW[]
// each entry → createEmptySowSection({ trade: { id: tradeId, label: tradeName }, scopes: selectedScopes, painPoints, notes })
```

Pure, deterministic except for the fresh `id` per section. It is the **one** mapping from requested trades to SOW sections — spec C's create dialog uses it for both the preview and the payload; spec D's migration and the `initialRequestedTrades` re-point use it; today's proposals-table create path uses it now:

- `snapSowFromMeeting` is **deleted** with its only caller (`crud.ts:39`). It ran only when the payload had no `sow`, and the UI always sends one — deleting it changes no UI path. It must go because it makes "Blank" impossible (C27). W4's amendment B6 / handoff q9 ("rewrite `snapSowFromMeeting` to insert rows") becomes moot — there is nothing left to rewrite.
- `features/meeting-flow/lib/build-proposal-defaults.ts` (only caller: `create-new-proposal-view.tsx:63`) has its **trades half** replaced by `seedSowSections(flowState.tradeSelections)` and its `painPoints → projectObjectives` mapping removed (C29/P4). Its **funding half** (`dealStructure → funding`) stays until spec E retires `dealStructure` (SA6) — that half is owned by D8/D9 and deleting it early would regress the table's create path before the Solution tab exists.
- Server side, create stays the generic `crud.create` (S3). Blank = `sow: []`.

### 4.8 `duplicate.after` engine hook; proposals duplicate config (P10 · C18)

Engine (`shared/dal/server/types.ts:80-96`, `create-crud-dal.ts:262-297`):

```ts
export interface DuplicateAfterMeta<TTable extends PgTable> { source: Row<TTable> }
// CrudConfig.duplicate gains a third key beside exclude/overrides (SA20 — not a CrudSlotHookMap slot, so CrudMutationSlot/CrudHooks/callsite hooks are untouched):
after?: (row: Row<TTable>, ctx: ScopedContext, meta: DuplicateAfterMeta<TTable>) => MaybePromise<Row<TTable> | void>
```

`duplicateImpl` keeps its local `source` (`:275`) and, after `createImpl` returns success, invokes `cfg.duplicate?.after(created, ctx, { source })` inside `dalDbOperation` (a `ThrowableDalError` from the hook becomes a `DalReturn` error), returning the hook's row when it returns one. There is no `duplicate.before` — `duplicate.overrides` already is the before-shaping seam. `CrudMutationSlot`/callsite hooks are unchanged (`duplicateImpl` still takes `'create'` callsite hooks). Entities without the hook see no change.

Proposals (`core/dal/server/crud.ts`):

```ts
duplicate: {
  async after(row, ctx, { source }) {
    const cloned = dalVerifySuccess(await cloneGlobalIncentiveRows(source.id, row.id))
    if (cloned === 0) return
    const { finalTcpCents } = dalVerifySuccess(await recomputeProposalFinancials(row.id))
    return { ...row, finalTcpCents }
  },
},
```

Sequential, no transaction (R.1, exactly as the override does today). The clone is the DAL function `cloneGlobalIncentiveRows` (`incentives/dal/server/mutations.ts`, today's `clone` body) because a DAL module never imports a service; the zero-caller service verb `proposalIncentivesService.clone` is **deleted** (SA20). `proposalService.duplicate` (`service.ts:60-72`) is **deleted**; `crud.router.ts` wires `crud: proposalService` (SA9) so the header comment at `:6-12` is true again and the working-tree swap to `proposalCrud` (X7) is resolved in the direction that keeps the service as the one server API. Duplicate now behaves identically from the proposals table, the meeting flow (spec C's switcher) and any script. `duplicate.exclude` gains `sentMessage`; `duplicate.overrides` (already a function of the source row, `types.ts:126`) returns `status: 'pre-draft'` and `projectJSON: regenerateSowSectionIds(source.projectJSON)` — a pure helper in `core/lib/`; the C3 inputs travel inside the blob untouched. Section ids are **regenerated** on the copy because they are the copy's future row PKs. **W4:** the `projectJSON` override dies with the blob, and `proposalService.sow.clone({ sourceId, targetId })` (sections + cost lines + section incentives, ids remapped) joins `incentives.clone` inside this same `duplicate.after` — the handoff's "extend duplicate" item lands in the hook, not in a second override (SA14).

### 4.9 A proposal must be attached to a meeting (D11 · C38)

Schema: `meetingId: uuid('meeting_id').notNull().references(() => meetings.id, { onDelete: 'restrict' })`. `insertProposalSchema` then requires `meetingId` (drizzle-zod infers it). `create.before` loses its no-meeting branch (`crud.ts:29-32`); a `meetingId` that resolves to no meeting ⇒ `precondition-failed: meeting_not_found`; `deriveProposalKind(meeting.projectId)` takes the meeting's value directly. Meeting delete on a meeting with proposals surfaces the FK restrict as `precondition-failed: meeting_has_proposals` from the meetings `delete.before` hook (count + clear message), rather than a raw Postgres error.

Push: the column exists and is nullable, so this is `ALTER COLUMN … SET NOT NULL` + an FK action change — not a new NOT NULL column, so no `truncate` plan (the plan still greps the generated SQL for `truncate` before every push). Pre-check on prod, read-only: `SELECT count(*) FROM proposals WHERE meeting_id IS NULL;` — any rows are hand-assigned via "Assign to meeting" (spec B) or by SQL under the owner's eye **before** the tighten. Dev push per commit (`pnpm db:push:dev`); prod = Push 1 (§8).

### 4.10 DOCS (K2)

`modules/proposals/core/DOCS.md`: lifecycle diagram gains `pre-draft →`; new rules `#pre-draft-status`, `#listing-visibility` (both predicates, who applies which), `#readiness-predicate`, `#send-verb` (write-before-deliver rationale), `#sow-rep-inputs` (C29 classification; `notes` on the never-to-homeowner list), `#sow-section-ids`, `#sow-child-service` (CRUD-shaped, no-tx hazard, W4 mapping), `#proposal-requires-meeting`; `#sow-snapshot-from-meeting-on-create` retired; `#duplicate-resets-and-redrives` rewritten for the hook; `#kind-derived-from-meeting-project` loses its no-meeting sentence; `#proposal-lock-ladder` notes `sentMessage` as lifecycle. Footer date updated. Meetings DOCS `#trade-selections-snapshot-source` is spec D's (K1) — this spec only points it at the seed.

### 4.11 W4 alignment — the contract with SOW normalization (C5, C56–C61)

W4 (`docs/plans/2026-07-26-wave-4-design-handoff.md` + `docs/plans/2026-08-25-wave-4-pre-design-amendments.md`, owner rulings §R of 2026-09-09, names locked in `3998e85b`) is being designed now and ships soon. Its prep items (amendments A1–A6) have **not** landed at `372448a7`: `calc_version` is still `default(1)` with no `CURRENT_CALC_VERSION`, `incentiveTypes` still lives in `core/schemas/`, `proposal_incentives.sow_item_id` has no FK or index — spec A touches none of them. Every seam spec A introduces maps onto W4 as follows; the W4 design session reads this table as an input, and spec A never widens W4's migration.

| Spec A seam | W4 counterpart (locked name where one exists) | What W4 does to it | Spec A must not |
|---|---|---|---|
| `sow[].id` — required, backfilled (§4.1) | `proposal_sow_items.id` | lifts the id verbatim: the data migration is a pure lift (no minting, no remap); `proposal_incentives.sow_item_id` (A6) gets real targets | mint ids at read time; regenerate on save |
| array index (§4.1) | `position` | `ORDER BY position` replaces array order | reorder inside `sow.update` |
| `painPoints: string[]`, `notes?: string` (§4.1) | two columns on `proposal_sow_items` — an identity-free value array (Addendum B: replaced whole, never SQL-queried) and `text` | adds both in its DDL; `toSowInputs` hydrates them | store rep inputs anywhere but the section |
| `trade` / `scopes` (unchanged) | `trade_id` / `trade_label` on the section row + **`proposal_sow_scopes` rows** (Q2 ruled 2026-09-22, re-grounding §6) | lifts each `scopes[]` entry into a row (`position` = array index) | change their shape (the Construction epic owns the reference primitive) |
| `proposalService.sow.{getById,create,update,delete}` (§4.6) | `...proposalSowItemCrud` — spec + config-factory hooks in `modules/proposals/sow/` | replaces the four bodies with the spread; the child-row lock gate + promotion live in its hooks (B7 / q8) | give the verbs a non-engine signature; admit financial fields |
| the whole-SOW save (editor's `projectJSON` write, untouched) | `replaceProposalSow` + `proposals.sow.replace` (§R.5) in the same unit + leaf | one DAL abstraction, one tRPC leaf, sequential writes, no tx (§R.1, §R.3); keyed sections are possible because the form round-trips ids (B3) | add a competing whole-SOW verb; build `sow.replace` itself |
| `getProposalReadiness({ status, sow })` (§4.2) | input from `toSowInputs(row)` (§R.5, the `toFundingInputs` twin) | changes one call site | read `projectJSON` inside the predicate |
| `pre-draft` promotion = the lock gate's twin (§4.4) | the gate's new home for child rows (B7 / q8) | moves both together | put promotion anywhere the gate is not |
| `duplicate.after` = `cloneGlobalIncentiveRows` + recompute (§4.8) | `+ sow.clone` (sections, scope rows, cost lines, section incentives, ids remapped — a DAL function called from the same hook, SA20) — the handoff's "extend duplicate" item | adds one call to the hook; the `projectJSON` id-regeneration override dies with the blob | clone anything outside the hook |
| `recomputeProposalFinancials` calls (§4.3, §4.6, §4.8) | the chokepoint's pure-SUM rewrite + `CURRENT_CALC_VERSION` stamping (A1) | rewrites the body; callers unchanged | touch the formula or `calc_version` |
| `snapSowFromMeeting` deleted (§4.7) | B6 / q9 ("rewrite it to insert rows") | moot | — |
| `listableProposalSql()` on `listProposals`, `get-customer-profile.ts`, `get-action-queue.ts` (§4.5) | B5: a `firstTrade` / `sowSummary` projection + one proposals DAL read replacing the positional SQL | its replacement reads keep the predicate | rewrite the positional SQL |
| `proposal_incentives.sow_item_id` (untouched) | section-incentive rows with `sow_item_id` set; the `IS NULL` predicate is already live (`5c721a83`) | flips the recompute's section term to rows | write a non-null `sow_item_id` before W4 — the rollup ignores such rows today (the global sum excludes them, the jsonb term never sees them), so an applications-epic incentive bound to a section id would silently not reduce price until W4 (SA16, tracker Q25) |
| Push 1 — `sent_message`, `meeting_id` NOT NULL (§8) | W4's own push (tables, freezes, the W3 frozen-column drops) | separate push, separate go | ride W4's push, or make W4 wait for Push 1 |

**Landing order (SA15).** Spec A is seven small commits and is designed to land **before** W4's cutover; W4 then builds on the ids, `painPoints` / `notes`, the `sow/` unit and the promotion helper. If W4 cuts over first, A3's blob half collapses into W4's DDL (ids from row PKs, `pain_points` / `notes` as columns, no backfill script) and A7's `sow` bodies are written as the crud spread directly — the signatures, callers, smoke assertions and DOCS rules are the same either way. Whoever lands second does the textual merge (amendments §C.3) on the shared files — `db/schema/proposals.ts`, `core/schemas/index.ts`, `core/dal/server/crud.ts`, `service.ts`, `core/dal/server/queries.ts` — and every spec A hunk in them is additive.

**Names introduced (amendments §R.5: new names get the owner's sign-off before use):** `pre-draft` · `sentMessage` / `sent_message` · `includePreDraft` · `getProposalReadiness` / `assertProposalReady` / `ReadinessReason` / `ReadinessInput` · `isListableProposal` / `isHomeownerVisibleProposal` / `listableProposalSql` / `homeownerVisibleProposalSql` / `LISTABLE_STATUSES` / `HOMEOWNER_VISIBLE_STATUSES` · `shouldPromotePreDraft` · `seedSowSections` · `regenerateSowSectionIds` · `SowSectionFields` / `SowSectionInsert` · `proposalService.sow` + `proposals.sow.*` (the leaf W4's `sow.replace` joins) · `DuplicateAfterMeta` / `duplicate.after` · `proposalService.send` · `scripts/backfill-sow-section-ids.ts` · (plan-time, SA17–SA21) `cloneGlobalIncentiveRows` · `countProposalsForMeeting` · `getProposalBySowSectionId` · `sowSectionFieldsSchema` / `sowSectionInsertSchema` / `sowSectionUpdateSchema` / `SowSectionUpdate` · `ProposalReadiness` · `READINESS_REASON_LABELS` · `scripts/verify-proposal-foundations.ts`. Removed: `proposalIncentivesService.clone`. Reused, not new: `recomputeProposalFinancials`, `createEmptySowSection`, `touchesFrozenLockedFields`; W4's own `toSowInputs`, `replaceProposalSow`, `proposalSowItemCrud`.

## 5. Decisions taken in this spec (mirrored to the tracker as C47–C61)

| Id | Decision |
|---|---|
| SA1 (C47) | SOW section ids are **required** by the schema and **backfilled once** by an idempotent script over `projectJSON` (no read-time default — that would mint a new id per read). The client generates ids in `createEmptySowSection`. |
| SA2 (C48) | Readiness v1 = ≥ 1 section with a trade id, and not `declined`. Approved proposals may be re-delivered; their status is untouched. |
| SA3 (C49) | The send verb **writes before it delivers** (C20 makes homeowner visibility depend on `sent`); a delivery failure leaves the row `sent` and surfaces the error. |
| SA4 (C50) | `delivery.sendProposalEmail` keeps its name, input and link mechanism in spec A; the access-mechanism grill (Q14) renames/rewires it. |
| SA5 (C51) | H15 is split: spec A defines both predicates and applies `isListable` on every agent-side read; spec F applies `isHomeownerVisible` inside its single token resolver (H11). |
| SA6 (C52) | `snapSowFromMeeting` is deleted; `buildProposalDefaults` keeps only its funding half until spec E deletes `dealStructure` (D8/D9); its trades half is `seedSowSections`. |
| SA7 (C53) | The `status` column default stays `'draft'`; `create.before` is the rule that makes every create `pre-draft`; existing rows are not reclassified. |
| SA8 (C54) | The SOW child service is sequential and un-transacted (W4 R.1); concurrent editing of one proposal by two agents is a known, W4-resolved hazard, documented. tRPC exposure of `sow.*` lands with its first consumer (spec D). |
| SA9 (C55) | `crud.router.ts` wires `crud: proposalService` (the service is the one server API); the duplicate override is deleted, not moved. |
| SA10 | Media uploads do not promote `pre-draft` (a photo is not authorship). Spec-time detail, not a tracker row. |
| SA11 (C56) | `proposalService.sow` verbs are **engine-shaped** (`getById` / `create` / `update` / `delete`, `{ id, data }`) and **content-only** (`SowSectionFields = Omit<SOW, 'id' \| 'financials'>`), positioned by array index; W4 replaces the bodies with `...proposalSowItemCrud`. Home `modules/proposals/sow/`; tRPC leaf `proposals.router/sow.router.ts` = `proposals.sow.*`, the leaf W4's locked `proposals.sow.replace` joins. Financial fields belong to the whole-SOW save only. |
| SA12 (C57) | Readiness takes the **domain** SOW list (`{ status, sow }`), never the `projectJSON` column; callers pass `row.projectJSON.data.sow` today and `toSowInputs(row)` after W4. |
| SA13 (C58) | `pre-draft` promotion is the lock gate's twin: one helper (`shouldPromotePreDraft`), same probe, same site, same field set; when W4 moves the gate into child-row hooks the promotion moves with it. |
| SA14 (C59) | Proposal duplicate regenerates section ids in `duplicate.overrides` (`regenerateSowSectionIds`, pure); in W4 that override dies and `sow.clone` joins `incentives.clone` inside `duplicate.after`. |
| SA15 (C60) | Spec A lands **before** W4's cutover; §4.11's either-order rule covers the reverse (A3's blob half collapses into W4's DDL, A7's bodies become the spread). Spec A touches none of W4's prep items A1–A6. |
| SA16 (C61) | Until W4, `proposal_incentives.sow_item_id` stays NULL on every written row — the rollup ignores non-null rows today. Constraint recorded for the applications epic (Q25). |
| SA17 (C62) | *Plan-time.* `sow.update({ scopes })` drops the section's cost lines whose `relatedScopeId` is no longer among the new scope ids (server twin of the editor's cascade); section incentives untouched; W4's R7 keeps the rule. |
| SA18 (C63) | *Plan-time.* The envelope-creation readiness gate lives in `contractService.createDraft` (the router loads no row); `createContractDraft` / `resendContract` map its `ThrowableDalError` through `dalToTrpc(dalError(…))`. |
| SA19 (C64) | *Plan-time.* `projectJSON` gains no `_v` (jsonb-columns `#mandatory-schema-version` waived): W4 freezes the blob; the id backfill is the shape marker. |
| SA20 (C65) | *Plan-time.* `duplicate.after` is a `CrudConfig.duplicate` key (beside `exclude`/`overrides`), not a `CrudSlotHookMap` slot. The hook clones through the DAL function `cloneGlobalIncentiveRows`; `proposalIncentivesService.clone` is deleted (DAL never imports a service). W4's `sow.clone` takes the same shape. |
| SA21 (C66) | *Plan-time.* `painPoints` required (no `.default` — zodResolver input/output parity; the backfill stamps `[]`); `LISTABLE_STATUSES` / `HOMEOWNER_VISIBLE_STATUSES` in `constants/enums/proposals.ts`; promotion respects an explicit `status`; the table's status dropdown disables `pre-draft` and its filter offers `LISTABLE_STATUSES`. |

## 6. Commit sequence (each `pnpm tsc` + `pnpm lint` clean; stage by path, never `git add -A`)

1. **A1 — engine:** `duplicate.after` slot + `DuplicateAfterMeta` + `duplicateImpl` threading. No entity uses it yet; behavior unchanged.
2. **A2 — duplicate:** proposals `duplicate.after` config; delete `proposalService.duplicate`; `crud.router.ts` → `proposalService`; DOCS `#duplicate-resets-and-redrives`. Smoke: duplicate clones global incentives and re-drives the rollup from the router path.
3. **A3 — SOW shape:** `id`/`painPoints`/`notes`; `min(1)` removed; `sow: []` default + form empty state; `createEmptySowSection` id; `duplicate.overrides` → `regenerateSowSectionIds`; the form's duplicate-section regenerates the section id; `scripts/backfill-sow-section-ids.ts` (run on dev); readers per §4.1.
4. **A4 — pre-draft + visibility:** enum value; `create.before` / `duplicate.overrides` set it; `proposal-pre-draft.ts` (`shouldPromotePreDraft`) called from `update.before`; badge case; `proposal-visibility.ts`; every consumer in the §4.5 table (`listProposals` + `includePreDraft`).
5. **A5 — readiness + send:** `proposal-readiness.ts`; `sentMessage` column (dev push); `proposalService.send`; delivery router adapter; contracts gate; heading display; `duplicate.exclude` + `sentMessage`.
6. **A6 — seed:** `seed-sow-sections.ts`; delete `snap-sow-from-meeting.ts`; `buildProposalDefaults` trades half onto the seed, objectives mapping removed.
7. **A7 — meeting required:** schema `notNull` + `restrict` (dev push after the dev pre-check); `create.before` branch removed; meetings `delete.before` message; `sow/` unit (`service.ts`, engine-shaped content-only verbs, §4.6) + smoke; DOCS rules (§4.10); tracker ticks.

A7 carries the SOW service so its smoke test runs against the final schema. A2 before A3 keeps the duplicate fix (X7) isolated and first.

## 7. Verification

- **Per commit:** `pnpm tsc` + `pnpm lint` (V1). Never `pnpm build`.
- **Smoke script** `scripts/tmp-smoke-proposal-foundations.ts` (the `tmp-smoke-proposals-module.ts` shape: `import './lib/load-env'`, refuses `DRIZZLE_TARGET=prod`, `SMOKE-…` rows deleted in `finally`; run with `DRIZZLE_TARGET=dev QSTASH_TOKEN= NODE_OPTIONS=--conditions=react-server pnpm tsx …`). Asserts, against the dev DB: create ⇒ `pre-draft`; duplicate ⇒ `pre-draft`, incentives cloned, `finalTcpCents` re-driven, fresh section ids (the source's untouched), `sentMessage` null; `label` update promotes to `draft`; `status`/`sentAt`/`sentMessage` update does **not** promote; `listProposals` hides pre-draft, shows it with `includePreDraft`; meeting `proposalCount` ignores pre-draft; `send` refuses zero-SOW (`proposal_not_ready:no-sow-section`) and declined; first `send` stamps `sentAt` + `sent` + message; resend keeps `sentAt`, replaces the message; `sow.getById/create/update/delete` round-trip by section id alone (the owning proposal resolved from the id), promote, re-drive the rollup, reject unknown ids, reject `financials` in `data` at the Zod input, append on create and compact on delete with order preserved; create without `meetingId` is rejected by Zod; create with a missing meeting ⇒ `meeting_not_found`; meeting delete with proposals ⇒ `meeting_has_proposals`. (V2)
- **Backfill script:** `--dry-run` reports rows/sections lacking ids; the real run is idempotent (second run reports 0).
- **Playwright (standalone script, per the repo's auth session route):** proposal edit view opens a zero-section proposal and shows the empty state; the proposals table hides a pre-draft and shows it once its label is edited; Send is disabled with the readiness reason on a zero-SOW proposal; the homeowner page shows the stored note.
- **Push preflight:** generated SQL grepped for `truncate` (must be absent); prod pre-checks run and reported before the owner's go.

## 8. Coordination

- **Push 1** (tracker §0): this spec's `proposals` half — `sent_message`, `meeting_id` NOT NULL + `restrict` — ships to **dev** per commit and to **prod** in one push with spec D's `meetings` half (`initial_requested_trades`, pgEnum → text, `proposal_created` retired, sentiment values). Runbook order on prod: pre-checks → `backfill-sow-section-ids` → push → deploy the code that requires ids (and that selects `sent_message` — DDL before deploy, the W3 walkthrough's ordering). W4's B9 cutover rules apply: fresh Neon snapshot first; run `db:push:prod` from a tree whose `src/shared/db/schema` is exactly the deployed commit; generated SQL grepped for `truncate`. The owner gives the prod go separately; nothing here assumes it.
- **#285 (permissions):** the token path is untouched; `sentMessage` is homeowner-visible by intent, `sow[].notes` joins the projection's never-to-homeowner list (H10) — recorded in DOCS for #285 to pick up.
- **W4 (SOW normalization — in design now, ships soon):** §4.11 is the contract — seam-by-seam mapping, landing order (spec A first; either-order rule), the shared-file merge list and the names list for §R.5 sign-off. Nothing here widens W4's migration; several W4 items shrink (B6/q9 moot, ids pre-lifted, the `sow` unit and leaf pre-built).
- **Construction Data epic:** the `TradeSelection` / `constructionItem` shapes are unchanged; its row consolidation reshapes them later for everyone.
- **Feature-layering epic:** nothing moves between layers; `buildProposalDefaults` stays in meeting-flow until spec E deletes it.
- **Specs C/D/E/F/G** consume: the seed (C, D), `includePreDraft` (C), `sow.*` (D), the visibility predicates (F), `sentMessage` display on the shared document surface (F, G).

## 9. Follow-ups — not in this spec

- Spec F: apply `isHomeownerVisible` in the single token resolver; the old-link validation; link producers (H7). Spec D: `sow.*` tRPC procedures + Specialties re-point; `initialRequestedTrades` and the seed re-point; the migration script. Spec E: delete `dealStructure` and the remaining half of `buildProposalDefaults`. Spec B: "Assign to meeting" (uses the `restrict` + same-customer hook).
- `get-customer-profile.ts:99,101` positional SQL → W4 (B5).
- W4 picks up (§4.11): `replaceProposalSow` + `sow.replace` in the `sow` unit/leaf; `sow.clone` in `duplicate.after`; `toSowInputs` as readiness's input; the child-row lock gate + promotion site; `pain_points`/`notes` columns; `position` from array index; A1's `CURRENT_CALC_VERSION`.
- Stale pre-draft cleanup job — not planned; filtered, not deleted (C43).
- Renaming `sendProposalEmail` and changing the link mechanism — the access grill (Q14).
- Tracker citation fix: P13 cites `meetings/dal/server/queries.ts:180,293` for `proposalCount`; the count is at `:179,292` (`:180,293` is `hasSentProposal`). Fixed in the tracker alongside this spec.
