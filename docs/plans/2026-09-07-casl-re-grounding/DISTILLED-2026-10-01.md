# Permissions epic (#285) — distilled record (2026-10-01; status and next steps updated 2026-10-05)

One page. Everything else in this folder is evidence. Code is the source of truth: re-verify any line here against the code before acting on it.

## 1. Status
- Branch `refactor/285-…` in `.worktrees/issue-285` = **main (`61d3e1e2`) + these docs**, since the supersede merge `2b038591` (2026-10-05). 0 behind main. Pushed to origin.
- The pre-re-grounding code (tip `b40403b6`, last code commit 2026-09-06) is no longer in the tree. It stays an ancestor of the branch: restore a file with `git show b40403b6:<path>`.
- **Nothing is built under the current design.** The tree runs main's legacy shapes: `ScopedContext { session, ability, scope }`, `SYSTEM_CONTEXT`, `spec.visibility` + `resolveEffectiveScope`, and CASL rules that grant verbs without conditions.
- Baseline on the merge: `pnpm tsc` passes; `pnpm lint` fails on two formatting errors in `src/app/(frontend)/globals.css:491-492` that main carries.
- Main is mid-move from `entities/` to `modules/` (proposals, projects, media, construction done), which relocates the files this epic rewrites.

## 2. Decided by the owner
| # | Decision |
|---|---|
| 1 | CASL rules are the only permission source for server, database and client. Row filters are compiled from the rules into Drizzle `where()`. |
| 2 | The actor is the plain record `{ ability, userId }`. No user/token/system union, no `kind` branches. |
| 3 | The session is the truth. No session → only an entity's shareable procedure may admit a share-token bearer. A logged-in staff member opening a share link acts as staff. |
| 4 | The actor is computed once per request and shared by tRPC, server components and route handlers. Middlewares only narrow. |
| 5 | Procedure ladder: base → protected → agent → superAdmin, plus one shareable procedure per shareable entity. Per-entity scope procedures, `systemProcedure`, `ctx.scope`, `ctx.ability` go away. |
| 6 | The DAL scopes itself per action from the ability. Routers and handlers carry no permission code. |
| 7 | A mutation's rows = its own action scope AND the read scope. Permanent. |
| 8 | The parent relation is declared once, on the child's spec. |
| 9 | The client hydrates the same rules (`packRules` → `@casl/react`, `subject()` for row checks). No hand mirrors. |
| 10 | Custom operators (participation, derived pipeline) appear only on `read` rules without fields. |
| 11 | Stay on `@casl/ability` 6.8.0. Add `@casl/react` 7.0.1. |
| 12 | The share-token bearer gets a real per-row ability: read its proposal; update only `financeOptionId` and `cashInDealCents`; record views. No separate `ProposalView` subject. |
| 13 | The `homeowner` role's unconditional `read Proposal` rule is deleted in the same change as #12. |
| 14 | Server-side masking of cost data on bearer reads: **deferred**, kept open. |
| 15 | Never widen the legacy engine to patch a gap. |
| 16 | A supersession edits the superseded text. No "read me first" banners. |
| 17 | **A sub-entity is a field of its parent's CASL subject** (2026-10-05). The child spec declares only its parent, foreign key and collection name. Reading the child = the parent's `read`; creating, updating or deleting it = the parent's `update` on that collection. Customer notes are the one child with its own subject. A parent `update` rule without a field list covers every collection; narrow with a field list or a `cannot`. |
| 19 | **Names** (2026-10-05): `defineEntitySpec`, `defineSubEntitySpec`, `parent: { spec, fk, field }`, `subject`, `conditionColumns`, `defineRules`, `permit`, `bearerContext(spec, token)`. `defineAbilitiesFor` and `entityName` keep their names. |
| 20 | **Verification** (2026-10-05): no test runner and no unit tests in the library. `pnpm tsc`, `pnpm lint`, the wrong-on-purpose type file, and browser end-to-end tests per role. |
| 21 | **Client** (2026-10-05): `@casl/react` is added as decided; rules are sent from the root layout. |
| 18 | **The specs are the single typed source** (2026-10-05). Rule fields, conditions, operator placement and the checks the client makes are all type-checked against the specs. Rules are written through a thin typed `can`/`cannot` wrapper that emits stock CASL rules. Each subject spec lists the columns rules may condition on. A checked-in file of wrong-on-purpose lines guards the types. |

## 3. Awaiting the owner's review
- **The structure spec**: `docs/superpowers/specs/2026-10-05-permissions-structure-design.md`. Its six sections were approved in chat on 2026-10-05; the written form is not yet approved. No plan and no code before it is.

## 4. Business rules
- **Homeowner with a share link** may: read their proposal, pick a financing option, set cash in deal, give their age, record a view, ask to move forward (a notification only). They may never touch status, price, scope of work, owner, contract timestamps, the contract lifecycle, or which documents go in the envelope.
- The age write and the document reconciliation it triggers are **server-derived** from the token-validated proposal, never from a client-supplied id.
- **Cost, margin and multiplier are never shown to the homeowner.** Today only the client view mode and the PDF enforce this; the server returns everything.
- **The homeowner must keep seeing their own phone number** once the bearer becomes a rule set (needs an explicit grant).
- **You cannot change what you cannot see.**
- A client-supplied id you cannot reach answers **not found**, never forbidden.
- **Parts of a parent** (customer profile, lead attribution, enrichment, proposal views, incentives, media, meeting participants, applications) are governed by the parent: permission to touch them is permission to update that part of the parent.
- **Customer notes** are the one exception: anyone who can see the customer can read and add; only the author or an admin edits or deletes.
- **Dispatcher**: customers in leads, rehash, dead, fresh; all meetings; notes and discovery profile. No proposals, no projects, no financials.
- **Pipeline is derived from meeting outcomes.** `not_good` and `ftd` are terminal (dead). Prod still maps them to rehash until the branch's map lands; needs the owner's go.

## 5. Realizations
- A CASL rule with fields but no conditions is **allow-all on rows**. That is why #7 is permanent.
- Stock `rulesToAST` ignores fields. A ~15-line walk over `ability.rulesFor(action, subject, field)` is what lets a sub-entity compile to SQL. Probe-verified on 6.8.0.
- Passing a child's own verb to the parent collapses to deny (agents hold no `delete Proposal`). Hence child writes map to the parent's `update`.
- Operators on mutation rules break the client matcher. Mutation rules carry fields and scalar conditions only; their row reach comes from the read scope.
- `null` meant allow-all, omni and unresolved at once. Scope must be a value that is always SQL.
- `applyEnvelopeContext` writes `envelopeDocumentIds` on the token path. A naive bearer allowlist silently breaks age reconciliation.
- `.because(reason)` is stored on the rule but `ForbiddenError` only reports it for `cannot` rules. Read it with `relevantRuleFor`.
- Of 93 primitives the branch built: 33 keep (the adapter core), 35 rewrite, 22 delete. One decision (#2 + #6) drives about 30 of the rewrites.
- The epic derailed because decisions were stacked as banners and one reversal was only spoken. Decision #16 is the fix.

## 6. Live security holes (verified in main's code 2026-10-01; all independent of this epic)
| Hole | Where on main | Fix |
|---|---|---|
| Unauthenticated caller can trigger a job that rewrites any proposal's `projectJSON` | `src/trpc/routers/ai.router/index.ts:7` (`baseProcedure`) | require staff or a valid share token + reach check |
| Any agent or dispatcher can read, edit or **delete any project** | `src/trpc/routers/projects.router/crud.router.ts:16,39,49,56,69` (bare `agentProcedure`) | scope the five procedures; delete stays admin-only |
| A share-link holder can update **any column** of their proposal | `src/trpc/lib/create-crud-router.ts:63,89` (gates skipped when `ctx.ability` is null) | deny `update` on the token path except an explicit allowlist |
| Proposals and projects read unscoped after a meeting check | `src/trpc/routers/customer-pipelines.router.ts:99-110` | read through the owning DALs |
| Bearer receives every proposal column incl. cost lines | `src/shared/modules/proposals/core/dal/server/queries.ts:85` | homeowner projection (decision 14, deferred) |
| Creating a meeting on any customer makes the creator a participant (gains visibility) | `src/shared/entities/meetings/dal/server/crud.ts:39` — re-verify there is no customer reach check | probe the customer before create |

## 7. Next steps, in order
1. **Fix the holes in §6** through the hotfix path. They do not need the epic.
2. Owner reviews the structure spec (§3); then the plan for unit 1 (typed foundation).
3. Rule the open items in the spec's §12: homeowner phone grant; pipeline map for prod; lint wall shape; which dev records browser tests may change; the 25 business rulings in report 10 §5.
4. Build order (spec §11): typed foundation → one actor per request → compiler + DAL self-scoping per entity family → rules matrix → lint wall + financial reads → delete the legacy engine → full browser pass. The keep-primitives (adapter core, outcome classification) come back from `b40403b6` in the unit that gives each a home.
5. Merge main into the branch at every unit boundary; one merge to main after the end-to-end pass.

## 8. Where the detail lives
Tracker `docs/plans/2026-08-10-casl-scope-compiler-epic.md` (decision table, units, ledgers) · `README.md` §L (reasoning per decision) · `18` decision and progress map · `19` what the branch built · `22` table topology · `24` interface comparison · `17` worked example · `19` §1 is the list of what to restore from `b40403b6`. Reports `16` and `21` (merge plans) are history: the 2026-10-05 supersede merge replaced them.
