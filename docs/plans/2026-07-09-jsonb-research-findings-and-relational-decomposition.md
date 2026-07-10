# JSONB Research Findings & Relational-Decomposition Investigation

> **Status**: Research complete (2026-07-09), NO decisions made yet. This doc preserves a 4-agent
> deep-research session (implementation audit, design-pattern research, ORM prior art, app-wide
> JSONB inventory) so future sessions don't redo it. It also frames the NEXT investigation:
> whether to decompose some JSONB columns into relational tables.
>
> Related: `docs/plans/2026-06-27-jsonb-deep-merge-implementation-plan.md` (the plan that produced
> the current code) · `docs/codebase-conventions/jsonb-columns.md` · ADR-0005 ·
> `src/shared/dal/server/lib/create-crud-dal.ts` · `src/shared/dal/server/lib/deep-merge-jsonb.ts`

## 1. Why this research happened

The `jsonbMergeColumns` deep-merge mechanism in `create-crud-dal.ts` (three one-off module
helpers + a branching `SELECT FOR UPDATE` transaction inside `updateImpl`) was flagged as
convoluted, unreadable, and semantically off. Research verdict: **the convolution is the symptom,
not the disease** — the audit found correctness problems more serious than readability, and the
inventory found the mechanism protects columns that don't need it while missing the ones that do.

## 2. Audit findings (severity-ranked)

| # | Finding | Severity |
|---|---------|----------|
| 1 | **Doc/code contradiction**: `jsonb-columns.md` claims "Zod re-parse of the merged whole"; code validates only the *patch* pre-merge (`create-crud-dal.ts` merge path) — merged result written unvalidated. A patch can blend discriminated-union variants (`leadMeta.source.kind`) into an invalid document. | HIGH |
| 2 | **Doc/code contradiction**: `dal-conventions.md` promises partial upsert "at any depth" and forbids reload-and-spread; update schemas only `.partial()` the **top level**, so nested partials are rejected by Zod before the merge runs. For proposals the deep recursion is unreachable dead code; for `leadMeta.source` a doc-following caller must resend the whole `source` and can clobber real UTM attribution. | HIGH |
| 3 | **Silent hook-skip**: fast path prefetches `previousRow` only for after-hooks and silently discards failure — update commits but after-hook never fires. Defeats customers' "strict dispatch" GCal guarantee for scalar-only updates (name/phone/**address** — exactly what GCal renders). | MED-HIGH |
| 4 | **Silent degradation in `resolveMergeKeys`**: registered `PgColumn` matched by **reference identity** against `spec.table`; a non-matching column (aliased table, different module instance) silently yields zero merge keys → entity silently falls back to shallow replace — the exact data-loss bug the feature exists to prevent. No `keys.size === mergeCols.length` check. Root cause: spec stores column *objects* where sibling config (`primaryKey`, `tokenColumn`) stores key *strings*. | MED-HIGH |
| 5 | `formMetaJSON` has effectively **no runtime validation** (drizzle-zod permissive fallback; `formMetaSectionSchema` exists but isn't wired into the insert schema) — violates `jsonb-columns.md#zod-parse-at-write-boundary`. | MED |
| 6 | Documented **null-clears-column is unreachable for all 7 registered columns** (Zod `.optional()` not `.nullable()`, or `NOT NULL` DB constraints). Dead documented behavior. | MED |
| 7 | Two-path duplication is **semantic**: merge path = transactional, locked, consistent `previousRow`; fast path = non-transactional, racy `previousRow`. Same entity's after-hook gets different consistency guarantees depending on payload shape. Undocumented. | MED |
| 8 | The three helpers (`resolveMergeKeys`, `updateTouchesMergeColumn`, `buildMergedUpdateData`) are **unexported** — the "pure function for testability" rationale is stranded (and the repo has zero tests). `deepMergeJsonb` itself is clean, exported, and fine. | MED |
| 9 | `precondition-failed` (→ HTTP 412) thrown for a server-side programming error (malformed merge payload) — everywhere else it means a business-state precondition. Nearly-dead branch, low blast radius. | LOW-MED |

Not pain points (adjudicated honestly): the fast/merge two-path *decision* (locking every scalar
update would be worse), after-hook firing post-commit, scope predicate on the locked read,
`deepMergeJsonb` itself.

## 3. App-wide JSONB inventory (2026-07-09 snapshot)

26 JSONB columns in `src/shared/db/schema/`. Zero `_v` adoption anywhere despite
`jsonb-columns.md#mandatory-schema-version`.

### Registered merge columns (7) — and the decisive finding

**No caller anywhere sends a bare partial through the CRUD merge path.** Every partial-intent
caller reload-and-spreads client/server-side first, or bypasses the CRUD entirely.

| Column | Reality |
|--------|---------|
| `customers.customerProfileJSON` / `propertyProfileJSON` / `financialProfileJSON` | Merge IS the right semantics, but all callers (meeting-flow, edit form, contracts router age-patch) pre-spread from possibly-stale cache — undermining the atomicity the row lock provides. |
| `customers.leadMetaJSON` | Registered but **no generic-CRUD partial writer exists**. The only real partial-patcher, `mergeFunnelEnrichment` (`customers/dal/server/mutations.ts`), deliberately bypasses CRUD with raw `jsonb_set ... ||` — for atomicity AND to skip geocode/GCal hooks (a real requirement to preserve). |
| `proposals.formMetaJSON` / `projectJSON` / `fundingJSON` | Every writer sends **whole sections**. Registration protects nobody and **actively costs**: whole documents flowing through merge semantics mean a field the edit form drops is *preserved*, not cleared — field-clearing is structurally impossible (most leaves aren't nullable). |

### Unprotected racy writers (the real gaps)

| Column | Hazard |
|--------|--------|
| `lead_sources.voipConfigJSON` | `setVoipCampaignsPolicy` (`lead-sources/dal/server/mutations.ts`) does an **unlocked read-modify-write** (select → JS spread → update, no tx/lock) patching `campaigns` while preserving `inHouse` — the exact lost-update pattern the merge mechanism was built to kill. Strongest registration candidate (lead-sources has no CRUD spec today, hence hand-rolled). |
| `user.agentProfileJSON` | Headshot upload client-spreads from cache then full-replaces via **raw `db.update`** in `agent-settings.router.ts` (bypasses DAL). Races crop-data/profile-form saves. Nested `headshotCropData.{app,proposal}` is a genuine deep-merge shape. |

### Correct as-is

Whole-document by design (deliberately NOT registered, deep-merge would resurrect deleted keys):
`meetings.contextJSON` / `flowStateJSON` (documented `meetings/DOCS.md`), `voip_campaigns.smsCadence`.
Insert-only/opaque: `bina_webhook_logs.*`, `voip_link_tokens.payloadJson`, `activities.metaJSON`.
Full-replace arrays: `projects.hoRequirements` / `beforeAfterPairsJSON`, `media_files.*`,
`scopes.homeAreas`, `variables.options`, `lead_sources.formConfigJSON`.

### Shape hazards inside merge columns

- **Arrays replace wholesale** — no current caller patches arrays partially, but
  `projectJSON.data.sow[]` (large per-trade objects, 4 levels deep) would wipe siblings if one ever did.
- **Dynamic-keyed map**: `leadMeta.source.enrichment: Record<stepId, {label,value,order}>` needs
  per-key upsert with per-record wholesale replace — served today only by the bespoke `jsonb_set` path.
- **Discriminated union**: `leadMeta.source` (`kind`: bina/generic/funnel) — deep merge recurses
  regardless of `kind`, can blend two variants; nothing re-validates the merged whole (finding #1).

### Real requirements distilled (what any mechanism must actually serve)

1. Preserve sibling keys at **depth 1** — the only depth any real caller patches.
2. Lost-update protection (the race is real and documented as having occurred — funnel enrichment).
3. Wholesale array replacement.
4. Explicit `null` clears column (needed by `agentProfileJSON: .nullish()` callers — once fixed).
5. Per-key upsert into one dynamic map (`source.enrichment`) **with hook bypass**.
6. Fast path for non-merge updates (vast majority: status/timestamps/FKs).
7. Opt-out for whole-document columns.

Serving NO real caller today: recursion below depth 1; proposals' registration entirely;
`leadMetaJSON` CRUD registration; the non-object rejection guard.

## 4. Design-pattern research verdicts

| Pattern | Verdict |
|---------|---------|
| **Policy objects** (declarative per-column write policy in the spec) | **STRONG FIT** — this is what `jsonbMergeColumns` already is, in degenerate form. The public API shape. |
| **Strategy** (small table: policy → write plan) | **STRONG FIT** — the executable half of policy. The three orphan helpers collapse into one strategy lookup + loop. In functional TS a strategy is a named function in a record — no classes. |
| **Single-statement DB-side merge** (concurrency pattern) | **STRONG FIT** — see §5. The one change that deletes the complexity. |
| Middleware pipeline (Chain of Responsibility variant) | PARTIAL — right *future* shape if 3+ write-time transforms accumulate; overweight for one. |
| Decorator | POOR for the merge itself — merge must happen *inside* the write path; a decorator would have to reimplement the whole locked update. Fine as the general extension mechanism (spec spreading), which already exists. |
| Template Method | POOR — `spec.hooks` + `spec.schemas` already IS Template-Method-via-composition; a class ladder would be a regression. |
| Command (GoF) | POOR — but its data-centric cousin is real: the patch-as-data IS the command (RFC 7396, MongoDB `$set`, Hasura operators). |
| **Factory / Abstract Factory (more of it)** | **POOR — the instinct is misplaced.** Pain is behavioral variation at *write time* (Strategy/Policy territory); factories solve *creation* problems. `createCrudDal` is already the right amount of factory. |

Current design is pattern-correct in substance (policy + pessimistic offline lock), pattern-unnamed
in form — an inlined Strategy.

## 5. Prior art & industry consensus

- **No mainstream ORM ships deep-merge for JSON columns.** Prisma ([#5057 open since 2020](https://github.com/prisma/prisma/issues/5057)), Sequelize, TypeORM, Rails, Django, Ecto, SQLAlchemy: replace wholesale. MikroORM shipped merge-by-default *accidentally* and reverted it as a bug ([#5410](https://github.com/mikro-orm/mikro-orm/discussions/5410)). Settled convention: **replace by default, deep-merge as explicit per-column opt-in** — our shape is the industry's landing point.
- **Our semantics have a spec**: [RFC 7396 JSON Merge Patch](https://datatracker.ietf.org/doc/html/rfc7396) (recurse objects, replace arrays/scalars). One deliberate deviation: RFC null **deletes the key**; ours sets the leaf to null. MySQL ships `JSON_MERGE_PATCH()` natively; Postgres doesn't — hence the ecosystem of hand-rolled functions.
- **The canonical single-statement solution** (Hootsuite pattern — [lobocv](https://blog.lobocv.com/posts/recursive_jsonb_merge/), [Medium](https://medium.com/hootsuite-engineering/recursively-merging-jsonb-in-postgresql-efd787c9fad7)): a ~10-line recursive SQL function `jsonb_recursive_merge(a, b)` (jsonb_each + FULL JOIN + recursion), used as `SET col = jsonb_recursive_merge(COALESCE(col,'{}'), $patch)` — **one statement, atomic by construction**: concurrent patches to different keys both survive, no lock, no transaction, no retry. Known guards needed: `COALESCE` for `jsonb_object_agg`-over-zero-rows → SQL NULL, and a type-check for non-object current values. Its `isnull` checks are SQL-NULL (key absent), so JSON `null` in the patch replaces the leaf — matching our current JS semantics; wrap with `jsonb_strip_nulls` for RFC-7396 null-deletes.
- **Drizzle**: no built-in JSONB merge ([#1690](https://github.com/drizzle-team/drizzle-orm/issues/1690)); the documented route is `sql` expressions inside `.set()`. Beware [#2279](https://github.com/drizzle-team/drizzle-orm/issues/2279) (double-encoding — pass patch as explicit `::jsonb`-cast string param). Prior art: [`@denny-il/drizzle-pg-utils`](https://github.com/denny-il/drizzle-pg-utils) (typed `$set`/`$merge`/`$push` builders). `customType`/`$onUpdate` can't see the current column value — merge must live at the DAL/query layer.
- **Neon-specific tax of the current design**: `SELECT FOR UPDATE` requires the **WebSocket interactive-transaction driver** and 3+ network hops per update; a single-statement DB-side merge is **1 hop over the cheap HTTP driver**. This is the strongest quantitative argument for moving the merge into the statement.
- Our current architecture (FOR UPDATE + JS merge) is legitimate — literally what SQLAlchemy maintainers recommend ([#9409](https://github.com/sqlalchemy/sqlalchemy/discussions/9409), the single best prior-art thread for this exact problem). The transaction is the *price* of app-side merge, not incidental complexity — you can't delete it without moving the merge into the statement.
- Optimistic version columns: standard where conflicts are rare + retries acceptable; **poor fit here** (single-statement merge eliminates the problem instead of detecting it).
- Prisma's useful idea: explicit `Prisma.JsonNull` vs `Prisma.DbNull` sentinels to disambiguate JSON-null-value from SQL-NULL-column.

## 6. Recommended redesign direction (NOT yet decided)

1. **Move merge into the statement**: migrate in `jsonb_recursive_merge`; DAL emits it via Drizzle `sql` in `.set()`. Deletes the transaction, lock, dual code path, and 2+ round trips. Keep `deepMergeJsonb` (TS) as executable specification; property-test SQL vs TS so they can't drift.
2. **Keep declarative opt-in, fix encoding**: per-column policy keyed by **TS key string** (like `primaryKey`), validated loudly at factory time (kills `resolveMergeKeys` and its silent degradation). Three helpers → one strategy lookup.
3. **Right-size registrations**: deregister proposals' three sections (fixes can't-clear-fields); route `voipConfigJSON` + `agentProfileJSON` through the mechanism; decide `mergeFunnelEnrichment`'s fate explicitly (preserve its hook-bypass property).
4. **Unify `previousRow`**: one strategy for both paths when an after-hook exists, documented consistency contract, fail loudly instead of silently skipping the hook.
5. **Resolve the doc contradictions** (§2 #1, #2): implement post-merge re-parse (cheap: `RETURNING` + `safeParse`) or amend `jsonb-columns.md`; make nested partials validate (deep-partial patch schemas) or scale back `dal-conventions.md`'s "any depth" promise.

Open questions for the human: SQL-function merge acceptable vs TS-visible logic? RFC-7396
null-deletes-key vs current null-sets-leaf? How aggressively to fix reload-and-spread callers?

**However** — see §7 before investing in any of this. If the load-bearing blobs get decomposed
relationally, much of the merge machinery may become unnecessary rather than needing improvement.

## 7. NEXT INVESTIGATION: relational decomposition of JSONB fields

The stated next step (2026-07-09): investigate whether normalizing some JSONB data into proper
tables/columns is the wiser long-term approach, rather than perfecting merge machinery.

### The key insight from this research

**Needing deep-merge is itself a smell**: it means multiple independent writers patch different
parts of one blob — which is exactly the situation relational columns/rows handle natively
(column-level UPDATE is inherently key-level-atomic; two writers touching different columns of the
same row never conflict). The entire merge mechanism exists to retrofit column-like semantics onto
blobs. Every pain point found (lost updates, can't-clear-fields, validation-vs-merge mismatch,
union blending) is a symptom of storing multi-writer structured data as documents.

### Seed classification from the inventory (hypotheses, to be validated)

**Strong decomposition candidates** (multi-writer, partial-patch, identity-bearing, or queryable):

| Blob | Relational shape hypothesis |
|------|----------------------------|
| `proposals.projectJSON.data.sow[]` | `proposal_sow_items` table (per-trade rows w/ financials — these have identity, ordering, and 4-level nesting today) |
| `fundingJSON.data.incentives[]` | `proposal_incentives` table (discriminated union → type column) |
| `leadMeta.source.enrichment` (dynamic map) | classic child table `customer_enrichment(customer_id, step_id, label, value, order)` — per-key upsert becomes a plain INSERT ON CONFLICT; the whole bespoke `mergeFunnelEnrichment` disappears |
| `customerProfileJSON.additionalPainPoints[]` | child table if pain points ever need identity/querying |
| customer profile trio (flat key-value form data) | could become plain nullable columns on `customers` — every key is flat, enum/bool/string; merge problem vanishes entirely |
| `user.agentProfileJSON` | mostly flat → plain columns; `headshotCropData` stays a small single-writer blob |
| `lead_sources.voipConfigJSON` | `campaigns`/`inHouse` as separate columns or a config table — the racy writer patches exactly one sub-object |

**Keep as JSONB** (single-writer, whole-document, opaque, or schemaless-by-nature):
`meetings.contextJSON`/`flowStateJSON` (UI flow state, whole-doc by design), `bina_webhook_logs.payload`
(raw provider data), `voip_link_tokens.payloadJson` (opaque), `smsCadence` (small single-writer
config), display arrays (`hoRequirements`, `beforeAfterPairsJSON`, `media_files.tags`).

### Decision heuristics for the investigation

JSONB earns its place when: single logical writer · written whole-document · read whole-document ·
schema genuinely fluid or provider-owned · never filtered/joined on in SQL.
Relational earns its place when: multiple independent writers patch parts · items have identity ·
values queried/filtered/aggregated · cross-field invariants need DB enforcement · FKs point at
items · concurrent-write safety matters.

### What the investigation should produce

Per-blob: (a) writer/reader census (already in §3 — verify still current), (b) query-pattern census
(does anything filter/join on blob internals? `jsonb_set`/`->>` usage in SQL), (c) migration cost
sketch (backfill script, dual-write window, caller rewrites), (d) verdict: decompose / keep /
hybrid. Then sequence by pain: `leadMeta.source.enrichment` and `voipConfigJSON` first (active
races), proposals sections next (biggest structural blob), profiles opportunistically.

### Interaction with the merge redesign (§6)

Do NOT build the full merge redesign before this investigation concludes. If decomposition proceeds,
the surviving JSONB population may be small and single-writer enough that the honest answer is
"replace wholesale + no merge mechanism at all," with `jsonb_recursive_merge` reserved for the few
genuine hybrid blobs. Sequencing: decide decomposition scope → then right-size (or delete) the
merge machinery for whatever remains.

## 8. Investigation round 2 (2026-07-09): relational modeling framework + schema grounding

Second research round answering: "how do relational DBs model form/nested data — is it table-per-use-case
+ joins? How do we avoid table-count explosion?" Two agents: external patterns literature + internal
schema grounding.

### 8.1 The answer: tables map to domain nouns, not use cases

**Table-per-use-case / table-per-form / table-per-screen is itself the explosion antipattern** —
table count then grows with screens (unbounded) and every UI redesign is a migration. Doctrine
across the literature (Fowler PoEAA, Karwin SQL Antipatterns, Exasol design principles): one table
per domain entity ("what type of thing does this row represent?"), never per screen. A CRM domain
has ~20–40 nouns total; disciplined normalization is **linear in domain nouns**, not exponential in
use cases. The other real explosion vectors, both named antipatterns with antidotes:
- **EAV** (attribute names as data) — Karwin's verdict: forfeits types/constraints/FKs; his sanctioned
  alternatives include "Semistructured Data" = today's JSONB. Dynamic-keyed maps → JSONB or a plain
  child table, never name-value meta-tables. Don't build `questions`/`answers` meta-tables for forms
  whose fields are known at compile time — that's EAV in a costume.
- **Polymorphic associations** (`commentable_type` + `commentable_id`) — no real FK possible; GitLab
  doctrine: "always use separate tables." Antidotes: per-type FK columns + CHECK (exclusive arc, fine
  for 2–3 types), per-type join tables, or a base table (CTI).

### 8.2 The per-blob decision tree (apply to each nested structure X inside parent P)

1. **X repeats N times per P?** → child table. Mandatory (1NF). The ONLY case a table is required.
2. **Anything external references X or its internals?** → table (or promote the referenced field to a column).
3. **Filtered/sorted/aggregated in SQL?** → columns on P (Fowler's *Embedded Value* — prefix-named
   columns; the most under-used move by document-store-minded teams), or table if also sparse/secured.
4. **Written concurrently with siblings by different actors?** → table/columns (column-level UPDATE
   is natively key-atomic — this is what the whole merge machinery retrofits onto blobs).
5. **Needs DB constraints (NOT NULL/UNIQUE/enum/FK)?** → columns/table.
6. **Else — dynamic keys, provider payloads, replaced-whole, single-writer, draft state?** →
   **JSONB is the correct answer, not a compromise.** Document shape in Zod; no guilt.

One-to-one sub-objects default to **columns on the parent**, NOT a table; break out only for:
sparseness (sea of NULLs), security boundary, hot/cold row-width split, optional subtype, or
different lifecycle/writer. One-to-one tables bought "for tidiness" are pure join tax.

**Discriminated unions** (relevant: `leadMeta.source` kind = bina/generic/funnel): three canonical
mappings — Single Table Inheritance (discriminator + nullable variant columns + per-variant CHECKs;
pick for 2–4 variants sharing most fields), Class Table Inheritance (base + per-variant tables; pick
when divergent AND base is an FK target), Concrete TI (almost never in OLTP). The Postgres-era
default for attribution metadata: **STI for the queried fields + `payload JSONB` for the
variant-specific residue** — promote a field to a column the day a report GROUP-BYs it.

**Form/draft data — the draft–commit split** (dissolves the "form is nested/partial ⇒ domain tables
must be" fallacy): in-flight wizard state = one JSONB draft row (partial, invalid, single-writer,
replaced-whole — textbook JSONB); on submit, validate whole payload against the domain Zod schema,
write proper relational rows in ONE transaction, archive the draft. Draft state is workflow data;
committed state is domain data — different invariants, lifetimes, consumers, representations.

**Table count is a non-cost in Postgres**: official limits page doesn't even worry about it
(~1.4B relations cap; someone hit 1.3M tables before the filesystem died). Real budget = cognitive
load (mitigated by naming tables after nouns the business already says), DAL boilerplate (amortized
by our CRUD factory), migration count (each ALTER smaller/safer than reshaping a blob in app code —
JSONB doesn't eliminate migrations, it makes them invisible and lazy-evaluated at read time).
Columns are cheap too (TOAST) — which is why "columns on parent" keeps table count down WITHOUT blobs.

**Query-side**: reads reassemble nested shapes in ONE round trip (`json_agg`/lateral joins; Drizzle
RQB `with:` compiles to a single statement — though our house style is manual joins + batch-fetch by
`inArray`, see `meetings/dal/server/participants.ts` anti-LEFT-JOIN doctrine). Writes are where
decomposition pays daily: per-row UPDATE is atomic, concurrent-safe, WAL-cheap — the JSONB
equivalent rewrites + re-TOASTs the whole document and races concurrent section editors.

Key sources: Karwin *SQL Antipatterns* · Fowler PoEAA (Embedded Value, Serialized LOB, STI/CTI) ·
Vernon *Effective Aggregate Design* · Heap "When to Avoid JSONB" (no per-key planner stats — 0.1%
hardcoded selectivity; >2× disk; recovered 30% promoting 45 hot fields) · Cybertec/Albe ·
DanLevy "The JSONB Seduction" ("the debt is the gap between what you told yourself you built and the
undocumented schema-on-read system you actually built") · GitLab polymorphic-assoc doctrine.

### 8.3 Internal grounding: the fear dispelled with our numbers

- **Schema census: 42 tables** (40 files; auth.ts holds 4). 15 core entities, 11 catalog/config,
  **7 `x_` junctions + 9 child/log/infra = 16 tables (38%) already parent-child** — child tables are
  the existing house style, not a new idiom.
- **Marginal cost of a table is already two-tier doctrine**: full entity (8 steps, server-spec,
  CASL, router — only 11 of 42 tables have a server-spec) vs **child table owned by parent entity**
  (schema + relations + DAL functions on parent + procedures on parent's L2 router; NO entity
  folder/CASL/router). Codified: `add-an-entity.md:7`; ADR-0005 prescribes child tables for
  "line items… something you aggregate across rows." Precedent: meeting_participants,
  proposal_views, customer_notes, all 7 junctions. **Every §7 candidate is cost-class child-or-cheaper.**
- **Projection: 42 → ~45 tables (48 absolute max).** SOW items +1, proposal_incentives +1,
  customer_enrichment +1, additionalPainPoints +0/1; profile trio, agentProfile, voipConfig = **+0
  tables each** (flat schemas → nullable columns on existing rows; voipConfig's `defaultCampaignId`
  finally gets a real FK).
- **Smoking gun — SQL already treats the blobs as relational**: `proposals/dal/server/queries.ts`
  `finalTcpExpr` hand-writes `SUM(...) FROM jsonb_array_elements(fundingJSON->'data'->'incentives')`
  as a SQL mirror of `computeFinalTcp` for list sort/filter — ADR-0005's own child-table trigger,
  firing today. Also positional `->0->'trade'->>'label'` hacks in customer-pipelines and
  agent-dashboard DALs; a backfill script already did `jsonb_agg` surgery inside SOW.
- **Read paths are cheap to migrate**: every SOW consumer (proposal-flow UI, Zoho envelope
  plaintext, PDF service, aggregates lib) consumes a flat ordered array → `ORDER BY position`.
  Enrichment UI (`funnel-intake-panel.tsx`) already converts the map to rows. `customer_enrichment`
  makes `mergeFunnelEnrichment` a plain `INSERT ON CONFLICT (customer_id, step_id)` and satisfies
  the hook-bypass requirement for free (child writes never enter the customers CRUD path).
- **The one real cost center**: proposal form's write side — RHF field-array bound to
  `project.data.sow.${index}.financials.costLines` paths (`sow-field.tsx`), submits whole sections.
  Form keeps its in-memory array; the mutation must diff into child-row upserts. Write-side
  refactor, not read-side.

## 9. Stale docs to fix regardless of direction

- `docs/codebase-conventions/jsonb-columns.md` — "Zod re-parse of the merged whole" (not implemented).
- `docs/codebase-conventions/dal-conventions.md` — "partial upsert at any depth" + "never reload-and-spread" (validation layer rejects nested partials; every caller reload-and-spreads).
- `docs/plans/2026-06-27-jsonb-deep-merge-implementation-plan.md` Phase 2 (`mergeFunnelEnrichment` retirement) — will collide with the top-level-only `.partial()` schemas (utm-clobber trap) as designed.
- `src/shared/entities/proposals/DOCS.md#jsonb-merge-on-update` — rationale ("forms submit partial state") doesn't match the actual whole-section writer.
- `customers/schemas/index.ts` leadMeta comment — predates leadMetaJSON's `jsonbMergeColumns` registration.
