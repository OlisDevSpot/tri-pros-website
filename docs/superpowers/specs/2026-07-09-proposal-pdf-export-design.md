# Proposal PDF Export — Design

**Date:** 2026-07-09
**Status:** Approved (brainstorm complete)
**Owner:** proposal-flow / proposals entity

## Problem

Some customers prefer a classic PDF over the interactive proposal page. Sales reps and homeowners need quick access to a branded, printable PDF version of a proposal — not a mimic of the web page, but a document focused on legitimacy and substance: customer details, company details, and the scope of work (trades, scopes, rich-text sections). Inspiration: the PDFs we already generate for Zoho Sign envelopes.

## Decision summary

| Decision | Choice |
| --- | --- |
| PDF stack | pdfmake doc-definition via existing pipeline (`renderPdf`, `tiptapToPdfmake`); no new deps |
| Pricing content | Full homeowner parity — respects `pricingMode`, shows incentives, derived final TCP, deposit. **Never cost lines/margins.** One variant only, always homeowner-safe |
| Generation | On-demand, always fresh (proposal is live-editable); in-memory buffer, nothing stored |
| Open behavior | New tab, browser-native viewer (`Content-Disposition: inline`) |
| Auth | Token-gated route, mirroring `/api/proposals/[proposalId]/summary` (SYSTEM_CONTEXT + exact token match). UI always has `proposal.token` from `getFullView`, so agents and homeowners use the same URL shape |
| UI placement | Both: (a) kebab (MoreVertical) button in `ProposalPageNavbar` opening a shadcn Popover; (b) "Prefer a classic PDF?" card near the end of the flow |
| Navbar cleanup | Kebab popover absorbs **View as PDF** + the agent/homeowner **view-mode toggle** (CASL-gated). The fixed desktop pill and the mobile `ViewModeToggleMobile` are removed. Step tabs (desktop) / Select jumper (mobile) unchanged |

## Rejected alternatives

- **@react-pdf/renderer** — second PDF stack alongside pdfmake; new bundling/tracing concerns; duplicates existing infra.
- **Headless-Chrome print of the live page** — user explicitly does not want a page mimic; operationally heavy on Vercel; risk of leaking agent-only UI state.

## Architecture

```
[Navbar kebab / bottom card]
        │ opens new tab
        ▼
GET /api/proposals/[proposalId]/pdf?token=tpr-…
        │ token === proposal.token (401 otherwise)
        ▼
pdfService.generateProposalPdf(SYSTEM_CONTEXT, { proposalId })
        │ getFullView → buildProposalDocDefinition → renderPdf
        ▼
Buffer → Response (application/pdf, inline, sanitized filename)
```

### 1. Doc definition — `src/shared/lib/pdf/proposal-doc-definition.ts`

`buildProposalDocDefinition(proposal): TDocumentDefinitions`. Sibling of `sow-doc-definition.ts`; copies its style conventions (Roboto→Helvetica standard fonts, 10pt base, `pageMargins [56,56,56,56]`). Content order (all data homeowner-safe):

1. **Branded header** — logo + company name, office address, phone, email, CSLB license. All from `src/shared/constants/company/` (`companyInfo`, `contactInfo`, `credentials`) — never hardcoded (memory: company-data-central-ref).
2. **Prepared-for block** — customer name, address/city/state/zip, phone via `formatPhone` (`src/shared/lib/phone.ts`), email; proposal `label`, created date, `validThroughTimeframe`.
3. **Project overview** — `projectJSON.data`: `summary`, `projectObjectives[]`, `homeAreasUpgrades[]`, `energyBenefits` (when present).
4. **Scope of Work** — one section per `projectJSON.data.sow[]`: `title`, trade label, scope labels, rich-text body via `tiptapToPdfmake(section.contentJSON)`. Per-section price shown **only** when `formMetaJSON.pricingMode === 'breakdown'`.
5. **Investment** — mirrors the summary route's pricing logic (`summary/route.ts:93-123`): breakdown lines + `miscPrice` + `startingTcp` subtotal when in breakdown mode, else single contract price; incentives (discount vs exclusive-offer rendering); **final TCP via `computeFinalTcp(fundingJSON.data)`** (never a stored value — DOCS `#final-tcp-derived`); deposit.
6. **Agreement notes** — `projectJSON.data.agreementNotes` (when present).
7. **Footer** (pdfmake `footer` fn) — page X of Y + company contact line.

**Hard invariant:** the generator never reads `sow[].financials.costLines` or any margin data. Cost lines are agent-only (feature DOCS anti-pattern); this document is homeowner-distributable by construction.

### 2. Service — `src/shared/services/pdf.service.ts`

Replace the throwing stub `generateProposalPdf` (line 14) with the same shape as `generateSowPdf`: `dalVerifySuccess(await getFullView(ctx, { id }))` → not-found guard → `buildProposalDocDefinition` → `renderPdf`.

### 3. Route — `src/app/api/proposals/[proposalId]/pdf/route.ts`

`GET` handler mirroring the summary route's auth exactly:

- Missing token → 401. Proposal not found → 404. `proposal.token !== token` → 401.
- Calls `pdfService.generateProposalPdf(SYSTEM_CONTEXT, { proposalId })`.
- Returns buffer with `Content-Type: application/pdf` and `Content-Disposition: inline; filename="<sanitized>.pdf"` — filename like `Tri Pros Proposal - {customer name}.pdf`. The `sanitize-filename` helper is generic, not Zoho-specific — **relocate it to `src/shared/lib/sanitize-filename.ts`** and update both importers (`assemble-envelope.ts`, `zoho-sync.service.ts`) — importing from `providers/zoho-sign/lib` into an API route would violate provider boundaries. `service-architecture.md#provider-directory-shape` cites this file as its provider-lib example and must be updated in the same change.
- Render failure → 500 with logged error (fail fast, no silent suppression).

**Vercel tracing:** add this route path to `next.config.ts` `outputFileTracingIncludes` with the same pdfkit data glob used for `/api/qstash-jobs` (`./node_modules/.pnpm/pdfkit@*/node_modules/pdfkit/js/data/**/*`). Without it the route 500s on Vercel with missing-AFM-font errors (memory: pdfkit-direct-dep).

### 4. Navbar kebab — proposal-flow UI

New component(s) under `src/features/proposal-flow/ui/components/navbar/` (entity-first organization, one component per file, named exports):

- **Kebab trigger**: MoreVertical icon button rendered in `ProposalPageNavbar` on both desktop and mobile.
- **shadcn Popover** content with:
  - **View as PDF** — anchor opening `/api/proposals/{id}/pdf?token={proposal.token}` in a new tab (`target="_blank" rel="noopener"`). Token read from the already-loaded proposal (`useCurrentProposal`).
  - **View-mode toggle** (agent-only) — gated by `hasMounted && ability.can('update', 'Proposal')`, same pattern the navbar already uses; drives `useViewMode` (single source of truth, unchanged).
- **Removals**: the fixed desktop `<ViewModeToggle>` pill (rendered from `proposal-flow-shell.tsx`) and `<ViewModeToggleMobile>` in the mobile navbar. The toggle UI inside the popover may reuse/adapt the existing toggle components.
- Step tabs / mobile Select jumper untouched.

### 5. Bottom card — proposal-flow UI

A "Prefer a classic PDF?" card rendered at the end of the proposal flow in `proposal/index.tsx`, **after** the mapped steps — it is not a registered step in `proposal-steps.ts` and does not appear in navigation. Same PDF link. Visible in both view modes; styled per funnel design standards (premium feel, mobile-first, both viewports).

**Design process requirement:** both UI pieces go through the mandated UI methodology before coding — user-flow brainstorm ✅ (this spec), then parallel design/convention subagents (ui-ux-pro-max, web-design-guidelines review, convention-auditor) during implementation. No ad-hoc UI.

## Data flow

Single read path: `getFullView` (already scope-safe; SYSTEM_CONTEXT acceptable here because the token check replaces scope, per DOCS `#shareable-via-token`). No writes, no schema changes, no new tRPC procedures.

## Error handling

| Failure | Behavior |
| --- | --- |
| Missing/mismatched token | 401 JSON |
| Proposal not found | 404 JSON |
| PDF render throws | 500 JSON, error logged with proposalId context |
| Popover link when proposal still loading | Button disabled until `proposal` is available |

## Testing & verification

- `pnpm tsc` + `pnpm lint` (never `pnpm build`).
- Manual: hit the route with a real dev proposal — valid token (200, PDF renders with all sections), wrong token (401), missing token (401), bogus id (404).
- Content audit: generate a PDF from a proposal that has cost lines and confirm none appear; confirm `total` vs `breakdown` pricing modes render correctly; confirm senior/incentive/no-incentive variants.
- UI: kebab popover on desktop + mobile viewport (Chrome device mode); bottom card on both; view-mode toggle still works from its new home; homeowner (token URL, no session) sees PDF item but no toggle.

## Out of scope

- Attaching this PDF to Zoho envelopes (future: one `generated-pdf` registry entry).
- Caching/persisting generated PDFs.
- Finance-form PDF (`generateFinanceForm` stays stubbed).
- Rebuilding the summary route (its TODO stands).

## Key references

- `src/shared/services/pdf.service.ts` (stub at line 14)
- `src/shared/lib/pdf/{render-pdf,sow-doc-definition,tiptap-to-pdfmake}.ts`
- `src/app/api/proposals/[proposalId]/summary/route.ts` (auth + content skeleton)
- `src/features/proposal-flow/ui/components/navbar/navbar.tsx`, `proposal-flow-shell.tsx`, `proposal/view-mode-toggle.tsx`, `proposal/index.tsx`
- `src/shared/entities/proposals/DOCS.md` (`#final-tcp-derived`, `#shareable-via-token`, `#share-token-generated-at-insert`)
- `src/shared/constants/company/`
- `next.config.ts` (`outputFileTracingIncludes`)
