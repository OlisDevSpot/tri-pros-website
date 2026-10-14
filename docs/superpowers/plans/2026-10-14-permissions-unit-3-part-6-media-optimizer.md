# Permissions unit 3 part 6: the media optimizer's system reason

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** The media optimizer reads its row under a named system reason, not the unnamed `SYSTEM_CONTEXT`, and the leftover mentions of `SYSTEM_CONTEXT` outside VoIP and the visit messages go.

**Architecture:** `systemContext(reason)` (`src/shared/dal/server/lib/contexts.ts`) already gives `manage all` with the reason on the rule. The optimizer swaps one context for the other; the ability is the same (`manage all`, `scope: null`), so nothing changes at run time. The rest is a dead re-export and three lines of prose.

**Tech Stack:** TypeScript, Drizzle, CASL (`defineRules`).

**Spec:** `docs/superpowers/specs/2026-10-05-permissions-structure-design.md` (§7 contexts: `systemContext(reason)`; a new reason is added to the closed list first). Tracker: `docs/plans/2026-08-10-casl-scope-compiler-epic.md` §4, "Unit 3 — what is left", item 5 (split 2026-10-14).

## Global Constraints

- A new `SystemReason` name needs the owner's agreement. **Proposed: `'job:media-optimization'`**, beside `'job:campaign-enrollment'` (the existing job reason, named by the work, not the queue).
- Comments say why, never what; no plan, spec or task citations in code.
- No DB writes for testing; never `pnpm build`; `pnpm tsc` and `pnpm lint` are the gate.
- Out of scope (wait for main's VoIP and visit-messages work, owner 2026-10-14): `findReplyTargetMeeting`, `runAutomaticKind`, `send-day-before-reminders.ts`, `send-rep-confirmations.ts`, `voip-{calls,dids}.service.ts`, the two Twilio routes, `voip-messages/lib/visibility.ts`. `SYSTEM_CONTEXT` itself stays for them.

## Decisions in this plan

1. **The context is made at the optimizer, not threaded from the job.** `optimizeMediaFile` has two callers, the QStash job and `mediaService.optimizeNow` (the backfill script), and both are the same work. Minting inside the function names that work once. Threading a `ctx` would change `optimizeNow`'s signature, which would no longer match the other four `mediaService` methods (all take `store` first). Precedent: `notification.service.ts` mints `systemContext('derived:…')` at the site of the read.
2. **The `SYSTEM_CONTEXT` re-export in `src/trpc/types.ts` goes.** Nothing imports it from there: every remaining user imports from `@/shared/dal/server/types`.

## Review Focus

- The optimizer still sees rows of both owners (project and proposal media): `systemRules` grants `manage all`, the same as `SYSTEM_CONTEXT`. The probe in Step 2 pins it.
- The backfill path (`scripts/backfill-proposal-media-optimization.ts` → `optimizeNow`) compiles unchanged.

---

### Task 1: The optimizer's reason, and the leftover mentions

**Files:**
- Modify: `src/shared/domains/permissions/rules/system.ts` (the `SystemReason` union)
- Modify: `src/shared/modules/media/core/lib/optimize-media.ts:4,27-31`
- Modify: `src/trpc/types.ts:26-31` (the re-export block)
- Modify: `src/shared/entities/customers/dal/server/queries.ts:45` (a comment)
- Modify: `src/shared/entities/meetings/DOCS.md:229,243`
- Probe (git-ignored): `.superpowers/permissions-probes/part6-system-reason.ts`

**Interfaces:**
- Consumes: `systemContext(reason: SystemReason): ScopedContext` from `@/shared/dal/server/lib/contexts`; `systemRules(reason)` from `@/shared/domains/permissions/rules/system`.
- Produces: `SystemReason` gains `'job:media-optimization'`.

- [ ] **Step 1: Baseline counts**

Run: `git grep -n "SYSTEM_CONTEXT" -- src | wc -l; git grep -l "SYSTEM_CONTEXT" -- src | wc -l`
Expected: `26` and `14`

- [ ] **Step 2: Write the probe, watch it fail**

`.superpowers/permissions-probes/part6-system-reason.ts`:

```ts
import { abilityFromRules } from '@/shared/domains/permissions/ability-from-rules'
import { systemRules } from '@/shared/domains/permissions/rules/system'

const rules = systemRules('job:media-optimization')
const ability = abilityFromRules(rules)
console.log(JSON.stringify({
  manageAll: ability.can('manage', 'all'),
  reason: rules.map(rule => rule.reason),
}))
```

Run: `pnpm tsc 2>&1 | grep part6 | head -3`
Expected: one error on the probe, `Argument of type '"job:media-optimization"' is not assignable to parameter of type 'SystemReason'` (tsconfig includes `**/*.ts`, so the git-ignored probes are type-checked; `tsx` alone would not type-check).

- [ ] **Step 3: Add the reason**

`src/shared/domains/permissions/rules/system.ts`, after `| 'job:campaign-enrollment'`:

```ts
    | 'job:campaign-enrollment'
    | 'job:media-optimization'
```

- [ ] **Step 4: The optimizer reads under it**

`src/shared/modules/media/core/lib/optimize-media.ts`. Replace the import:

```ts
import { systemContext } from '@/shared/dal/server/lib/contexts'
```

(in place of `import { SYSTEM_CONTEXT } from '@/shared/dal/server/types'`; keep the import order the linter wants, so run `pnpm lint --fix` on the file if it moves).

Replace lines 27–31:

```ts
  // The row is read through the owner's own scoped CRUD — SYSTEM_CONTEXT because a
  // background job has no session and must see every row. This is what removes the
  // last raw `db` read on the media service/optimizer path (MD2) — the table-generic
  // DAL ops (media-ops.ts, optimization.ts) still import `db` legitimately.
  const found = await store.crud.getById(SYSTEM_CONTEXT, { id: mediaId })
```

with:

```ts
  // A queued job has no session and must see every owner's row.
  const found = await store.crud.getById(systemContext('job:media-optimization'), { id: mediaId })
```

- [ ] **Step 5: The dead re-export**

`src/trpc/types.ts`, the value re-export block becomes:

```ts
export {
  dalError,
  dalSuccess,
  ThrowableDalError,
} from '@/shared/dal/server/types'
```

- [ ] **Step 6: The prose**

`src/shared/entities/customers/dal/server/queries.ts:45`:

```ts
// A system context (`manage all`) is ungated: system callers never surface the phone to a user.
```

`src/shared/entities/meetings/DOCS.md:229`: `` `SYSTEM_CONTEXT` passes its explicit ownerId through `` → `` a system context (`systemContext(reason)`) passes its explicit ownerId through ``.
`src/shared/entities/meetings/DOCS.md:243`: `` falls back to the source owner under `SYSTEM_CONTEXT` `` → `` falls back to the source owner under a system context ``.

- [ ] **Step 7: Verify**

Run: `pnpm tsx --tsconfig tsconfig.json .superpowers/permissions-probes/part6-system-reason.ts`
Expected: `{"manageAll":true,"reason":["job:media-optimization"]}`

Run: `git grep -n "SYSTEM_CONTEXT" -- src | wc -l; git grep -l "SYSTEM_CONTEXT" -- src | wc -l; git grep -n "SYSTEM_CONTEXT" -- src/shared/modules/media src/trpc/types.ts src/shared/entities/customers src/shared/entities/meetings`
Expected: `19`, `10`, and no lines from the last command.

Run: `pnpm tsc > .superpowers/sdd/part6-tsc.log 2>&1; echo tsc=$?; pnpm lint > .superpowers/sdd/part6-lint.log 2>&1; echo lint=$?`
Expected: `tsc=0`, `lint=0`.

No browser check: the optimizer runs from QStash (needs the tunnel) and its ability is unchanged (`manage all`, `scope: null`); the probe and tsc carry the proof.

- [ ] **Step 8: Commit and push**

```bash
git add src/shared/domains/permissions/rules/system.ts src/shared/modules/media/core/lib/optimize-media.ts src/trpc/types.ts src/shared/entities/customers/dal/server/queries.ts src/shared/entities/meetings/DOCS.md
git commit -m "refactor(permissions): the media optimizer reads under its own system reason"
git push
```

### Task 2: Record

- [ ] Tracker §4 item 5: the media optimizer built by part 6 (SHA, counts 26 → 19 lines, 14 → 10 files); §0 "Next" names what follows; Appendix A one line. DISTILLED §7 item 2 likewise. Memory: one line in `project-permissions-casl-compiler.md` and the `MEMORY.md` index. Delete this plan in its own commit. Push.
