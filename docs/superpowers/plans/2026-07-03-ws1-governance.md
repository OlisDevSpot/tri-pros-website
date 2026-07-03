# WS-1: JSONB Governance Docs Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Install the two already-reviewed governance drafts (ADR-0005 + `jsonb-columns.md`) into their canonical homes, register the conventions doc in the README topic table, wire "See also" cross-links from every doc that touches JSONB, and thin the MEMORY.md merge-hazard entry to reflection + link. **Docs-only, zero code.**

**Architecture:** Standard why/what split (mirrors ADR-0003 ↔ service-architecture.md): the *why* (three-way placement rule + promotion ladder + considered alternatives) lands as **ADR-0005**; the *what-to-do* (internal shape, validation mandate, merge rule, evolution playbook, pre-change checklist) lands as a **new conventions topic file** `jsonb-columns.md`. Both drafts are already written and reviewed in `docs/superpowers/specs/`; this workstream moves them verbatim (minus the DRAFT header note), registers the topic file, and cross-links the existing docs so future sessions discover the governance from wherever they touch a JSONB column.

**Tech Stack:** Markdown docs only. No code, no build, no schema. Refs use the house form `see docs/codebase-conventions/jsonb-columns.md#slug` / `see ./DOCS.md#slug` with slug anchors (survive reordering).

**Spec:** `docs/superpowers/specs/2026-07-03-jsonb-restructure-design.md` §3.

**Depends on:** none — WS-1 can land first (it is the foundation the other workstreams reference).

**Explicitly NOT in scope:** adding `_v` (schema-version) fields to any blob — that happens when WS-4/WS-5 touch each schema, per the "add `_v` the next time each schema is touched" rule (spec §3, `jsonb-columns.md#mandatory-schema-version`). Correcting the *bodies* of the stale `#jsonb-merge-on-update` / `#jsonb-merge-columns-merge-on-update` sections (which still describe the merge as `COALESCE || ` deep-merge when the code is shallow) is **WS-2's** job (spec §4.8) — WS-1 only *adds* "See also" links, it does NOT rewrite those merge descriptions. Any code.

## Global Constraints

- Package manager: **pnpm**. Path alias `@/` → `src/`.
- **NEVER run `pnpm build`.** This is docs-only — verify docs render / links resolve manually.
- Work directly on `main`. **Stage files explicitly** (`git add <path>`), never `git add -A`, so unrelated WIP isn't swept in.
- In-code/doc refs use the house form: `// see docs/codebase-conventions/jsonb-columns.md#slug` or `see ./DOCS.md#slug`. Refs use slug anchors (survive reordering).
- Follow `docs/codebase-conventions/README.md` decision-tree + self-healing rituals for doc placement (§"Where does a new rule go?" and §"Self-healing rituals" — anchor verification: grep the slug in the target before committing).
- Commit messages end with: `Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>`

---

### Task 1: Install ADR-0005

**Files:**
- Create: `docs/adr/0005-jsonb-vs-column-vs-child-table.md`
- (Source, read-only: `docs/superpowers/specs/2026-07-03-jsonb-ADR-0005-draft.md`)

**Interfaces:** n/a (documentation — no code interfaces).

- [ ] **Step 1: Copy the draft to its ADR home**

  Run: `cp docs/superpowers/specs/2026-07-03-jsonb-ADR-0005-draft.md docs/adr/0005-jsonb-vs-column-vs-child-table.md`

- [ ] **Step 2: Strip the DRAFT header note**

  In `docs/adr/0005-jsonb-vs-column-vs-child-table.md`, delete lines 3–4 (the blockquote note):

  ```
  > DRAFT — companion to `2026-07-03-jsonb-restructure-design.md` (WS-1). On approval,
  > install to `docs/adr/0005-jsonb-vs-column-vs-child-table.md`.
  ```

  Also delete the now-orphaned blank line that separated the note from `## Status`, so the file reads `# ADR-0005: …` (title) → blank line → `## Status`. Keep everything from `## Status` onward **verbatim** (including the existing `## See also` block, which already points at `jsonb-columns.md`, `database-schema.md`, ADR-0002, and the restructure spec).

- [ ] **Step 3: Verify the file is at its new path and the DRAFT note is gone**

  Run: `test -f docs/adr/0005-jsonb-vs-column-vs-child-table.md && ! grep -q '^> DRAFT' docs/adr/0005-jsonb-vs-column-vs-child-table.md && echo OK`
  Expected: `OK` (file exists; no DRAFT line remains).

- [ ] **Step 4: Verify the title line survived and Status is the first section**

  Run: `head -8 docs/adr/0005-jsonb-vs-column-vs-child-table.md`
  Expected: line 1 is `# ADR-0005: JSONB vs Column vs Child Table — the storage-shape decision`; the first `##` heading is `## Status`.

- [ ] **Step 5: Commit**

  ```bash
  git add docs/adr/0005-jsonb-vs-column-vs-child-table.md
  git commit -m "docs(adr): install ADR-0005 — JSONB vs column vs child table

  Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
  ```

---

### Task 2: Install the jsonb-columns.md conventions doc

**Files:**
- Create: `docs/codebase-conventions/jsonb-columns.md`
- (Source, read-only: `docs/superpowers/specs/2026-07-03-jsonb-columns-conventions-draft.md`)

**Interfaces:** n/a (documentation).

- [ ] **Step 1: Copy the draft to its conventions home**

  Run: `cp docs/superpowers/specs/2026-07-03-jsonb-columns-conventions-draft.md docs/codebase-conventions/jsonb-columns.md`

- [ ] **Step 2: Strip the DRAFT header note**

  In `docs/codebase-conventions/jsonb-columns.md`, delete lines 3–5 (the blockquote note, which also contains the pre-baked README row text):

  ```
  > DRAFT — companion to `2026-07-03-jsonb-restructure-design.md` (WS-1). On approval,
  > install to `docs/codebase-conventions/jsonb-columns.md` and add a README table row:
  > `| [jsonb-columns.md](./jsonb-columns.md) | When a field belongs in JSONB vs a column vs a child table; JSONB internal shape, runtime validation, merge safety, evolution playbook |`
  ```

  Also delete the now-orphaned blank line so the file reads `# JSONB Column Conventions` (title) → blank line → the "When to reach for JSONB…" intro paragraph. Keep everything from that intro paragraph onward **verbatim** (all 9 slug-anchored H3 rules, the 9-step checklist, Anti-patterns, and the existing `## See also` block).

  > Note: the exact README row text lives in the note you are deleting — copy it out before deleting (Task 3 Step 2 reuses it).

- [ ] **Step 3: Verify the file is at its new path and the DRAFT note is gone**

  Run: `test -f docs/codebase-conventions/jsonb-columns.md && ! grep -q '^> DRAFT' docs/codebase-conventions/jsonb-columns.md && echo OK`
  Expected: `OK`.

- [ ] **Step 4: Verify the 9 rule anchors survived (they are referenced by every cross-link in Tasks 4–10)**

  Run: `grep -nE '^### ' docs/codebase-conventions/jsonb-columns.md`
  Expected: exactly these 9 H3 slugs, in order — `placement-rule-column-vs-jsonb-vs-child`, `flat-over-nested`, `keep-docs-small`, `arrays-of-objects-vs-keyed-objects`, `mandatory-schema-version`, `one-canonical-key-per-concept`, `zod-parse-at-write-boundary`, `never-shallow-merge-nested`, `evolution-playbook`.

- [ ] **Step 5: Commit**

  ```bash
  git add docs/codebase-conventions/jsonb-columns.md
  git commit -m "docs(conventions): install jsonb-columns.md operational rules

  Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
  ```

---

### Task 3: Register jsonb-columns.md in the README topic table

**Files:**
- Modify: `docs/codebase-conventions/README.md` (the `## Topics` table, ~lines 9–24)

**Interfaces:** n/a (documentation).

**Context:** The README's self-healing ritual (README §"How to use this directory") requires: "Update the README's table if a new topic file is added." The table format is a 2-column pipe table `| File | What it covers |`. Place the new row adjacent to `dal-conventions.md` (the DAL row) since JSONB merge governance is closest in subject to the DAL.

- [ ] **Step 1: Read the current table to confirm exact row format**

  Run: `sed -n '9,24p' docs/codebase-conventions/README.md`
  Expected: the pipe table with header `| File | What it covers |` and one row per existing topic file (database-schema.md through the Design System row).

- [ ] **Step 2: Insert the jsonb-columns.md row directly after the `database-schema.md` row**

  In `docs/codebase-conventions/README.md`, after the line:

  ```
  | [database-schema.md](./database-schema.md) | Schema files, pgEnum placement, UUID/timestamp conventions, barrel exports |
  ```

  insert:

  ```
  | [jsonb-columns.md](./jsonb-columns.md) | When a field belongs in JSONB vs a column vs a child table; JSONB internal shape, runtime validation, merge safety, evolution playbook |
  ```

  (This is the exact row text carried over from the deleted DRAFT note in Task 2.)

- [ ] **Step 3: Verify the table row is present and the file link resolves**

  Run: `grep -q '\[jsonb-columns.md\](./jsonb-columns.md)' docs/codebase-conventions/README.md && test -f docs/codebase-conventions/jsonb-columns.md && echo OK`
  Expected: `OK` (row exists; the linked file exists).

- [ ] **Step 4: Verify the table still renders (pipe count consistent)**

  Run: `sed -n '9,26p' docs/codebase-conventions/README.md`
  Expected: every data row has exactly two `|`-delimited cells (leading + trailing pipes = 3 pipes per line); the new row sits between `database-schema.md` and `enum-standardization.md`.

- [ ] **Step 5: Commit**

  ```bash
  git add docs/codebase-conventions/README.md
  git commit -m "docs(conventions): register jsonb-columns.md in README topic table

  Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
  ```

---

### Task 4: Cross-link from proposals/DOCS.md

**Files:**
- Modify: `src/shared/entities/proposals/DOCS.md` (the `## See also` block, starts at line 234)

**Interfaces:** n/a (documentation).

**Context:** Proposals owns the reference-impl merge rule (`#jsonb-merge-on-update`) and the canonical `#final-tcp-derived` example the governance docs cite. Add the two governance pointers to the existing `## See also` list. **Do NOT edit the `#jsonb-merge-on-update` body** — its stale `COALESCE || ` wording is corrected by WS-2, not here.

- [ ] **Step 1: Append the two governance pointers to `## See also`**

  In `src/shared/entities/proposals/DOCS.md`, at the end of the `## See also` bullet list (after the `dal-conventions.md` bullet, currently the last line), add:

  ```
  - `docs/codebase-conventions/jsonb-columns.md#never-shallow-merge-nested` — JSONB payload shape, runtime validation, and deep-merge safety governing `formMetaJSON`/`projectJSON`/`fundingJSON`
  - ADR-0005 — JSONB vs column vs child table (the storage-shape decision behind `#final-tcp-derived`)
  ```

- [ ] **Step 2: Verify the anchors resolve in their target files**

  Run: `grep -q '^### never-shallow-merge-nested' docs/codebase-conventions/jsonb-columns.md && test -f docs/adr/0005-jsonb-vs-column-vs-child-table.md && echo OK`
  Expected: `OK` (the `#never-shallow-merge-nested` slug exists in jsonb-columns.md; ADR-0005 exists).

- [ ] **Step 3: Commit**

  ```bash
  git add src/shared/entities/proposals/DOCS.md
  git commit -m "docs(proposals): cross-link JSONB governance (jsonb-columns.md + ADR-0005)

  Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
  ```

---

### Task 5: Cross-link from customers/DOCS.md

**Files:**
- Modify: `src/shared/entities/customers/DOCS.md` (the `## See also` block, starts at line 136)

**Interfaces:** n/a (documentation).

**Context:** Customers has `#three-jsonb-profiles` (`customerProfileJSON`/`propertyProfileJSON`/`financialProfileJSON`) — the archetypal correctly-shaped, deep-merged blobs. Add the governance pointers to the existing `## See also` list.

- [ ] **Step 1: Append the two governance pointers to `## See also`**

  In `src/shared/entities/customers/DOCS.md`, at the end of the `## See also` bullet list (after the `dal-conventions.md` bullet), add:

  ```
  - `docs/codebase-conventions/jsonb-columns.md#never-shallow-merge-nested` — payload shape / runtime validation / deep-merge safety for the three JSONB profiles (`#three-jsonb-profiles`)
  - ADR-0005 — JSONB vs column vs child table (why the profiles stay JSONB but lead-attribution fields are columns)
  ```

- [ ] **Step 2: Verify the anchors resolve**

  Run: `grep -q '^### never-shallow-merge-nested' docs/codebase-conventions/jsonb-columns.md && grep -q '^### three-jsonb-profiles' src/shared/entities/customers/DOCS.md && echo OK`
  Expected: `OK` (target slug exists; the `#three-jsonb-profiles` self-reference is real).

- [ ] **Step 3: Commit**

  ```bash
  git add src/shared/entities/customers/DOCS.md
  git commit -m "docs(customers): cross-link JSONB governance (jsonb-columns.md + ADR-0005)

  Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
  ```

---

### Task 6: Cross-link from meetings/DOCS.md

**Files:**
- Modify: `src/shared/entities/meetings/DOCS.md` (the `## See also` block, starts at line 192)

**Interfaces:** n/a (documentation).

**Context:** Meetings' `contextJSON`/`flowStateJSON` are the load-bearing **whole-document / full-replace** counter-example the merge rule calls out (they deliberately stay OUT of `jsonbMergeColumns`). The cross-link should name that distinction so a future reader doesn't wrongly opt them into deep-merge.

- [ ] **Step 1: Append the two governance pointers to `## See also`**

  In `src/shared/entities/meetings/DOCS.md`, at the end of the `## See also` bullet list (after the `dal-conventions.md` bullet), add:

  ```
  - `docs/codebase-conventions/jsonb-columns.md#never-shallow-merge-nested` — `contextJSON`/`flowStateJSON` are whole-document writers → deliberately NOT in `jsonbMergeColumns` (deep-merge would resurrect deselected keys)
  - ADR-0005 — JSONB vs column vs child table (storage-shape decision rule)
  ```

- [ ] **Step 2: Verify the anchor resolves**

  Run: `grep -q '^### never-shallow-merge-nested' docs/codebase-conventions/jsonb-columns.md && echo OK`
  Expected: `OK`.

- [ ] **Step 3: Commit**

  ```bash
  git add src/shared/entities/meetings/DOCS.md
  git commit -m "docs(meetings): cross-link JSONB governance (whole-document full-replace note)

  Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
  ```

---

### Task 7: Cross-link from projects/DOCS.md

**Files:**
- Modify: `src/shared/entities/projects/DOCS.md` (the `## See also` block, starts at line 147)

**Interfaces:** n/a (documentation).

**Context:** Projects has `#before-after-pairs-jsonb-shape` (`beforeAfterPairsJSON`, an array-of-objects blob) — a direct instance of the `#arrays-of-objects-vs-keyed-objects` rule. Point at both the shape rule anchor and the ADR.

- [ ] **Step 1: Append the two governance pointers to `## See also`**

  In `src/shared/entities/projects/DOCS.md`, at the end of the `## See also` bullet list (after the last `dal-conventions.md` bullet), add:

  ```
  - `docs/codebase-conventions/jsonb-columns.md#arrays-of-objects-vs-keyed-objects` — `beforeAfterPairsJSON` array-of-objects shape + write-boundary validation (`#before-after-pairs-jsonb-shape`)
  - ADR-0005 — JSONB vs column vs child table (storage-shape decision rule)
  ```

- [ ] **Step 2: Verify both anchors resolve**

  Run: `grep -q '^### arrays-of-objects-vs-keyed-objects' docs/codebase-conventions/jsonb-columns.md && grep -q '^### before-after-pairs-jsonb-shape' src/shared/entities/projects/DOCS.md && echo OK`
  Expected: `OK` (target slug exists; the self-reference is real).

- [ ] **Step 3: Commit**

  ```bash
  git add src/shared/entities/projects/DOCS.md
  git commit -m "docs(projects): cross-link JSONB governance (array-of-objects shape rule)

  Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
  ```

---

### Task 8: One-line pointer in database-schema.md

**Files:**
- Modify: `docs/codebase-conventions/database-schema.md` (the `## See also` block, starts at line 78)

**Interfaces:** n/a (documentation).

**Context:** database-schema.md governs column/pgEnum/timestamp shape but is silent on JSONB payloads. Add the one-line pointer the WS-1 brief specifies: JSONB payload shape/validation/merge is governed by jsonb-columns.md.

- [ ] **Step 1: Append the pointer bullet to `## See also`**

  In `docs/codebase-conventions/database-schema.md`, at the end of the `## See also` bullet list (after the `pnpm db:push:dev` bullet), add:

  ```
  - `docs/codebase-conventions/jsonb-columns.md` — JSONB **payload** shape, runtime validation, and merge safety are governed here (this file covers the column itself; jsonb-columns.md covers what goes inside it). Placement rule (column vs JSONB vs child table): ADR-0005.
  ```

- [ ] **Step 2: Verify the target file exists**

  Run: `test -f docs/codebase-conventions/jsonb-columns.md && test -f docs/adr/0005-jsonb-vs-column-vs-child-table.md && echo OK`
  Expected: `OK`.

- [ ] **Step 3: Commit**

  ```bash
  git add docs/codebase-conventions/database-schema.md
  git commit -m "docs(schema): point JSONB payload shape/validation/merge at jsonb-columns.md

  Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
  ```

---

### Task 9: Cross-link from dal-conventions.md

**Files:**
- Modify: `docs/codebase-conventions/dal-conventions.md` (the `## See also` block, starts at line 120)

**Interfaces:** n/a (documentation).

**Context:** The DAL is where the merge actually happens (`createCrudDal` merge path reads `spec.update.jsonbMergeColumns`). Point at the merge-safety rule + the ADR. Note: WS-2 later *adds a merge rule H3* to this file; WS-1 only adds the "See also" pointer, so the two edits don't collide.

- [ ] **Step 1: Append the two governance pointers to `## See also`**

  In `docs/codebase-conventions/dal-conventions.md`, at the end of the `## See also` bullet list (after the `dal-to-trpc.ts` bullet), add:

  ```
  - `docs/codebase-conventions/jsonb-columns.md#never-shallow-merge-nested` — JSONB deep-merge safety (opted-in per column via `spec.update.jsonbMergeColumns`, applied on the CRUD update path)
  - ADR-0005 — JSONB vs column vs child table (storage-shape decision rule)
  ```

- [ ] **Step 2: Verify the anchor resolves**

  Run: `grep -q '^### never-shallow-merge-nested' docs/codebase-conventions/jsonb-columns.md && echo OK`
  Expected: `OK`.

- [ ] **Step 3: Commit**

  ```bash
  git add docs/codebase-conventions/dal-conventions.md
  git commit -m "docs(dal): cross-link JSONB deep-merge safety (jsonb-columns.md + ADR-0005)

  Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
  ```

---

### Task 10: Cross-link from src/trpc/DOCS.md

**Files:**
- Modify: `src/trpc/DOCS.md` (the `## See also` block, starts at line 313)

**Interfaces:** n/a (documentation).

**Context:** `src/trpc/DOCS.md` has `#jsonb-merge-columns-merge-on-update`, the operational rule for the merge from the tRPC/spec side. Add the governance pointer to `## See also`. **Do NOT edit the `#jsonb-merge-columns-merge-on-update` body** — its stale "deep-merges" wording (code is currently shallow) is WS-2's correction, not WS-1's.

- [ ] **Step 1: Append the two governance pointers to `## See also`**

  In `src/trpc/DOCS.md`, at the end of the `## See also` bullet list (after the `src/shared/dal/server/types.ts` bullet), add:

  ```
  - `docs/codebase-conventions/jsonb-columns.md#never-shallow-merge-nested` — JSONB merge safety governing `#jsonb-merge-columns-merge-on-update` (payload shape, validation, additive-partial vs whole-document)
  - ADR-0005 — JSONB vs column vs child table (storage-shape decision rule)
  ```

- [ ] **Step 2: Verify both anchors resolve**

  Run: `grep -q '^### never-shallow-merge-nested' docs/codebase-conventions/jsonb-columns.md && grep -q '^### jsonb-merge-columns-merge-on-update' src/trpc/DOCS.md && echo OK`
  Expected: `OK` (target slug exists; the self-reference is real).

- [ ] **Step 3: Commit**

  ```bash
  git add src/trpc/DOCS.md
  git commit -m "docs(trpc): cross-link JSONB merge governance (jsonb-columns.md + ADR-0005)

  Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
  ```

---

### Task 11: Thin the MEMORY.md merge-hazard entry to reflection + link

**Files:**
- Modify: `memory/MEMORY.md` (the `[Funnel capture + JSONB merge]` index line under `## Active Backlog`, line 71)

**Interfaces:** n/a (documentation).

**Context:** MEMORY.md §"Before writing a rule into memory" + README §"Self-healing rituals" (Memory audit) mandate: memory entries that duplicate a canonical doc's *rule body* get thinned to reflection + link. The current line embeds the actual hazard rule ("generic entity JSONB merge is SHALLOW `||`, not deep — partial nested updates delete siblings"). That rule now lives canonically in `jsonb-columns.md#never-shallow-merge-nested`. Replace the embedded rule with a reflection + link — do NOT re-state the rule body.

- [ ] **Step 1: Confirm the current line and its exact text**

  Run: `grep -n 'Funnel capture + JSONB merge' memory/MEMORY.md`
  Expected: one match (~line 71) — the line beginning `- [Funnel capture + JSONB merge](project-funnel-capture-and-jsonb-merge.md) — …`.

- [ ] **Step 2: Replace the line with a reflection + link (no rule body)**

  Replace the entire existing line:

  ```
  - [Funnel capture + JSONB merge](project-funnel-capture-and-jsonb-merge.md) — funnel data-capture re-derivation + **⚠️ app-wide hazard: generic entity JSONB merge is SHALLOW `||`, not deep** — partial nested updates delete siblings; deep-merge fix handed off (docs/plans/2026-06-27-*). **READ before any JSONB-column update or funnel-capture work.**
  ```

  with:

  ```
  - [Funnel capture + JSONB merge](project-funnel-capture-and-jsonb-merge.md) — funnel data-capture re-derivation reflection. The JSONB shallow-merge hazard + deep-merge rule is now canonical: `docs/codebase-conventions/jsonb-columns.md#never-shallow-merge-nested` (fix designed in `docs/superpowers/specs/2026-07-03-jsonb-restructure-design.md` §4 / WS-2). **Trust the canonical doc; this entry is reflection-and-link only.**
  ```

- [ ] **Step 3: Verify the rule body is gone and the link is present**

  Run: `grep -q 'jsonb-columns.md#never-shallow-merge-nested' memory/MEMORY.md && ! grep -q 'generic entity JSONB merge is SHALLOW' memory/MEMORY.md && echo OK`
  Expected: `OK` (link present; the duplicated rule body removed).

- [ ] **Step 4: Verify the canonical anchor the memory line now points at actually exists**

  Run: `grep -q '^### never-shallow-merge-nested' docs/codebase-conventions/jsonb-columns.md && echo OK`
  Expected: `OK`.

- [ ] **Step 5: Commit**

  ```bash
  git add memory/MEMORY.md
  git commit -m "docs(memory): thin JSONB merge-hazard entry to reflection + link

  Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
  ```

---

## Self-Review

**Spec coverage (§3 of the restructure spec — WS-1 deliverables):**
- ADR-0005 installed to `docs/adr/0005-jsonb-vs-column-vs-child-table.md`, DRAFT note stripped, rest verbatim → Task 1. ✓
- `docs/codebase-conventions/jsonb-columns.md` installed, DRAFT note stripped, 9 anchors + checklist + anti-patterns verbatim → Task 2. ✓
- README topic-table row added (exact text from the deleted note; format matches existing rows) → Task 3. ✓
- "See also" cross-links added to all 7 named files → proposals (T4), customers (T5), meetings (T6), projects (T7), database-schema.md one-line pointer (T8), dal-conventions.md (T9), src/trpc/DOCS.md (T10). ✓
- MEMORY.md merge-hazard entry thinned to reflection + link, no rule-body duplication → Task 11. ✓
- `_v` fields NOT added (deferred to WS-4/WS-5) → stated in header "NOT in scope." ✓
- No code touched → docs-only throughout. ✓

**Placeholder scan:** No "TBD" / "add appropriate…" / "similar to Task N". Every cross-link bullet shows exact text; every DRAFT-strip step names the exact lines to delete; every anchor is named explicitly. ✓

**Link-integrity check (every `#slug` referenced actually exists in the target):**
- `jsonb-columns.md#never-shallow-merge-nested` — referenced in T4, T5, T6, T9, T10, T11; confirmed present as `### never-shallow-merge-nested` (Task 2 Step 4 lists all 9 slugs). ✓
- `jsonb-columns.md#arrays-of-objects-vs-keyed-objects` — referenced in T7; confirmed present in the 9-slug list. ✓
- `jsonb-columns.md#final-tcp-derived` / `#mandatory-schema-version` — mentioned in prose, not as live target anchors of a cross-link. n/a.
- Self-reference anchors on the source side (verified in-plan): `proposals/DOCS.md#jsonb-merge-on-update` + `#final-tcp-derived` (real, lines 90/98), `customers/DOCS.md#three-jsonb-profiles` (real, line 82), `projects/DOCS.md#before-after-pairs-jsonb-shape` (real, line 104), `src/trpc/DOCS.md#jsonb-merge-columns-merge-on-update` (real, line 258). Each cross-link task re-verifies with a `grep` step before committing. ✓
- ADR-0005's own `## See also` (installed verbatim) points at `jsonb-columns.md`, `database-schema.md`, ADR-0002, and the restructure spec — all pre-existing / created here. ✓

**⚠️ Staleness flagged (NOT fixed here — belongs to WS-2, spec §4.8):**
- `src/shared/entities/proposals/DOCS.md:96` (`#jsonb-merge-on-update` body) says the merge applies `COALESCE(col, '{}'::jsonb) || $value::jsonb` and calls it a "deep-merge." Per spec §4.1 the running code (`create-crud-dal.ts`) is a **shallow** `||`. WS-1 deliberately does not rewrite this body (only adds the "See also" link) — WS-2 corrects it.
- `src/trpc/DOCS.md:260` (`#jsonb-merge-columns-merge-on-update` body) similarly says "deep-merges those JSONB columns." Same stale-vs-code gap; same WS-2 ownership. WS-1 adds only the pointer.
- These are surfaced here so the WS-1 worker does not accidentally "fix" them (which would collide with WS-2) and so a reviewer knows the mismatch is known and assigned.

**Out-of-scope (correctly deferred):** `_v` schema-version fields (WS-4/WS-5); the shallow-vs-deep merge *code* fix and the stale merge-description *body* corrections (WS-2); generated columns (WS-3); `lead_meta` table (WS-5); the funnel-plan header note (WS-5/§8). None are WS-1.
