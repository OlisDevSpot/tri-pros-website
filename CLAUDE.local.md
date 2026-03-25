# Dispatched Session — Issue #40

**You are a dispatched Claude Code session working on a specific issue.**

## Your Assignment
- **Issue**: #40 — feat(meetings): complete overhaul — schema & logic improvements
- **Branch**: `feat/40-feat-meetings-complete-overhaul-schema-l`
- **Labels**: area:sales-flow, P1, type:feature, claude
- **Port**: 3001 (use `pnpm dev -- --port 3001` if you need a dev server)

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
2. **Follow conventional commits**: `feat(scope): description`
3. **Do NOT create a PR.** The user will do that via `dispatch pr 40`.
4. **Do NOT push to remote.** The user controls when to push.
5. **When blocked**: stop and explain what you need. Do not guess or work around it.

## When Done
1. Run `pnpm lint` and fix any errors.
2. Run `pnpm build` and fix any errors.
3. Review your own diff with `git diff` — check for unintended changes, debug logs, or leftover code.
4. Commit your work using conventional commits matching your branch type.
5. Say **"DONE — ready for review"** so the user knows you're finished.

## Dev Server
If you need to run the dev server, use port 3001 to avoid conflicts:
```bash
pnpm dev -- --port 3001
```

## Issue Body
## Summary

Full overhaul of the meeting flow — schema, logic, and UX. This is a brainstorm-first issue; implementation follows after design is aligned.

## Context

The meeting flow is the core sales event in TPR's funnel (see `docs/sales/in-home-meeting-playbook.md`). The "Due Diligence Story" (`docs/sales/due-diligence-story.md`) defines the narrative framework and psychological levers that must be front-and-center in the meeting flow implementation.

Key concept: the meeting flow is a **customer journey**, not just a data entry form. Every step should map to the due diligence story (licensing, scope, supervision, communication, office support, proof of performance) and leverage the 6 psychological levers (authority transfer, fear inoculation, contrast effect, commitment & consistency, identity alignment, the reframe).

## Scope

- [ ] Brainstorm session required before any implementation
- [ ] Review current schema (`src/shared/db/schema/meetings.ts`) and entity model
- [ ] Review current meeting flow steps and identify gaps
- [ ] Align flow steps with the due diligence story narrative
- [ ] Schema improvements (fields, JSONB structure, relationships)
- [ ] Logic improvements (step progression, validation, data capture)
- [ ] Ensure customer profiling data lands on the right entity (customer vs meeting vs proposal)

## References

- `docs/sales/due-diligence-story.md` — narrative framework + psychological mechanics
- `docs/sales/in-home-meeting-playbook.md` — current meeting phases
- `docs/customer/decision-psychology.md` — emotional drivers
- `docs/customer/journey-map.md` — Stage 3 (Evaluation)
- `src/features/meetings/` — current implementation
- `src/shared/entities/meetings/schemas.ts` — current JSONB schemas

## Labels

area:sales-flow, type:feature, P1
