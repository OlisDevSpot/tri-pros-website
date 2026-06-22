# URL / Origin Routing System Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make every app path flow through a complete, composable `ROOTS` map, and every absolute URL through exactly two intent-named resolvers (`mainSiteUrl` client, `publicUrl` server), so funnel-subdomain links resolve to the main site correctly in every environment and nothing breaks on a future rename.

**Architecture:** Three layers. (1) Path layer — `roots.ts` builders, parent-derived so a segment rename cascades; no call site concatenates or hardcodes a path. (2) Origin layer — `mainSiteUrl(path?)` derives the apex origin from the live `window.location` by stripping a registered subdomain label; `publicUrl(path?)` returns the env/tunnel-aware externally-reachable origin. (3) Outbound — `ROOTS.subdomainUrl(label)` builds a subdomain URL generically. A lint guard + convention doc prevent regression.

**Tech Stack:** Next.js 15 (App Router), TypeScript, ESLint (flat config: antfu + perfectionist), `motion/react`. **No test runner exists in this repo** — the test cycle for every task is `pnpm tsc` (clean) + `pnpm lint` (clean) + targeted `grep` assertions, plus Playwright for the runtime browser scenarios in Phase 2.

## Global Constraints

- Work **only on `main`** — no feature branch. Stage explicitly so unrelated WIP isn't swept in.
- Verify with `pnpm tsc` and `pnpm lint`. **NEVER run `pnpm build`.**
- `src/shared/config/roots.ts` MUST stay type-only-importable (no value/env imports) — it is loaded by `next.config.ts` in a CJS transpile. Origin env-awareness lives in `public-url.ts` (server) and `main-site-url.ts` (client `window` + `NEXT_PUBLIC_BASE_URL`).
- One React component per file; helpers in `lib/`; constants in `constants/`; **named exports only**.
- Respect `perfectionist/sort-imports` (alphabetical, external before internal) and `antfu/if-newline` (braces + newline for `if`).
- `process.env.X` accesses need `// eslint-disable-next-line node/prefer-global/process` (existing repo pattern — see `src/trpc/helpers.tsx`).
- Each phase must leave `main` in a correct-or-no-worse state (it may be deployed between phases).

---

## Phase 1 — Path layer: complete + composable `ROOTS`, migrate all violators

### Task 1: Add composable builders to `roots.ts`

**Files:**
- Modify: `src/shared/config/roots.ts`

**Interfaces:**
- Produces: `ROOTS.landing.portfolioProject(accessor: string, options?: UrlOptions): string` → `/portfolio/projects/<accessor>`; `ROOTS.public.proposalReview(id: string, opts?: UrlOptions & { token?: string }): string` → `/proposal-flow/proposal/<id>[?token=…]`. Existing builders unchanged in signature; recomposed to derive from parents.

- [ ] **Step 1: Recompose the `landing` portfolio + services builders to derive from parents.** Replace the current flat literals with parent-derived versions (keep the `options` threading):

```ts
landing: {
  about: (options?: UrlOptions) => generateUrl('/about', options),
  blog: (options?: UrlOptions) => generateUrl('/blog', options),
  communityCommitment: (options?: UrlOptions) => generateUrl('/community/commitment', options),
  communityJoin: (options?: UrlOptions) => generateUrl('/community/join', options),
  contact: (options?: UrlOptions) => generateUrl('/contact', options),
  experience: (options?: UrlOptions) => generateUrl('/experience', options),
  portfolio: (options?: UrlOptions) => generateUrl('/portfolio', options),
  portfolioProjects: (options?: UrlOptions) => generateUrl(`${APP_ROOTS.landing.portfolio()}/projects`, options),
  portfolioProject: (accessor: string, options?: UrlOptions) => generateUrl(`${APP_ROOTS.landing.portfolioProjects()}/${accessor}`, options),
  portfolioTestimonials: (options?: UrlOptions) => generateUrl(`${APP_ROOTS.landing.portfolio()}/testimonials`, options),
  services: (options?: UrlOptions) => generateUrl('/services', options),
  servicesPillar: (pillarSlug: ServiceSlug, options?: UrlOptions) => generateUrl(`${APP_ROOTS.landing.services()}/${pillarSlug}`, options),
  servicesTrade: (pillarSlug: ServiceSlug, tradeSlug: string, options?: UrlOptions) => generateUrl(`${APP_ROOTS.landing.servicesPillar(pillarSlug)}/${tradeSlug}`, options),
},
```

> Note: child builders call their parent **without options** (to get a relative segment) and wrap the full path with their own `options`. Lazy self-reference to `APP_ROOTS` is safe — builders run after the module const is assigned.

- [ ] **Step 2: Add `proposalReview` under `public`.** Replace the `public` block:

```ts
public: {
  intake: (options?: UrlOptions) => generateUrl('/intake', options),
  proposals: (options?: UrlOptions) => generateUrl('/proposal-flow', options),
  proposalReview: (id: string, { token, ...options }: UrlOptions & { token?: string } = {}) =>
    generateUrl(`${APP_ROOTS.public.proposals()}/proposal/${id}${token ? `?token=${token}` : ''}`, options),
},
```

- [ ] **Step 3: Recompose `dashboard` parameterized builders to derive from their `root`.** For the nested groups, derive the byId/new builders from the group root (leaving `root` as-is). Example for `proposals` (apply the same to `meetings`, `projects`):

```ts
proposals: {
  root: (options?: UrlOptions) => generateUrl('/dashboard/proposals', options),
  new: (options?: UrlOptions) => generateUrl(`${APP_ROOTS.dashboard.proposals.root()}/new`, options),
  byId: (id: string, options?: UrlOptions) => generateUrl(`${APP_ROOTS.dashboard.proposals.root()}/${id}`, options),
},
```

- [ ] **Step 4: Verify type-check passes.**

Run: `pnpm tsc`
Expected: clean (no errors). The new builders compile; existing call sites unaffected (signatures unchanged except additive `portfolioProject`/`proposalReview`).

- [ ] **Step 5: Verify lint passes.**

Run: `pnpm lint`
Expected: clean.

- [ ] **Step 6: Commit.**

```bash
git add src/shared/config/roots.ts
git commit -m "refactor(roots): add portfolioProject + proposalReview, compose builders from parents"
```

---

### Task 2: Migrate project-detail concatenations → `portfolioProject`

**Files (Modify):**
- `src/features/project-management/ui/components/project-detail-sheet.tsx:129`
- `src/features/landing/ui/components/portfolio/project-card.tsx:24`
- `src/features/project-management/ui/views/edit-project-view.tsx:153`
- `src/features/project-management/ui/components/portfolio-project-card.tsx:44`
- `src/shared/entities/projects/hooks/use-project-action-configs.ts:29`
- `src/shared/domains/funnels/ui/blocks/funnel-project-carousel.tsx:62`

**Interfaces:**
- Consumes: `ROOTS.landing.portfolioProject(accessor)` from Task 1.

- [ ] **Step 1: Apply the swap at each site.** The transform is uniform — replace the template-literal concatenation with the builder call (drop the surrounding backticks):

```
// before → after
`${ROOTS.landing.portfolioProjects()}/${project.accessor}`        → ROOTS.landing.portfolioProject(project.accessor)
`${ROOTS.landing.portfolioProjects()}/${project.data.project.accessor}` → ROOTS.landing.portfolioProject(project.data.project.accessor)
`${ROOTS.landing.portfolioProjects()}/${slug}`                    → ROOTS.landing.portfolioProject(slug)
`${ROOTS.landing.portfolioProjects()}/${p.project.accessor}`      → ROOTS.landing.portfolioProject(p.project.accessor)
```
In JSX `href={...}` keep the braces: `href={ROOTS.landing.portfolioProject(project.accessor)}`. In `window.open(...)` drop the backticks: `window.open(ROOTS.landing.portfolioProject(slug), '_blank')`. For `funnel-project-carousel.tsx:62` the value stays **relative** here (`href: ROOTS.landing.portfolioProject(p.project.accessor)`) — Phase 2 Task 6 adds the origin wrapper. Ensure each file imports `ROOTS` from `@/shared/config/roots` (most already do; add + sort if missing).

- [ ] **Step 2: Assert no project-detail concatenations remain.**

Run: `grep -rnE '\$\{ROOTS\.landing\.portfolioProjects\(\)\}/' src/`
Expected: no output.

- [ ] **Step 3: Verify type-check + lint.**

Run: `pnpm tsc && pnpm lint`
Expected: clean.

- [ ] **Step 4: Commit.**

```bash
git add -A
git commit -m "refactor(routes): use ROOTS.landing.portfolioProject at all 6 call sites"
```

---

### Task 3: Migrate proposal-review concatenations → `proposalReview`

**Files (Modify):**
- `src/features/proposal-flow/ui/components/table/index.tsx:57`
- `src/features/proposal-flow/ui/views/edit-proposal-view.tsx:102,115`
- `src/shared/entities/proposals/components/overview-card.tsx:88`
- `src/shared/entities/proposals/hooks/use-proposal-action-configs.ts:42`
- `src/shared/entities/customers/components/lists/proposal-row.tsx:20`
- `src/shared/entities/customers/components/lists/meeting-proposal-row.tsx:20`

**Interfaces:**
- Consumes: `ROOTS.public.proposalReview(id)` from Task 1.

- [ ] **Step 1: Apply the swap.** Uniform transform:

```
`${ROOTS.public.proposals()}/proposal/${entity.id}`   → ROOTS.public.proposalReview(entity.id)
`${ROOTS.public.proposals()}/proposal/${proposalId}`  → ROOTS.public.proposalReview(proposalId)
`${ROOTS.public.proposals()}/proposal/${proposal.id}` → ROOTS.public.proposalReview(proposal.id)
```
e.g. `window.open(ROOTS.public.proposalReview(proposal.id), '_blank')`; `router.push(ROOTS.public.proposalReview(proposalId))`; `const viewHref = ROOTS.public.proposalReview(proposalId)`. Add/sort the `ROOTS` import where missing. **Do not touch** the `{ absolute: true }` share link in `use-proposal-action-configs.ts` (around line 21) — that's Phase 3 Task 8.

- [ ] **Step 2: Assert no proposal-review concatenations remain.**

Run: `grep -rnE '\$\{ROOTS\.public\.proposals\([^)]*\)\}/proposal/' src/`
Expected: no output.

- [ ] **Step 3: Verify type-check + lint.**

Run: `pnpm tsc && pnpm lint`
Expected: clean.

- [ ] **Step 4: Commit.**

```bash
git add -A
git commit -m "refactor(routes): use ROOTS.public.proposalReview at all 7 call sites"
```

---

### Task 4: Migrate raw path literals → existing builders

**Files (Modify):**
- `src/features/lead-sources-admin/ui/components/lead-source-detail-header.tsx:48`
- `src/features/lead-sources-admin/ui/components/danger-zone.tsx:52,60`
- `src/app/(frontend)/dashboard/pipeline/page.tsx:5`
- `src/app/(frontend)/dashboard/pipelines/page.tsx:5`
- `src/app/(frontend)/dashboard/campaigns/page.tsx:13`
- `src/app/(frontend)/dashboard/lead-sources/page.tsx:13`

**Interfaces:**
- Consumes: `ROOTS.dashboard.leadSources()`, `ROOTS.dashboard.pipeline()`, `ROOTS.dashboard.root` (value, no parens).

- [ ] **Step 1: Apply the swap.**

```
router.push('/dashboard/lead-sources')   → router.push(ROOTS.dashboard.leadSources())
redirect('/dashboard/pipeline/fresh')    → redirect(ROOTS.dashboard.pipeline())
redirect('/dashboard')                   → redirect(ROOTS.dashboard.root)   // root is a string value — NO parens
```
Add `import { ROOTS } from '@/shared/config/roots'` (sorted) to each file that lacks it.

- [ ] **Step 2: Assert no targeted raw literals remain.**

Run: `grep -rnE "(push|redirect)\(\s*['\"]/(dashboard)" src/ | grep -v roots.ts`
Expected: no output.

- [ ] **Step 3: Verify type-check + lint.**

Run: `pnpm tsc && pnpm lint`
Expected: clean.

- [ ] **Step 4: Commit.**

```bash
git add -A
git commit -m "refactor(routes): replace hardcoded dashboard paths with ROOTS builders"
```

---

## Phase 2 — Client origin resolver + fix the funnel bug

### Task 5: Add `SUBDOMAIN_LABELS` and the `mainSiteUrl` resolver

**Files:**
- Modify: `src/shared/config/subdomains.ts`
- Create: `src/shared/lib/main-site-url.ts`

**Interfaces:**
- Produces: `SUBDOMAIN_LABELS: string[]` (e.g. `['kitchens','bathrooms','complete-interior']`); `mainSiteUrl(path?: string): string`.

- [ ] **Step 1: Export `SUBDOMAIN_LABELS` from `subdomains.ts`.** Append after the existing `SUBDOMAIN_ROUTES` declaration:

```ts
/**
 * The subdomain labels that, if leading the host, mean we're on a subdomain
 * (the inverse of what the middleware rewrites). Consumed by `mainSiteUrl` to
 * strip back to the apex. Same source of truth as the middleware.
 */
export const SUBDOMAIN_LABELS = Object.keys(SUBDOMAIN_ROUTES)
```

- [ ] **Step 2: Create the client resolver.** Write `src/shared/lib/main-site-url.ts`:

```ts
import { SUBDOMAIN_LABELS } from '@/shared/config/subdomains'

/**
 * Absolute URL on the MAIN SITE (the apex app), built from wherever the user
 * currently is. On a subdomain (e.g. kitchens.localhost:3000) it strips the
 * registered subdomain label to return to the apex; on the apex it's a no-op.
 * Reads the live origin, so it is automatically correct across dev, any
 * worktree port, the https tunnel, and prod. Client-only; SSR falls back to
 * NEXT_PUBLIC_BASE_URL. For a link that must be reachable from a server
 * context, use publicUrl() instead. see ../config/subdomains.ts
 */
export function mainSiteUrl(path?: string): string {
  const origin = resolveMainSiteOrigin()
  return path ? `${origin}${path}` : origin
}

function resolveMainSiteOrigin(): string {
  if (typeof window === 'undefined') {
    // eslint-disable-next-line node/prefer-global/process
    return process.env.NEXT_PUBLIC_BASE_URL ?? ''
  }
  const { protocol, host } = window.location
  const [label, ...rest] = host.split('.')
  const apexHost = rest.length > 0 && SUBDOMAIN_LABELS.includes(label) ? rest.join('.') : host
  return `${protocol}//${apexHost}`
}
```

- [ ] **Step 3: Verify type-check + lint.**

Run: `pnpm tsc && pnpm lint`
Expected: clean.

- [ ] **Step 4: Commit.**

```bash
git add src/shared/config/subdomains.ts src/shared/lib/main-site-url.ts
git commit -m "feat(routing): add SUBDOMAIN_LABELS + client mainSiteUrl resolver"
```

---

### Task 6: Wire the funnel links + fix the middleware comment

**Files:**
- Modify: `src/shared/domains/funnels/ui/blocks/funnel-project-carousel.tsx:62`
- Modify: `src/shared/domains/funnels/ui/steps/confirmation-step.tsx:109`
- Modify: `src/middleware.ts:16-17`

**Interfaces:**
- Consumes: `mainSiteUrl` (Task 5), `ROOTS.landing.portfolioProject` / `ROOTS.landing.portfolio` (Task 1).

- [ ] **Step 1: Wrap the carousel href with `mainSiteUrl`.** In `funnel-project-carousel.tsx`, add `import { mainSiteUrl } from '@/shared/lib/main-site-url'` (sorted), and change the slide mapping:

```ts
.map(p => ({ title: p.project.title, src: getOptimizedSrc(p.heroImage), href: mainSiteUrl(ROOTS.landing.portfolioProject(p.project.accessor)) }))
```

- [ ] **Step 2: Replace the "See our work" link.** In `confirmation-step.tsx`, add the `mainSiteUrl` import (sorted) and replace the env-based href (and remove the now-unneeded eslint-disable comment on the line above it):

```tsx
<a href={mainSiteUrl(ROOTS.landing.portfolio())} target="_blank" rel="noopener noreferrer">See our work</a>
```
(Add `import { ROOTS } from '@/shared/config/roots'` if not present.)

- [ ] **Step 3: Reword the middleware comment to be subdomain-generic + fix the typo.** In `src/middleware.ts`, replace the example comment block:

```ts
  // Registered subdomain → rewrite, preserving any sub-path. URL bar unchanged.
  // A funnel is one kind of subdomain; voip will be another.
  //   kitchens.triprosremodeling.com/        → /funnels/kitchens
  //   kitchens.triprosremodeling.com/thanks  → /funnels/kitchens/thanks
```

- [ ] **Step 4: Verify type-check + lint, and assert no funnel concats/env-origin remain.**

Run: `pnpm tsc && pnpm lint`
Expected: clean.
Run: `grep -nE "NEXT_PUBLIC_BASE_URL|portfolioProjects\(\)\}/" src/shared/domains/funnels/ui/steps/confirmation-step.tsx src/shared/domains/funnels/ui/blocks/funnel-project-carousel.tsx`
Expected: no output.

- [ ] **Step 5: Runtime verify the scenarios with Playwright.** Start the dev server (`pnpm dev`), then in the browser tool:
  - Navigate to `http://kitchens.localhost:3000`, complete to the confirmation step, and confirm a carousel project link's `href` is `http://localhost:3000/portfolio/projects/<accessor>` (scenario C2) and the "See our work" href is `http://localhost:3000/portfolio`.
  - Navigate to `http://localhost:3000` (apex) and confirm a portfolio link is `http://localhost:3000/portfolio/...` (scenario C1 — no double prefix).
Expected: links point at the apex origin, not the `kitchens.` subdomain; clicking reaches a real project page (no 404).

- [ ] **Step 6: Commit.**

```bash
git add -A
git commit -m "fix(funnel): link carousel + 'See our work' to main site via mainSiteUrl"
```

---

## Phase 3 — Server origin unification

### Task 7: Rename `getPublicBaseUrl` → `publicUrl(path?)` and migrate its callers

**Files:**
- Modify: `src/shared/config/public-url.ts`
- Modify callers: `src/shared/services/providers/web-push/lib/build-payload.ts`, `src/shared/services/scheduling.service.ts`, `src/shared/services/providers/upstash/lib/create-job.ts`, `src/shared/services/voip/voip-link-tokens.service.ts`

**Interfaces:**
- Produces: `publicUrl(path?: string): string` (server-only). Removes `getPublicBaseUrl`.

- [ ] **Step 1: Rewrite `public-url.ts`.** Keep the docblock intent; collapse origin+url into one function:

```ts
import env from '@/shared/config/server-env'

import 'server-only'

/**
 * An absolute URL reachable from the public internet — the origin this running
 * instance advertises to external services (push, webhooks, qstash, GCal) and
 * in transactional email links. Tunnel-aware: NGROK_URL wins in dev so external
 * callbacks hit the tunnel instead of localhost. No path → the origin alone.
 * Server-only; clients use mainSiteUrl(). see ../lib/main-site-url.ts
 */
export function publicUrl(path?: string): string {
  const origin = env.NGROK_URL ?? env.NEXT_PUBLIC_BASE_URL
  return path ? `${origin}${path}` : origin
}
```

- [ ] **Step 2: Migrate the 4 callers.** Replace `getPublicBaseUrl()` → `publicUrl()` and update the import name. `new URL(navigate, getPublicBaseUrl())` → `new URL(navigate, publicUrl())`.

- [ ] **Step 3: Assert no `getPublicBaseUrl` references remain.**

Run: `grep -rn "getPublicBaseUrl" src/`
Expected: no output.

- [ ] **Step 4: Verify type-check + lint.**

Run: `pnpm tsc && pnpm lint`
Expected: clean.

- [ ] **Step 5: Commit.**

```bash
git add -A
git commit -m "refactor(routing): collapse getPublicBaseUrl into publicUrl(path?)"
```

---

### Task 8: Migrate `{ absolute: true }` call sites to `publicUrl` / `mainSiteUrl`

**Files (Modify):**
- Server (→ `publicUrl(...)`): `src/shared/services/providers/resend/emails/{proposal-email,proposal-viewed-email,customer-confirmation-email,general-inquiry-email,project-inquiry-email}.tsx`, `src/shared/services/email.service.ts:61`, `src/shared/services/providers/google-calendar/lib/map-to-gcal.ts:86`
- Client (→ `mainSiteUrl(...)`): `src/shared/entities/proposals/hooks/use-proposal-action-configs.ts:21`

**Interfaces:**
- Consumes: `publicUrl` (Task 7), `mainSiteUrl` (Task 5), `ROOTS.public.proposalReview`, `ROOTS.dashboard.scheduleWithMeetingHighlight` (Task 1).

- [ ] **Step 1: Migrate the email base-URL pattern (server).** In each `resend/emails/*.tsx`, replace:

```ts
// before
const base = ROOTS.generateUrl('', { absolute: true })
// after
const base = publicUrl()
```
Add `import { publicUrl } from '@/shared/config/public-url'` (sorted); drop the `ROOTS` import if it becomes unused.

- [ ] **Step 2: Migrate `email.service.ts:61` (server).** Replace the absolute proposal link:

```ts
// before
`${ROOTS.public.proposals({ absolute: true })}/proposal/${proposalId}?token=${token}`
// after
publicUrl(ROOTS.public.proposalReview(proposalId, { token }))
```

- [ ] **Step 3: Migrate `map-to-gcal.ts:86` (server).**

```ts
// before
ROOTS.dashboard.scheduleWithMeetingHighlight(meeting.id, scheduledFor, { absolute: true })
// after
publicUrl(ROOTS.dashboard.scheduleWithMeetingHighlight(meeting.id, scheduledFor))
```

- [ ] **Step 4: Migrate the client share link `use-proposal-action-configs.ts:21`.** This runs in the browser (copy-to-clipboard), so it uses `mainSiteUrl`:

```ts
// before
`${ROOTS.public.proposals({ absolute: true })}/proposal/${proposalId}`
// after
mainSiteUrl(ROOTS.public.proposalReview(proposalId))
```
Add `import { mainSiteUrl } from '@/shared/lib/main-site-url'` (sorted).

- [ ] **Step 5: Assert no `{ absolute: true }` usages remain.**

Run: `grep -rn "absolute: true" src/`
Expected: no output.

- [ ] **Step 6: Verify type-check + lint.**

Run: `pnpm tsc && pnpm lint`
Expected: clean.

- [ ] **Step 7: Commit.**

```bash
git add -A
git commit -m "refactor(routing): route absolute URLs through publicUrl/mainSiteUrl"
```

---

## Phase 4 — Generic outbound subdomain URL

### Task 9: Replace `ROOTS.funnels.subdomain` with generic `ROOTS.subdomainUrl`

**Files:**
- Modify: `src/shared/config/roots.ts`
- Modify: the Meta caller (find with grep in Step 2)

**Interfaces:**
- Produces: `ROOTS.subdomainUrl(label: string, opts?: { rootDomain?: string, protocol?: string }): string`.

- [ ] **Step 1: Add the generic builder and remove the funnel-specific one.** In `roots.ts`, add to the top level of `APP_ROOTS` (sibling of `landing`/`dashboard`):

```ts
subdomainUrl: (label: string, { rootDomain = APP_HOSTS.prod[0], protocol = 'https' }: { rootDomain?: string, protocol?: string } = {}) =>
  `${protocol}://${label}.${rootDomain}`,
```
Then in the `funnels` block, delete the `subdomain:` line (keep `trade:`).

- [ ] **Step 2: Find and migrate the caller(s).**

Run: `grep -rn "funnels.subdomain\b" src/`
For each hit, replace `ROOTS.funnels.subdomain(slug)` → `ROOTS.subdomainUrl(slug)`.

- [ ] **Step 3: Assert the old builder is gone and unreferenced.**

Run: `grep -rn "funnels\.subdomain\b" src/`
Expected: no output.

- [ ] **Step 4: Verify type-check + lint.**

Run: `pnpm tsc && pnpm lint`
Expected: clean.

- [ ] **Step 5: Commit.**

```bash
git add -A
git commit -m "refactor(routing): generic ROOTS.subdomainUrl replaces funnels.subdomain"
```

---

## Phase 5 — Purify `roots.ts`

### Task 10: Remove `{ absolute }` / `UrlOptions` / `PROD_BASE_URL`

**Files:**
- Modify: `src/shared/config/roots.ts`

**Interfaces:**
- Produces: every `ROOTS.*` builder returns a pure relative path; no `options` param.

- [ ] **Step 1: Simplify `generateUrl` and delete the absolute machinery.** Remove `UrlOptions`, the `absolute` branch, and `PROD_BASE_URL`. `generateUrl` reduces to identity, so inline it — change every builder to return its template literal directly and drop the `options` params. Examples:

```ts
portfolio: () => '/portfolio',
portfolioProjects: () => `${APP_ROOTS.landing.portfolio()}/projects`,
portfolioProject: (accessor: string) => `${APP_ROOTS.landing.portfolioProjects()}/${accessor}`,
proposalReview: (id: string, token?: string) => `${APP_ROOTS.public.proposals()}/proposal/${id}${token ? `?token=${token}` : ''}`,
scheduleWithMeetingHighlight: (meetingId: string, scheduledFor?: string | null) => {
  const search = new URLSearchParams({ highlightMeeting: meetingId })
  if (scheduledFor) {
    search.set('highlightDate', scheduledFor)
  }
  return `/dashboard/schedule?${search.toString()}`
},
```
> `proposalReview` loses the options object — its only extra was `token`, now a plain optional arg. Update the two `proposalReview` call sites that pass `{ token }` (email.service.ts, and any other) to pass `token` positionally: `ROOTS.public.proposalReview(id, token)`.

- [ ] **Step 2: Let the compiler enumerate any stragglers.**

Run: `pnpm tsc`
Expected: errors ONLY where a caller still passes an options/absolute arg (there should be none after Phases 1–4). Fix each by removing the arg. Re-run until clean.

- [ ] **Step 3: Assert the machinery is gone.**

Run: `grep -rnE "UrlOptions|PROD_BASE_URL|generateUrl" src/`
Expected: no output (or only the now-removed definitions — there should be none).

- [ ] **Step 4: Verify lint.**

Run: `pnpm lint`
Expected: clean.

- [ ] **Step 5: Commit.**

```bash
git add -A
git commit -m "refactor(roots): pure relative path map — drop absolute/UrlOptions/PROD_BASE_URL"
```

---

## Phase 6 — Enforcement

### Task 11: ESLint guard against raw app-path literals

**Files:**
- Modify: the flat ESLint config (`eslint.config.{js,mjs,ts}` — locate with grep)

**Interfaces:** none (lint-only).

- [ ] **Step 1: Locate the config.**

Run: `ls eslint.config.* 2>/dev/null; grep -rln "antfu" eslint.config.* 2>/dev/null`

- [ ] **Step 2: Add a `no-restricted-syntax` rule** to the main rules block:

```js
'no-restricted-syntax': ['error', {
  selector: "Literal[value=/^\\/(dashboard|portfolio|services|proposal-flow|funnels|intake|about|contact|blog|community|experience)(\\/|$)/]",
  message: 'Build app paths with ROOTS.* (see docs/codebase-conventions/urls-and-origins.md), not string literals.',
}],
```

- [ ] **Step 3: Add a scoped override turning the rule OFF for the canonical definition file** (and `sitemap.ts` if it legitimately needs literals):

```js
{ files: ['src/shared/config/roots.ts', 'src/app/sitemap.ts'], rules: { 'no-restricted-syntax': 'off' } },
```

- [ ] **Step 4: Run lint and resolve fallout.**

Run: `pnpm lint`
Expected: clean. If the rule flags a legitimate non-route literal (false positive), add a narrow `// eslint-disable-next-line no-restricted-syntax` with a reason, or tighten the selector. Document any disable.

- [ ] **Step 5: Commit.**

```bash
git add -A
git commit -m "chore(lint): forbid raw app-path literals outside roots.ts"
```

---

### Task 12: Convention doc + in-code references

**Files:**
- Create: `docs/codebase-conventions/urls-and-origins.md`
- Modify: `docs/codebase-conventions/README.md` (register the new doc per its decision tree)
- Modify: add `// see` refs at `src/shared/config/roots.ts`, `src/shared/lib/main-site-url.ts`, `src/shared/config/public-url.ts`, `src/shared/config/subdomains.ts`

- [ ] **Step 1: Write the convention doc.** Content:

```markdown
# URLs & origins

**Rule:** paths come from `ROOTS.*`; absolute URLs come from `mainSiteUrl` (client) or `publicUrl` (server); subdomain URLs come from `ROOTS.subdomainUrl`. Never hardcode an origin or a path segment.

## Paths — `src/shared/config/roots.ts`
Every addressable route has one builder. Builders derive from their parent, so renaming a segment is a single edit that cascades. Never concatenate onto a builder (`` `${ROOTS.x()}/y` `` is a bug — add a builder) and never write a path literal in `href`/`push`/`redirect`/`window.open` (the ESLint `no-restricted-syntax` guard enforces this).

## Absolute URLs
- **Client** (a link the user clicks): `mainSiteUrl(ROOTS.x())` — derives the apex origin from the live `window.location`, stripping a registered subdomain label. Correct in dev, any worktree port, the https tunnel, and prod.
- **Server** (a link an email/webhook/push/calendar must reach): `publicUrl(ROOTS.x())` — env/tunnel-aware, server-only.
- Decision: if a reachable link is built during SSR, it's a server concern → `publicUrl`.

## Subdomains
Registry: `SUBDOMAIN_ROUTES` (label → rewrite path) in `subdomains.ts`; `SUBDOMAIN_LABELS` is its key set. Middleware adds a label (rewrite); `mainSiteUrl` removes one (strip to apex). Outbound subdomain URLs: `ROOTS.subdomainUrl(label)`. Funnels and voip are both just labels.
```

- [ ] **Step 2: Register in the conventions README** following its "where does a new rule go?" section (add a one-line index entry).

- [ ] **Step 3: Add `// see` refs.** At the top of each of the four files, add a one-line pointer, e.g. `// see ../../../docs/codebase-conventions/urls-and-origins.md` (adjust relative depth per file).

- [ ] **Step 4: Verify lint.**

Run: `pnpm lint`
Expected: clean.

- [ ] **Step 5: Commit.**

```bash
git add -A
git commit -m "docs(conventions): urls-and-origins rule + in-code refs"
```

---

## Self-review notes (author)

- **Spec coverage:** Path layer (Tasks 1–4), client origin + bug (5–6), server unification (7–8), generic subdomain (9), purify (10), enforcement (11–12) — every spec section maps to a task.
- **Sequencing safety:** `{ absolute }` keeps working until Task 10; absolute callers migrate in Task 8 first. The carousel is relative after Task 2 (no worse than today's bug) and fixed in Task 6. Each phase leaves `main` correct-or-no-worse.
- **Type consistency:** `portfolioProject(accessor)`, `proposalReview(id, …)`, `mainSiteUrl(path?)`, `publicUrl(path?)`, `ROOTS.subdomainUrl(label, opts?)`, `ROOTS.dashboard.root` (value) used consistently across tasks.
- **No test runner:** verification is `pnpm tsc` + `pnpm lint` + `grep` assertions + Playwright (Task 6) — matches repo reality.
