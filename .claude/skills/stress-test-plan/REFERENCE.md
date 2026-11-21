# Stress-test reference

## Summary

This is the "What is planned" section. The owner should be able to judge from it alone whether the plan is complete.

~~~md
## What is planned — <feature> (<plan path>)

**Goal in one line:** …
**Spec decisions:** D1 … Dn · **Owner rulings in force:** …

### Flow (one user path, end to end)
<who> does <action> on <surface> → <procedure> → <service.method> → <DAL fn> → <table> → <what re-renders / is sent>

### Schema
`src/shared/db/schema/<x>.ts` — new columns / enums / tables
```ts
<snippet from plan, or "not specified">
```
db:push needed? dev / prod order?

### DAL · Service · tRPC · Hooks · UI · Jobs / webhooks / scripts
(one subsection each, the same shape: path, the signature or snippet quoted from the plan, and the existing primitive it reuses or why none fits)

### Deletes and moves
<file> → consumers today (`grep -rln`) → where each consumer goes
~~~

Quote only what the plan contains. Where the plan says something like "add a procedure that updates X" without showing the code, mark it **not specified**.

## Lenses

Every reviewer prompt starts with this preamble:

> You are stress-testing an UNBUILT implementation plan for a Next.js 15 / React 19 / tRPC v11 / TanStack Query / Drizzle (Neon) / better-auth / CASL / Tailwind v4 app at `<repo>`. Plan: `<plan>`. Spec: `<spec>`. Inventory of everything the plan creates, modifies or deletes: `<inventory>`. The code is the source of truth. Docs and memory may be stale, so verify every rule against the code before you cite it, and report any mismatch as `⚠️ Stale ref — <doc>:<line> says X, but code at <path> does Y`.
> READ-ONLY: never edit or create files outside `<scratchpad>`, never run state-changing git commands, make no DB writes, never run `pnpm build`, and run no script that touches a DB or an external service.
> Output: findings ranked BLOCKER / HIGH / MEDIUM / LOW. For each give the location (`plan:<task/step>` and the code `file:line`), the defect in one sentence, a concrete failure scenario, and a proposed amendment to the plan. Mark speculation UNVERIFIED. List briefly what is solid. Stay under ~700 words.

**A: Conventions and architecture** (`convention-auditor` agent)
> Compile the conventions that bind this plan's file map: `docs/codebase-conventions/`, `docs/adr/` 0001–0006, `docs/how-to/`, and the owner's coding rules in memory `coding-conventions.md`. Check them against the code. Then audit each task against them: layering (router → service → DAL, and services compose DAL calls without raw `db.*`), entity server specs and CRUD hooks, procedure types and scope middleware, enum pipeline, JSONB vs column vs child table (ADR-0005), provider boundaries, urls and origins, file placement under `src/shared/modules/<m>/<unit>/` (not `entities/`), one component per file, constants in `constants/`, named exports, comments that say why.

**B: Reuse and API surface** (`general-purpose`)
> For EVERY new export in the inventory, search for an existing primitive that already does the job before you accept it. Check the `createCrudDal` slots (getById/create/update/delete/duplicate), the business DAL functions and service methods in the owning module, query toolkit pieces, entity action configs and `<EntityActionMenu>`, compound overview cards and `<EntityList>`, DataView / DataTable, existing hooks, and shared helpers in `src/shared/lib/` and `src/shared/constants/`. Flag thin wrappers (a function whose body is one call to an existing slot), parallel helpers, a per-row loop where one multi-row DAL write fits, and a mutation placed on another entity's router. For each, name the primitive with `file:line` and show the one-line replacement.

**C: Completeness and flow** (`general-purpose`)
> 1. Build a coverage matrix that maps each spec decision (D#) and each acceptance line to the plan task(s) that deliver it. Mark each one covered, partial or missing. Also run it the other way: list every task step and file that no spec item asks for (scope drift; shared files like `package.json`, `app.ts` and routers count double).
> 2. Walk each user flow step by step and name what the plan leaves out: loading, empty, error and forbidden states; phone (390px) and desktop; light and dark; permissions (who can, who cannot, CASL rule source); query invalidation and prefetch-key parity; optimistic updates; idempotency and retries for jobs and webhooks; timezones (server UTC vs PT); schema push order; data backfill; consumers of every deleted or renamed export (run the grep).
> 3. Check that each task's verify step could actually fail if the task were wrong.

**D: Vocabulary, placement and plan hygiene** (`general-purpose`)
> 1. Check every new name (types, hooks, components, procedures, columns, copy labels) against `CONTEXT.md` (including its _Avoid_ lists), `docs/ubiquitous-language.md` and existing primitives. Flag invented terms and synonyms for things that already exist.
> 2. Run `ls` on every path the plan cites. Flag paths that do not exist yet are not marked Create, stale `entities/` paths, and files that other in-flight plans under `docs/superpowers/plans/` and `docs/plans/` also edit (collision risk).
> 3. Check for task ordering errors: a task that uses an export a later task creates.
> 4. Check that the plan's Global Constraints carry this repo's standing rules: explicit-path commits, no stash/reset, CRLF check, no DB writes for testing, tsc and lint only.

## Report

1. **What is planned**: the summary above.
2. **Verdict**, one line: *ready* / *ready after amendments* / *not ready, needs a spec decision*.
3. **Findings table**, severity first:

   | # | Sev | Lens | Where (plan → code) | Defect | Proposed amendment |
   |---|-----|------|---------------------|--------|--------------------|

   Below the table, give each BLOCKER and HIGH a short paragraph with the evidence, quoting both the plan snippet and the existing code that contradicts it.
4. **Coverage matrix**: D# → task(s) → covered / partial / missing, plus the scope-drift list.
5. **Stale refs** found along the way (doc vs code).
6. **Owner questions**: only product or architecture calls the code cannot settle, each with a recommended option. Ask them with `AskUserQuestion`.
7. **Solid**: what the plan gets right, in 3 to 5 bullets, so the owner knows what not to re-argue.
