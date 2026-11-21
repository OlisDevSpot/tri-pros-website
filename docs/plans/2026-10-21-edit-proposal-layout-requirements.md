# Edit Proposal Page Layout — Requirements Ledger

> **Status:** the warm-up closed on round 8 (2026-10-21). The owner: "Looks fine for now." Spec approved 2026-10-21 ("Approved lets proceed"); plan `docs/superpowers/plans/2026-10-21-edit-proposal-layout.md`. Nothing is built.
> **Surface:** `/dashboard/proposals/[proposalId]` → `src/features/proposal-flow/ui/views/edit-proposal-view.tsx` + `src/features/proposal-flow/ui/components/form/`.
> **Reference mock:** https://claude.ai/artifact/5BS6vyHTxQgEmw7jaENMTo (Version 8, "Round 8"). Its Handoff section holds the build brief.
> **Parent tracker:** `docs/plans/2026-10-20-proposal-editor-epic.md` (project PE4).

**Why this file exists.** The owner corrected the layout over eight rounds, and has asked that every agreed correction hold through the spec, the plan and the build. Each correction below has an ID. The spec cites these IDs, every plan task names the IDs it serves, and every review checks them. Nothing on this list may be dropped, changed or "simplified" without a new dated owner ruling here first. An earlier round's correction that a later one replaced is listed under "Superseded" so it never comes back.

---

## 1. Scope

| ID | Requirement | Source |
|---|---|---|
| **L1** | The edit page links to the proposal's customer and its in-home visit. | Owner, opening ask |
| **L2** | Reuse the overview-card compound components **fully**: `CustomerOverviewCard` with its address, phone and email parts, profile fields, lead source and actions; `MeetingOverviewCard` with its fields, owner, trades, proposals and actions. Never thin bespoke rows (like the cockpit's), never a re-implementation. | Owner, round 1: "We really need to leverage our compound component" |
| **L3** | The section nav sits in its own container on the left, on the same surface rung as the overview cards, with the form to its right on desktop. Tablet and phone are shaped too. | Owner, round 1 |
| **L4** | Out of scope here: the rethink of the editing flow, the inputs in each section, and how the edit page relates to the homeowner proposal page. That is a separate brainstorm (requirements and vision). | Owner, round 1 |
| **L5** | The page gets broad UI/UX improvement, not a quick fix. | Owner, round 1 |

## 2. Spacing and frame

| ID | Requirement | Source |
|---|---|---|
| **L6** | Gaps between surfaces use the dashboard's gap token, `--gutter` (8px), as every dashboard page does. | Owner, round 2: "you must use the same gap token we've been using across our dashboard" |
| **L7** | Card interiors follow the measured dashboard Card rhythm (shadcn Card inset 24, header to content 24, fields 16 apart, label 8 above a 36px control). No ad-hoc spacing. | Owner, rounds 2–3 ("spacing is still messed up") |
| **L8** | The document never scrolls. The overview stays fixed at the top; under it sit the left nav and the content. The content container stays put and its content scrolls inside it, like the `/dashboard/proposals` records page. No scroll container may show behind the overview. | Owner, round 4 |
| **L9** | A part's Card hugs its content (`flex: 0 1 auto; min-height: 0`). Short content (General info, a collapsed Scope of Work, Funding, Files) never stretches the Card to the bottom of the screen, and its spacing reads right in short states. Only content longer than the space left scrolls, inside the Card. | Owner, round 5: Funding and Files "simply extend all the way down"; short-state spacing "disgusting" |

## 3. Overview (top bar)

| ID | Requirement | Source |
|---|---|---|
| **L10** | No pre-sit visit signals (the "texted / opened / …" VisitMeter). The proposal stage is past them. | Owner, round 2 |
| **L11** | The proposal name input shrinks to its text. The Draft chip sits a small fixed distance after the text and keeps that distance while the rep types. | Owner, round 4 |
| **L12** | The overview row has no "created on", "viewed once" or "final price" text. That space goes to the customer and the visit. Wherever a price is shown, it is labelled "Price", not "Final price"; wherever views are shown, they are the eye icon plus a count. | Owner, round 4 |
| **L13** | Preview is the eye icon alone, no text label. | Owner, round 4 |
| **L14** | The customer and the visit sit **in the overview**, in the middle (between the proposal name and the proposal actions), as one small piece. Clicking it shows the **full** customer overview card and the **full** meeting overview card. They are never placed loose on the page. | Owner, round 5 |
| **L15** | The picked form (option 2): a **split trigger pill**. The customer half opens the panel on the Customer tab; the visit half opens it on the In-home visit tab. The panel holds the two full cards as tabs: a 400px popover on desktop and tablet, a bottom drawer on phone. | Owner, round 6 pick: "I like the tabbed popover (#2)" |
| **L16** | Switching tabs never changes the panel's height (no jitter or shift), on phone and on desktop: both tab panes share one grid cell and the inactive one is invisible and inert. | Owner, round 7 (phone); the mock applies it everywhere |
| **L17** | Inside each card in the panel, the common actions are the **first row** under the card header (View Profile / Schedule Meeting / ⋯; View Meeting / Reschedule / ⋯), not the last. Their ⋯ menus open downward. | Owner, round 8 |
| **L18** | Desktop: the top-right actions are tight and look like **today's toolbar**: the track (`h-9`, `border-control-border`, `bg-tab-track`, `p-0.5`, `gap-0.5`) with Internal financials, the Settings popover ("General", Breakdown Pricing switch), the Preview eye, and the Save split (Save / Save & Preview). Below `lg` the save becomes today's icon plus chevron. No new toolbar look. | Owner, round 7 |

## 4. Navigation between parts

| ID | Requirement | Source |
|---|---|---|
| **L19** | Parts, in this order: **General info**, Scope of Work, Funding, Files. General info holds Project Type, Time Allocated and Valid Through Timeframe (three columns on desktop, one on phone). | Owner, round 7: "move the project type / time allocated etc back to a new general info tab above the scope of work tab" |
| **L20** | Desktop: a left rail with nav only. Each part shows a live summary and an unsaved dot. | Rounds 4–5, kept since |
| **L21** | Tablet (`md`): the same four parts as a strip above the Card. | Rounds 5–7, kept since |
| **L22** | Phone: the page opens on the parts list; a part opens in place, with "All parts" to go back. | Owner, round 3 answer: keep "Phone parts list" |
| **L23** | No "Unsaved changes" alert or banner. The rail dot is the only unsaved signal. | Owner, round 7 |

## 5. Phone summary row

| ID | Requirement | Source |
|---|---|---|
| **L24** | A summary row is always on screen at the bottom, above the dock: Draft chip, Price with the final price, the ⋯ (moreHorizontal) menu (Preview, Internal financials, Proposal settings), and the Save split. Draft and ⋯ are **not** in the top bar on phone. The top bar and the summary row never move between the parts list and a part; only the middle of the screen changes. | Owner, round 7 |

## 6. Scope of Work

| ID | Requirement | Source |
|---|---|---|
| **L25** | The Scope of Work design approved in round 5 stays. | Owner, round 5: "I like the scope of work section and how it looks" |
| **L26** | Every expand and collapse uses **our transition primitives**: Radix `Collapsible` + `AnimatedCollapsibleContent` (`src/shared/components/ui/collapsible.tsx`) with `COLLAPSE_TRANSITION` (`src/shared/constants/motion.ts`). That covers SOW sections, funding incentives and discounts, and rows added to or removed from a list (section incentives, cost lines). | Owner, round 7: "must keep our nice transition primitives" |
| **L27** | While working inside a long open SOW section (e.g. Roof Replacement, Gutters & Downspouts), its header stays in view, so the rep always sees which section they are editing. | Owner, round 7 |
| **L28** | L27 is done with **no fixed or sticky positioning**. The accordion item is its own overflow container: the list is a flex column; an open item takes the space left (`flex: 0 1 auto`, a minimum height) and its body (`AnimatedCollapsibleContent`) scrolls inside it (`min-h-0 overflow-y-auto overscroll-contain`), under its own header. Closed items are just their header row. With two sections open, they share the height and each scrolls on its own. Built from the primitives in L26, as today's bordered `rounded-xl` Collapsible items. | Owner, round 8: "you placed them as fixed rather than simply having the container itself overflow … Rethink the css on the accordion and use our primitives!" |
| **L29** | Each SOW section has a **Section incentives** area (label + amount rows; add and delete; the field already exists at `sow[i].financials.incentives`), next to Section Price and Cost Lines. The final price reflects it. | Owner, round 7: "in the individual sow sections I do not see an area for section incentive" |
| **L30** | Agreement Notes is the last accordion item, closed by default, with a one-line preview in its header. | Claude's proposal in round 8; confirmed with the spec approval, 2026-10-21. |

## 7. Funding and Files

| ID | Requirement | Source |
|---|---|---|
| **L31** | Funding and Files are redesigned on the Card rhythm (L7) and hug their content (L9). As shown in round 8: Funding has a ledger (Scope of Work, Misc Pricing, Total Contract Price, Section incentives, Incentives, Final price) plus Deposit, and the incentives as collapsible rows (`IncentiveCollapsibleHeader` + `AnimatedCollapsibleContent`). Files has photo tiles, document rows, and Upload in the Card header. | Owner, round 5 (asked for the redesign); round 8 layout not objected |

## 8. Process rules for the spec, plan and build

| ID | Rule | Source |
|---|---|---|
| **P1** | Every round, and now every plan task and review, keeps everything already approved. "You took the good elements we approved thus far and completely removed a lot of them" must not happen in the build. Each plan task lists the L-IDs it touches; the final review walks this whole file. | Owner, round 3 |
| **P2** | No app code until the owner says build or execute. "Go ahead" is not execute. | Standing |
| **P3** | Verification is `pnpm tsc` + `pnpm lint` + a rendered Playwright check at 1440×900, 820×1180 and 390×844, light and dark. Never `pnpm build`. No DB writes for testing. Commit only when asked. | Standing |
| **P4** | The uncommitted `ProposalContextBand` change in `edit-proposal-view.tsx` and `cockpit/cockpit.tsx` (working tree) is replaced by this layout; it is not built on. | Round 1 leftover |

---

## Superseded (do not bring back)

| Earlier state | Replaced by |
|---|---|
| Project Type / Time Allocated / Valid Through in the overview or a page bar; "General is not a section" (rounds 3–6) | L19 General info part |
| Customer and meeting cards placed on the page; one-line customer + visit text in the overview (rounds 3–4) | L14, L15 |
| Phone Save in the Card footer above the dock (rounds 4–6) | L24 summary row |
| Save split with ghost icons, a new toolbar look (rounds 5–6) | L18 today's toolbar |
| "Unsaved changes" marker (rounds 4–6) | L23 |
| Sticky SOW section headers (round 7) | L28 |
| Card actions as the last row (rounds 6–7) | L17 |

## Owner rulings

| Date | Ruling |
|---|---|
| 2026-10-21 | Spec approved with its five §10 choices: the create page keeps today's tabs (follow-up); lock alerts in one row under the overview; Actions first, checked before any shared edit; Upload in the Files header only if the media manager exposes it; errors jump to their part. |
| 2026-10-21 | **Q1** answered: the page opens on General info. |
| 2026-10-21 | **L30** confirmed. |

## Open owner questions

None. Planning findings that need a yes are in the spec, §11.

## Verification checklist (the build's Playwright pass)

- L8: no document scroll and no horizontal overflow at all three sizes.
- L9: on General info, Funding and Files, the Card's bottom edge sits above the bottom of the pane.
- L16: the panel has the same height on both tabs (desktop popover and phone drawer).
- L17: in both cards, the actions row comes before the first field.
- L24: the summary row and the top bar sit at the same y on the parts list, Scope of Work and Files (phone).
- L27/L28: with a long section open and its body scrolled, the header's top equals the item box's top; no element on the page has `position: sticky` or `fixed` inside the Card.
- L26: a collapse sampled mid-transition has an in-between height (it animates, not jumps).
- L29: adding a section incentive of $200 lowers the final price by $200.
