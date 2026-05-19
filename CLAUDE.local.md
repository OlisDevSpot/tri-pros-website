# Dispatched Session — Issue #193

**You are a dispatched Claude Code session working on a specific issue.**

## Your Assignment
- **Issue**: #193 — tRPC Entity Server System — Phase 1a: factory scaffolding + entity-name colocation
- **Branch**: `refactor/193-trpc-entity-server-system-phase-1a-facto`
- **Labels**: area:backend, P1, type:refactor, claude
- **Port**: 3002 (use `pnpm dev -- --port 3002` if you need a dev server)

## Approach — Complex Issue
BEFORE writing any code:
1. Use the superpowers:brainstorming skill (`/brainstorm`) to explore the problem space, clarify requirements, and design your approach.
2. Once you have a clear plan, proceed with implementation.

## Coding Rules (non-negotiable)
- ONE React component per file. No exceptions.
- No file-level constants in component files — extract to `constants/`.
- No helper functions in component files — extract to `lib/`.
- Named exports only. Never `export default`.
- Follow existing project patterns and import conventions.
- Read `CLAUDE.md` and `memory/coding-conventions.md` for full coding standards.
- Read `docs/domain/ubiquitous-language.md` for canonical domain terminology — use these terms exactly.

## Workflow Rules
1. **Stay on your branch.** Do not switch branches or touch other worktrees.
2. **Follow conventional commits**: `refactor(scope): description`
3. **Do NOT create a PR.** The user will do that via `dispatch pr 193`.
4. **Do NOT push to remote.** The user controls when to push.
5. **When blocked**: stop and explain what you need. Do not guess or work around it.

## When Done
1. Run `pnpm lint` and fix any errors.
2. Run `pnpm build` and fix any errors.
3. Review your own diff with `git diff` — check for unintended changes, debug logs, or leftover code.
4. Commit your work using conventional commits matching your branch type.
5. Say **"DONE — ready for review"** so the user knows you're finished.

## Dev Server
If you need to run the dev server, use port 3002 to avoid conflicts:
```bash
pnpm dev -- --port 3002
```

## Issue Body
## Goal

Land the foundational factories (L0/L1/L2) for the **Entity Server System** described in ADR-0002 and refactor `domains/permissions/abilities.ts` to derive `EntityName` / `AppSubject` from per-entity constants colocated in `entities/<entity>/lib/constants.ts`.

**Pure additive PR. No entity migrations. No behavior change.** App should function identically after this lands.

This is the foundation Phase 1b (#194) builds on.

## References

- **ADR**: [`docs/adr/0002-entity-server-system.md`](../blob/main/docs/adr/0002-entity-server-system.md)
- **How-to**: [`docs/how-to/add-an-entity.md`](../blob/main/docs/how-to/add-an-entity.md)
- **Mirrors**: ADR-0001's forcing-function pattern at the server layer

## Scope

### 1. Factory scaffolding (`src/trpc/lib/`)

- [ ] `create-crud-handlers.ts` — L0 raw handler functions. Pure async fns: `(ctx, input) => result`. Composable from anywhere. No tRPC dependency.
- [ ] `create-crud-router.ts` — L1 tRPC sub-router. Accepts `{ exclude?: SlotName[] }`. Refuses to compile when `spec.parentEntity !== null` (TS-level forcing function).
- [ ] `create-entity-router.ts` — L2 composer. Auto-plugs L1. Accepts plugins as `(spec) => Router` factories. Registers spec into `entityRegistry`.
- [ ] `entity-registry.ts` — `Record<EntityName, EntityServerSpec>`, populated by spec imports at load time.
- [ ] `build-agent-ctx.ts` — internal helper for `shareable` session-path delegation (used by L1 to call L0 from the authenticated branch).
- [ ] Type definitions: `EntityServerSpec` discriminated union (Core + Nested branches), `CrudHandlers<Spec>`, `SlotName`, `AgentCtx<Spec>`, etc.

### 2. Entity-name colocation pattern

Create the constant files for the 4 existing core entities (cheap, additive — no behavior change yet):

- [ ] `entities/customers/lib/constants.ts` exporting `CUSTOMER`
- [ ] `entities/meetings/lib/constants.ts` exporting `MEETING`
- [ ] `entities/proposals/lib/constants.ts` exporting `PROPOSAL`
- [ ] `entities/projects/lib/constants.ts` exporting `PROJECT`

Then refactor `domains/permissions/abilities.ts`:

- [ ] Import the 4 constants
- [ ] Derive `ENTITY_NAMES` const array + `EntityName` union + `AppSubject` type from them
- [ ] Verify existing CASL rules continue to work (no behavior change)

### 3. Validation

- [ ] `pnpm tsc` clean
- [ ] `pnpm lint` clean
- [ ] No runtime behavior change — manually verify the app still loads, the agent dashboard renders, an existing proposal/meeting/customer screen renders. Existing CASL rules unchanged.

## Out of scope (explicitly deferred)

- Proposal migration → **Phase 1b (#194)** (this issue unblocks it)
- Customer / Meeting / Project migrations → Phases 2-4
- `proposalVisibility` predicate design → Phase 1b (#194)
- Moving visibility predicates from `dal/server/<entity>/visibility.ts` to `entities/<entity>/lib/visibility.ts` → per-entity migration phases
- Restructuring `entities/proposals/` into `core/` + `line-items/` → deferred until ProposalLineItem lands as a real table
- Factory-arg wrap/replace overrides → v2

## Acceptance criteria

- All factory files compile, lint, type-check
- `EntityServerSpec` discriminated union enforces required fields per branch at the TS level (test by trying to construct an invalid spec — should fail to compile)
- `createCrudRouter` refuses to compile against a nested-entity spec (same test, different branch)
- `abilities.ts` derives `EntityName` / `AppSubject` from imported constants; existing role rules unchanged in semantics
- Phase 1b (#194) can be picked up immediately after this merges

## Unblocks

- **#194** — Phase 1b: Proposal migration
