# Funnel Footer + PII Consent Rework — Design

**Date:** 2026-06-27
**Status:** Approved (brainstorm complete; pending implementation plan)

## Goal

Build one shared, data-driven `FunnelFooter`, set up once and rendered across
every funnel (kitchens, bathrooms, future trades). The funnel layout
(`src/app/(frontend)/funnels/layout.tsx`) intentionally omits the marketing-site
footer, so this is a funnel-specific footer. In the same sweep, rework the PII
form's consent: remove the consent checkbox and replace it with
submission-as-agreement disclaimer copy, while still recording implied consent on
the lead for audit.

**Cross-funnel guarantee:** all footer markup, styling, and copy live in shared
components/constants. Specs supply no footer content — they already carry `slug`
and `offer`, and the engine passes `ctx` to the footer. Kitchens and bathrooms
therefore render identically except for the trade name/offer the data already
differs on.

## Decisions settled in brainstorm

1. **50%-visible legal rule applies to BOTH** the submit-point consent disclosure
   and the footer legal block (most conservative reading).
2. **Footer renders on Landing + PII step + Confirmation** only. Interior question
   steps (card-select / zip / address) keep their calm single-viewport design with
   no footer.
3. **PII form stays inside the fixed question container** like any other step. The
   footer is a separate section *below* that container — never rendered inside it.
4. **Consent wording: short proximate line at submit + full footer legal block**
   (TCPA favors consent that is clear, conspicuous, and proximate to the action).
5. **Consent recorded as `{ agreed: true, at: <ISO timestamp> }`** (boolean +
   timestamp) for now. A third-party consent-capture service may replace this with
   richer evidence later.
6. **Footer visual style: slimmer single-column light block** (not the multi-column
   site footer) — its job is trust + legal, not site navigation.

## Architecture context (why these constraints exist)

- **Engine has three views** (`funnel-engine.tsx`): `landing`, `confirmation`,
  `steps`. Landing and confirmation scroll the document. The `steps` view is a
  `min-h-dvh` flex column with a **fixed-height, internally-scrolling question
  stage** (`h-[clamp(21rem,56dvh,36rem)] overflow-y-auto`) plus a `flex-1` spacer —
  designed to be exactly one viewport with no document scroll.
- **PII (`pii-form` kind) currently falls into the `steps` branch.** To give it a
  footer (and the page-scroll the legal rule needs) without changing the other
  steps, the engine branches on `engine.step.kind === 'pii-form'`.
- **Funnels run on dedicated subdomains** (`kitchens.*`, `bathrooms.*`). Middleware
  rewrites *every* path on a funnel host into `/funnels/{slug}/...`, so a relative
  `/privacy` link 404s. Legal links must be absolute to the marketing root host.
- **Funnel subtree is light-themed** (`.funnel-light`), so the footer uses the dark
  logo variant (dark-on-light) and light-theme tokens.
- **An existing hero `TrustBar`** (`ui/trust-bar.tsx`) already shows credential
  chips under the hero. The footer trust row is a *distinct* page-bottom surface
  that reads the same company constants; it does not replace TrustBar.

## Components (all new, one component per file)

Location: `src/shared/domains/funnels/ui/footer/`. Props-driven; data sourced
internally from `src/shared/constants/company/*`.

- **`funnel-footer.tsx`** — `<FunnelFooter ctx={ctx} />`. The page-bottom section:
  - Branding: `LogoLink` (dark variant), one-line company blurb derived from
    `companyInfo` (years via `companyInfo.yearsOld()` — never a raw `new Date()`
    recompute in the component).
  - Trust-marker row (`<FunnelFooterTrust />`).
  - Legal block (`<FunnelFooterLegal ctx={ctx} />`).
  - Social icons from `socials`.
  - Copyright line (`companyInfo.name`, current year).
- **`funnel-footer-trust.tsx`** — trust markers from company constants:
  license # (`licenses[0].licenseNumber`), Licensed/Bonded/Insured (`insurances`),
  BBB A+ (`stats`), years (`companyInfo.combinedYearsExperience`), projects
  (`companyInfo.numProjects`), satisfaction (`companyInfo.clientSatisfaction`), top
  award (`awards[0]`). Reads the same constants as `TrustBar`; no duplicated
  literals.
- **`funnel-footer-legal.tsx`** — `<FunnelFooterLegal ctx={ctx} />`. The
  conspicuous TCPA/legal disclosure paragraph + Privacy Policy / Terms links. The
  block the footer half of the ~50%-visible rule targets.

**Constants:** new `src/shared/domains/funnels/constants/footer-copy.ts` holds all
footer copy not already in company constants — the blurb template, the TCPA
disclosure paragraph, and the inline proximate consent micro-copy. Single home for
the legally-reviewed wording; no string literals in components.

## Mount points (engine wiring)

- **Landing** (`funnel-landing.tsx`): render `<FunnelFooter ctx={ctx} />` as the
  last child of the scroll column, after the final CTA. Natural document scroll.
- **Confirmation** (`funnel-engine.tsx`, confirmation branch): append
  `<FunnelFooter ctx={ctx} />` after the confirmation content block. Natural scroll.
- **PII step** (`funnel-engine.tsx`, `steps` branch): when
  `engine.step.kind === 'pii-form'`, render `<FunnelFooter ctx={ctx} />` *after* the
  question cluster (outside the fixed stage). The PII variant of the cluster relaxes
  the full-viewport fill (drop/relax the `flex-1` spacer; e.g. `min-h-[60dvh]`) so
  the footer legal block peeks ~50% into the first viewport and the document scrolls
  to reveal the rest. Interior steps are untouched — exact single-viewport behavior,
  no footer.

## Consent disclosure — placement & 50%-visible behavior

- **Inline at submit** (`pii-form-step.tsx`, replacing the checkbox `FormField`): a
  short, non-interactive line directly under the Submit button — e.g. *"By tapping
  {CTA}, you agree to our Terms & Privacy Policy and that Tri Pros Remodeling may
  contact you by call/text/email. Consent isn't a condition of purchase."* with
  Terms/Privacy links. This is the legally-proximate consent.
- **Footer legal block** (`funnel-footer-legal.tsx`): fuller TCPA disclosure
  (msg/data rates, frequency, STOP/HELP, consent-not-a-condition) + Privacy/Terms
  links.
- **~50%-visible mechanism**: realized by the PII-step layout above — the legal
  block sits ~50% into the first viewport, page scrollable to reveal the rest. Not
  hidden, not forced fully visible. On landing/confirmation the same footer simply
  scrolls normally.

## PII form rework (remove checkbox)

- **`ui/steps/pii-form-step.tsx`**: delete the `consent` `FormField` (~L173–183) and
  the `Checkbox` import; add the inline disclaimer line under the Submit button;
  remove `consent` from `defaultValues`.
- **`schemas/pii.schema.ts`**: remove the `consent: z.literal(true)` field entirely
  (submission *is* the agreement; nothing to validate).
- **`types.ts` (`PiiContent`) + `lib/steps/pii-step.ts`**: replace the
  `consent: string` content field with a new `submitDisclaimer` content field
  carrying the proximate copy; no stale `consent` content key left behind.

## Recording implied consent (boolean + timestamp)

- **`entities/customers/schemas/index.ts`**: add to the `kind: 'funnel'` source
  object an optional `consent: z.object({ agreed: z.literal(true), at: z.string() })
  .optional()` (ISO string via `new Date().toISOString()` — a content timestamp set
  in JS at submit, consistent with the no-raw-SQL / no-manual-`updatedAt`
  conventions).
- **`lib/build-lead-input.ts`**: set `source.consent = { agreed: true, at: <ISO
  now> }`. Every funnel lead records it (submission = agreement).
- **`submitLead`** (funnels router): already threads `leadMetaJSON` verbatim into
  `customerIntakeService.ingestLead`, so no router change beyond the schema
  accepting the new field. Verify `ingestLead`/CRM ignores `source.consent`
  gracefully (the generic dial/SMS path reads only the envelope; `source` is
  audit-only).

## Legal links must be absolute (cross-host)

Because middleware rewrites all funnel-host paths into `/funnels/{slug}/...`, the
footer + inline disclaimer Privacy/Terms links must be **absolute to the marketing
root host**. Add a small helper (e.g. `lib/legal-links.ts`) that builds
`https://{rootHost}/privacy` and `.../terms`, derived dev-safe by stripping the
`{slug}.` label from the current host (`kitchens.localhost:3000` → `localhost:3000`;
`kitchens.triprosremodeling.com` → `triprosremodeling.com`), falling back to
`APP_HOSTS.prod[0]`. Exact helper finalized in the plan. Reuse `ROOTS.landing
.privacy()/terms()` for the path portion.

## Legal-compliance review

Before finalizing copy, run the **Legal Compliance Checker** agent over the inline
disclaimer + footer disclosure wording (TCPA implied-consent language, "consent not
a condition of purchase", STOP/HELP, msg & data rates). Its output feeds the final
strings in `footer-copy.ts`. Wording review only — not the third-party *recording*
service flagged for later.

## Files

**New**
- `src/shared/domains/funnels/ui/footer/funnel-footer.tsx`
- `src/shared/domains/funnels/ui/footer/funnel-footer-trust.tsx`
- `src/shared/domains/funnels/ui/footer/funnel-footer-legal.tsx`
- `src/shared/domains/funnels/constants/footer-copy.ts`
- `src/shared/domains/funnels/lib/legal-links.ts` (if not folded into footer-copy)

**Edited**
- `src/shared/domains/funnels/ui/funnel-engine.tsx`
- `src/shared/domains/funnels/ui/funnel-landing.tsx`
- `src/shared/domains/funnels/ui/steps/pii-form-step.tsx`
- `src/shared/domains/funnels/schemas/pii.schema.ts`
- `src/shared/domains/funnels/types.ts`
- `src/shared/domains/funnels/lib/steps/pii-step.ts`
- `src/shared/domains/funnels/lib/build-lead-input.ts`
- `src/shared/entities/customers/schemas/index.ts`

## Testing / verification

- `pnpm tsc` + `pnpm lint`.
- Manual on **both** kitchens and bathrooms subdomains:
  - Footer identical bar trade/offer; renders on landing, PII, confirmation; absent
    on interior question steps.
  - PII step: footer legal block ~50% visible at the fold, page scrolls to reveal
    the rest; interior steps unchanged (single viewport, no footer, no page scroll).
  - Privacy/Terms links resolve to the marketing host (not a funnel-host 404).
  - A submitted lead's `source.consent` is `{ agreed: true, at: <ISO> }`.

## Conventions honored

- One React component per file; no file-level constants/helpers in component files
  (copy → `footer-copy.ts`, link helper → `lib/`); named exports only.
- Company data sourced exclusively from `src/shared/constants/company/*` — never
  hardcoded (see memory: company data central ref).
- ISO timestamps set in JS, not raw SQL; no manual `updatedAt`.
- `shared/` does not import from `features/`.
