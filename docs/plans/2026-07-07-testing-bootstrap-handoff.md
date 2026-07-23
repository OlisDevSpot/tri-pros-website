# Hand-off: Bootstrap a testing practice — first patient is the JSONB deep-merge

> Paste everything below the line into a fresh session. Above the line is for you (Oliver).
>
> **Why this doc exists:** the repo currently has *zero* tests — no runner, no config, no
> `*.test.ts`. Rather than bolt on a test framework in the abstract, we use one real, well-scoped
> change (the JSONB deep-merge from `2026-06-27-jsonb-deep-merge-implementation-plan.md`) as the
> first thing we ever test. You want to *learn* testing as we go — so this session is half
> implementation, half tutorial, and the agent is told to teach, not just type.

---

## Your mandate

Stand up a real testing practice in this codebase, and prove it out by implementing **Phase 1 of
`docs/plans/2026-06-27-jsonb-deep-merge-implementation-plan.md` test-first.** Two deliverables braided
together: (1) the app gets its first test runner, config, convention, and a couple of exemplar tests;
(2) the JSONB deep-merge ships, guarded by those tests.

**The person you're working with is new to testing.** They know `assert()`, `describe()`, and the
basic idea — nothing more. This is a hard constraint on *how* you work:

- **Teach before you type.** Before each new testing concept (a matcher, a lifecycle hook, a mock, a
  test-DB setup), explain in 3-5 sentences *what it is and why it's needed here*, then show the code,
  then pause for questions. Never dump a 200-line test file.
- **Explain WHY, in terms of this code.** Not "we mock the DB because mocking is good" — "we don't
  mock the DB for the merge path because the bug we're guarding against (the lost-update race) only
  exists in real Postgres row-locking, so a mock would test nothing."
- **One concept per step.** Small commits, small test files, frequent check-ins. Let them predict
  what a test will output before you run it — prediction is how the concept sticks.
- Adopt the **mentor** stance throughout. Understanding > completion speed.

## The vehicle (what we're testing and why it's a good first patient)

The JSONB deep-merge has a rare property: it splits cleanly into a **pure function** and an
**impure, concurrency-sensitive** path — the two archetypes of testing, in one small feature.

- `deepMergeJsonb(current, patch)` — pure, no I/O. The *ideal* first unit test: deterministic,
  no setup, teaches test anatomy (arrange-act-assert, `describe`/`it`/`expect`) with zero ceremony.
- The `SELECT … FOR UPDATE` merge path in `updateImpl` — impure, needs a real database and teaches
  integration testing, test isolation, and *why some things can't be unit-tested*.

Read the implementation plan first — it defines the merge rules, the two-path `updateImpl` design,
and the decisions already locked. Your job is to build it test-first, not to redesign it.

## Migration strategy — introducing tests to a codebase that has none

Go in this order. Each step is also a lesson; don't rush ahead.

**Step 0 — Pick the tool, and say why (lesson: the testing landscape).**
Adopt **vitest**. Briefly explain to the user why vitest over jest here: it speaks the same
`describe`/`it`/`expect` vocabulary they already know, natively runs the project's TypeScript/ESM
(the repo is `tsx`/Next/ESM — jest needs extra transpile config), has a fast watch mode that's great
for learning, and its assertion style is nearly identical to what they've seen. Confirm the current
versions with context7 (`resolve-library-id` → `get-library-docs` for `vitest`) — don't trust memory
on config API.

**Step 1 — Minimal install + the smallest passing test (lesson: anatomy of a test).**
Add vitest as a dev dependency, a minimal `vitest.config.ts`, and a `"test"` script (`vitest` for
watch, `vitest run` for one-shot). Decide + document where tests live — **colocate**: `foo.ts` →
`foo.test.ts` next to it (matches the repo's colocation ethos; state it in the convention doc). Write
ONE trivial passing test (`expect(1 + 1).toBe(2)`) purely to prove the runner works and to walk them
through: what `describe`/`it`/`expect` each do, how to run one file, how to read pass/fail output.

**Step 2 — First real unit test, red-green (lesson: pure functions & TDD's red→green).**
Now the deep-merge. Write `deep-merge-jsonb.test.ts` FIRST, from the merge rules in the plan:
recurse objects, replace arrays/scalars, preserve omitted keys, `null` replaces a leaf. Watch it fail
(red — the function doesn't exist yet). Then write `deepMergeJsonb` until green. This is their first
taste of test-driven development — narrate the loop explicitly. Cover the cases the plan calls out,
especially the headline one: a partial `mainPainPoint` payload must NOT drop `accessor`. Consider
invoking the **`tdd`** or **`superpowers:test-driven-development`** skill and following it out loud so
they see the discipline.

**Step 3 — First integration test (lesson: unit vs integration, test isolation, test DBs).**
Swap `buildUpdateSet` to use the pure function, and wrap the merge path in the `FOR UPDATE`
transaction per the plan. Now teach why a unit test can't cover this: the guarantee is *atomicity
under concurrent writes*, which only exists in real Postgres. Write an integration test that runs
against the **dev Neon branch** (this worktree has its own — see memory `reference-neon-branching`):
seed a row, fire two overlapping partial updates to different sub-keys of the same JSONB column,
assert both survive. Teach: test setup/teardown (create/clean the row), why integration tests are
slower and fewer, and how to keep them isolated (unique ids, cleanup in `afterEach`). Keep unit and
integration tests distinguishable (naming or a folder) so the fast suite stays fast.

**Step 4 — Make it a practice, not a one-off (lesson: regression tests & preflight).**
Write `docs/codebase-conventions/testing.md`: the runner, where tests live, unit-vs-integration
split, how to run each, and the rule "a bug fixed gets a regression test so it can't silently come
back." Wire `pnpm test` (the fast unit suite at least) into the PR preflight alongside `pnpm tsc` +
`pnpm lint`. Add a one-line pointer in memory so future sessions know tests now exist and how to run
them.

## Learning arc (so the user keeps levelling up past this feature)

Each concept is anchored to a step above, so learning is never abstract:

1. **Test anatomy** — describe/it/expect, AAA, running tests (Steps 1-2)
2. **Pure functions are the easiest thing to test** — and why we design for that (Step 2)
3. **Red→green TDD** — write the failing test first, let it drive the code (Step 2)
4. **Unit vs integration** — what each is *for*, and why not to unit-test everything (Step 3)
5. **Test isolation & fixtures** — setup/teardown, not leaking state between tests (Step 3)
6. **Regression tests & CI** — tests as a ratchet that stops backsliding (Step 4)

Future sessions can extend the ladder: mocking external services (Resend, Zoho, QStash), testing tRPC
procedures, component/interaction tests, and coverage — but do NOT front-load these now. Mastery of
1-6 on one real feature beats a shallow tour of all of them.

## Constraints (repo norms — do not violate)

- **DB:** dev Neon branch only. `pnpm db:push:dev`, never `pnpm db:push` (prod). Read memory
  `reference-neon-branching` + `feedback-db-push-dev-only` before any DB work. Note: the deep-merge
  itself needs **no schema migration** (no DB-side function, no column change).
- **Verify with `pnpm tsc` + `pnpm lint` + `pnpm test`. NEVER `pnpm build`.**
- **Do not regress the Meta measurement loop:** a funnel lead must still accumulate enrichment across
  steps with `leadMetaJSON.source.{meta,utm}` intact. Add a test that pins this if practical.
- Work per repo git norms (branch `feat/<issue>-jsonb-deep-merge`; the user works on main — confirm
  before branching). Don't commit unless asked.
- **Phase 1 only.** Do NOT retire `mergeFunnelEnrichment` — that's Phase 2, gated on a separate hook
  decision (see the implementation plan + funnel unified-design §4).

## Deliverables (in order)

1. vitest installed + `vitest.config.ts` + `test` script + one trivial green test (Steps 0-1).
2. `deep-merge-jsonb.test.ts` (red) → `deep-merge-jsonb.ts` (green), covering the plan's merge rules.
3. `buildUpdateSet` → pure merge; `updateImpl` merge path wrapped in the `FOR UPDATE` transaction.
4. Integration test proving the concurrent-partial-update case survives on the dev branch.
5. Call-site audit from the plan (esp. `edit-proposal-view` full-document write) + fix the two stale
   docs (ADR-0002 wording, `proposals/DOCS.md:96`).
6. `docs/codebase-conventions/testing.md` + preflight wiring + memory pointer.

End by summarizing, in plain language, the testing concepts the user now has hands-on with, and what
the natural next rung on the ladder is.

## Resources

- **This feature's spec:** `docs/plans/2026-06-27-jsonb-deep-merge-implementation-plan.md` (the WHAT).
- **Skills:** `tdd` / `superpowers:test-driven-development` (run the red-green loop by the book);
  context7 for current vitest config/API.
- **Companion:** `docs/plans/2026-06-27-funnel-data-capture-unified-design.md` (why the merge matters
  end-to-end).
