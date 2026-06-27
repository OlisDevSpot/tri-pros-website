# Hand-off: Make entity-server-spec JSONB updates a true recursive deep-merge

> Paste the section below into a new session. Everything above the line is context
> for you (the human); everything below is the agent's mandate.

---

## Your mandate
Establish and enforce one hard rule across the whole app: **an update to a JSONB
column must never delete data that wasn't in the payload — it may only upsert the
specific portions the payload carries, recursively at every depth.** Today this is
**not** guaranteed. Fix it at the toolkit level, then audit every call site, then
retire the bespoke workarounds that exist only because the rule was missing.

Follow the project's working principles (trust-but-verify; code is truth; ping on
staleness). Backend convention is three-layer (tRPC→Service→DAL→DB); services
orchestrate, DAL implements; reuse generic surface; derived values stay computed.
Do **brainstorming/design before code** — this touches shared DAL used by every
entity, so a wrong move silently corrupts customer/proposal/meeting data.

## The defect (verified in code 2026-06-27 — re-verify before acting)
The generic CRUD update builds its `.set()` payload in `buildUpdateSet`
([src/shared/dal/server/lib/create-crud-dal.ts:116-165](../../src/shared/dal/server/lib/create-crud-dal.ts#L116-L165)).
For every column registered in `spec.update.jsonbMergeColumns` it emits:

```ts
out[key] = sql`COALESCE(${col}, '{}'::jsonb) || ${JSON.stringify(value)}::jsonb`
```

PostgreSQL's `||` on `jsonb` is a **shallow, top-level merge**. It replaces any
top-level key present in the right-hand object **wholesale** — it does **not**
recurse. So a partial *nested* payload deletes sibling nested keys:

- `update(customerProfileJSON, { mainPainPoint: { urgencyRating: 5 } })` →
  drops `mainPainPoint.accessor` (and any other sub-key).
- `update(leadMetaJSON, { source: { enrichment: {...} } })` → replaces the entire
  `source`, dropping `kind`, `offer`, `funnelSlug`, `utm`, `meta` (fbp/fbc).

**Proof the team already hit this:** `mergeFunnelEnrichment`
([src/shared/entities/customers/dal/server/mutations.ts:57-77](../../src/shared/entities/customers/dal/server/mutations.ts#L57-L77))
is a bespoke `jsonb_set` at `{source,enrichment}` written *specifically* to dodge
the shallow `||`. Its comment and the schema comment at
[customers/schemas/index.ts:141-145](../../src/shared/entities/customers/schemas/index.ts#L141-L145)
both state plainly that a top-level `||` on `leadMetaJSON` "would replace the whole
`source` and is NOT safe here." That workaround is the symptom; the toolkit is the
disease.

The current `buildUpdateSet` does get two things right that the fix MUST preserve:
- skips keys whose value is `undefined` (partial top-level updates don't clobber);
- treats explicit `null` as an intentional clear.

## Registered merge columns & which are nested (verify each schema)
`jsonbMergeColumns` is registered for **customers** only today
([customers/lib/server-spec.ts:48-55](../../src/shared/entities/customers/lib/server-spec.ts#L48-L55)):
`customerProfileJSON`, `propertyProfileJSON`, `financialProfileJSON`, `leadMetaJSON`.
Proposals reference deep-merge semantics in their DOCS (verify whether they
register merge columns too — grep `jsonbMergeColumns` across `src`).

| Entity | Column | Shape | Nested risk |
|---|---|---|---|
| customers | `customerProfileJSON` | **nested** (`mainPainPoint` obj, `additionalPainPoints[]`) | high |
| customers | `leadMetaJSON` | **deeply nested** (`source{utm,meta,enrichment}`, `phoneVerification`, `requestedTrades[]`) | high |
| customers | `propertyProfileJSON` | flat | low |
| customers | `financialProfileJSON` | flat | low |
| proposals | `projectJSON`, `fundingJSON` | **deeply nested** (`data{sow[],...}`, `meta{...}`) | high (confirm registration) |
| proposals | `formMetaJSON` | flat | low |

Verify every shape against `src/shared/entities/<entity>/schemas/`. Also check
meetings (`situationProfileJSON`, `programDataJSON`) and projects.

## Decisions you must make in design (don't code until these are settled)
1. **Merge semantics for non-objects.** Standard "deep merge": recurse into
   **objects**; **replace arrays and scalars wholesale**. Confirm this is the
   intended rule (sending a new array replaces that array — the array is the unit;
   that's an upsert of that key, not data loss). Decide explicitly — array-by-index
   merge is almost always wrong here (`sow`, `additionalPainPoints`, `requestedTrades`).
2. **`null` semantics.** Preserve today's "explicit null clears the key." Decide how
   null interacts at depth (clear the leaf only).
3. **Implementation site.** Options, pick with rationale:
   - (a) A recursive Postgres function `jsonb_deep_merge(a, b)` installed via
     migration, called from `buildUpdateSet` — keeps the update **atomic and
     race-safe** in a single statement (preserves the property `mergeFunnelEnrichment`
     was created to get). Must define array/null behavior in SQL.
   - (b) App-level recursive merge before write — **rejected unless justified**: it
     reintroduces a read-modify-write race, the exact class of bug already fixed for
     funnel enrichment. Only viable if wrapped in a row-locked transaction.
   - Recommend (a). Decide and document.
4. **Retire workarounds.** Once the toolkit deep-merges, plan to retire
   `mergeFunnelEnrichment` and route funnel enrichment through generic CRUD —
   **but** note that path fires the customer `update.after` GCal-propagation hook
   ([customers/lib/server-spec.ts:106-108](../../src/shared/entities/customers/lib/server-spec.ts#L106-L108))
   per write. Decide: add a hook-skip/`silent` option to CRUD update for metadata-only
   patches, or accept the (short-circuiting) enqueue cost. This connects to the
   funnel redesign — see `2026-06-27-funnel-data-capture-unified-design.md` (§4, Decision 3).

## Required deliverables (in order)
1. **Confirm the defect** with a failing test: a partial nested update through
   generic CRUD that demonstrably drops a sibling key. (Project uses the test setup
   already present — find it; do TDD.)
2. **Audit every call site** that updates a registered JSONB column through generic
   CRUD, and classify each as whole-key (safe today) vs partial-nested (**active
   data-loss bug**). Suspected active/fragile sites to confirm first:
   - `meeting-flow.router` `updateCustomerProfile` → `customerProfileJSON`
     ([src/trpc/routers/meeting-flow.router.ts](../../src/trpc/routers/meeting-flow.router.ts)) — confirm whether the form sends a partial `mainPainPoint`.
   - proposal edit/funding flows → `projectJSON`/`fundingJSON`
     ([src/features/proposal-flow/](../../src/features/proposal-flow/)) — currently safe only because the UI spreads the whole object; confirm and note the fragility.
3. **Implement** the chosen deep-merge (decision 3), preserving the `undefined`-skip
   and `null`-clear semantics. Make the failing test pass.
4. **Retire** `mergeFunnelEnrichment` if decision 4 allows, or document why it stays.
5. **Codify the rule** in `docs/codebase-conventions/` (DAL conventions) and the
   relevant entity `DOCS.md`: "JSONB merge columns deep-merge; partial nested
   payloads never delete siblings; arrays/scalars replace." Add the regression test
   to the suite so the guarantee can't silently regress.

## Constraints & verification
- Run `pnpm tsc` + `pnpm lint` (never `pnpm build`). Schema/DB work uses
  `pnpm db:push:dev` only (per-worktree Neon branch is isolated). Re-read the memory
  entries on these before touching the DB.
- Do **not** regress the Meta measurement loop: `leadMetaJSON.source.{meta,utm}`
  and the enrichment record must survive every write. After changes, verify a funnel
  lead still accumulates enrichment across steps and `source.meta`/`utm` are intact.
- Atomicity is a hard requirement: the fix must not reintroduce the lost-update race
  that `mergeFunnelEnrichment` was built to solve (rapid/concurrent partial updates
  to different sub-keys of the same column must all survive).

## Deliverable
A toolkit change that makes the hard rule true app-wide, an audit of call sites with
active bugs fixed, retired workarounds, a codified convention + regression test, and
a short note on the array/null/hook decisions you made and why. End with anything
that needs the user's sign-off (especially the array semantics and the hook-skip
option).
</content>
