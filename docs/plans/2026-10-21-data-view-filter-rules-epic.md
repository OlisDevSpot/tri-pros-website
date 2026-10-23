# Data-view filter rules — Epic Tracker

> **Status:** 🌱 **OPENED 2026-10-21.** FR1 picked; FR2 spec written and stress-tested 2026-10-22 (rulings O8–O11 folded in), awaiting owner approval. Nothing is built.
> **Started:** 2026-10-21, from the owner: "we should be able to quickly filter by *had a sit*" on the schedule page, which led to the deeper ask, a rule-based filter (add a rule, group by AND / OR, IS / IS NOT, fields picked from a dropdown) that every entity in every data view can use.
> **This file is the live index of the order.** It holds no design. Cite its IDs (FR0…) in specs, plans and commits, and update it as each step lands.
> **Baseline:** local `main` at `d914445cd` (2026-10-21).

**Goal in one line:** any entity shown in any data view can be narrowed with the same rule builder, so the team can ask the table the exact question it needs ("sat, OR not set yet, AND rep is not Dan") without a developer adding a filter.

**Owner's principle (2026-10-21):** filtering is crucial for every entity and every data view, so it needs the right architecture, not a per-page patch. UI first (warm-up, owner picks with their eyes), then the architecture brainstorm, fitted to the codebase rules.

Legend: `[ ]` open · `[~]` in progress · `[x]` done · ⏸ waiting on another step.

---

## 1. What exists today (verified 2026-10-21 against the code)

| Layer | Today | Where |
|---|---|---|
| Field list | One per entity; each field declares at most one toolbar filter of a fixed kind (`multi-select`, `select`, `date-range`, `number-range`, `boolean`) or a `fixed` filter set in code | `src/shared/dal/lib/query/field-list.ts`; meetings `src/shared/entities/meetings/dal/meeting-fields.ts`, customers `src/shared/entities/customers/dal/customer-fields.ts`, activities `src/shared/entities/activities/dal/activity-fields.ts`, projects `src/shared/modules/projects/core/dal/project-fields.ts` |
| Server SQL | One `where` per field id, every active filter ANDed; a filter can only mean "is one of" | `defineFieldSql`, e.g. `src/shared/entities/meetings/dal/server/meeting-field-sql.ts` |
| State | Flat `{ [fieldId]: value }` in the URL under the view's `paramPrefix` | `useDataViewQuery`, `src/shared/dal/client/lib/types.ts` |
| UI | Filters popover (desktop) / bottom sheet (below lg) renders **every** toolbar filter at once; the chip rail shows one chip per active field | `src/shared/components/data-view/query-toolbar/ui/filter-trigger.tsx`, `filter-popover-body.tsx`, `filter-sheet-body.tsx`, `chip-rail.tsx` |
| Per-view choice | Each view's config names which field ids its toolbar shows | e.g. `src/features/schedule-management/constants/schedule-queries.ts` (`toolbar: [...]`) |
| Outside the system | Analytics builds its own multi-select definitions and reuses only the control | `src/features/analytics/lib/filter-fields.ts` |

What cannot be expressed today: OR across fields, IS NOT on any field, two rules on one field, and any filter the field list did not pre-declare as a single kind.

**Sit is already a domain fact.** `MEETING_OUTCOME_SIT` (`sat | not_sat | unknown`) and `isSit()` live in `src/shared/constants/enums/meetings.ts:108-135`; analytics already derives `sit` from it (`src/features/analytics/lib/build-lead-records.ts:59`). A Sit filter is a derived filter over `meeting_outcome`, no schema change.

---

## 2. Order

| ID | Step | Source of truth | Status |
|---|---|---|---|
| **FR0** | **Filter grouping fields (quick win).** Value lists `meetingSits` / `meetingOutcomeSentiments`, generic inverse `valuesInGroups` (`stagesForBuckets` folds in), label maps in `modules/meetings/core/constants/`, meetings `sit` (Sat · Didn't Sit · Not Set) and `outcomeSentiment` ("Outcome type": Positive · Neutral · Negative · Not Set) on today's flat toolbar (`pm`, `s`); the Filters popover scrolls inside the screen (O12); sentiment colour maps typed (O14). Becomes a filter-rule field later unchanged. | spec §4 | [~] spec approved 2026-10-22; plan `docs/superpowers/plans/2026-10-22-filter-grouping-fields.md` stress-tested 2026-10-22 (8.5/10, amended); awaiting owner's go |
| **FR1** | **Filter-builder UI warm-up.** Three directions for the rule builder, as working mocks in the app's tokens, on one private page. Owner picks one, with corrections. | `/ui-warmup` page https://claude.ai/artifact/PgC7K7kAcsdPtsuTDecGBT (A popover rules · B docked panel + quick filters · C chips in the bar) | [x] owner picked **A + B's quick-filter row** 2026-10-21, with correction O4 |
| **FR2** | **Architecture brainstorm → spec.** | `docs/superpowers/specs/2026-10-21-data-view-filter-rules-design.md` | [~] written + builder-checked 2026-10-21; stress-tested 2026-10-22 (spec §12), O8–O11 folded in; awaiting owner approval |
| **FR3** | **Stress-test the spec, then the plan,** against the conventions, ADRs, existing API surface and the in-flight data-view steps. Nothing is built until both pass (O5). | `/stress-test-plan` on the spec, then again on the FR0 plan and the FR4/FR5 plan | [~] spec done 2026-10-22 (7/10 on conventions as first written; amended); plans pending |
| **FR4** | **Core:** filter rule model + schema, is / is not, one gated `where` / `orderBy` (filter rules, flat filters, sort), nuqs codec + `dataViewHref`, per-rule derive, `filters: false` / `omit` / `quickFilters` config, `toolbar` arrays deleted, old flat links dropped (O9). **Ships in one release with FR5**, after DV3 + DV3a + DV4. | spec §5–§7, §9 | ⏸ FR3, DV4 |
| **FR5** | **Builder UI** in `query-toolbar/`, desktop and phone, replacing the all-at-once popover and sheet bodies; reuses `SingleFilterControl`, `FilterChip`, `ToggleGroup`, `toToolbarFilters`. Same release as FR4. | spec §8 | ⏸ FR3, DV4 |
| **FR6** | **Verification per view** with pass criteria (spec §9): records pm/pj/pc, lead-sources, kanban (no Pipeline), schedule meetings + activities, dashboard lists (no filters). Proposals / campaign leads join with DV8 / DV9; analytics out. | spec §9 | ⏸ FR5 |
| **FR7** | **Breakdown by grouping field** (proposed): e.g. this week by outcome type, Not set its own bucket. Own spec. | — | ⏸ FR0 |

---

## 3. Open questions for FR2 (not decided)

- **Rule model:** one level of groups (rules AND inside, groups OR between, or the reverse) vs. nested groups. Notion / Linear / Airtable precedent; the warm-up shows the trade-off.
- **Operators per kind:** `is` / `is not` for selects; `is any of` / `is none of` for multi-select; `before` / `after` / `between` for dates; `is empty` / `is not empty`; which are v1.
- **URL encoding:** the tree in one compact param vs. today's flat keys; old links keep working; how `ROOTS.scheduleWithMeetingHighlight` (writes `s_d`) and other deep links survive.
- **Field list contract:** does a field declare its operators, or does the kind imply them; how derived fields (Sit) and `fixed` filters sit beside rules.
- **Server:** `defineFieldSql` gains a negation-safe `where` per operator (NULL handling for IS NOT); the date window stays outside the rules.
- **Chips:** one chip per rule, per group, or a summary chip ("3 rules") that opens the builder.
- **Role-gated fields:** Rep / Lead source gates wait on #285 CASL (records tracker O4); the field picker must hide refused fields the same way options hide today.
- **Saved views / presets:** in or out of v1 (owner).
- **Analytics:** joins the system or keeps its own filter keys.

---

## 4. Owner rulings

| # | Question | Ruling |
|---|---|---|
| O1 | Names and labels | **As proposed** (2026-10-21): "Sit" (Sat · Didn't sit · Not set), "Outcome type" (Positive · Neutral · Negative · Not set), quick filter "Sits"; terms rule, group, quick filter, grouping field. |
| O2 | Schedule default | **Unfiltered** (2026-10-21); "Sits" one tap away. |
| O3 | Builder direction | **A + quick filters** (2026-10-21): rules live in the existing Filters popover and phone sheet (field · IS / IS NOT · values, AND / OR groups), with a one-tap quick-filter row ("Had a sit") on top. B's docked panel and C's chip builder are not pursued. |
| O4 | Value pickers | **Plain dropdowns from the existing primitives** (2026-10-21): the field and values controls reuse `Select` / `MultiSelect` (as `filter-controls/` does today). The warm-up's custom floating values menu (its own IS / IS NOT, count and Done) is rejected as over-built. |
| O6 | Rule fields | **Every field the viewer's role may read** (2026-10-21), enforced on the server; per-view toolbar lists go. "An agent should not be able to filter by setter, or customers by an admin-only lead source." |
| O7 | Project meetings and sits | **A project visit is a sit of that meeting; the "Sits" quick filter leaves project meetings out** (2026-10-21). |
| O8 | Names (2026-10-22) | **Keep the original names, prefixed with `filter`:** filter rule, filter group, filter rule tree, filter grouping field (`FilterRule`, `FilterGroup`, `FilterRuleTree`, `filterRules`…), so they never read as CASL rules or analytics group-by. In CONTEXT.md. |
| O9 | Old filter links (2026-10-22) | **Dropped:** links with today's flat keys open unfiltered; no compatibility layer. Every link the app builds moves. |
| O10 | View opt-outs (2026-10-22) | **Two config flags:** `filters: false` for the six dashboard lists, `omit: ['pipeline']` on the kanban. |
| O11 | Sort gate (2026-10-22) | **Gated like filtering:** a field the role may not filter by is not sortable either (agents lose Rep / Setter / Lead source sort). |
| O12 | Filters popover height | **Scrolls inside the screen**, fixed in FR0 (2026-10-22, FR0 plan stress test). |
| O13 | Label casing | **Title Case**: Sat · Didn't Sit · Not Set; Positive · Neutral · Negative · Not Set (2026-10-22). |
| O14 | Sentiment colour maps | **Retyped to `MeetingOutcomeSentiment`** in FR0 (2026-10-22). |
| O5 | Quality gate | **Stress-test before any code** (2026-10-21): the FR2 spec and the FR4/FR5 plan each go through `/stress-test-plan`. |

---

## 5. Hazards

- **In-flight data-view work.** DV3 + DV3a are on local main, unshipped, and ship with DV4; DV5 (calendars) and DV6 (kanban) are unplanned. FR5 edits `query-toolbar/` and the toolbar part, so its plan orders itself against `docs/plans/2026-10-12-data-views-epic.md`.
- **Two schedule configs share the `s` prefix** (`schedule-queries.ts`): a rule tree in the URL must not carry a meetings rule into the activities view.
- **Hidden filters still apply** (chip rail keeps a removable chip for a URL value whose control is hidden); the builder must keep that guarantee.
- **New names** (rule, group, operator labels, the builder's component names) go to the owner before a plan uses them; check `CONTEXT.md` and `docs/ubiquitous-language.md` first.
