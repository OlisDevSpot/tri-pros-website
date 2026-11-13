---
name: stress-test-plan
description: Stress-tests a written spec or implementation plan before any code is built. It summarizes what the plan will build, layer by layer with the plan's own code snippets, then sends read-only reviewers to check it against this repo's conventions, ADRs, approved patterns and existing API surface (no ad-hoc thin wrappers, no bespoke UI where an entity component exists). It verifies every finding against the code, checks that each spec decision maps to a task, and ends with a verdict and the questions only the owner can answer. Use when the owner says "/stress-test-plan", "stress test this plan", "before we trust this plan", "is this plan complete", "gauge this plan", "poke holes in the spec", or when a plan or spec under docs/superpowers/ or docs/plans/ has just been written and has not been built.
---

# Stress-test a plan

A plan is cheap to fix and code is not. Find what the plan gets wrong, leaves out or invents before a subagent builds it. **Read-only until the owner rules.** Never write app code, run DB writes or `pnpm build`, or commit. The only files this skill may edit are the plan and spec, and only after the owner rules on the findings (step 7).

## Inputs

The plan path, plus the spec and tracker row it names in its header. With no path given, take the newest file under `docs/superpowers/plans/` with no code built against it, and say which one you chose. If there is a spec but no plan, test the spec alone and skip the task-level checks.

## Workflow

Copy this checklist into the todo list and work it in order.

1. **Read everything the plan rests on**: the spec, the plan, the tracker row, and the memory files the `MEMORY.md` index marks "READ before …" for this area. Note each spec decision ID (D1, D2, …) and each owner ruling.
2. **Inventory the plan** into a scratchpad file: every file it creates, modifies or deletes; every new export (table, column, enum, DAL function, service method, tRPC procedure, hook, component, constant, script); and every user-visible flow. This inventory is what the reviewers check.
3. **Write the "What is planned" summary** in the shape of [REFERENCE.md §Summary](REFERENCE.md#summary). Go layer by layer (schema → DAL → service → tRPC → hooks → UI → jobs/webhooks/scripts) and quote the plan's own signatures and snippets with file paths. Where the plan describes code without showing it, write "not specified". A gap you can see in the summary is a finding.
4. **Send the reviewers out**: four read-only subagents in ONE message, in the background, one per lens in [REFERENCE.md §Lenses](REFERENCE.md#lenses). Lens A goes to the `convention-auditor` agent and lenses B–D go to `general-purpose`. Give each one the inventory path, the plan and spec paths, and its lens prompt.
5. **Check every BLOCKER and HIGH finding yourself** before you repeat it. Open the cited `file:line` and run the grep. Drop a finding you cannot confirm, or label it UNVERIFIED. When a doc or memory disagrees with the code, report it as `⚠️ Stale ref — <doc>:<line> says X, but code at <path> does Y.`
6. **Report** in the shape of [REFERENCE.md §Report](REFERENCE.md#report): summary, verdict, findings, coverage matrix, owner questions. Ask the owner questions with `AskUserQuestion` (max 4 per call, recommended option first) and only for decisions the code cannot settle.
7. **Amend on rulings.** Once the owner rules, edit the spec and plan to fold in each accepted finding and ruling: fix the task's files and steps, its interface block, the Review Focus, and the spec's decision list. Record any new term in `CONTEXT.md` in the same edit. Then say what changed. Do not commit unless asked.

## What counts as a finding

- **Thin or ad-hoc API.** A new function, procedure or hook does something an existing primitive already covers: `createCrudDal` slots, an existing business DAL or service method, the query toolkit, entity action configs, compound entity components, or shared helpers such as `phone.ts`, `ROOTS` and business time. Name the primitive and its `file:line`.
- **Wrong owner or layer.** A router writes another entity's rows, a service runs raw `db.*`, entity UI is built outside its module, or new code goes outside the module it belongs in.
- **Convention breaks.** The plan breaks a rule in `docs/codebase-conventions/`, an ADR, or the coding rules (one component per file, constants in `constants/`, named exports, comments say why).
- **Scope drift.** A task touches a file or shared config the spec never names, or a spec decision has no task.
- **Invented vocabulary.** A name is missing from `CONTEXT.md` and `docs/ubiquitous-language.md`, appears on an _Avoid_ list, or duplicates an existing primitive.
- **Unhandled reality.** Loading, empty, error or forbidden states; phone and dark mode; permissions (CASL); cache invalidation and prefetch keys; idempotent jobs and webhooks; a `db:push` order; consumers of deleted files; prod-only traps (UTC, hydration, serverless sends).
- **Untestable task.** A task has no verify step, or its verify step cannot fail.

## Rules

- Evidence over opinion. Every finding needs a `file:line` in the code or the plan, a concrete failure scenario, and a proposed amendment.
- Reviewers are read-only. Before the report, check that `git status` shows no new files they left behind.
- Plans drift too. Treat a path the plan names but `ls` cannot find (for example `entities/` versus `modules/`) as a finding.
- Keep the report scannable: severity first, one line per finding in the table, details below it.
