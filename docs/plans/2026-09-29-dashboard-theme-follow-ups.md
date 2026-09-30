# Dashboard theme — follow-ups

Open items the Navy Rail theme (spec `docs/superpowers/specs/2026-09-29-dashboard-navy-rail-theme-design.md`) left on purpose. Delete each line when it ships.

- Meeting-flow program and benefit accents keep raw palette classes (`benefit-categories.ts`, `program-card.tsx`, `closing-step.tsx`, and any file Task 7 added to `THEME_TOKEN_IGNORES`). Decide their colors as a presentation decision, then drop them from the ignore list in `eslint.config.js`.
- `--text-presentation-label` (min 13px) and `--text-presentation-body` (min 17px) break the 2px rule at their minimums. The one-screen-per-slide rule makes resizing them a presentation decision.
- Detector non-color findings: nested cards on the kanban; the `side-tab` border in `story-challenge.tsx:50` and `story-solution.tsx:76`; `border-t-2` on rounded kanban columns.
- Part B of the spec (floating mobile dock) is a brief for a new session.
- Categorical chart palette `--chart-1..5` fails the dataviz validator (light: slate below chroma floor; teal↔blue ΔE 13.3 < 15; amber 2.74:1 vs white. dark: teal/amber/slate outside the lightness band, teal/slate below chroma floor, teal↔blue ΔE 13.4). Values kept as the spec states; tune the categorical set (owner call).
- `THEME_TOKEN_IGNORES` also holds `src/features/meeting-flow/ui/components/steps/who-we-are/reputation-mark.tsx` (a generic rating star; `fill-chart-3 text-chart-3` could replace it and drop the ignore).
- One "gold highlight" mapping: the project-media "Hero" badge uses `bg-warning` as a gold fill while the owner crown uses `text-chart-3` (≈2.2:1 on white). Pick one.
- `src/shared/components/presentation/heading-column.tsx:48` keeps the fluid `text-[11cqw]` numeral; the type-ramp guard only bans fixed px/rem sizes. Decide with the presentation clamps.
- Look changes to check at the owner's visual pass: program-step hero and PWA install prompt now use card/muted/popover (they were dark-on-dark in light mode); customer hero ground/scrim is translucent black (an opaque ground would be deterministic).
- Six files carry theme edits that are NOT committed because other sessions had uncommitted work in them: `src/features/lead-sources-admin/ui/components/{all-customers-section,all-detail,lead-source-customers-section,source-detail}.tsx`, `src/features/agent-dashboard/ui/components/{dashboard-list-section-header,dashboard-snapshot-chips}.tsx`. Commit them with that work.
