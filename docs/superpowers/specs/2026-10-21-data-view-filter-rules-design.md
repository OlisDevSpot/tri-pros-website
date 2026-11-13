# Data-view filter rules — design

> **Epic:** `docs/plans/2026-10-21-data-view-filter-rules-epic.md` (this is FR2; it also redefines FR0).
> **Status:** stress-tested 2026-10-22 (`/stress-test-plan`, four lenses, 7/10 on conventions as first written); findings and owner rulings O8–O11 folded in (§12). **Approved by the owner 2026-10-22** (URL-only state kept; "filters stick per tab" left for later). FR0 plan: `docs/superpowers/plans/2026-10-22-filter-grouping-fields.md` (stress-tested 2026-10-22, 8.5/10; O12–O14); the FR4+FR5 plan follows. Each is stress-tested before code (O5).
> **Baseline:** local `main` at `095169a44`. Facts below were read from the code on 2026-10-22; paths are cited so a builder can re-verify.

## 1. Intent

Every data view (CONTEXT.md: one surface listing one entity's records through `useDataViewQuery`) can be narrowed with the same builder: add a filter rule, pick a field from a dropdown, choose **is** or **is not**, pick values, and combine filter rules with AND / OR in filter groups. Filter rules speak the business's own categories, not only raw column values: a meeting can be filtered by **Sit** (Sat · Didn't Sit · Not Set) or **Outcome type** (Positive · Neutral · Negative · Not Set), because the app already classifies outcomes that way.

The owner's trigger questions are instances, not the scope:
- "Leave out 1 of 10 values" → **is not** on any field.
- "How many real meetings did we have this week?" → the **Sit** filter grouping field, and a one-tap "Sits" quick filter on every meetings view.

Owner principle (2026-10-21): "We are trying to build robust systems that will scale with our app. DO NOT think single use-case." A new entity, field or classifier must reach the builder without a developer touching it.

## 2. Goals, non-goals, anti-goals

**Goals**
- G1. One filter rule model for every field-list data view: filter rules (field · is / is not · values), AND / OR, one level of filter groups.
- G2. **Filter grouping fields:** any canonical classifier map over an enum column (`Record<Value, Group>`) becomes a filterable field, compiled through its inverse. A value added to the enum and classified in the map reaches every filter with no filter code touched.
- G3. **Quick filters:** named filter rules declared once per entity, a one-tap row on every view of that entity that allows their fields.
- G4. The UI is option A from the warm-up (O3): filter rules inside the existing Filters popover (desktop) and bottom sheet (below lg), quick-filter row on top. Field, operator and value pickers are the existing `Select` / `MultiSelect` and the existing per-kind filter controls (O4).
- G5. Server and client derive the same query input from the same URL (prefetch parity), and the server stays the only place SQL is built.
- G6. **Every field the viewer's role may filter by, and nothing else** (O6). The gate is one function per field, enforced on the server for filter rules, flat filters and sort (O11); the UI only hides what the server would ignore.
- G7. Today's guarantees survive: fixed filters stay applied and invisible, the date window stays outside the filter rule tree, invalid URL input is dropped per rule and never throws, and a filter rule whose options are still loading keeps applying with a removable chip.

**Non-goals (this spec)**
- Saved views / user-defined quick filters stored in the DB. Quick filters are declared in code.
- Counting / breakdown ("this week: 12 positive, 5 neutral, 3 negative, 4 not set"). It reuses the filter grouping fields but is its own step (FR7, own spec).
- Analytics filters. Analytics keeps its own filter keys and its "Not applicable" rules; it may adopt filter grouping fields later.
- The two legacy `fromPaginatedQuery` views (proposals, campaign leads). They join when DV8 / DV9 move them onto field lists (§7.5).
- Nested filter groups deeper than one level; "is empty / is not empty"; text "contains"; relative dates in filter rules.
- Multi-column or related-row classifiers (customer derived pipeline, fresh stage, campaign lead status, "unresolved meeting"). They stay fields with hand-written SQL, as customer `pipeline` already is (§4.3).
- **Old filter links** (O9). Links that use today's flat keys (`pm_outcome=…`) open the page unfiltered after FR4; every link the app builds moves in the same change (§7.1).

**Anti-goals (a failure even if it works)**
- A hard-coded list of outcome or meeting-type values in a filter, quick filter or chart, instead of a derivation from the canonical classifier or predicate.
- "Not set" folded into another group.
- A bespoke picker or floating values menu (O4).
- A second filter pipeline beside `defineFieldSql` / `useDataViewQuery`, a hand-rolled URL serializer, or per-view filter code.
- A filter rule, flat filter or sort on a field the viewer's role may not filter by changing the result, from the UI or from a hand-typed URL or API call.

## 3. What exists today (verified 2026-10-22)

| Layer | Today | Where |
|---|---|---|
| Field list | `defineFieldList` with toolbar kinds `multi-select`, `select`, `date-range`, `number-range`, `boolean`, plus `fixed`; option sources `trades / reps / setters / leadSources` | `src/shared/dal/lib/query/field-list.ts`; `OPTION_SOURCES` at `src/shared/dal/lib/query/constants.ts:15`, `RESERVED_URL_SUFFIXES` at `:11` |
| Entities on it | meetings, customers, activities (still under `src/shared/entities/`), projects (`src/shared/modules/projects/core/dal/project-fields.ts`) | |
| Server SQL | `defineFieldSql(fields, { filter, sort }, order)`; `where(filters)` ANDs every active field (`isActive` treats `''`, `[]`, `{}`, `false` as off); `orderBy(sort)` throws on an unsortable id; conditions are typed `SQL \| undefined` | `src/shared/dal/server/lib/query/field-sql.ts:12-80` (file imports `server-only`) |
| Read sites | 5 `*_FIELD_SQL.where(` calls behind 6 procedures | meetings `entities/meetings/dal/server/queries.ts:109` (`reads.list`); customers `entities/customers/dal/server/queries.ts:182` (`business.list`, and `leadSourcesRouter.getCustomers`, which DV4 deletes); customers `entities/customers/dal/server/pipeline-items.ts:72` (kanban); activities `entities/activities/dal/server/queries.ts:37` (schedule); projects `modules/projects/core/dal/server/queries.ts:197` (`crud.list`) |
| Only server gate | `listMeetings` strips `proposalStatus` for a role without `read Proposal` | `entities/meetings/dal/server/queries.ts:104-105` |
| Client gate | `OPTION_SOURCE_READS[source].canRead(ability)` only disables the options read; the parser is built from the view's `toolbar` whatever the role, so a hand-typed `pm_setter=` applies for an agent today | `src/shared/dal/client/constants/option-source-reads.ts:13-38`, `derive-data-view-input.ts:52-55`, `use-data-view-query.ts:132-141` |
| URL + derive | One nuqs key per toolbar field `${prefix}_${id}`; `deriveFilterSortState` validates each value with the field's `filter.schema.safeParse` and drops failures | `src/shared/dal/lib/query/derive-data-view-input.ts:83-110`; parsers `filter-parser-registry.ts:26-44` (`parseAsJson(schema.parse)` for ranges) |
| Prefetch parity | `loadDataViewQueryInput` runs the same parsers + derive on the server; it takes no ability | `src/shared/dal/server/lib/query/load-data-view-query-input.ts:15-25` |
| URL builders | nuqs `createSerializer` already used | `src/features/omni-search/lib/build-omni-registry.ts:17`, `src/features/calculators/constants/calculator-tab-meta.ts:13` |
| Hand-built filter links | `hygieneHref` writes `pm_outcome`, `pm_scheduledFor` (and `pp_*` for proposals) | `src/features/analytics/lib/hygiene-links.ts:12-23` |
| "No filters" views | 6 dashboard configs declare `toolbar: []` | `src/features/agent-dashboard/constants/dashboard-queries.ts:24-101` |
| Kanban | `CUSTOMER_PIPELINE_QUERY` (`cp`), its pipeline comes from the route | `customer-pipeline-query.ts:6-11` |
| UI | Filters popover `w-80` / bottom sheet render every toolbar filter at once (`filter-control-field.tsx` → `SingleFilterControl`); chip rail = one `FilterChip` per field; `toToolbarFilters` marks a field `hidden` for "loading", "refused" and "not permitted" alike | `src/shared/components/data-view/query-toolbar/{ui,lib}/` |
| Classifiers | `MEETING_OUTCOME_SENTIMENT` (`positive / neutral / negative / unset`), `MEETING_OUTCOME_SIT` (`sat / not_sat / unknown`): forward maps; the group types are bare unions with no value list | `src/shared/constants/enums/meetings.ts:71,85,108,114` |
| Grouping precedent | `PROJECT_STAGE_BUCKET` + `projectStatusBuckets` list + inverse `stagesForBuckets` (one caller) + `PROJECT_STATUS_BUCKET_LABELS` in the module | `src/shared/constants/enums/pipelines.ts:63,81,116`; `modules/projects/core/constants/status-labels.ts:3`; `project-field-sql.ts:14` |
| Labels | `MEETING_OUTCOME_LABELS` (`not_set: 'Not Set'`) | `src/shared/entities/meetings/constants/status-colors.ts:51-52` |

## 4. Filter grouping fields (FR0)

### 4.1 Mechanism

A filter grouping field is an ordinary `multiSelect({ values, optionLabel })` field whose values are a classifier's groups and whose SQL is `inArray(column, valuesInGroups(map, groups))`. No new filter kind: the field list, URL, chips, controls and builder treat it as any static multi-select (exactly the projects `statusBucket` pattern).

- `valuesInGroups<V extends string, G extends string>(map: Record<V, G>, groups: readonly G[]): V[]` beside the classifiers in `src/shared/constants/enums/` (isomorphic; `src/shared/lib/` is acceptable if the plan finds a better home). It derives from the map, so a newly classified value reaches every filter.
- `stagesForBuckets` is **deleted**; its one caller (`project-field-sql.ts:14`) calls `valuesInGroups(PROJECT_STAGE_BUCKET, v)` inside its existing `coalesce`. One inverse in the codebase.
- Value lists beside the types, as `projectStatusBuckets` does: `meetingSits = ['sat', 'not_sat', 'unknown'] as const` and `meetingOutcomeSentiments = ['positive', 'neutral', 'negative', 'unset'] as const`, types derived from them. The list order is the picker order.
- Label maps typed `Record<Group, string>` (a missing label fails tsc) in a new `src/shared/modules/meetings/core/constants/` file (new meetings code goes to the module; the projects labels live in their module too): `MEETING_SIT_LABELS = { sat: 'Sat', not_sat: "Didn't Sit", unknown: MEETING_OUTCOME_LABELS.not_set }`, `MEETING_OUTCOME_SENTIMENT_LABELS = { positive: 'Positive', neutral: 'Neutral', negative: 'Negative', unset: MEETING_OUTCOME_LABELS.not_set }`: Title Case like every other picker (O13), and "Not Set" read from the outcome labels so it has one spelling.

### 4.2 First filter grouping fields (meetings)

| Field id | Label | Values (order) | SQL |
|---|---|---|---|
| `sit` | Sit | Sat · Didn't Sit · Not Set | `inArray(meetings.meetingOutcome, valuesInGroups(MEETING_OUTCOME_SIT, v))` |
| `outcomeSentiment` | Outcome type | Positive · Neutral · Negative · Not Set | `inArray(meetings.meetingOutcome, valuesInGroups(MEETING_OUTCOME_SENTIMENT, v))` |

`meetingOutcome` is non-null with default `not_set` (`db/schema/meetings.ts:31`), so no `coalesce`. Edits to `meeting-fields.ts` / `meeting-field-sql.ts` stay in place (they move with the modules consolidation, not here). The per-meeting Sit differs from analytics' "Sits" count by design (CONTEXT.md, Flagged ambiguities).

Ship note: unshipped `0d0d33896` reclassifies `rescheduled` as negative, so "Outcome type: Negative" differs between local main and prod until it ships.

### 4.3 What is not a filter grouping field

A classifier that reads more than one column or related rows (customer `derivedPipelineSql`, `computeFreshStage`, campaign lead status, "unresolved meeting") stays a field with hand-written SQL. The builder treats it the same; only the `valuesInGroups` shortcut does not apply.

### 4.4 FR0 ships first

FR0 = value lists, `valuesInGroups` (with `stagesForBuckets` folded in), label maps, the `sit` and `outcomeSentiment` fields, added to today's `pm` and `s` toolbar arrays. It ships before the builder and becomes a filter-rule field in FR4 with no change.

## 5. The filter rule model

### 5.1 Shape

```ts
type FilterRule<F> = { field: FilterableId<F>; not?: true; value: FilterValue<F, field> }
type FilterGroup<F> = { op: 'and' | 'or'; rules: FilterRule<F>[] }          // one level only
type FilterRuleTree<F> = { op: 'and' | 'or'; items: (FilterRule<F> | FilterGroup<F>)[] }
```

All three live in `src/shared/dal/lib/query/` with the field list (isomorphic).

- The root has its own AND / OR and holds filter rules and filter groups; a filter group holds filter rules only: "A and (B or C)", "(A and B) or C".
- Two operators on every kind, **is** and **is not**; the label adapts to the kind (multi-select "is" / "is not", date-range "is within" / "is not within", boolean "is" / "is not"). Value controls are today's per-kind controls.
- A field may appear in many filter rules.
- Caps: 20 filter rules in the tree, 10 filter groups. The builder disables "Add rule" / "Add group" at the cap; input over the cap is truncated on the client parse and rejected (`BAD_REQUEST`) by the server.

### 5.2 Which fields a view offers

**Filterable fields** (O6): every field of the entity with a toolbar-kind filter, minus the view's fixed-filter ids, minus its date-window field, minus the config's `omit` ids (O10), minus fields the viewer's role may not filter by (§6.3). Field-list declaration order is the picker order. A view whose config says `filters: false` (O10) offers none and parses no filter rules from the URL.

The per-view `toolbar` arrays are deleted (FR4); the six `toolbar: []` dashboard configs become `filters: false`; the kanban config sets `omit: ['pipeline']` (its route owns the pipeline). The `schedule-queries.ts:31` type check that kept meetings and activities ids apart goes with the arrays (each entity has its own filter rules key, §7.1). The `T extends ToolbarFilterId` generic threaded through the toolkit for `toolbar` goes too.

### 5.3 Validation is per rule

- **URL (client and server prefetch):** the codec (§7.1) parses JSON into the tree's shape only. `deriveFilterSortState` then walks the tree in the loop that already validates each flat value (`derive-data-view-input.ts:96-103`): each filter rule's `value` goes through **that field's** `filter.schema.safeParse`; a rule that fails, names an unknown field or a field this view does not offer (`filters: false`, `omit`, fixed, window) is dropped; a filter group left empty is dropped; the rest is kept. One stale rep id never costs the whole tree. The role gate is **not** applied here (§6.4), so parsing needs no ability and prefetch parity holds by construction.
- **API input:** `filterRuleTreeSchema(fields)` in `fieldListInput` checks the shape and the caps strictly, and drops unknown or invalid filter rules leniently (an old open tab after a deploy that removed a field keeps working instead of failing every refetch with `BAD_REQUEST`).

### 5.4 Empty filter rules

A filter rule whose value is empty (`isActive` false) stays in the client tree, so a half-built row survives in the builder, but is not sent and adds no SQL. `activeFilterCount` = the active filter rules the viewer may filter by. Adding an empty row does not reset the page; picking a value does.

## 6. Server

### 6.1 One `where`, one gate

`defineFieldSql` keeps one entry point and grows it rather than adding a parallel compiler:

```ts
where(input: { filters?: FilterValues<F>; filterRules?: FilterRuleTree<F> }, ability: AppAbility): SQL | undefined
orderBy(sort: SortState<F> | undefined, ability: AppAbility): SQL[]
```

Inside, one private `conditionFor(id, value, ability)` does what today's loop body does (`conditions[id]`, `isActive`) plus the gate, and both the flat `filters` and the filter rule tree compile through it:

- Field the ability may not filter by (§6.3) → nothing, wherever it sits (flat filter, root, filter group).
- Filter rule **is** → the field's existing condition (the positive predicate; no field is rewritten).
- Filter rule **is not** → `not(coalesce(<positive>, false))`. The `coalesce` makes negation NULL-safe once for every field: a meeting with no setter matches "Setter is not Dan", a NULL `completedAt` matches "Completed is not within last month". Verified against every current predicate (LEFT-joined `customers.leadSourceId`, nullable `setBy`, `pipeline` `eq`, open-ended date ranges; EXISTS predicates are never NULL; `inArray(x, [])` compiles to `false`).
- **is not** on a to-many field negates the whole EXISTS: "Rep is not Dan" = no participant is Dan; "Proposal status is not Approved" = no proposal is approved.
- A positive that is `undefined` → the filter rule adds nothing, for **is** and **is not** alike (never `coalesce(, false)`).
- Filter group / root → `and(...)` / `or(...)` of the compiled children; inactive and gated children skipped; an empty filter group adds nothing.
- `orderBy` falls back to the default order for a sort id the ability may not filter by (it does not throw: a stale URL must not 500).

Dropping a gated filter rule changes the result set (wider under AND, narrower under OR) but never filters by the gated field. Fixed filters go through the same gate: today's fixed filters use ungated fields (`outcome`, `statusBucket`, `excludePortfolio`, and the super-admin-only lead-source pane's `leadSource`), and a fixed filter on a gated field would be dropped for a refused role, so the plan adds a check that no config fixes a gated field.

### 6.2 Input and read sites

`fieldListInput` gains `filterRules?: filterRuleTreeSchema(fields)`. Flat `filters` keeps accepting every field id: it carries fixed filters and the date window (`dashboard-queries.ts` fixes toolbar fields such as `outcome`). The client sends the viewer's filters only as `filterRules`; the server does not tell a fixed filter from a viewer filter, and does not need to, because the gate covers both.

Each read site changes `FIELD_SQL.where(input.filters)` to `FIELD_SQL.where(input, ctx.actor.ability)` and `orderBy(input.sort)` to `orderBy(input.sort, ctx.actor.ability)`: meetings `queries.ts:109/111`, customers `queries.ts:182/200`, `pipeline-items.ts:72/74`, activities `queries.ts:37/50`, projects `queries.ts:197/199`. Passing the ability into a server SQL helper has precedent (`customerSearchWhere(input.search, ctx.actor.ability)`, customers `queries.ts:181`). The bespoke `proposalStatus` strip (`meetings/queries.ts:104-105`) is deleted in the same change, because the gate now covers it. `leadSourcesRouter.getCustomers` is gone by then (DV4).

### 6.3 The gate per field

- `OPTION_SOURCE_GATES: Record<OptionSource, (ability: AppAbility) => boolean>` beside `OPTION_SOURCES` in `src/shared/dal/lib/query/constants.ts` (isomorphic): `trades` → always; `reps`, `setters` → `can('assign','Meeting')`; `leadSources` → `can('manage','all')`. `OPTION_SOURCE_READS[source].canRead` reads it (the client keeps its `queryOptions`), so the option read and the filter share one gate.
- A field spec may declare `canFilter?: (ability: AppAbility) => boolean` (the same shape as today's `canRead`). A field with a runtime option source and no `canFilter` inherits its source's gate. `proposalStatus` declares `ability => ability.can('read', 'Proposal')`. Every other field is open.
- One helper, `filterableIds(fields, ability)`, in `src/shared/dal/lib/query/`, used by the server (`conditionFor`, `orderBy`) and the client (field picker, quick filters, sort menu, chips, `activeFilterCount`).
- The gate means "may filter and sort by", not "may read": agents already receive `setterName` and `leadSource` on every meeting row (`queries.ts:127-134`); the owner ruled they may not filter or sort by them (O6, O11). CASL field rules cannot carry this (agents read every Meeting column), which is why it is a capability function and not a CASL rule.
- O11: agents lose the Rep, Setter and Lead source sort options they have today.

### 6.4 Prefetch parity

`toDataViewInput` emits `{ filterRules, filters: { ...fixed, [window.field]: range }, sort }`. Parsing and deriving take no ability (§5.3), so `loadDataViewQueryInput` and `useDataViewQuery` keep producing the same input from the same URL, and the dev guards (`useHydrationParityCheck`, `useServerPrefetchGuard`) cover it unchanged. A filter rule on a gated field that sits in the URL reaches the server and is ignored there; the client never shows it (no chip, not counted). This also avoids the client's `AbilityProvider` returning an empty ability until its rules query lands (`permissions/client.tsx:63-74`) from ever changing a query key.

## 7. Client

### 7.1 URL

- The tree lives in **one** key, `${prefix}_${filterRulesKey}`, default `filterRulesKey: 'f'`. The codec is one nuqs `createParser({ parse, serialize })` in `src/shared/dal/lib/query/` that maps short JSON keys ↔ the model (`{"o":"and","i":[{"f":"sit","v":["sat"]},{"f":"rep","n":1,"v":["…"]},{"o":"or","r":[…]}]}`); the model never sees the short keys. It parses shape only (§5.3).
- `filterRulesKey` joins `dataViewUrlKeys` (`derive-data-view-input.ts:14`) beside `anchorKey` / `viewKey`. The schedule's meetings and activities configs share prefix `s` (and must, for `s_d`); the activities config sets `filterRulesKey: 'af'`, so switching "Show" never carries one entity's filter rules into the other.
- `f` and `af` join `RESERVED_URL_SUFFIXES` (`constants.ts:11`); `filterRulesKey` is typed to that list, so no field id can collide with it. `url-state.ts:4` (the legacy `usePaginatedQuery` list, missing `d` and `v`) imports the same constant instead of keeping its own.
- **Old flat keys are no longer read** (O9). The flat per-field parsers go; a link with `pm_outcome=…` opens unfiltered. No compatibility layer.
- **Links built in code** use nuqs' own serializer: `dataViewHref(config, path, tree)` = `path + createSerializer(makeDataViewParsers(config))({ [keys.filterRulesKey]: tree })`, in `src/shared/dal/lib/query/`. `hygieneHref`'s `meetingsWithoutOutcome` link moves to it (Outcome is Not set AND Scheduled is within `{ to: asOf }`); its `pp_*` proposals links stay flat until DV8. `roots.ts` writes only `s_d`, unaffected. The meetings records config lives in `src/features/records-management/constants/`; if the import rules bar analytics from importing it, the plan moves that config (or the href call) to `src/shared/modules/meetings/core/`.

### 7.2 Hook API

`DataViewFilterSort` becomes a union with an explicit discriminant (so the toolbar never sniffs for a property):
- `mode: 'rules'` (every `useDataViewQuery` view): `filterRules: FilterRuleTree` (client tree, empty filter rules included), `setFilterRules(tree)` (one write, `history: 'replace'`, resets `_p` on page windows when an active filter rule changes), `clearFilters` (filter rules + search + sort, as today).
- `mode: 'flat'` (`fromPaginatedQuery`, §7.5): today's `filters` / `setFilter`.

### 7.3 Tree edits

Pure functions in one file in `src/shared/dal/lib/query/` (testable without React): `addFilterRule`, `updateFilterRule`, `removeFilterItem`, `addFilterGroup`, `toggleQuickFilter`. Changing a root or group operator is an inline spread, not a helper.

### 7.4 Quick filters

Declared next to the entity's field list, in the entity's module (`src/shared/modules/meetings/core/constants/` for meetings), as a typed constant (no identity wrapper):

```ts
export const MEETING_QUICK_FILTERS = {
  // A project visit is a sit of that meeting, but not a sales sit (O7).
  sits: { label: 'Sits', rules: [
    { field: 'sit', value: ['sat'] },
    { field: 'meetingType', not: true, value: meetingTypes.filter(meetingType => isProjectMeeting({ meetingType })) },
  ] },
} as const satisfies QuickFilters<typeof MEETING_FIELDS>
```

- The meeting-type value derives from `isProjectMeeting` (`meetings.ts:142`), never the literal `'Project'`.
- A view finds its entity's quick filters through its config: `DataViewQueryConfig` gains `quickFilters?`, set once on each meetings config from `MEETING_QUICK_FILTERS` (the plan may hang it on the field list's entity instead if the types allow; either way there is one declaration per entity).
- A view shows a quick filter when all its fields are filterable there (§5.2, §6.3).
- **Active** when the root is AND and holds each of its filter rules (deep equal). **Tap on** appends them at the root; if the root is OR, the existing root items first move into one OR filter group and the root becomes AND, so what was there keeps its meaning. **Tap off** removes exactly those filter rules.
- Its filter rules are ordinary filter rules: they show in the builder and can be edited (after which the quick filter reads inactive).
- First set: meetings `sits` only. More are a one-line addition; which ones is the owner's.

### 7.5 Legacy views

Proposals and campaign leads read through `fromPaginatedQuery` (`from-paginated-query.ts:38-42`), whose servers take flat filters only. They keep `mode: 'flat'` and today's all-at-once body until DV8 / DV9 put them on field lists. This is the one place two bodies coexist; DV8 / DV9 delete it.

### 7.6 Option reads

With every filterable field offered, mounting a view must not fire every option read (dashboard home is on the PWA startup path). A runtime option source loads only when a filter rule uses its field or the builder is open (`runtimeOptionFields`, `use-data-view-query.ts:36,132`, changes from "every toolbar field" to "fields in use").

## 8. UI (option A + quick filters, O3 / O4)

All parts live in `src/shared/components/data-view/query-toolbar/`, one component per file; every data view gets them through `QueryToolbar.Standard` / `DataView.Toolbar` with no per-view code. Reused, by name:

| Need | Existing part |
|---|---|
| Value control | `SingleFilterControl` (`ui/single-filter-control.tsx`), which wraps `filterRendererRegistry` |
| Field and operator pickers | `Select` (`src/shared/components/ui/select`) |
| Quick-filter row | `ToggleGroup type="multiple"` (as `page-size-segmented.tsx` uses `ToggleGroup`) |
| Chips | `FilterChip` (`ui/filter-chip.tsx`), generalised to `{ label, text, onClear, onClick? }` for filter rule chips, filter group chips and "is not" text |
| Field metadata | `toToolbarFilters` (`lib/to-toolbar-filters.ts`), fed `filterableIds` instead of `toolbar`; its `hidden` flag splits into "options loading" (rule and chip stay) and "not filterable" (never offered) |
| Sheet sections | `SheetSection` |

`filter-control-field.tsx` is deleted with its two callers, the all-at-once `filter-popover-body.tsx` and `filter-sheet-body.tsx` bodies, which the builder replaces (the `mode: 'flat'` legacy views keep a flat body until DV8 / DV9; the plan decides whether that body keeps `FilterControlField` or inlines `SingleFilterControl`).

**Desktop popover** (`FilterTrigger` keeps `Popover modal={false}`; width grows from `w-80` to fit a three-control row, plan's call within the app's popover sizes):
1. Header: "Filters" · "Reset all" (unchanged).
2. Quick-filter row.
3. Filter rule rows: `[Where | And | Or]` · field `Select` (the view's filterable fields by label) · operator `Select` (is / is not, kind-adapted) · `SingleFilterControl` · remove. The root AND / OR is picked on the second row's lead `Select` and shown as text on the rest (Notion pattern).
4. A filter group renders inset with its own AND / OR and its own "Add rule".
5. Footer: "Add rule", "Add group" (disabled at the caps).
New filter rule defaults: the first filterable field not yet used, is, empty value (inactive until a value is picked). While a field's options load, its value control shows the existing loading state and the rule keeps applying.

**Below lg** (bottom sheet, unchanged frame and "View results · N" footer): same content; each row stacks field + operator on one line and the value control full width below; a filter group's inset stays within the 16px gutter at 390px. Sort (gated, §6.3) and rows-per-page sections stay.

**Chips:** one chip per root item. A filter rule chip reads `{field} {is|is not} {values}` with today's formatting (`format-chip-value.ts`). A filter group chip reads "Any of 2 rules" / "All of 3 rules" and opens the builder. X removes that root item. When the root is OR, the rail leads with "Any of:" so the bar never implies AND. A filter rule on a field the viewer may not filter by gets no chip.

**Not changed:** search, columns, page size, refresh, keyboard shortcuts (`F` opens filters), the trigger's `Filters · N` label (N = `activeFilterCount`).

## 9. Roll-out and order

| Step | Content | Depends on |
|---|---|---|
| FR0 | Filter grouping fields (§4) on today's flat toolbar (`pm`, `s`) | spec approval; own plan, stress-tested |
| FR4 + FR5 (**one release**) | Core (§5–§7): model, codec, per-rule derive, `where` / `orderBy` with the gate, `OPTION_SOURCE_GATES` / `canFilter` / `filterableIds`, input + read sites, strip deleted, `filters: false` / `omit` / `quickFilters` config, `toolbar` arrays deleted, hook union, tree edits, quick filters, `dataViewHref` + `hygieneHref`, lazy option reads; and the builder UI, chips, quick-filter row (§8). Two plans or one, but they ship together: FR4 removes what today's popover reads. | DV3 + DV3a + DV4 shipped (DV4 deletes `getCustomers` and edits the customers field list, SQL and configs; FR builds on DV3a's `data-view/query-toolbar/` paths) |
| FR6 | Verification per view, with pass criteria: records `pm` / `pj` / `pc`, lead-sources `src` / `all`, kanban `cp` (no Pipeline field), schedule `s` meetings + activities (`s_f` vs `s_af`), dashboard lists (no filters parsed). For each: a filter rule and an is-not rule change the rows; a gated field is absent for agent and dispatcher and ignored when hand-typed; prefetch guards stay silent. | FR4 + FR5 |
| FR7 (proposed) | Breakdown by filter grouping field (this week by outcome type: positive / neutral / negative / not set) | FR0; own spec |

`docs/codebase-conventions/query-toolkit.md` is already stale (it names `usePaginatedQuery` as the only hook and reserves only `p,q,sort,dir,ps`); FR4 updates or deletes it per CLAUDE.md.

## 10. Verification the plans must carry

- **Pure libs on `node:test` via `tsx`** (no vitest): codec round-trip and short keys; per-rule derive (one bad rule dropped, the rest kept; empty group dropped; `filters: false`, `omit`, fixed and window fields dropped; caps truncate); tree edits incl. `toggleQuickFilter` on an OR root; `valuesInGroups` (every value of each map lands in exactly one group); `filterableIds` per role.
- **SQL assertions** for `where` / `orderBy` via `PgDialect.sqlToQuery`: is, is not (`not(coalesce(…, false))`), OR root, filter group, gated field dropped from flat filters / rules / sort, undefined positive adds nothing. `field-sql.ts` imports `server-only`, so the test runs with `--conditions=react-server` (or the compiler moves to a file without the import); the plan picks one.
- `pnpm tsc` and `pnpm lint` only; never `pnpm build`.
- **Screenshots** in light and dark, at desktop and 390px, signed in through `/api/dev/playwright-session?role=` as **super-admin, agent and dispatcher** (an agent-only pass cannot show the gate).
- Standing rules carried into every plan: explicit-path commits only (never `git add -A`), no stash / reset / checkout in dispatched work, `git diff --shortstat` after scripted edits (no target file is CRLF today), no DB writes for testing.

## 11. Decisions

**Owner's**
- O1. Labels: field "Sit" (Sat · Didn't sit · Not set), field "Outcome type" (Positive · Neutral · Negative · Not set), quick filter "Sits". Casing superseded by O13.
- O2. The schedule opens unfiltered; "Sits" is one tap away. No per-view default filter rules.
- O3 / O4. Option A + quick filters; plain existing pickers. O5: stress-test spec and plan.
- O6. A filter rule can use every field the viewer's role may filter by; per-view `toolbar` lists go; the gate is enforced on the server.
- O7. A project visit is a sit of that meeting; "Sits" leaves project meetings out.
- "Real meetings" = sits; Not set is its own group; filters use the app's existing classifications; "terminal negative" dropped; systems, not single use cases.
- **O8 (2026-10-22). Names:** keep the original names, prefixed with `filter` so they read as filter machinery: **filter rule**, **filter group**, **filter rule tree**, **filter grouping field** (CONTEXT.md, Data view terms). Code: `FilterRule`, `FilterGroup`, `FilterRuleTree`, `filterRuleTreeSchema`, `filterRules` / `setFilterRules` / `filterRulesKey`, `addFilterRule` …
- **O9 (2026-10-22). Old filter links are dropped:** flat-key links open unfiltered; no compatibility layer.
- **O10 (2026-10-22). View opt-outs:** `filters: false` on views with no filters (the six dashboard lists), `omit: ['pipeline']` on the kanban.
- **O11 (2026-10-22). Sort is gated** by the same per-field gate as filtering.
- **O12 (2026-10-22, FR0 plan stress test). The Filters popover scrolls inside the screen** (`max-h-(--radix-popover-content-available-height) overflow-y-auto` on its `PopoverContent`), fixed in FR0: twelve meetings filters overflow a 1440×900 screen.
- **O13 (2026-10-22). Option labels are Title Case:** Sat · Didn't Sit · Not Set; Positive · Neutral · Negative · Not Set, matching the Outcome and project status pickers.
- **O14 (2026-10-22). The two sentiment colour maps** (`status-colors.ts`, `schedule-calendar-config.ts`) are retyped to `Record<MeetingOutcomeSentiment, string>` in FR0, so a new group fails tsc.

**Mine (please check)**
- C1. is / is not on every kind; NULL-safe negation once in the compiler; is not on a to-many field = none match.
- C2. One level of filter groups, root AND / OR selectable; caps 20 / 10 with the buttons disabled at the cap.
- C3. The tree in one JSON key through one nuqs parser; links built with nuqs' serializer.
- C4. Fixed filters and the date window stay in flat `filters`, which keeps accepting every field id and goes through the same gate.
- C5. Quick filters are code-declared per entity, reached through the view config, shown wherever their fields are filterable; tapping on an OR root wraps it.
- C6. Filter grouping fields are plain multi-select fields over `valuesInGroups`; `stagesForBuckets` is deleted into it.
- C7. Legacy proposals / campaign leads keep `mode: 'flat'` until DV8 / DV9.
- C8. Analytics and saved views out of scope.
- C9. URL parsing never reads the ability; the gate lives in the server compiler and the UI only hides (keeps prefetch parity, survives the client ability loading late).
- C10. The gate is a capability function per field (`canFilter`, sources via `OPTION_SOURCE_GATES`), not a CASL field rule, because it means "may filter by", not "may read".
- C11. The server is lenient per filter rule and strict only on shape and caps.

**Open for the owner:** none.

## 12. Stress test 2026-10-22 — what changed

Four read-only lenses (conventions, reuse, completeness, vocabulary) against the code; every BLOCKER / HIGH re-checked by hand. First draft scored 7/10 on conventions. Changes:
- BLOCKER: the draft deleted the `proposalStatus` strip while flat `filters` stayed ungated (a dispatcher could filter by proposal status). Now one gate in `where` covers flat filters, filter rules and sort (§6.1).
- Prefetch parity: the draft dropped refused rules at parse with an ability neither the server loader nor an early client render has. Now parsing is ability-free (§5.3, §6.4).
- Whole-tree validation in the URL parser would drop every rule for one bad value; now per rule in the existing derive loop (§5.3).
- `clearOnDefault` never cleared old flat keys (they came back after an edit); moot after O9.
- Deleting `toolbar` lost "no filters" on six dashboard lists and let a Pipeline rule fight the kanban route; O10 flags (§5.2). Option reads became lazy (§7.6).
- Order: DV4 deletes a read site the draft edited, and FR4 deleted what today's popover reads before FR5 replaced it; now FR4 + FR5 ship together after DV3 / DV3a / DV4 (§9).
- Reuse: `dataViewHref` and the codec use nuqs' `createParser` / `createSerializer`; `stagesForBuckets`, `setOp` and `defineQuickFilters` are not kept as thin wrappers; the UI names `SingleFilterControl`, `FilterChip`, `ToggleGroup`, `toToolbarFilters`; legacy views get an explicit `mode` (§7, §8).
- Placement: label maps and quick filters in `src/shared/modules/meetings/core/constants/`; value lists beside the types; toolkit pieces in `src/shared/dal/lib/query/` (§4.1, §5.1).
- "Sits" derives its meeting type from `isProjectMeeting` (§7.4). Undefined positives and to-many "is not" defined (§6.1). Verification made able to fail (§10). Wrong line references corrected.

## 13. Left to the plans

Exact file names inside the folders named above; the JSON short keys; popover width; whether `quickFilters` hangs on the config or the field list; the `server-only` test approach; whether FR4 and FR5 are one plan or two (they ship as one release).
