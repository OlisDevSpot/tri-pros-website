# Proposal Editor — Epic Tracker

> **Status:** opened 2026-10-20, right after the proposal page rework was built (local main `f0b8c10c0..91246e139`). Nothing designed or built yet. Two projects are split out (§0), each starting in its own brainstorm session.
> **Goal:** a rep can create a proposal from scratch, or edit one, so that it meets what a proposal and its agreement (the contract) now require, and the reworked homeowner page renders it the way the rep expects. Nothing on the page may depend on hidden text rules.
> **Adjacent, owned elsewhere (do not duplicate, link):**
> - Multi-proposal meeting flow epic `docs/plans/2026-09-20-multi-proposal-meeting-flow-epic.md`. Spec A (unbuilt) owns stable SOW section ids and the SOW rep inputs. Tab 4, **Solution**, is "the main proposal-editing experience of the meeting flow" and will reuse this editor.
> - W4 SOW normalization `docs/superpowers/specs/2026-09-24-wave-4-sow-normalization-design.md`. Unbuilt; owner review pending. It moves the SOW into `proposal_sow_items` rows with granular per-row writes and rewrites the editor "with its current layout".
> - One pricing mode `docs/plans/2026-09-26-proposal-single-pricing-mode-follow-up.md`. R1: the price comes only from section prices. R2: a `show_section_prices` display flag. Q1 is open. Unbuilt.
> - Proposal page rework spec `docs/superpowers/specs/2026-10-16-proposal-page-rework-design.md`, built. Its §11 F1 (structured scope view model), F2 (contract fields), F3 (the owner's Zoho template changes) and F8 (the PDF pass) are **absorbed here** (§0).
> - Construction data standardization epic `docs/plans/2026-09-15-construction-data-standardization-epic.md`: the Notion catalog seam, `constructionService.getSowContent`.
> - Sales calculators epic `docs/plans/2026-09-26-sales-calculators-epic.md`, phase C4: per-scope pricing formulas set a section's price.

Legend: `[ ]` open · `[x]` done · `[~]` in progress · ⚠️ blocked on a §2 question.

**Sync protocol:** (1) specs and plans cite these IDs (O/R/Q/X/PE) and link here instead of restating a rule; (2) a new owner ruling becomes a dated row in §1 before the spec that relies on it is approved; (3) when work lands, tick its IDs and update the §0 row with the commit range; (4) new owner input is added to §1 in the owner's words, with the date.

---

## 0. Projects

| ID | Project | Owns | Blocked by | Spec | Plan | Status |
|---|---|---|---|---|---|---|
| **PE1** | **Payment schedule editor**: per-proposal payment rows (sensible defaults; rep edits amounts, labels and the number of payments; the last row, "Project completion", is the remainder and cannot be edited). This is the first group of **contract fields** (rework spec F2, CONTEXT.md:181-182). Covers the storage, the editor in the proposal form, the page, cockpit, summary route and PDF reading it, and the Zoho mapping. | R1–R6 · rework F2 | Ships only after Q1 (Zoho prints the app's rows). Design can start now. | not written | — | [ ] next |
| **PE2** | **Structured SOW editor**: a section's scope of work is edited as visible building blocks (description, phases with steps, key details, notes, not included, optional add-ons), drawn by the page as they are, with no parsing. Notion templates come in through one explicit mapping the rep sees and can fix. The LAZY parser `parse-sow-section.ts` goes away. Covers rework F1. | R7–R14 · rework F1 | Q4 (on the blob now or on W4 rows), Q5 (existing proposals) | not written | — | [ ] next |
| PE3 | **Other proposal requirements the editor must cover.** The owner called the two examples "non-exhaustive". This project collects the rest as the PE1/PE2 sessions find them (Q7). | — | Q7 | — | — | [ ] |
| PE4 | **Edit page layout**: the page shell around the form. Overview with the customer + visit trigger (full overview cards in a tabbed popover or drawer), a part nav (rail, strip or phone list) for General info / Scope of Work / Funding / Files, Cards that hug their content, the SOW accordion that scrolls inside each open item, section incentives in each SOW section, the phone summary row. Every agreed correction is in `docs/plans/2026-10-21-edit-proposal-layout-requirements.md` (L1–L31, P1–P4). Layout only; the SOW body inside a section belongs to PE2. | L1–L31 | owner yes on spec §11.2 (a `roles` prop on two shared card Actions), asked in plan Task 5 | `docs/superpowers/specs/2026-10-21-edit-proposal-layout-design.md` (approved 2026-10-21) | `docs/superpowers/plans/2026-10-21-edit-proposal-layout.md` | [~] plan written 2026-10-21; awaits execute |

**Order:** the owner asked for both hand-offs at once (2026-10-20). Claude recommended PE2 first as the bigger change for reps. PE1's design can run alongside it, since they touch different parts of the form. They share the form shell `src/features/proposal-flow/ui/components/form/index.tsx`; whichever builds second rebases on the other.

---

## 1. Owner input and rulings (verbatim where quoted)

| ID | Input | Date |
|---|---|---|
| **O1** | "The new UI looks much better. That being said, we must be able to clearly edit the proposal to align with the new, important requirements of a proposal & it's agreement (contract)." The examples that follow are "non-exhaustive". | 2026-10-20 |
| **O2** | "edit scheduled payments (have sensible defaults, be able to edit amounts/labels/# of payments, and have the last payment (uneditable, "project completion") be automatically calculated as the remainder" | 2026-10-20 |
| **O3** | "edit the SOW content (many templates coming from Notion) so that it is aligned with the new parser we created. How the sow sections are displayed in the final proposal should not be black magic, and should be easy (via UI, not via magic text rules) to be edited as needed" | 2026-10-20 |
| **O4** | "it looks great in the example proposal you created, but when our reps will create new proposals, it must be intuitive and easy to edit / create from scratch" | 2026-10-20 |
| **O5** | "we should use the current tiptap/notion building blocks like H2, bullet list etc for easily creating these sow texts. Since they often come from notion templates, and these templates come with rich text like H1, H2, p, etc our UI should simply adapt to display these as actual sections rather than a single, large editable tiptap" … "I know tiptap is an entire ecosystem so maybe using context7 or some tiptap skill we can see the possibilities it gives us that will align with our goals here" | 2026-10-20 |
| **O6** | Keep track of all requirements and inputs in an epic tracker; hand-off prompts for both projects, for fresh sessions. | 2026-10-20 |
| **O7** | (PE2 session, on Q4: how soon reps need it) "As soon as possible, but we do not need to sacrifice code quality for speed. We should be thorough and rebuild the infra / primitives from scratch as needed without coding defensively to allow for a "smooth transition" between the legacy and new approaches. It is important to remember that the proposal editing experience was broken to begin with (had good ideas, and mostly set up the right inputs, logic etc, but has a lot of UI bugs and data transfer through the layers that was set up simply wrong, and could be used as building blocks" | 2026-10-20 |
| **O8** | (Edit page layout warm-up, rounds 1–8, 2026-10-21) The owner corrected the edit page layout over eight rounds and closed it with "Looks fine for now". The owner then asked: "make a note about every single correction we agreed upon so that the same requirements hold also through writing the plan and implementation". Every correction is in `docs/plans/2026-10-21-edit-proposal-layout-requirements.md` (PE4); cite its IDs. | 2026-10-21 |

**Earlier rulings that bind this epic (verify each against the code before relying on it):**
- **Payment schedule shape** (`CONTEXT.md:182`): the deposit, then progress payments that split (contract price − deposit). The standard template is Measurements / Site inspection 20%, Material order / Delivery 35%, Installation commencement 35%, Completion the remainder. "Per-proposal edits (2–5 payments) arrive with contract fields, as their first group." The same for every deal structure.
- **Contract fields** (`CONTEXT.md:181`): "the values the app fills into a contract's Zoho fields, owned by the codebase rather than by Zoho formulas or defaults: per proposal, grouped by field group (the payment schedule first), each group's defaults and Zoho mapping declared in the Zoho registry (`contractFields`, `proposals.contract_fields`)."
- **Rework spec P23 and §11 F2/F3:** one function (`computePaymentSchedule`) feeds the page, the cockpit, the summary route and later the contract fields. The page copy says California law requires a payment schedule even when the project is financed. F3, the owner's Zoho template changes:
  - Z1: five label+amount rows replace the `sp-1…sp-4` formulas on the main (`563034000000046241`) and senior (`563034000000055081`) templates.
  - Z2: send the new field API names.
  - Z3: clear the template's `deposit` default.
  - Z4: leave Date and `finance-charge` as they are.
  - Z5: the material order fields get their own small spec.
- The original D29 (schedule editor) and D30 (`contract_fields` column) rows lived in the uncommitted amendments of the deleted 10-01 proposal-page spec. They are **lost**; the bullets above are what survives.
- **Deposit:** the cap is min($1,000, 10% of the price), and a null deposit means the cap (`core/lib/financials/deposit.ts`). Built in the rework.
- **One pricing mode R1/R2:** see the follow-up doc. Section prices become the only price source, which matters to PE2's per-section price field.
- **Scope card order** (rework P18): header, description, Key details, "How we'll do it · n phases" (first phase open), Notes, Not included, plus the Optional add-ons the code also renders (spec drift, X12).
- **W4 rulings:** a granular write model with one user action per row call, no whole-SOW replace and no transaction in the SOW save.

---

## 2. Open questions

| ID | Question | Blocks | State |
|---|---|---|---|
| **Q1** | Can the owner change the Zoho templates (F3 Z1–Z3) so the contract prints the payment rows the app sends instead of working them out itself? Until then an edited schedule would disagree with the signed contract. | PE1 ship | open, asked 2026-10-20 |
| Q2 | Does the rep edit each payment as a dollar amount, a percent of (price − deposit), or either? O2 says "amounts". | PE1 | open |
| Q3 | Bounds: 2–5 payments (CONTEXT.md)? Any minimum or maximum per payment? Is the deposit row editable here, or does it stay the funding field with its cap? | PE1 | open |
| Q4 | Build PE2 on today's `projectJSON.sow[].contentJSON` blob, or wait for or join W4's `proposal_sow_items.content_json` rows? Spec A's stable section ids are unbuilt too. | PE2 | open |
| Q5 | Existing proposals (114 on prod as of 2026-09-26) hold free-form SOW docs. Convert them once with the parser's rules, leave them read-only in the old rendering, or convert each one when a rep opens it? | PE2 | open |
| Q6 | Notion templates: should they be rewritten in Notion to match the new blocks, or should the import map today's templates (H2 = phase, "Description:" line, "Agreement Notes" heading, …) with the rep checking the result? | PE2 | open |
| Q7 | What else counts as "important requirements of a proposal & its agreement" (O1)? Candidates with no editor today (X9): summary, energy benefits, project objectives, home-area upgrades. Also the Agreement Notes field, whose Templates button does nothing, plus validity and time allocated. | PE3 | open |
| Q8 | Which SOW blocks does the homeowner see, and which are internal or contract-only? Agreement Notes appears today only in the PDF and the summary route, never on the page. | PE2 | open |

---

## 3. Requirements

### PE1: Payment schedule editor
- [ ] **R1** Every proposal starts with the standard schedule (sensible defaults, O2).
- [ ] **R2** The rep can edit each payment's label and amount, and add or remove payments (O2), within the bounds of Q3.
- [ ] **R3** The last payment is labelled "Project completion", cannot be edited, and is always the remainder, so the rows always add up to the contract price (O2). The existing `computePaymentSchedule` already computes completion as the remainder.
- [ ] **R4** One source: the page's folded schedule, the cockpit, the summary route, the PDF and the Zoho contract all read the stored schedule through one function (P23).
- [ ] **R5** It is stored per proposal as the first contract-fields group (`proposals.contract_fields`, CONTEXT.md:181), unless the PE1 spec rules otherwise with a reason.
- [ ] **R6** The Zoho registry maps the rows to the template fields once Q1 lands (F2/F3).

### PE2: Structured SOW editor
- [ ] **R7** The rep builds a section's scope from visible blocks (O3, O5), at least those the page shows today (P18): description, phases (title plus steps), key details (label and value rows), notes, not included, optional add-ons.
- [ ] **R8** The editor shows these as real sections, not one large undifferentiated text box (O5).
- [ ] **R9** The page renders the stored blocks directly, with no text rules or regex (O3). `parse-sow-section.ts` (LAZY) is deleted.
- [ ] **R10** A Notion template is imported through one explicit mapping. The rep sees the result before it lands and can fix it; nothing Notion sends is silently dropped (today's drops: X5).
- [ ] **R11** Creating a section from scratch, with no template, is as easy as starting from one (O4).
- [ ] **R12** Everything that reads `contentJSON` keeps working or moves in the same change: the PDF (`sow-doc-definition.ts`, `proposal-doc-definition.ts`), `tiptap-to-text.ts`, `overview-parts.tsx` (phase count) and the summary route.
- [ ] **R13** It stays inside the proposals module's write rules (W4 granular model, crud hooks, the service as the one server API).
- [ ] **R14** It works on a phone and an iPad as well as a desktop, since reps edit in the home.

---

## 4. Findings (code, 2026-10-20, read-only map; file:line at `74b158894`)

- **X1 Form:** react-hook-form plus zod. The create view (`ui/views/create-new-proposal-view.tsx:50`) and edit view (`edit-proposal-view.tsx:63`) share `ui/components/form/index.tsx`. Its tabs are `general | sow | funding | files` (:26, `?formTab`). Each save sends the whole `projectJSON`.
- **X2 SOW section editor:** `form/sow-field.tsx`, with a Trade select, a Scopes multiselect, a "Scope of Work" collapsible containing a **Templates** button and `<Tiptap>`, and a Financials collapsible. Sections are a `useFieldArray` in `project-fields.tsx:22`. The title is edited inline in `sow-collapsible-header.tsx:61-70`.
- **X3 Tiptap:** v3 (`@tiptap/react`, `starter-kit`, `pm`, `extension-drag-handle(-react)` ^3.15.3; `highlight` and `text-align` ^3.19.0). There is one component, `src/shared/components/tiptap/tiptap.tsx`, with StarterKit defaults, TextAlign, multicolour Highlight, a DragHandle and a BubbleMenu. It has no custom nodes.
- **X4 Storage:** `sowSchema` (`modules/proposals/core/schemas/index.ts:39-46`) holds `contentJSON` (a **stringified** Tiptap doc), `html` (a cached copy, written client-side on every keystroke), `scopes`, `title`, `trade`, `financials`. All of it lives inside the `proposals.project_JSON` jsonb. There is no section id.
- **X5 Notion import:** Notion blocks become **Tiptap JSON** (`modules/construction/sources/notion/.../page-to-tiptap.ts`, `blocks-to-tiptap.ts`). Supported: divider, heading 1–3, paragraph, bulleted and numbered lists (nested), to_do (as `[ ]`/`[x]` bullets). **Toggle, callout, quote, table and image are dropped silently** (:151-159). Picking a template **appends** at the end of the section (`sow-field.tsx:240-241`). It is cached under the catalog tag.
- **X6 Parser rules** (`features/proposal-flow/lib/parse-sow-section.ts`, marked LAZY):
  - The first paragraph or heading starting `Description:` becomes the description.
  - Each H2 starts a group; the bullet or numbered list after it gives that group's steps.
  - An H2 titled exactly "Optional add-ons" holds the add-ons.
  - An H2 titled exactly "Agreement Notes" holds lines matched with `Key: value`. "Exclusion(s):" lines, and lines containing "not included / excluded / not responsible / unless / not specifically", go to Not included. Other `Key: value` lines with a value of 48 characters or fewer become Key details. Everything else becomes Notes.
  - Any other node returns null, and the whole section falls back to sanitized HTML (`scope-spec-card.tsx:84-85`). Examples: a loose paragraph, an H1 or H3 that isn't the description, a list before any H2.
  - Tests: `parse-sow-section.test.ts`.
- **X7 Toolbar** (`tiptap/menu-bar.tsx`): lock, H1/H2/H3, bold/italic/strike, highlight, alignment. There are **no list buttons**, although phases depend on lists. `TextAlign` has no `types` config, so alignment probably does nothing (unverified).
- **X8 Payment schedule:**
  - The template is `core/constants/payment-schedule.ts:2-7` (`STANDARD_PAYMENT_SCHEDULE`).
  - `computePaymentSchedule(finalTcp, deposit)` (`core/lib/financials/payment-schedule.ts:12-25`) works in cents, rounds each fixed row and makes completion the remainder. It is tested.
  - **Nothing is stored per proposal**; there is no `contract_fields` column.
  - It is rendered by `payment-schedule-fold.tsx` (through `derive-stored-funding-choice.ts` and `use-funding-choice.ts`) and by the summary route (`app/api/proposals/[proposalId]/summary/route.ts:120-122`).
  - Zoho receives only `tcp` and `deposit` (`zoho-sign/lib/documents/registry.ts`). Zoho's own `sp-1..4` formulas make the contract's schedule.
- **X9 Unedited fields:** `summary`, `energyBenefits`, `projectObjectives` and `homeAreasUpgrades` are in the schema, but no form field edits them. The Agreement Notes "Templates" button has no `onClick` (`project-fields.tsx:152-175`).
- **X10 Leftovers:**
  - `@notion-render/client` and `@notion-utils/html` are dependencies, but only a type import is used.
  - `src/shared/services/providers/notion/lib/sows/` is empty.
  - `constants/scopes-of-work/roof.md` is imported by nothing; `proposal-flow/DOCS.md:13` still lists it.
- **X11 What the homeowner page reads:** `hero.tsx` (label, timeAllocated, first trade, section count), `overview-parts.tsx` (titles, trades, phase count through the parser), `scope-spec-card.tsx` (contentJSON, html, title, trade, sectionPrice), `results.tsx` and `portfolio-match-context.tsx` (trade ids), `funding.tsx` (the sow pricing breakdown). Agreement Notes is not on the page.
- **X12 Spec drift:** rework P18 does not list Optional add-ons, but the code renders it.

### 4.1 Tiptap capabilities relevant to PE2 (context7, tiptap.dev docs, 2026-10-20)
- **Enforced structure:** a node's `content` expression is enforced strictly (for example `'heading block+'`, or `'(paragraph|list?)+'`), and content that doesn't fit is discarded. A custom top-level `Document` can force a whole doc shape (the "forced content structure" example).
- **Custom section nodes with React node views:** `ReactNodeViewRenderer` plus `NodeViewWrapper` and `NodeViewContent` draw a node as a React card (labels and controls `contentEditable={false}`) with editable rich text inside. Each SOW block (Phase, Key details, Not included, …) can be its own node type with its own editor chrome.
- **Static renderer:** `@tiptap/static-renderer` (`renderToReactElement` with `nodeMapping`) draws stored Tiptap JSON as React **without an editor instance**, server-side included. The homeowner page could map each block node straight to its scope-card component, replacing the parser.
- **Drag handle:** already installed (`@tiptap/extension-drag-handle-react`) and supports nested reordering. Per the docs, its install pulls in collaboration and Yjs packages; check what the repo already has before adding any.
- **Slash menu:** Tiptap UI Components offer `SlashDropdownMenu` / `useSlashDropdownMenu` with custom items ("/phase", "/key details"). Check whether these are free or paid, and whether they're shadcn-compatible, before choosing them.
- `insertContent(editor.schema.node(...))` inserts a whole structured block in one step, which suits an "add phase" button and the Notion import mapping.
