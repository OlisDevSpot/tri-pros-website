# Dispatched Session — Issue #56

**You are a dispatched Claude Code session working on a specific issue.**

## Your Assignment
- **Issue**: #56 — refactor(dashboard): migrate from query-param hub to nested route architecture
- **Branch**: `refactor/56-refactor-dashboard-migrate-from-query-pa`
- **Labels**: area:frontend, P2, type:refactor
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
2. **Follow conventional commits**: `refactor(scope): description`
3. **Do NOT create a PR.** The user will do that via `dispatch pr 56`.
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

Migrate the dashboard from a single `DashboardHub` component with `?step=` query-param routing to proper Next.js nested routes under `/dashboard/`.

## Problem

The current dashboard architecture routes ALL views through a single `DashboardHub` component (`src/features/agent-dashboard/ui/views/dashboard-hub.tsx`). Navigation between sections (Pipelines, Meetings, Proposals, Showroom, Settings) is controlled by a `?step=` nuqs query parameter, and every view is conditionally rendered inside the same page via `AnimatePresence` blocks.

This doesn't scale:
- **DashboardHub grows proportionally** — every new section/sub-view adds another `AnimatePresence` block to the hub
- **No code-splitting** — all views are imported and bundled together regardless of which one the user visits
- **Sub-navigation is awkward** — e.g., Meetings has `meetings`, `create-meeting`, `edit-meeting` all as top-level step values instead of scoped under `/dashboard/meetings?step=edit`
- **URLs aren't semantic** — `/dashboard?step=customer-pipelines` vs `/dashboard/pipelines`

## Proposed Architecture

```
src/app/(frontend)/dashboard/
├── layout.tsx              ← SidebarProvider + AppSidebar + SidebarInset (shared)
├── page.tsx                ← Dashboard home/overview
├── pipelines/
│   └── page.tsx            ← CustomerPipelineView
├── meetings/
│   ├── page.tsx            ← MeetingsView (list + create, uses ?step= internally)
│   └── [meetingId]/
│       └── page.tsx        ← MeetingFlowView (already exists as a route)
├── proposals/
│   ├── page.tsx            ← PastProposalsView (list, uses ?step= for create/edit internally)
│   └── [proposalId]/
│       └── page.tsx        ← Edit proposal
├── showroom/
│   ├── page.tsx            ← PortfolioProjectsView
│   └── [projectId]/
│       └── page.tsx        ← Edit project
├── settings/
│   └── page.tsx            ← Agent profile & settings
├── intake/
│   └── page.tsx            ← Intake form (super-admin)
└── team/
    └── page.tsx            ← Team overview (super-admin)
```

**Key principle**: The `?step=` param moves DOWN into individual pages for their internal sub-navigation (e.g., `/dashboard/meetings?step=edit`), rather than living at the top-level hub.

## Migration Steps

1. Move `SidebarProvider` + `AppSidebar` into `dashboard/layout.tsx` (will already be done in #9)
2. Create route directories for each section
3. Move each view into its own `page.tsx` with a server component wrapper
4. Update sidebar nav items to use `pathname`-based active state instead of `?step=`
5. Migrate internal sub-navigation to per-page `?step=` params where needed
6. Remove `DashboardHub` and the monolithic step-switch pattern
7. Add `AnimatePresence` at the layout level for route transitions (optional)

## Dependencies

- #9 (Agent Profile & Settings) — establishes the new sidebar + layout foundation

## References

- Current hub: `src/features/agent-dashboard/ui/views/dashboard-hub.tsx`
- Current step parser: `src/features/agent-dashboard/lib/url-parsers.ts`
- Current sidebar items: `src/features/agent-dashboard/constants/sidebar-items.ts`
