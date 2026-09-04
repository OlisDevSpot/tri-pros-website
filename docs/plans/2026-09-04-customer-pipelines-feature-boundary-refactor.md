# customer-pipelines — Feature Boundary & Read-API Refactor (deferred)

> **Status:** DEFERRED — NOT part of the CASL scope-compiler epic (#285). Captured during Grill D (dispatcher fresh-visibility, 2026-09-04). Land as its own grill AFTER the permissions epic merges. Coordinate with Phase 7 Grill B (uniform read cutover) — some of this may fold in there.
>
> **Why this doc exists:** the dispatcher financial-wall work was shipped *defensively* to unblock the epic. The user's ruling (2026-09-04): "This is NOT good code — we should not aim to preserve backwards compatibility or code defensively. This will do for now, but I need explicit documentation directing us to update the customer profile API / primitives / types / data flow."

## The core insight

`customer-pipelines` is legitimately a **feature** — a *view* that orchestrates shared primitives (the Customers entity + a pipeline **UI component**) into a specific rendering. It belongs in `features/`. The sin is **not** its location — it is the **inverted import direction**:

- **Today (wrong):** the tRPC router (server/shared tier) reaches *up* into the feature for its reads — `src/trpc/routers/customer-pipelines.router.ts` imports from `@/features/customer-pipelines/dal/server/*`. That is `shared/trpc ← features`, which is forbidden.
- **Correct:** a feature *consumes* shared primitives (entities + pipeline UI). Data flows `feature → shared`, never `shared → feature`.

And "pipelines" as a rendering primitive should live in **`components/`**, not `domains/` — it is UI, not a domain rule.

## Problems to fix

1. **Import inversion.** `customer-pipelines.router.ts:4-7` imports all four reads from `features/`. The server router must not depend on a client-feature tree. (Same inversion exists for `dashboard`/`ai`/`meeting-flow`/`landing` — out of scope here, but note the pattern.)

2. **Defensive financial-gate is a patch, not an API (Grill D, 2026-09-04).** To wall dispatchers off from proposal financials while widening their customer visibility to `fresh`, we added:
   - a per-builder `resolveActorScope(proposalServerSpec, actor)` gate on every proposal sub-query,
   - a `canReadProposals` boolean threaded through `getCustomerPipelineItems`,
   - a `maskFinancials()` post-pass that strips the residual `hasSentProposal` badge,
   - the same `canReadProposals ? … : false` suppression inline in `get-customer-profile.ts`.

   This is knowingly *not good code*: financial exclusion is bolted on after the fact rather than being a structural property of the read API's **shape**. The redesign should make it impossible to select financial columns without the grant — e.g. the profile/pipeline read API returns a type whose financial fields simply don't exist for a non-proposal actor, driven by the actor at the API boundary, so no `maskFinancials` afterthought is needed.

3. **Param-threading smell.** Builders take redundant, ctx-derived args — `(actor, customerScope, inBucket, canSeeUngated)` etc. `customerScope`, `inBucket`, `canSeeUngated`, `canReadProposals` are all recomputable from `ctx.actor` + `pipeline`. Collapse into a single derived read-context value object (or a self-scoping DAL keyed on the actor).

4. **Business logic in the transport tier.** `getRecordingUrl`, `getCustomerProjects`, `assignToProject` run raw `db.select` and hand-build `ScopedContext` literals inline in the router. `getCustomerProjects` even returns **proposals** via an unscoped `db.select` — fold under the same financial gate and move into the DAL.

5. **File size / cohesion.** `get-customer-pipeline-items.ts` is ~21KB / 5 builders in one file — split by responsibility.

## Target architecture

- **Feature orchestrates shared.** `customer-pipelines` (feature) composes: the Customers entity read API (shared) + a pipeline **UI component** (relocated to `components/`). The tRPC router exposes the feature's orchestration; it does not host reads.
- **Clean read API / primitives / types / data-flow.** A profile/pipeline read surface whose types encode what the actor may see (financials present only when the `Proposal` grant is held), self-scoping on `ctx.actor` — no threaded scope/flag params, no post-hoc masking.
- **Import direction restored.** Nothing under `shared/`/`trpc/` imports from `features/`.

## Sequencing

- Do NOT do this inside #285. It is a structural re-architecture of the feature boundary, primitives, and APIs — too big for a permissions epic.
- Best landed right after Phase 7 Grill B (the uniform read-side cutover to `resolveActorScope` as sole authority), since that work already touches these read paths and retires `ctx.scope` from reads — the param-threading collapse is a natural companion.

## Pointers

- Epic tracker Phase-9 deferred-residuals: `docs/plans/2026-08-10-casl-scope-compiler-epic.md`.
- The defensive code this replaces: `src/features/customer-pipelines/dal/server/{get-customer-profile,get-customer-pipeline-items}.ts` + `src/features/customer-pipelines/lib/mask-financials.ts`.
