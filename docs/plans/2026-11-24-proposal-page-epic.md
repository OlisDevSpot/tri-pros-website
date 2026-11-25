# Proposal Page — Epic Tracker

> **Status**
> - Stage: built · unmerged, PR #298 draft · epic #305
> - Built on: `feat/proposal-page` · Verified at: `feat/proposal-page@057a8beca` (2026-11-24) · page: https://claude.ai/artifact/7D8kgccA7iy6f8ATWzLdqS#lane-proposal-page
> - Done: first build · rework P1–P40 · Scope chapter K1–K13 · MoneyField and PhoneField · share-link cost-line gate (verified in code)
> - Next: fold PE4 #307 (E2) → data views #297 ships → merge main, fix the paths DV3a moves → Playwright on the preview → #298 ready → owner iPad check → squash → backfill #352
> - Open: Scope chapter iPad check (follow-ups F3) · C4 payment-schedule law line wording · pricing-hold line (spec §11 F7) · Zoho Z1–Z3 #351
> - Blocked: #298 merge on data views #297 (DV3a moves ~92 files this branch imports)

> **Goal:** the homeowner's proposal page reads as a story (per-part pricing, cash-down slider, a sticky Scope chapter, an agent cockpit), and every money and phone input in the app formats through one `MoneyField` and one `PhoneField`.
> **Design:** rework spec `docs/superpowers/specs/2026-10-16-proposal-page-rework-design.md` (rulings §2.5 and §12) · Scope chapter spec `docs/superpowers/specs/2026-10-23-proposal-scope-chapter-design.md` and plan `docs/superpowers/plans/2026-10-23-proposal-scope-chapter.md` · follow-ups `docs/plans/2026-11-03-proposal-scope-chapter-follow-ups.md`.

## Issues

| Issue | What | Notes |
|---|---|---|
| #306 | The proposal page as a story | built; PR #298, which also closes #307 (E2) |
| #351 | Zoho templates print the app's payment rows (Z1–Z3) | owner, in Zoho; answers the editor epic's Q1 |
| #352 | Cash-down backfill on prod | owner; after #306 is on prod; prod access only with the owner's OK for that run |
| #353 | Scope chapter surfaces: wrapper hole, well, control edges | follow-ups F1, F2, F5; needs-info |

PE4 (#307) belongs to the proposal editor epic #347 (`docs/plans/2026-10-20-proposal-editor-epic.md`) and ships inside #298.

## Follow-ups with no issue yet

From rework spec §11 and the Scope chapter follow-ups. Spec §11 F1, F2 and F3 moved to the editor epic (PE2, PE1, #351).

| ID | Follow-up | When |
|---|---|---|
| §11 F4 | Remove the automatic email OTP on app envelopes (`assemble-envelope.ts`) | independent |
| §11 F6 | Rep headshots in the team card | company photo revamp |
| §11 F7 | A real pricing-hold field, or drop "Pricing held through" for good | owner decision |
| §11 F8 | The PDF pass (reps, folded schedule, review standing) | after #298 ships |
| §11 F9 | Analytics closer narrowed to meeting reps of an approved proposal | analytics |
| §11 F10 | VoIP `specialist` → owner rep rename | visit-messages work |
| §11 F11 | One hook for the always-mounted sheets' close, focus return, Escape and drag | after #298 ships |
| §11 F12 | `OverviewCard` adoption by the Proposal, Customer and Meeting entity cards | after #298 ships, own plan |
| Scope F4 | Cap step lines at ~72ch, or keep full width | owner |
| Scope F6 | Small accepted behaviours (reduced-motion jump, eyebrow hairline width, collapse-all not sticky, open state seeded once) | with #353 |

## Rulings

Earlier rulings live where they were made (rework spec §2.5 T1–T7 and §12 C1–C8, Scope chapter spec K1–K13, memory `project-proposal-page-redesign.md`); they are not copied here.

| ID | Ruling | Date |
|---|---|---|
| E1 | Two epics: the proposal page (#305) and the proposal editor (#347). PE4 moves under the editor epic. (Owner picked "Two epics".) | 2026-11-24 |
| E2 | "Fold into #298": PE4 merges into `feat/proposal-page` and ships in one PR with the proposal page. | 2026-11-24 |
