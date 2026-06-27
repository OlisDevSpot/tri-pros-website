# Funnel Footer + PII Consent Rework Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add one shared, data-driven funnel footer (rendered on landing, the PII submit step, and confirmation) and rework the PII consent from a checkbox to submission-as-agreement, while recording implied consent on the lead.

**Architecture:** A new presentational `FunnelFooter` (composed of trust + legal sub-components) lives in `src/shared/domains/funnels/ui/footer/`, sources all data from `src/shared/constants/company/*` + per-funnel `ctx`, and is mounted at three points in the engine. The PII step drops its checkbox for a proximate disclaimer line; the fuller TCPA disclosure lives in the footer legal block. Implied consent (`{ agreed: true, at: ISO }`) is added to the funnel `source` schema and set in `build-lead-input`.

**Tech Stack:** Next.js 15 (App Router), React 19, TypeScript, Tailwind v4, motion/react, Zod, tRPC, react-hook-form. Funnels run on subdomains; legal links cross back to the apex via `mainSiteUrl()`.

## Global Constraints

- **No unit-test runner exists** in this repo (no vitest/jest). Verification for every task = `pnpm tsc` (type-check) + `pnpm lint`, plus manual browser checks for UI tasks. NEVER run `pnpm build`. NEVER `pnpm db:push` (use `pnpm db:push:dev` — though no schema/db push is needed here; the consent field is JSONB-internal, no migration).
- **Company data only from `src/shared/constants/company/*`** — never hardcode license #, phone, stats, coverage, awards.
- **One React component per file; named exports only; no file-level constants or helper functions inside component files** — copy lives in `constants/footer-copy.ts`.
- **Funnel is scoped-light under global `html.dark`** — use the `logo-light-right.svg` asset directly via `next/image`, NOT the shared `Logo` component (it switches on `dark:` and would pick the wrong variant). Same pattern as `funnel-hero.tsx` / `funnel-sticky-header.tsx`.
- **Legal links must be absolute to the apex** via `mainSiteUrl(ROOTS.landing.privacy())` / `mainSiteUrl(ROOTS.landing.terms())` — a relative `/privacy` 404s on a funnel subdomain (middleware rewrites all paths to `/funnels/{slug}/...`).
- **ISO timestamps in JS** (`new Date().toISOString()`), never raw SQL. Display years/dates may use `new Date()` in components (display-only), but prefer `companyInfo` constants where they exist.
- **Work on `main`**; stage only the files each task touches (do not `git add -A`). Commit message trailer:
  `Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>`

---

### Task 1: Footer copy constants + legal-compliance review

**Files:**
- Create: `src/shared/domains/funnels/constants/footer-copy.ts`

**Interfaces:**
- Produces:
  - `funnelFooterBlurb(trade: string): string`
  - `FUNNEL_SUBMIT_DISCLAIMER: string` (proximate consent line under the PII submit button)
  - `FUNNEL_FOOTER_DISCLOSURE: string` (fuller TCPA disclosure for the footer legal block)

- [x] **Step 1: Legal-compliance review — DONE by controller (2026-06-27)**

The Legal Compliance Checker reviewed the draft TCPA wording and supplied the final
strings used verbatim in Step 2 below. Its findings (folded in): String 1 needed
message-frequency + STOP/HELP added and stronger technology naming ("autodialed and
prerecorded" not just "automated means"); String 2 needed the Terms/Privacy
reference added. It also confirmed "submission = agreement" is defensible given a
retained consent record (timestamp — see Task 2). **Do not re-dispatch a compliance
agent; transcribe the approved strings exactly.**

- [ ] **Step 2: Write `footer-copy.ts`** (use these compliance-approved strings verbatim)

```ts
/**
 * All funnel-footer copy that isn't already a company constant. Single home for
 * the legally-reviewed TCPA wording so no string literals live in the footer /
 * PII components. The trade name is injected by the caller from `ctx` (per
 * funnel), keeping these strings funnel-agnostic. see ../ui/footer/funnel-footer.tsx
 *
 * Wording reviewed via the Legal Compliance Checker on 2026-06-27 — re-review on
 * any change to the consent flow.
 */

/** One-line company blurb. `trade` is the funnel's trade name (from ctx). */
export function funnelFooterBlurb(trade: string): string {
  return `${trade} done right — Southern California's licensed, bonded & insured remodeling specialists.`
}

/**
 * Proximate consent shown directly under the PII submit button (replaces the
 * removed checkbox). Submission itself is the agreement; the component renders
 * functional Terms/Privacy links in the same block. Wording approved by the Legal
 * Compliance Checker on 2026-06-27 — re-review on any change.
 */
export const FUNNEL_SUBMIT_DISCLAIMER
  = 'By tapping the button above, you agree to our Terms and Privacy Policy and authorize Tri Pros Remodeling to contact you at the number provided by phone, text, and email about your project — including by autodialed and prerecorded/automated messages. Consent is not a condition of purchase. Msg frequency varies; msg & data rates may apply. Reply STOP to opt out, HELP for help.'

/** Fuller TCPA disclosure shown in the footer legal block (links rendered by the component). */
export const FUNNEL_FOOTER_DISCLOSURE
  = 'By submitting your information, you authorize Tri Pros Remodeling to contact you at the phone number provided by phone call, text message (SMS), and email regarding your remodeling project and related offers, including through automated telephone dialing technology and prerecorded or artificial voice messages. You understand that your consent is not a condition of purchasing any goods or services. Message frequency varies; message and data rates may apply. Reply STOP to unsubscribe at any time, or HELP for help. See our Terms of Service and Privacy Policy for details on how we handle your information.'
```

- [ ] **Step 3: Type-check + lint**

Run: `pnpm tsc && pnpm lint`
Expected: PASS (new file compiles; no unused-export errors — consumers land in later tasks; if lint flags the unused exports, that resolves once Tasks 3–4 import them, so a single `pnpm tsc` clean is the gate here).

- [ ] **Step 4: Commit**

```bash
git add src/shared/domains/funnels/constants/footer-copy.ts
git commit -m "feat(funnels): footer + consent copy constants (TCPA-reviewed)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 2: Record implied consent on the lead

**Files:**
- Modify: `src/shared/entities/customers/schemas/index.ts` (funnel `source` object, after `enrichment`)
- Modify: `src/shared/domains/funnels/lib/build-lead-input.ts` (funnel `source` object)

**Interfaces:**
- Produces: `LeadMeta.source` (kind `'funnel'`) gains optional `consent?: { agreed: true, at: string }`.
- Consumes: nothing new. `submitLead` already threads `leadMetaJSON` verbatim into `customerIntakeService.ingestLead` (`leadMetaJSON: input.leadMeta ?? null`), so no router/service change is needed.

- [ ] **Step 1: Add the `consent` field to the funnel source schema**

In `src/shared/entities/customers/schemas/index.ts`, inside the `z.literal('funnel')` branch of the `source` discriminated union, immediately after the `enrichment: enrichmentRecordSchema.optional(),` line, add:

```ts
      // Implied TCPA consent captured at funnel submit (submission = agreement;
      // the PII step shows the proximate disclaimer + the footer legal block).
      // Boolean + ISO timestamp for now — a third-party consent-capture service
      // may later replace this with richer evidence. Audit-only: the generic
      // dial/SMS path never reads it.
      consent: z.object({ agreed: z.literal(true), at: z.string() }).optional(),
```

- [ ] **Step 2: Set consent in `build-lead-input.ts`**

In `src/shared/domains/funnels/lib/build-lead-input.ts`, in the returned object's `leadMetaJSON.source`, add `consent` as the last key (after `enrichment`):

```ts
      source: {
        kind: 'funnel' as const,
        offer: ctx.offer,
        funnelSlug: ctx.slug,
        utm: ctx.utm,
        meta: { fbp, fbc },
        enrichment,
        // Submission = agreement (no checkbox). Captured at submit time, client-side.
        consent: { agreed: true as const, at: new Date().toISOString() },
      },
```

- [ ] **Step 3: Type-check + lint**

Run: `pnpm tsc && pnpm lint`
Expected: PASS. (The `as const` on `agreed` is required so it narrows to the literal `true` the schema expects.)

- [ ] **Step 4: Commit**

```bash
git add src/shared/entities/customers/schemas/index.ts src/shared/domains/funnels/lib/build-lead-input.ts
git commit -m "feat(funnels): record implied consent on funnel leads

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 3: PII consent rework — remove checkbox, add proximate disclaimer

**Files:**
- Modify: `src/shared/domains/funnels/schemas/pii.schema.ts` (remove `consent`)
- Modify: `src/shared/domains/funnels/types.ts` (`PiiContent` — remove `consent`)
- Modify: `src/shared/domains/funnels/lib/steps/pii-step.ts` (remove `consent` from content)
- Modify: `src/shared/domains/funnels/ui/steps/pii-form-step.tsx` (drop checkbox FormField, add disclaimer)

**Interfaces:**
- Consumes: `FUNNEL_SUBMIT_DISCLAIMER` (Task 1); `mainSiteUrl` from `@/shared/lib/main-site-url`; `ROOTS` from `@/shared/config/roots`.
- Produces: `PiiContent` no longer has a `consent` field; `PiiFormData` no longer has `consent`.

> **Refinement vs spec:** the disclaimer is identical across funnels, so it lives as a shared **constant** (`FUNNEL_SUBMIT_DISCLAIMER`) read directly by the component — the `consent` content field is removed outright (not replaced with a per-funnel `submitDisclaimer` field). This better satisfies "specs only supply data; copy lives in shared constants."

- [ ] **Step 1: Remove `consent` from the Zod schema**

Replace the body of `src/shared/domains/funnels/schemas/pii.schema.ts` with:

```ts
import z from 'zod'

export const piiSchema = z.object({
  firstName: z.string().min(1, 'Please enter your first name'),
  lastName: z.string().min(1, 'Please enter your last name'),
  phone: z.string().min(7, 'Please enter a valid phone'),
  _honeypot: z.string().max(0).optional(),
})
export type PiiFormData = z.infer<typeof piiSchema>
```

- [ ] **Step 2: Remove `consent` from `PiiContent`**

In `src/shared/domains/funnels/types.ts`, change the `PiiContent` interface (currently lines ~76–82) to drop the `consent` line:

```ts
export interface PiiContent {
  title: string
  subtitle?: string
  cta?: string
  fields: PiiFieldLabels
}
```

- [ ] **Step 3: Remove `consent` from the prebuilt step content**

In `src/shared/domains/funnels/lib/steps/pii-step.ts`, delete the `consent: '…'` line from `content` so it reads:

```ts
export const PII_STEP: PiiStep = {
  id: 'pii',
  kind: 'pii-form',
  content: {
    title: 'Where should we send your Showcase details?',
    cta: 'See if I qualify',
    fields: { firstName: 'First name', lastName: 'Last name', phone: 'Phone' },
  },
}
```

- [ ] **Step 4: Rework the PII form component**

In `src/shared/domains/funnels/ui/steps/pii-form-step.tsx`:

(a) Remove the `Checkbox` import (line 10) and add the new imports near the other `@/shared` imports:

```ts
import { ROOTS } from '@/shared/config/roots'
import { FUNNEL_SUBMIT_DISCLAIMER } from '@/shared/domains/funnels/constants/footer-copy'
import { mainSiteUrl } from '@/shared/lib/main-site-url'
```

(b) Change `defaultValues` (line 33) to drop `consent`:

```ts
    defaultValues: { firstName: '', lastName: '', phone: '', _honeypot: '' },
```

(c) Delete the entire consent `FormField` block (the `<FormField … name="consent" …>` JSX, ~lines 173–183).

(d) Replace the submit `Button` (lines ~194–196) and add the disclaimer + links directly below it. Replace:

```tsx
        <Button type="submit" size="lg" disabled={!namesFilled || submit.isPending}>
          {submit.isPending ? 'Submitting…' : (content.cta ?? 'See if I qualify')}
        </Button>
```

with:

```tsx
        <Button type="submit" size="lg" disabled={!namesFilled || submit.isPending}>
          {submit.isPending ? 'Submitting…' : (content.cta ?? 'See if I qualify')}
        </Button>
        {/* Submission = agreement (replaces the old consent checkbox). Proximate to
            the action for TCPA; Terms/Privacy link back to the apex (funnels are on
            subdomains, so a relative path 404s). The fuller disclosure lives in the
            footer legal block. */}
        <p className="text-muted-foreground text-center text-xs leading-snug">
          {FUNNEL_SUBMIT_DISCLAIMER}
          {' '}
          <a href={mainSiteUrl(ROOTS.landing.terms())} target="_blank" rel="noopener noreferrer" className="underline underline-offset-2">Terms</a>
          {' · '}
          <a href={mainSiteUrl(ROOTS.landing.privacy())} target="_blank" rel="noopener noreferrer" className="underline underline-offset-2">Privacy Policy</a>
        </p>
```

- [ ] **Step 5: Type-check + lint**

Run: `pnpm tsc && pnpm lint`
Expected: PASS. (Confirms no remaining `consent` references — `data.consent`, `content.consent`, the schema literal — anywhere.)

- [ ] **Step 6: Manual check**

Run `pnpm dev`, open a funnel (e.g. `kitchens.localhost:3000`), advance to the PII step. Confirm: no checkbox; the disclaimer line + Terms/Privacy links render under the button; the form still submits with names + valid mobile; Terms/Privacy open the apex pages.

- [ ] **Step 7: Commit**

```bash
git add src/shared/domains/funnels/schemas/pii.schema.ts src/shared/domains/funnels/types.ts src/shared/domains/funnels/lib/steps/pii-step.ts src/shared/domains/funnels/ui/steps/pii-form-step.tsx
git commit -m "feat(funnels): replace PII consent checkbox with submission-as-agreement disclaimer

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 4: Footer presentational components

**Files:**
- Create: `src/shared/domains/funnels/ui/footer/funnel-footer-trust.tsx`
- Create: `src/shared/domains/funnels/ui/footer/funnel-footer-legal.tsx`
- Create: `src/shared/domains/funnels/ui/footer/funnel-footer.tsx`

**Interfaces:**
- Consumes: `funnelFooterBlurb`, `FUNNEL_FOOTER_DISCLOSURE` (Task 1); company constants (`companyInfo`, `licenses`, `stats`, `awards`, `socials`); `getTradeFacts` from `constants/trade-facts`; `mainSiteUrl`; `ROOTS`.
- Produces:
  - `FunnelFooterTrust(): JSX` (no props)
  - `FunnelFooterLegal(): JSX` (no props)
  - `FunnelFooter({ ctx }: { ctx: FunnelContext }): JSX`

- [ ] **Step 1: Create `funnel-footer-trust.tsx`**

```tsx
import { Check } from 'lucide-react'
import { awards, companyInfo, licenses, stats } from '@/shared/constants/company'

/**
 * Page-bottom legitimacy markers for the funnel footer. A distinct surface from
 * the hero `TrustBar`; both read the same company constants (no duplicated
 * literals). Company data only — never hardcode credentials.
 */
export function FunnelFooterTrust() {
  const bbb = stats.find(s => s.label === 'BBB Rating')
  const markers = [
    `CA Lic. #${licenses[0]?.licenseNumber ?? ''}`,
    'Licensed, Bonded & Insured',
    bbb ? `${bbb.number} BBB Rating` : null,
    `${companyInfo.numProjects}+ Projects`,
    `${companyInfo.combinedYearsExperience}+ Yrs Experience`,
    `${Math.round(companyInfo.clientSatisfaction * 100)}% Satisfaction`,
    awards[0]?.label ?? null,
  ].filter((m): m is string => Boolean(m))

  return (
    <ul className="flex flex-wrap items-center gap-x-4 gap-y-2">
      {markers.map(m => (
        <li key={m} className="text-muted-foreground flex items-center gap-1.5 text-xs font-medium">
          <Check className="size-3.5 shrink-0" aria-hidden="true" />
          {m}
        </li>
      ))}
    </ul>
  )
}
```

- [ ] **Step 2: Create `funnel-footer-legal.tsx`**

```tsx
import { ROOTS } from '@/shared/config/roots'
import { FUNNEL_FOOTER_DISCLOSURE } from '@/shared/domains/funnels/constants/footer-copy'
import { mainSiteUrl } from '@/shared/lib/main-site-url'

/**
 * The conspicuous TCPA/legal disclosure + Privacy/Terms links. On the PII step
 * this block is the one the ~50%-visible-but-scrollable rule targets (the engine
 * lays the footer out so it peeks into the fold there). Links resolve to the apex
 * via `mainSiteUrl` — a relative path 404s on a funnel subdomain.
 */
export function FunnelFooterLegal() {
  return (
    <div className="flex flex-col gap-3">
      <p className="text-muted-foreground/80 text-[11px] leading-relaxed">
        {FUNNEL_FOOTER_DISCLOSURE}
      </p>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs">
        <a
          href={mainSiteUrl(ROOTS.landing.privacy())}
          target="_blank"
          rel="noopener noreferrer"
          className="text-muted-foreground hover:text-foreground underline-offset-2 hover:underline"
        >
          Privacy Policy
        </a>
        <a
          href={mainSiteUrl(ROOTS.landing.terms())}
          target="_blank"
          rel="noopener noreferrer"
          className="text-muted-foreground hover:text-foreground underline-offset-2 hover:underline"
        >
          Terms of Service
        </a>
      </div>
    </div>
  )
}
```

- [ ] **Step 3: Create `funnel-footer.tsx`**

```tsx
import type { FunnelContext } from '@/shared/domains/funnels/types'
import LogoOnLight from '@public/company/logo/logo-light-right.svg'
import Image from 'next/image'
import { companyInfo, socials } from '@/shared/constants/company'
import { funnelFooterBlurb } from '@/shared/domains/funnels/constants/footer-copy'
import { getTradeFacts } from '@/shared/domains/funnels/constants/trade-facts'
import { FunnelFooterLegal } from './funnel-footer-legal'
import { FunnelFooterTrust } from './funnel-footer-trust'

/**
 * Shared funnel footer — set up once, rendered on the landing, the PII submit
 * step, and the confirmation. Per-funnel only via `ctx` (trade name); everything
 * else is company-constant data, so kitchens and bathrooms render identically bar
 * the trade. Funnel is scoped-light under global `html.dark`, so the logo uses
 * the `logo-light-right` artwork directly (NOT the shared Logo component, which
 * switches on `dark:`). see funnel-hero.tsx for the same pattern.
 */
export function FunnelFooter({ ctx }: { ctx: FunnelContext }) {
  const trade = getTradeFacts(ctx.slug).name
  const year = new Date().getFullYear()

  return (
    <footer className="border-border/60 w-full border-t pt-10 pb-12">
      <div className="mx-auto flex w-full max-w-xl flex-col gap-6 px-5">
        <Image src={LogoOnLight} alt="Tri Pros Remodeling" width={180} height={48} className="h-11 w-auto" />
        <p className="text-muted-foreground max-w-md text-sm leading-relaxed">
          {funnelFooterBlurb(trade)}
        </p>
        <FunnelFooterTrust />
        <FunnelFooterLegal />
        <div className="flex items-center gap-4">
          {socials.map(s => (
            <a
              key={s.name}
              href={s.href}
              target="_blank"
              rel="noopener noreferrer"
              aria-label={s.name}
              className="text-muted-foreground hover:text-foreground transition-colors"
            >
              <s.Icon className="size-4" />
            </a>
          ))}
        </div>
        <p className="text-muted-foreground/70 text-xs">
          ©
          {' '}
          {year}
          {' '}
          {companyInfo.name}
          . All rights reserved.
        </p>
      </div>
    </footer>
  )
}
```

- [ ] **Step 4: Type-check + lint**

Run: `pnpm tsc && pnpm lint`
Expected: PASS. (`<s.Icon />` is a valid member-expression component tag. `LogoOnLight` SVG import resolves like the hero's.)

- [ ] **Step 5: Commit**

```bash
git add src/shared/domains/funnels/ui/footer/
git commit -m "feat(funnels): shared FunnelFooter (branding + trust + legal)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 5: Mount the footer in the engine + landing

**Files:**
- Modify: `src/shared/domains/funnels/ui/funnel-landing.tsx` (append footer at the bottom of the scroll column)
- Modify: `src/shared/domains/funnels/ui/funnel-engine.tsx` (confirmation branch + PII branch of `steps`)

**Interfaces:**
- Consumes: `FunnelFooter` (Task 4). `FunnelLanding` already receives `ctx`; the engine has `ctx` in scope.

- [ ] **Step 1: Mount on the landing**

In `src/shared/domains/funnels/ui/funnel-landing.tsx`:

(a) Add the import alongside the other `ui/` imports:

```ts
import { FunnelFooter } from '@/shared/domains/funnels/ui/footer/funnel-footer'
```

(b) Add `<FunnelFooter>` as the last child of the entrance `motion.div`, immediately after the closing `</FunnelCta>` that currently ends the column (the one rendering `FOOTER_CTA_LABEL`), before `</motion.div>`:

```tsx
        <FunnelCta onClick={scrollToQuestion} className="self-center">
          {FOOTER_CTA_LABEL}
          <ArrowUp className="size-4" />
        </FunnelCta>
        <FunnelFooter ctx={ctx} />
      </motion.div>
```

- [ ] **Step 2: Mount on the confirmation view**

In `src/shared/domains/funnels/ui/funnel-engine.tsx`:

(a) Add the import near the other `ui/` imports:

```ts
import { FunnelFooter } from '@/shared/domains/funnels/ui/footer/funnel-footer'
```

(b) In the `view === 'confirmation'` branch, append the footer after the content `div`:

```tsx
    body = (
      <>
        <FunnelStickyHeader opacity={stickyOpacity} widthClass={contentWidth} />
        <div className={`mx-auto w-full ${contentWidth} px-5 pb-16 pt-20`}>
          {stepEl}
        </div>
        <FunnelFooter ctx={ctx} />
      </>
    )
```

- [ ] **Step 3: Mount on the PII step (with ~50%-visible behavior)**

In the `else` (steps) branch of `funnel-engine.tsx`, derive an `isPii` flag and use it to (a) drop the full-viewport fill so the cluster takes natural height, (b) drop the `flex-1` spacer, and (c) append the footer below the cluster. Replace the entire `else { body = ( … ) }` block with:

```tsx
  else {
    // PII is the submit step: it keeps the fixed question stage like any other
    // step, but the page must scroll to reveal a legal block that peeks ~50% into
    // the fold. So on PII we drop `min-h-dvh` + the spacer (let the cluster take
    // natural height) and render the footer below it; the document then scrolls.
    // Interior steps keep the exact single-viewport behavior (no footer).
    const isPii = engine.step.kind === 'pii-form'
    body = (
      <>
        <FunnelStickyHeader opacity={stickyOpacity} widthClass={contentWidth} />
        <div className={`mx-auto flex w-full flex-col px-5 pb-10 pt-16 ${contentWidth} ${isPii ? '' : 'min-h-dvh'}`}>
          {/* ① Progress — pinned at the top, exactly where it was. */}
          <FunnelProgress total={spec.steps.length} currentIndex={currentIndex} />

          {/* ② Question stage — FIXED-height frame; content scrolls INTERNALLY. */}
          <div className="mt-6 h-[clamp(21rem,56dvh,36rem)] overflow-x-clip overflow-y-auto">
            <div className="overflow-clip">
              <AnimatePresence mode="wait">
                <motion.div
                  key={engine.step.id}
                  initial={reduceMotion ? false : STEP_VARIANTS.initial}
                  animate={STEP_VARIANTS.animate}
                  exit={reduceMotion ? undefined : STEP_VARIANTS.exit}
                  transition={FUNNEL_TRANSITION}
                  className="w-full py-2"
                >
                  {stepEl}
                </motion.div>
              </AnimatePresence>
            </div>
          </div>

          {/* ③ Nav — directly under the stage at a constant Y. */}
          {engine.hasNext
            ? (
                <div className="mt-6 flex items-center justify-between gap-3">
                  <Button variant="ghost" onClick={engine.back}>← Back</Button>
                  {engine.value != null
                    ? <Button onClick={engine.advance}>Next →</Button>
                    : <span />}
                </div>
              )
            : null}

          {/* Spacer — only when filling the viewport (non-PII). On PII the footer
              below carries the page instead, so the cluster stays its natural
              height and the legal block peeks into the fold. */}
          {isPii ? null : <div className="flex-1" aria-hidden="true" />}
        </div>
        {isPii ? <FunnelFooter ctx={ctx} /> : null}
      </>
    )
  }
```

- [ ] **Step 4: Type-check + lint**

Run: `pnpm tsc && pnpm lint`
Expected: PASS.

- [ ] **Step 5: Manual check — both funnels + 50%-visibility tuning**

Run `pnpm dev`. On **both** `kitchens.localhost:3000` and `bathrooms.localhost:3000`:
- Landing: footer renders at the very bottom; trade name in the blurb matches the funnel; footer is otherwise identical between the two.
- Interior question steps (card-select / zip / address): unchanged — single viewport, no footer, no page scroll.
- PII step: the footer's **legal block is partially visible (~50% target) at the fold**, and the page scrolls to reveal the rest. If the legal block sits fully below the fold on a typical mobile viewport (e.g. iPhone in DevTools responsive mode), reduce the PII cluster's top padding for the `isPii` branch (`pt-16` → `pt-8`) and/or lower the stage clamp for PII until the legal block peeks ~half a viewport. Re-run `pnpm lint` after any class change.
- Confirmation: footer renders at the bottom; page scrolls normally.
- Click Privacy/Terms in the footer and the PII inline line → both open the apex pages (not a funnel-host 404).

- [ ] **Step 6: Commit**

```bash
git add src/shared/domains/funnels/ui/funnel-landing.tsx src/shared/domains/funnels/ui/funnel-engine.tsx
git commit -m "feat(funnels): mount shared footer on landing, PII step, and confirmation

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Self-Review

**Spec coverage:**
- Shared, data-driven footer set up once, rendered across funnels → Tasks 4 + 5. ✓
- Branding (logo + company info from constants) → Task 4 (`funnel-footer.tsx`, dark-ink logo, `companyInfo`). ✓
- Trust markers (license #, insured, ratings, awards, years) → Task 4 (`funnel-footer-trust.tsx`). ✓
- Legal links Privacy/Terms → Tasks 3 (inline) + 4 (footer), via `mainSiteUrl`. ✓
- Dynamic per funnel (trade name via ctx/trade-facts) → Task 4 (`funnelFooterBlurb(getTradeFacts(ctx.slug).name)`). ✓
- Mount points resolved (landing / PII step / confirmation; not interior steps) → Task 5. ✓
- 50%-visible-but-scrollable for consent + footer legal block → Task 5 Step 3 + tuning in Step 5. ✓
- Remove consent checkbox + disclaimer replacement → Task 3. ✓
- `pii.schema.ts`, `pii-step.ts`, `types.ts` consent copy updates → Task 3. ✓
- `build-lead-input` records implied consent (`true` + timestamp); verify CRM/lead record → Task 2 (schema passthrough confirmed via `submitLead` → `ingestLead`). ✓
- Cross-funnel identical render (kitchens + bathrooms) → Task 5 Step 5 manual. ✓
- Legal-compliance check on wording → Task 1 Step 1. ✓

**Placeholder scan:** No TBD/TODO; every code step shows complete code. Verification uses the repo's real gate (`pnpm tsc` + `pnpm lint` + manual) since there is no unit-test runner. ✓

**Type consistency:** `FunnelFooter({ ctx })` consumes `FunnelContext` (engine + landing both have `ctx`). `funnelFooterBlurb(trade: string)`, `FUNNEL_SUBMIT_DISCLAIMER`, `FUNNEL_FOOTER_DISCLOSURE` named identically across Tasks 1/3/4. `source.consent = { agreed: true, at: string }` matches the schema `z.object({ agreed: z.literal(true), at: z.string() })`. `PiiFormData`/`PiiContent` lose `consent` consistently across schema, types, content, and component. ✓
