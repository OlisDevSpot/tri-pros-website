---
description: "Run a UI exploration on a surface: baseline → critique with three directions → studies page the user can open → spec → plan → subagent build → Playwright verify → /impeccable polish. Use when the user wants to redesign, re-conceive, or explore directions for a meeting-flow step, page, or screen — e.g. 'explore layouts for the specialties tab', 'redesign the portfolio step', 'run the ui exploration on X'."
---

# UI Exploration

Read `docs/how-to/ui-exploration.md` in full and run it against: $ARGUMENTS

Start at Phase 0. Load `/impeccable layout` (or `critique` when the ask is evaluate-only) and `superpowers:brainstorming` before reading any code. Classify the request out loud.

Rules that bind the whole run:

- No app code before the user picks a direction and approves the spec. Mocks are throwaway HTML published as an artifact.
- UI only. Aggregate every DAL, tRPC, schema, or seed change the new UI needs into the spec's "Data access" section for the user to run first; gate dependent build tasks behind it.
- Root cause over per-instance fixes.
- Company facts only from `src/shared/constants/company/` or an existing typed constant.
- Shared working tree: no stash, checkout-dot, restore, reset, or `git add -A`; commit by explicit pathspec only, after the user answers the commit question.
- `pnpm tsc` + `pnpm lint` + Playwright; never `pnpm build`. Clear `.next` before judging rendered CSS on a long-running dev server.

Stop at every gate in the how-to's Gates table and ask with `AskUserQuestion`, recommended option first.
