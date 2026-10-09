# PWA Launch: Logo Splash + Service-Worker Shell — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** The installed app opens on the TPR mark from the first frame on iPhone, iPad and Android, with no white frame and no second logo, and from the second launch on the web layer paints from Cache Storage before the server answers.

**Architecture:** Three layers, shipped and device-checked in order, all of it under one platform domain, `src/shared/domains/pwa/`. (1) Native assets: an exact-dimension iOS startup-image matrix and navy Android icons, all on one field colour. (2) A root-layout cover that is SSR-open only on a static `/launch` shell document and fades the moment the dashboard layout has committed from the server's response (skeletons on screen, before the session resolves), plus the shell page that soft-navigates to `/dashboard`. (3) The existing push worker gains one fetch rule: the launch-marked `start_url` navigation is answered with the precached shell and its chunks; everything else stays on the network.

**Tech Stack:** Next.js 15.5.9 (App Router, webpack), React 19, `motion/react`, next-themes, `sharp` (asset generation via `tsx`), a hand-written `public/sw.js`, Playwright MCP for browser checks. No new dependencies.

**Spec:** `docs/superpowers/specs/2026-10-08-pwa-launch-splash-shell-design.md` (research: `docs/plans/2026-10-08-pwa-launch-research.md`, facts F1–F20).

## Global Constraints

- **PWA code lives in `src/shared/domains/pwa/`** (`constants/`, `lib/`, `hooks/`, `ui/`), spec §4 / D7. Nothing new goes to naked `src/shared/{lib,hooks,components,constants}`. Convention-bound files stay where they are: `public/sw.js`, `public/pwa/*`, `src/app/manifest.ts`, the routes under `src/app/`, `scripts/*`, `launch-shell.tsx` with the dashboard feature. A domain file never imports from `src/features/`.
- **Field colour:** `#040f23`, read everywhere from `PWA_LAUNCH_FIELD`. **Launch marker:** `/dashboard?launch=1`, in `PWA_START_URL`; `public/sw.js` mirrors the literals `/dashboard`, `?launch=1`, `/launch` under a comment naming the constants file.
- **The cover lifts on the layout's commit** (D2): `PwaLaunchReady` mounts in the dashboard layout outside its Suspense slots, never inside the session slot.
- **Push handlers untouched.** `git diff public/sw.js` must show no removed or changed line inside the `push`, `notificationclick` and `pushsubscriptionchange` handlers. `skipWaiting()` on install and `clients.claim()` on activate stay.
- **One document, one logo.** No `location.replace` outside the two stall watchdogs; the mark is always rendered at rest (`entrance={false}`) on the launch path.
- **No new dependencies; no `package.json` edits.** `next-pwa` removal stays with the cold-start plan.
- **Comments say why, never what,** and never cite the spec, this plan, tasks or docs (CLAUDE.md).
- **Git on the owner's workbench (`main`):** stage new files with `git add -- <path>`, moves with `git mv`, commit with `git commit -F - -- <paths>` (explicit paths; for a move list both the old and the new path). Never a plain `git commit`, `git add -A`, `commit -a`, `stash`, `reset`, `checkout .` or `clean` in the main tree. Before the first commit run `git diff --cached --stat` and leave anything already staged alone.
- **Commit trailer:** every commit message ends with `Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>`.
- **Verification:** `pnpm tsc` and `pnpm lint` (use `CI=1 npx eslint --fix <files>` for scoped fixes, never repo-wide `lint:fix`; it also settles import order after a path change). **Never `pnpm build` in the main tree.** Task 16's build in an isolated worktree runs only after the owner approves it at that task's gate.
- **No test data writes.** No DB writes, emails, SMS or uploads. Browser checks use the Playwright MCP; signed-in checks authenticate through `http://localhost:<port>/api/dev/playwright-session?secret=<DEV_LOGIN_SECRET>`. If reading `DEV_LOGIN_SECRET` from `.env.local` is refused, the signed-in checks are handed to the owner; the signed-out checks (the shell, the cover, the sign-in screen) still run.
- **The dev server on :3000 is the owner's.** Do not restart it or delete its `.next`. If a new Tailwind class does not apply there, see `memory/project-dev-css-staleness-investigation.md` before blaming the code.
- **Phase gates:** STOP at Task 6, Task 11 and Task 16 for the owner's checks and shipping decision. Nothing from a later phase is committed before the earlier gate is passed (main is linear; a later commit would ship inside the earlier deploy).
- **Device checks are the owner's.** Record each result in spec §11 before the next phase.

## Review Focus

1. **A cold database** (the session read takes seconds): the cover lifts onto the server's skeletons, not after the session resolves. Test: Task 10, Step 8 and Task 16, Step 4 (the RSC response is delayed so the order is observable).
2. **A push whose `navigate` carries `?launch=1`** opens its page, never the static shell. Test: Task 13 verify script.
3. **A desktop browser visit to `/launch`** lands on `/dashboard` with the cover lifting, and Back does not return to `/launch`. Test: Task 10, Step 9.
4. **Reduced motion:** the cover shows, lifts on ready, no fade, no stuck overlay. Test: Task 10, Step 9.
5. **The cover never appears on a plain `/dashboard` document load or on the public site:** their server HTML carries no `data-splash`. Test: Task 9, Step 5.
6. **A soft navigation that never completes** (RSC blocked): the cover fades at 4 s over the shell's skeletons and the page hard-loads `/dashboard` unmarked at 8 s. Test: Task 10, Step 10.

---

## File map

| File | Change | Task |
|---|---|---|
| `src/shared/lib/pwa.ts` → `src/shared/domains/pwa/lib/device.ts`, `src/shared/lib/push.ts` → `…/lib/vapid-key.ts`, `src/shared/hooks/use-push-subscription.ts` → `…/hooks/use-push-subscription.ts`, `src/shared/components/pwa-install-prompt.tsx` → `…/ui/pwa-install-prompt.tsx`, `src/shared/components/push-subscription-banner.tsx` → `…/ui/push-subscription-banner.tsx`, `src/shared/components/push-subscription-manager.tsx` → `…/ui/push-subscription-manager.tsx`; imports in `src/shared/components/contact-actions/ui/address-action.tsx`, `src/app/(frontend)/dashboard/layout.tsx`, `src/features/agent-dashboard/ui/components/dashboard-session-content.tsx`; delete `src/shared/components/splash-screen/pwa-splash-screen.tsx` | the domain gathers today's PWA code | 1 |
| `docs/plans/2026-10-08-pwa-launch-research.md`, `docs/superpowers/specs/…design.md`, this plan | committed | 1 |
| `src/shared/config/roots.ts` | `ROOTS.pwa.shell` | 2 |
| `src/shared/domains/pwa/constants/launch.ts` (new) | field colour, marker, start URL, cover timing | 2 |
| `src/shared/domains/pwa/lib/launch-url.ts` (new), `scripts/verify-pwa-launch-url.ts` (new) | pure marker helpers + check | 2 |
| `scripts/generate-pwa-icons.mjs` → `scripts/generate-pwa-icons.ts`, `public/pwa/icon-*.png`, `public/pwa/icon-maskable-512.png`, `src/app/manifest.ts` | navy icons, maskable icon, manifest `id` | 3 |
| `scripts/generate-pwa-splash.ts` (new), `src/shared/domains/pwa/constants/startup-images.ts` (generated), `public/pwa/splash/*.png`, `scripts/verify-pwa-splash-matrix.ts` (new), `src/app/(frontend)/layout.tsx` | iOS startup-image matrix | 4 |
| `src/shared/domains/pwa/ui/pwa-probe.tsx` (new), `src/app/(frontend)/dev/pwa-probe/page.tsx` (new) | device probe | 5 |
| `src/shared/components/splash-screen/splash-screen.tsx` | `held` mode, `entrance`, inline layout | 7 |
| `src/shared/domains/pwa/lib/launch-store.ts` (new), `src/shared/domains/pwa/hooks/use-pwa-launch-phase.ts` (new), `scripts/verify-pwa-launch-store.ts` (new) | launch phase store + hook | 8 |
| `src/shared/domains/pwa/ui/pwa-launch-cover.tsx` (new), `src/shared/domains/pwa/ui/pwa-launch-ready.tsx` (new), `src/app/(frontend)/layout.tsx`, `src/app/(frontend)/dashboard/layout.tsx` | cover + ready beacon | 9 |
| `src/shared/domains/pwa/ui/pwa-launch-handoff.tsx` (new), `src/features/agent-dashboard/ui/components/launch-shell.tsx` (new), `src/app/(frontend)/launch/page.tsx` (new), `src/app/robots.ts` | shell route | 10 |
| `src/shared/domains/pwa/constants/storage-keys.ts` (new), `src/shared/domains/pwa/lib/register-service-worker.ts` (new), `src/shared/domains/pwa/ui/service-worker-registrar.tsx` (new), `src/shared/domains/pwa/hooks/use-push-subscription.ts`, dashboard layout, `launch-shell.tsx` | one registration owner | 12 |
| `src/shared/services/providers/web-push/lib/build-payload.ts`, `scripts/verify-push-launch-marker.ts` (new) | push payload guard | 13 |
| `public/sw.js` | launch shell block | 14 |
| `src/shared/domains/pwa/ui/pwa-launch-ready.tsx`, `src/app/manifest.ts`, `docs/codebase-conventions/app-shell.md` | revalidation message, `start_url` marker, docs | 15 |
| `.worktrees/launch-build/` (gitignored) | production build for the browser checks | 16 |

---

## Phase 1 — the domain and the native assets

### Task 1: The PWA domain gathers today's PWA code; commit the docs

**Files:**
- Move: `src/shared/lib/pwa.ts` → `src/shared/domains/pwa/lib/device.ts`
- Move: `src/shared/lib/push.ts` → `src/shared/domains/pwa/lib/vapid-key.ts`
- Move: `src/shared/hooks/use-push-subscription.ts` → `src/shared/domains/pwa/hooks/use-push-subscription.ts`
- Move: `src/shared/components/pwa-install-prompt.tsx` → `src/shared/domains/pwa/ui/pwa-install-prompt.tsx`
- Move: `src/shared/components/push-subscription-banner.tsx` → `src/shared/domains/pwa/ui/push-subscription-banner.tsx`
- Move: `src/shared/components/push-subscription-manager.tsx` → `src/shared/domains/pwa/ui/push-subscription-manager.tsx` (mounted nowhere today; moved with its family, not deleted; the owner decides its fate)
- Modify (import lines only): `src/shared/components/contact-actions/ui/address-action.tsx`, `src/app/(frontend)/dashboard/layout.tsx`, `src/features/agent-dashboard/ui/components/dashboard-session-content.tsx`, and the moved files' own imports
- Delete: `src/shared/components/splash-screen/pwa-splash-screen.tsx` (mounted nowhere since `9ca491a8`)
- Commit: `docs/plans/2026-10-08-pwa-launch-research.md`, `docs/superpowers/specs/2026-10-08-pwa-launch-splash-shell-design.md`, `docs/superpowers/plans/2026-10-08-pwa-launch-splash-shell.md`

**Interfaces:**
- Produces: `isIOSDevice`, `isStandalonePWA`, `openExternalUrl` from `@/shared/domains/pwa/lib/device`; `urlBase64ToUint8Array` from `@/shared/domains/pwa/lib/vapid-key`; `usePushSubscription` from `@/shared/domains/pwa/hooks/use-push-subscription`; `PwaInstallPrompt`, `PushSubscriptionBanner`, `PushSubscriptionManager` from `@/shared/domains/pwa/ui/<file>`. No behaviour changes.

- [ ] **Step 1: Check the staged index, then commit the three docs**

Run: `git diff --cached --stat` — note anything already staged and leave it alone.

```bash
git add -- docs/plans/2026-10-08-pwa-launch-research.md docs/superpowers/specs/2026-10-08-pwa-launch-splash-shell-design.md docs/superpowers/plans/2026-10-08-pwa-launch-splash-shell.md
git commit -F - -- docs/plans/2026-10-08-pwa-launch-research.md docs/superpowers/specs/2026-10-08-pwa-launch-splash-shell-design.md docs/superpowers/plans/2026-10-08-pwa-launch-splash-shell.md <<'EOF'
docs(pwa): launch splash + service-worker shell — research, design, plan

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>
EOF
```

- [ ] **Step 2: Move the six files**

```bash
mkdir -p src/shared/domains/pwa/lib src/shared/domains/pwa/hooks src/shared/domains/pwa/ui
git mv src/shared/lib/pwa.ts src/shared/domains/pwa/lib/device.ts
git mv src/shared/lib/push.ts src/shared/domains/pwa/lib/vapid-key.ts
git mv src/shared/hooks/use-push-subscription.ts src/shared/domains/pwa/hooks/use-push-subscription.ts
git mv src/shared/components/pwa-install-prompt.tsx src/shared/domains/pwa/ui/pwa-install-prompt.tsx
git mv src/shared/components/push-subscription-banner.tsx src/shared/domains/pwa/ui/push-subscription-banner.tsx
git mv src/shared/components/push-subscription-manager.tsx src/shared/domains/pwa/ui/push-subscription-manager.tsx
```

- [ ] **Step 3: Point every import at the new paths**

Exact replacements, one per line; nothing else in these files changes:

| File | Old import path | New import path |
|---|---|---|
| `src/shared/domains/pwa/hooks/use-push-subscription.ts` | `@/shared/lib/push` | `@/shared/domains/pwa/lib/vapid-key` |
| `src/shared/domains/pwa/hooks/use-push-subscription.ts` | `@/shared/lib/pwa` | `@/shared/domains/pwa/lib/device` |
| `src/shared/domains/pwa/ui/pwa-install-prompt.tsx` | `@/shared/lib/pwa` | `@/shared/domains/pwa/lib/device` |
| `src/shared/domains/pwa/ui/push-subscription-banner.tsx` | `@/shared/hooks/use-push-subscription` | `@/shared/domains/pwa/hooks/use-push-subscription` |
| `src/shared/domains/pwa/ui/push-subscription-manager.tsx` | `@/shared/hooks/use-push-subscription` | `@/shared/domains/pwa/hooks/use-push-subscription` |
| `src/shared/components/contact-actions/ui/address-action.tsx` | `@/shared/lib/pwa` | `@/shared/domains/pwa/lib/device` |
| `src/app/(frontend)/dashboard/layout.tsx` | `@/shared/components/pwa-install-prompt` | `@/shared/domains/pwa/ui/pwa-install-prompt` |
| `src/features/agent-dashboard/ui/components/dashboard-session-content.tsx` | `@/shared/components/push-subscription-banner` | `@/shared/domains/pwa/ui/push-subscription-banner` |

```bash
sed -i "s#'@/shared/lib/push'#'@/shared/domains/pwa/lib/vapid-key'#; s#'@/shared/lib/pwa'#'@/shared/domains/pwa/lib/device'#" src/shared/domains/pwa/hooks/use-push-subscription.ts
sed -i "s#'@/shared/lib/pwa'#'@/shared/domains/pwa/lib/device'#" src/shared/domains/pwa/ui/pwa-install-prompt.tsx src/shared/components/contact-actions/ui/address-action.tsx
sed -i "s#'@/shared/hooks/use-push-subscription'#'@/shared/domains/pwa/hooks/use-push-subscription'#" src/shared/domains/pwa/ui/push-subscription-banner.tsx src/shared/domains/pwa/ui/push-subscription-manager.tsx
sed -i "s#'@/shared/components/pwa-install-prompt'#'@/shared/domains/pwa/ui/pwa-install-prompt'#" "src/app/(frontend)/dashboard/layout.tsx"
sed -i "s#'@/shared/components/push-subscription-banner'#'@/shared/domains/pwa/ui/push-subscription-banner'#" src/features/agent-dashboard/ui/components/dashboard-session-content.tsx
```

Run: `git diff --shortstat` — expected eight files with one changed line each (two in the hook); a whole-file diff means a CRLF file was rewritten (see `memory/feedback-crlf-files-scripted-edits.md`): restore it with `git checkout -- <that file>` only if it is one of the eight, then redo that one edit with the Edit tool.

- [ ] **Step 4: Delete the unmounted PWA splash**

`git rm src/shared/components/splash-screen/pwa-splash-screen.tsx`. Run `grep -rn "PwaSplashScreen\|app-splash-shown" src` — expected: no matches (the proposal splash uses `PROPOSAL_SPLASH_KEY`).

- [ ] **Step 5: Gates, and nothing points at the old paths**

Run: `CI=1 npx eslint --fix src/shared/domains/pwa "src/app/(frontend)/dashboard/layout.tsx" src/features/agent-dashboard/ui/components/dashboard-session-content.tsx src/shared/components/contact-actions/ui/address-action.tsx && pnpm tsc` — expected clean (the `--fix` only reorders imports).
Run: `grep -rn "shared/lib/pwa'\|shared/lib/push'\|shared/hooks/use-push-subscription'\|shared/components/pwa-install-prompt'\|shared/components/push-subscription-" src scripts` — expected: no matches.
Playwright MCP on the owner's dev server: open `http://localhost:3000/dashboard` — the page renders as before, `browser_console_messages` shows no error.

- [ ] **Step 6: Commit**

```bash
git commit -F - -- src/shared/lib/pwa.ts src/shared/domains/pwa/lib/device.ts src/shared/lib/push.ts src/shared/domains/pwa/lib/vapid-key.ts src/shared/hooks/use-push-subscription.ts src/shared/domains/pwa/hooks/use-push-subscription.ts src/shared/components/pwa-install-prompt.tsx src/shared/domains/pwa/ui/pwa-install-prompt.tsx src/shared/components/push-subscription-banner.tsx src/shared/domains/pwa/ui/push-subscription-banner.tsx src/shared/components/push-subscription-manager.tsx src/shared/domains/pwa/ui/push-subscription-manager.tsx src/shared/components/contact-actions/ui/address-action.tsx "src/app/(frontend)/dashboard/layout.tsx" src/features/agent-dashboard/ui/components/dashboard-session-content.tsx src/shared/components/splash-screen/pwa-splash-screen.tsx <<'EOF'
refactor(pwa): the PWA domain — install, push subscription and standalone helpers move under src/shared/domains/pwa; the unmounted PWA splash goes

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>
EOF
```

### Task 2: Constants, route root, marker helpers

**Files:**
- Modify: `src/shared/config/roots.ts` (inside `APP_ROOTS`, after the `dashboard` object)
- Create: `src/shared/domains/pwa/constants/launch.ts`
- Create: `src/shared/domains/pwa/lib/launch-url.ts`
- Create: `scripts/verify-pwa-launch-url.ts`

**Interfaces:**
- Produces: `ROOTS.pwa.shell: '/launch'`; `PWA_LAUNCH_FIELD`, `PWA_LAUNCH_PARAM`, `PWA_LAUNCH_VALUE`, `PWA_START_URL`, `PWA_LAUNCH_COVER_MIN_MS`, `PWA_LAUNCH_COVER_MAX_MS`, `PWA_LAUNCH_STALL_MS`; `isPwaLaunchUrl(url: URL): boolean`, `withoutPwaLaunchMarker(url: URL): URL`.

- [ ] **Step 1: Write the failing check**

Create `scripts/verify-pwa-launch-url.ts`:

```ts
/* eslint-disable no-console */
import assert from 'node:assert/strict'
import { PWA_START_URL } from '@/shared/domains/pwa/constants/launch'
import { isPwaLaunchUrl, withoutPwaLaunchMarker } from '@/shared/domains/pwa/lib/launch-url'

const origin = 'https://www.triprosremodeling.com'

assert.equal(PWA_START_URL, '/dashboard?launch=1', 'start url shape')
assert.equal(isPwaLaunchUrl(new URL(PWA_START_URL, origin)), true, 'the start url is a launch url')
assert.equal(isPwaLaunchUrl(new URL('/dashboard', origin)), false, 'plain dashboard')
assert.equal(isPwaLaunchUrl(new URL('/dashboard?launch=2', origin)), false, 'another value')
assert.equal(isPwaLaunchUrl(new URL('/dashboard/customers?launch=1', origin)), true, 'the marker on any path')

assert.equal(
  withoutPwaLaunchMarker(new URL('/dashboard/proposals/abc?launch=1', origin)).href,
  `${origin}/dashboard/proposals/abc`,
  'marker stripped with no dangling ?',
)
assert.equal(
  withoutPwaLaunchMarker(new URL('/dashboard/schedule?launch=1&show=meetings', origin)).href,
  `${origin}/dashboard/schedule?show=meetings`,
  'other params kept',
)
const untouched = new URL('/dashboard/customers', origin)
assert.equal(withoutPwaLaunchMarker(untouched), untouched, 'an unmarked url comes back as is')

console.log('✅ pwa launch url helpers verified')
```

- [ ] **Step 2: Run it to see it fail**

Run: `pnpm exec tsx scripts/verify-pwa-launch-url.ts`
Expected: fails to resolve `@/shared/domains/pwa/constants/launch`.

- [ ] **Step 3: Add the route root**

In `src/shared/config/roots.ts`, inside `APP_ROOTS` between the `dashboard` object's closing `},` and `public: {`, add:

```ts
  pwa: {
    /** The static shell document the installed app's launch is served from; it soft-navigates to the dashboard. */
    shell: '/launch',
  },
```

- [ ] **Step 4: Write the constants**

Create `src/shared/domains/pwa/constants/launch.ts`:

```ts
import { ROOTS } from '@/shared/config/roots'

/** The launch field. The manifest background, the iOS startup images, the icons and the cover all read it. */
export const PWA_LAUNCH_FIELD = '#040f23'

/**
 * Only the installed app's start_url carries this marker, and the service worker serves the static shell
 * for that navigation alone. public/sw.js repeats the literals; change them together.
 */
export const PWA_LAUNCH_PARAM = 'launch'
export const PWA_LAUNCH_VALUE = '1'
export const PWA_START_URL = `${ROOTS.dashboard.root}?${PWA_LAUNCH_PARAM}=${PWA_LAUNCH_VALUE}`

/** The cover never fades sooner than this after the shell's first client render: a warm launch would blink. */
export const PWA_LAUNCH_COVER_MIN_MS = 300
/**
 * The fail-open ceiling for a server that never answers: past it the cover fades over the shell's skeletons.
 * On a launch the server answers it never binds; the cover lifts when the dashboard layout commits.
 */
export const PWA_LAUNCH_COVER_MAX_MS = 4000
/** Past this with the shell still on screen the soft navigation has failed; a hard load takes over. */
export const PWA_LAUNCH_STALL_MS = 8000
```

- [ ] **Step 5: Write the helpers**

Create `src/shared/domains/pwa/lib/launch-url.ts`:

```ts
import { PWA_LAUNCH_PARAM, PWA_LAUNCH_VALUE } from '@/shared/domains/pwa/constants/launch'

/** True for the URL the installed app launches with: the exact marker, on any path. */
export function isPwaLaunchUrl(url: URL): boolean {
  return url.searchParams.get(PWA_LAUNCH_PARAM) === PWA_LAUNCH_VALUE
}

/** The same URL without the marker, so a link is never answered with the static shell instead of its page. */
export function withoutPwaLaunchMarker(url: URL): URL {
  if (!isPwaLaunchUrl(url)) {
    return url
  }
  const stripped = new URL(url.href)
  stripped.searchParams.delete(PWA_LAUNCH_PARAM)
  return stripped
}
```

- [ ] **Step 6: Run the check and the gates**

Run: `pnpm exec tsx scripts/verify-pwa-launch-url.ts` — expected `✅ pwa launch url helpers verified`.
Run: `pnpm tsc && CI=1 npx eslint src/shared/config/roots.ts src/shared/domains/pwa/constants/launch.ts src/shared/domains/pwa/lib/launch-url.ts scripts/verify-pwa-launch-url.ts` — expected clean.

- [ ] **Step 7: Commit**

```bash
git add -- src/shared/domains/pwa/constants/launch.ts src/shared/domains/pwa/lib/launch-url.ts scripts/verify-pwa-launch-url.ts
git commit -F - -- src/shared/config/roots.ts src/shared/domains/pwa/constants/launch.ts src/shared/domains/pwa/lib/launch-url.ts scripts/verify-pwa-launch-url.ts <<'EOF'
feat(pwa): one launch field colour, the launch marker and its URL helpers

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>
EOF
```

### Task 3: Icons on the navy field, a maskable icon, manifest `id`

**Files:**
- Rename + rewrite: `scripts/generate-pwa-icons.mjs` → `scripts/generate-pwa-icons.ts`
- Regenerate: `public/pwa/icon-192.png`, `public/pwa/icon-512.png`, `public/pwa/apple-touch-icon.png`; create `public/pwa/icon-maskable-512.png`
- Modify: `src/app/manifest.ts`

**Interfaces:**
- Consumes: `PWA_LAUNCH_FIELD`, `ROOTS.dashboard.root` (Task 2).
- Produces: the four icon files; manifest `id`, `background_color` from the constant, a `maskable` icon entry. `start_url` is **unchanged** in this task.

- [ ] **Step 1: Replace the icon script**

`git mv scripts/generate-pwa-icons.mjs scripts/generate-pwa-icons.ts`, then replace its contents:

```ts
/* eslint-disable no-console */
import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import sharp from 'sharp'
import { PWA_LAUNCH_FIELD } from '@/shared/domains/pwa/constants/launch'

// Run: pnpm exec tsx scripts/generate-pwa-icons.ts
const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(__dirname, '..')
const LOGO_SVG = resolve(ROOT, 'public/company/logo/logo-dark.svg')
const OUT_DIR = resolve(ROOT, 'public/pwa')

// Android draws the maskable icon through a circle whose radius is 40% of the icon; the mark at half the
// width keeps its corners inside that circle. The others keep the mark at 60%, as before.
const ICONS = [
  { name: 'icon-192.png', size: 192, markRatio: 0.6 },
  { name: 'icon-512.png', size: 512, markRatio: 0.6 },
  { name: 'icon-maskable-512.png', size: 512, markRatio: 0.5 },
  { name: 'apple-touch-icon.png', size: 180, markRatio: 0.6 },
]

const svg = readFileSync(LOGO_SVG)

for (const { name, size, markRatio } of ICONS) {
  const mark = await sharp(svg).resize({ width: Math.round(size * markRatio) }).png().toBuffer()
  await sharp({ create: { width: size, height: size, channels: 4, background: PWA_LAUNCH_FIELD } })
    .composite([{ input: mark, gravity: 'centre' }])
    .png()
    .toFile(resolve(OUT_DIR, name))
  console.log(`Generated ${name} (${size}x${size})`)
}
```

- [ ] **Step 2: Generate**

Run: `pnpm exec tsx scripts/generate-pwa-icons.ts`
Expected: four `Generated …` lines. Then `pnpm exec tsx -e "import('sharp').then(async s => { for (const f of ['icon-192.png','icon-512.png','icon-maskable-512.png','apple-touch-icon.png']) { const m = await s.default('public/pwa/'+f).metadata(); console.log(f, m.width, m.height) } })"` — expected 192, 512, 512, 180 squares. Open `public/pwa/icon-maskable-512.png` with the Read tool: the mark sits centred on navy with clear margin on every side.

- [ ] **Step 3: Update the manifest**

Replace `src/app/manifest.ts`:

```ts
import type { MetadataRoute } from 'next'
import { ROOTS } from '@/shared/config/roots'
import { PWA_LAUNCH_FIELD } from '@/shared/domains/pwa/constants/launch'

export default function manifest(): MetadataRoute.Manifest {
  return {
    // Pinned, so start_url can change without the installed app becoming a different app.
    id: ROOTS.dashboard.root,
    name: 'Tri Pros Remodeling',
    short_name: 'TPR',
    start_url: ROOTS.dashboard.root,
    // Scope MUST be "/" for declarative web push deep links to open the
    // standalone PWA. Without this, scope defaults to the directory of
    // start_url (/dashboard/), and pushes with `navigate: "/customers/123"`
    // open in Safari instead of routing into the installed app.
    scope: '/',
    display: 'standalone',
    background_color: PWA_LAUNCH_FIELD,
    theme_color: '#03AFED',
    orientation: 'portrait',
    icons: [
      {
        src: '/pwa/icon-192.png',
        sizes: '192x192',
        type: 'image/png',
      },
      {
        src: '/pwa/icon-512.png',
        sizes: '512x512',
        type: 'image/png',
      },
      // Android's splash prefers a maskable icon and masks it; this one keeps the mark inside the safe zone.
      {
        src: '/pwa/icon-maskable-512.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'maskable',
      },
    ],
  }
}
```

- [ ] **Step 4: Gates**

Run: `pnpm tsc && CI=1 npx eslint src/app/manifest.ts scripts/generate-pwa-icons.ts` — expected clean. `curl -s http://localhost:3000/manifest.webmanifest | head -c 400` (if the owner's dev server is up) — expected `"id":"/dashboard"`, `"background_color":"#040f23"`, three icons.

- [ ] **Step 5: Commit**

```bash
git add -- scripts/generate-pwa-icons.ts public/pwa/icon-maskable-512.png
git commit -F - -- scripts/generate-pwa-icons.mjs scripts/generate-pwa-icons.ts public/pwa/icon-192.png public/pwa/icon-512.png public/pwa/apple-touch-icon.png public/pwa/icon-maskable-512.png src/app/manifest.ts <<'EOF'
feat(pwa): icons on the launch field, a maskable icon for Android's splash, a pinned manifest id

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>
EOF
```

### Task 4: iOS startup-image matrix

**Files:**
- Create: `scripts/generate-pwa-splash.ts`
- Generated: `src/shared/domains/pwa/constants/startup-images.ts`, `public/pwa/splash/apple-splash-*-v3.png`
- Create: `scripts/verify-pwa-splash-matrix.ts`
- Modify: `src/app/(frontend)/layout.tsx` (`appleWebApp`)

**Interfaces:**
- Consumes: `PWA_LAUNCH_FIELD`.
- Produces: `PWA_STARTUP_IMAGES: { url: string, media: string }[]`, `PWA_STARTUP_IMAGE_SIZES: { width: number, height: number, scale: number }[]`, `PWA_STARTUP_IMAGE_VERSION: string`, all from `@/shared/domains/pwa/constants/startup-images`.

- [ ] **Step 1: Write the failing check**

Create `scripts/verify-pwa-splash-matrix.ts`:

```ts
/* eslint-disable no-console */
import assert from 'node:assert/strict'
import { resolve } from 'node:path'
import sharp from 'sharp'
import { PWA_STARTUP_IMAGE_SIZES, PWA_STARTUP_IMAGES } from '@/shared/domains/pwa/constants/startup-images'

const MEDIA = /^screen and \(device-width: (\d+)px\) and \(device-height: (\d+)px\) and \(-webkit-device-pixel-ratio: (\d)\) and \(orientation: (portrait|landscape)\)$/

assert.equal(PWA_STARTUP_IMAGES.length, PWA_STARTUP_IMAGE_SIZES.length * 2, 'both orientations for every size')

for (const { url, media } of PWA_STARTUP_IMAGES) {
  const match = MEDIA.exec(media)
  assert.ok(match, `media shape: ${media}`)
  const [, width, height, scale, orientation] = match
  const portrait = orientation === 'portrait'
  const expectWidth = (portrait ? Number(width) : Number(height)) * Number(scale)
  const expectHeight = (portrait ? Number(height) : Number(width)) * Number(scale)
  const meta = await sharp(resolve('public', url.slice(1))).metadata()
  assert.equal(meta.width, expectWidth, `${url} width`)
  assert.equal(meta.height, expectHeight, `${url} height`)
}

console.log(`✅ ${PWA_STARTUP_IMAGES.length} startup images match their media queries`)
```

Run: `pnpm exec tsx scripts/verify-pwa-splash-matrix.ts` — expected: fails to resolve `@/shared/domains/pwa/constants/startup-images`.

- [ ] **Step 2: Write the generator**

Create `scripts/generate-pwa-splash.ts`:

```ts
/* eslint-disable no-console */
import { mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import sharp from 'sharp'
import { PWA_LAUNCH_FIELD } from '@/shared/domains/pwa/constants/launch'

// Run: pnpm exec tsx scripts/generate-pwa-splash.ts && CI=1 npx eslint --fix src/shared/domains/pwa/constants/startup-images.ts
//
// iOS paints a startup image only when one entry's media query matches the device exactly, and it keys its
// cache on the file URL: bump VERSION whenever the picture changes, or a re-added app keeps the old one.
const VERSION = 'v3'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(__dirname, '..')
const OUT_DIR = resolve(ROOT, 'public/pwa/splash')
const CONSTANTS_PATH = resolve(ROOT, 'src/shared/domains/pwa/constants/startup-images.ts')
const LOGO_SVG = resolve(ROOT, 'public/company/logo/logo-dark.svg')
const PUBLIC_PREFIX = '/pwa/splash'

interface Device {
  /** Logical portrait size in CSS points; iOS reports these in both orientations. */
  width: number
  height: number
  scale: number
  name: string
}

const DEVICES: Device[] = [
  { width: 320, height: 568, scale: 2, name: 'iPhone SE (1st), 5s' },
  { width: 375, height: 667, scale: 2, name: 'iPhone 6–8, SE (2nd, 3rd)' },
  { width: 414, height: 736, scale: 3, name: 'iPhone 6–8 Plus' },
  { width: 375, height: 812, scale: 3, name: 'iPhone X, XS, 11 Pro, 12 mini, 13 mini' },
  { width: 414, height: 896, scale: 2, name: 'iPhone XR, 11' },
  { width: 414, height: 896, scale: 3, name: 'iPhone XS Max, 11 Pro Max' },
  { width: 390, height: 844, scale: 3, name: 'iPhone 12, 12 Pro, 13, 13 Pro, 14, 16e' },
  { width: 428, height: 926, scale: 3, name: 'iPhone 12 Pro Max, 13 Pro Max, 14 Plus' },
  { width: 393, height: 852, scale: 3, name: 'iPhone 14 Pro, 15, 15 Pro, 16' },
  { width: 430, height: 932, scale: 3, name: 'iPhone 14 Pro Max, 15 Plus, 15 Pro Max, 16 Plus' },
  { width: 402, height: 874, scale: 3, name: 'iPhone 16 Pro, 17, 17 Pro' },
  { width: 440, height: 956, scale: 3, name: 'iPhone 16 Pro Max, 17 Pro Max' },
  { width: 420, height: 912, scale: 3, name: 'iPhone Air' },
  { width: 744, height: 1133, scale: 2, name: 'iPad mini (6th, 7th)' },
  { width: 768, height: 1024, scale: 2, name: 'iPad 9.7", mini 5, Air 2' },
  { width: 810, height: 1080, scale: 2, name: 'iPad 10.2"' },
  { width: 820, height: 1180, scale: 2, name: 'iPad 10.9" (10th, 11th), Air 10.9"/11"' },
  { width: 834, height: 1112, scale: 2, name: 'iPad Pro 10.5", Air 3' },
  { width: 834, height: 1194, scale: 2, name: 'iPad Pro 11" (1st–4th)' },
  { width: 834, height: 1210, scale: 2, name: 'iPad Pro 11" (M4, M5)' },
  { width: 1024, height: 1366, scale: 2, name: 'iPad Pro 12.9", Air 13"' },
  { width: 1032, height: 1376, scale: 2, name: 'iPad Pro 13" (M4, M5)' },
]

const ORIENTATIONS = ['portrait', 'landscape'] as const

// The cover renders the mark 192 CSS px wide under a 640 px viewport and 224 px from there (w-48 sm:w-56);
// the image shows the same mark at the same size, so the handoff from the image to the cover moves nothing.
function markCssWidth(viewportCssWidth: number): number {
  return viewportCssWidth < 640 ? 192 : 224
}

mkdirSync(OUT_DIR, { recursive: true })
for (const existing of readdirSync(OUT_DIR)) {
  if (existing.startsWith('apple-splash-') && existing.endsWith('.png')) {
    rmSync(resolve(OUT_DIR, existing))
  }
}

const svg = readFileSync(LOGO_SVG)
const entries: { url: string, media: string }[] = []
const written = new Set<string>()

for (const device of DEVICES) {
  for (const orientation of ORIENTATIONS) {
    const cssW = orientation === 'portrait' ? device.width : device.height
    const cssH = orientation === 'portrait' ? device.height : device.width
    const pxW = cssW * device.scale
    const pxH = cssH * device.scale
    const file = `apple-splash-${pxW}-${pxH}-${VERSION}.png`
    const media = `screen and (device-width: ${device.width}px) and (device-height: ${device.height}px) and (-webkit-device-pixel-ratio: ${device.scale}) and (orientation: ${orientation})`
    entries.push({ url: `${PUBLIC_PREFIX}/${file}`, media })
    if (written.has(file)) {
      continue
    }
    written.add(file)
    const mark = await sharp(svg).resize({ width: markCssWidth(cssW) * device.scale }).png().toBuffer()
    await sharp({ create: { width: pxW, height: pxH, channels: 4, background: PWA_LAUNCH_FIELD } })
      .composite([{ input: mark, gravity: 'centre' }])
      .png({ compressionLevel: 9 })
      .toFile(resolve(OUT_DIR, file))
    console.log(`${file}  ${device.name}, ${orientation}`)
  }
}

const sizes = DEVICES.map(({ width, height, scale }) => ({ width, height, scale }))
writeFileSync(CONSTANTS_PATH, `// Generated by scripts/generate-pwa-splash.ts; run it again instead of editing.
export const PWA_STARTUP_IMAGE_VERSION = ${JSON.stringify(VERSION)}

/** One entry per device and orientation for appleWebApp.startupImage. */
export const PWA_STARTUP_IMAGES: { url: string, media: string }[] = ${JSON.stringify(entries, null, 2)}

/** The logical portrait sizes the matrix covers; the device probe checks a phone against them. */
export const PWA_STARTUP_IMAGE_SIZES: { width: number, height: number, scale: number }[] = ${JSON.stringify(sizes, null, 2)}
`)
console.log(`Done. ${written.size} images, ${entries.length} entries.`)
```

- [ ] **Step 3: Generate and lint the generated file**

Run: `mkdir -p src/shared/domains/pwa/constants && pnpm exec tsx scripts/generate-pwa-splash.ts && CI=1 npx eslint --fix src/shared/domains/pwa/constants/startup-images.ts`
Expected: 44 image lines, `Done. 44 images, 44 entries.`; `ls public/pwa/splash | wc -l` → 44. Open two files with the Read tool (one phone portrait, one iPad landscape): navy field, mark centred, nothing clipped.

- [ ] **Step 4: Run the check**

Run: `pnpm exec tsx scripts/verify-pwa-splash-matrix.ts` — expected `✅ 44 startup images match their media queries`.

- [ ] **Step 5: Wire the layout**

In `src/app/(frontend)/layout.tsx`, add the import `import { PWA_STARTUP_IMAGES } from '@/shared/domains/pwa/constants/startup-images'` (after the `@/shared/components/providers` import) and change `appleWebApp` to:

```ts
  appleWebApp: {
    capable: true,
    title: 'TPR',
    statusBarStyle: 'black-translucent',
    // iOS paints one of these before the web view exists, only on an exact device match, and only
    // after the app is re-added: the generator keeps the list and the files together.
    startupImage: PWA_STARTUP_IMAGES,
  },
```

- [ ] **Step 6: Gates**

Run: `pnpm tsc && CI=1 npx eslint "src/app/(frontend)/layout.tsx" scripts/generate-pwa-splash.ts scripts/verify-pwa-splash-matrix.ts src/shared/domains/pwa/constants/startup-images.ts` — expected clean. If the owner's dev server is up: `curl -s http://localhost:3000/ | grep -o 'apple-touch-startup-image' | wc -l` — expected 44.

- [ ] **Step 7: Commit**

```bash
git add -- scripts/generate-pwa-splash.ts scripts/verify-pwa-splash-matrix.ts src/shared/domains/pwa/constants/startup-images.ts public/pwa/splash
git commit -F - -- scripts/generate-pwa-splash.ts scripts/verify-pwa-splash-matrix.ts src/shared/domains/pwa/constants/startup-images.ts public/pwa/splash "src/app/(frontend)/layout.tsx" <<'EOF'
feat(pwa): iOS startup images for every current device and orientation, the mark at rest on the launch field

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>
EOF
```

### Task 5: Device probe page

**Files:**
- Create: `src/shared/domains/pwa/ui/pwa-probe.tsx`
- Create: `src/app/(frontend)/dev/pwa-probe/page.tsx`

**Interfaces:**
- Consumes: `PWA_STARTUP_IMAGE_SIZES`, `PWA_STARTUP_IMAGE_VERSION` (Task 4), `isStandalonePWA()` (`@/shared/domains/pwa/lib/device`, Task 1).

- [ ] **Step 1: Write the probe**

Create `src/shared/domains/pwa/ui/pwa-probe.tsx`:

```tsx
'use client'

import { useEffect, useState } from 'react'
import { PWA_STARTUP_IMAGE_SIZES, PWA_STARTUP_IMAGE_VERSION } from '@/shared/domains/pwa/constants/startup-images'
import { isStandalonePWA } from '@/shared/domains/pwa/lib/device'

interface Reading {
  width: number
  height: number
  scale: number
  orientation: string
  standalone: boolean
  userAgent: string
}

function read(): Reading {
  return {
    width: Math.min(screen.width, screen.height),
    height: Math.max(screen.width, screen.height),
    scale: window.devicePixelRatio,
    orientation: screen.orientation?.type ?? (screen.width > screen.height ? 'landscape' : 'portrait'),
    standalone: isStandalonePWA(),
    userAgent: navigator.userAgent,
  }
}

/** What iOS will match a startup image against, read on the device itself; the table is the generator's. */
export function PwaProbe() {
  const [reading, setReading] = useState<Reading | null>(null)
  useEffect(() => {
    // eslint-disable-next-line react-hooks-extra/no-direct-set-state-in-use-effect
    setReading(read())
    const update = () => setReading(read())
    window.addEventListener('resize', update)
    return () => window.removeEventListener('resize', update)
  }, [])
  if (!reading) {
    return <p className="p-6 font-mono text-sm">Reading…</p>
  }
  const covered = PWA_STARTUP_IMAGE_SIZES.some(size => size.width === reading.width && size.height === reading.height && size.scale === reading.scale)
  return (
    <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 p-6 font-mono text-sm">
      <dt>screen</dt>
      <dd>{`${reading.width} × ${reading.height} @ ${reading.scale}x`}</dd>
      <dt>orientation</dt>
      <dd>{reading.orientation}</dd>
      <dt>standalone</dt>
      <dd>{String(reading.standalone)}</dd>
      <dt>startup image</dt>
      <dd>{covered ? `in table (${PWA_STARTUP_IMAGE_VERSION})` : 'MISSING: add this size to scripts/generate-pwa-splash.ts and rerun it'}</dd>
      <dt>user agent</dt>
      <dd className="break-all">{reading.userAgent}</dd>
    </dl>
  )
}
```

- [ ] **Step 2: Write the page**

Create `src/app/(frontend)/dev/pwa-probe/page.tsx`:

```tsx
import { PwaProbe } from '@/shared/domains/pwa/ui/pwa-probe'

export default function PwaProbePage() {
  return <PwaProbe />
}
```

- [ ] **Step 3: Gates and a browser look**

Run: `pnpm tsc && CI=1 npx eslint src/shared/domains/pwa/ui/pwa-probe.tsx "src/app/(frontend)/dev/pwa-probe/page.tsx"` — expected clean. Playwright MCP: open `http://localhost:3000/dev/pwa-probe`, resize to 390×844; expected `screen` line shows the emulated size and `startup image` reads `in table (v3)` or `MISSING` (desktop screens are not in the table; the line must render either way, never "Reading…" for more than a moment).

- [ ] **Step 4: Commit**

```bash
git add -- src/shared/domains/pwa/ui/pwa-probe.tsx "src/app/(frontend)/dev/pwa-probe/page.tsx"
git commit -F - -- src/shared/domains/pwa/ui/pwa-probe.tsx "src/app/(frontend)/dev/pwa-probe/page.tsx" <<'EOF'
feat(pwa): a device probe that says whether the startup-image table covers this screen

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>
EOF
```

### Task 6: Phase 1 gate

- [ ] **Step 1: Clean-tree gates**

Run: `pnpm tsc && pnpm lint` — expected 0 errors (warnings in other sessions' files are not ours; if `pnpm lint` fails only on files this plan did not touch, record that and continue).

- [ ] **Step 2: Record and stop**

Update spec §11: "Phase 1 — native assets ✅ <date> (commits …)". Then STOP and report to the owner:
1. Ship Phase 1 through the normal flow (owner's call).
2. On each iPhone and iPad: open `https://www.triprosremodeling.com/dev/pwa-probe` in Safari (portrait and landscape); every reading must say `in table`. A `MISSING` reading → add the size to `DEVICES` in `scripts/generate-pwa-splash.ts`, rerun Task 4 Steps 3–7.
3. Remove and re-add the app from `www.triprosremodeling.com` on each device (never the apex; it redirects). Android: open `about://webapks` in Chrome and tap Update, or wait for the automatic re-mint.
4. Device check: force-quit → tap, three times per device, light and dark, iPad also in landscape: the mark on navy from the first frame, no white. (The web layer is still today's streamed shell; the mark will cut to it rather than fade. The fade is Phase 2.)
5. Record the results in spec §11. Phase 2 starts only after this.

---

## Phase 2 — the cover and the shell route

### Task 7: Splash primitive: `held` mode, `entrance`, inline layout

**Files:**
- Modify: `src/shared/components/splash-screen/splash-screen.tsx`

**Interfaces:**
- Produces: `dismiss: { mode: 'held' }` (no timer, no press; the caller closes by flipping `open`); prop `entrance?: boolean` (default `true`; `false` renders the mark at rest from the first frame).
- Unchanged for existing callers: `ProposalSplashScreen` (`timed`) and `MeetingSplashScreen` (`press`) pass no `entrance` and keep their behaviour.

- [ ] **Step 1: Extend the dismiss union and props**

Replace the `SplashDismiss` type and `SplashScreenProps`:

```ts
/**
 * `timed` fades on its own after `SPLASH_VISIBLE_MS`. `press` holds until the viewer presses:
 * `label` is the button's text and accessible name; while `ready` is false (default true) the
 * button is disabled and reads `pendingLabel`, and no press is accepted — the splash is then also
 * the loading state of what it covers (E10). `held` has no clock and no press: the caller closes it.
 */
type SplashDismiss
  = | { mode: 'timed' }
    | { mode: 'held' }
    | { mode: 'press', label: string, ready?: boolean, pendingLabel?: string }

interface SplashScreenProps {
  /** Controlled: the caller decides when it shows (once per session, once per meeting). */
  open: boolean
  onDismiss: () => void
  dismiss: SplashDismiss
  /** Caption under the mark. The timed proposal and PWA splashes have none. */
  title?: string
  subheading?: string
  /** The mark's and caption's rise, and the overlay's fade. */
  ease?: [number, number, number, number]
  /**
   * Play the mark's entrance (default). `false` paints the finished mark from the first frame, for a
   * cover that continues a native launch image already showing that mark.
   */
  entrance?: boolean
}
```

- [ ] **Step 2: Thread `entrance` into the entrance animation and move the layout inline**

In the component signature add `entrance = true` to the destructured props. Keep `const animate = !reduced` as it is (the closing fade follows it) and add `const playEntrance = animate && entrance` directly below it; `SplashMark`, `SplashCaption` and the press button's `initial` read `playEntrance`, the overlay's `transitionDuration` keeps reading `animate`.

Change the overlay `<div>`:

```tsx
    <div
      className="flex flex-col items-center justify-center gap-8 p-10"
      data-splash
      data-state={open ? 'open' : 'closed'}
      inert={!open}
      style={{
        // A full-window cover must not depend on a stylesheet rule being present: its box is inline.
        position: 'fixed',
        inset: 0,
        zIndex: 9999,
        backgroundColor: '#040f23',
        opacity: open ? 1 : 0,
        transitionProperty: 'opacity',
        transitionDuration: `${animate ? SPLASH_FADE_S : 0}s`,
        transitionTimingFunction: `cubic-bezier(${ease.join(',')})`,
      }}
      onClick={armed ? onDismiss : undefined}
    >
```

Add one sentence to the component's doc comment after "Visibility is the caller's policy.": `In held mode nothing here closes it; a held cover also usually passes entrance={false}, so the mark it shows is the one the native launch image already showed.`

- [ ] **Step 3: Gates and the two existing splashes**

Run: `pnpm tsc && CI=1 npx eslint src/shared/components/splash-screen/splash-screen.tsx` — expected clean. Confirm with `grep -rn "entrance\|'held'" src/features` that no existing caller changed. The `timed`/`press` effects early-return on `held`, so the proposal and meeting splashes are unaffected by construction.

- [ ] **Step 4: Commit**

```bash
git commit -F - -- src/shared/components/splash-screen/splash-screen.tsx <<'EOF'
feat(splash): a held mode the caller closes, an entrance switch for a mark already on screen, the cover's box inline

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>
EOF
```

### Task 8: The launch phase store and its hook

**Files:**
- Create: `src/shared/domains/pwa/lib/launch-store.ts`
- Create: `src/shared/domains/pwa/hooks/use-pwa-launch-phase.ts`
- Create: `scripts/verify-pwa-launch-store.ts`

**Interfaces:**
- Consumes: `PWA_LAUNCH_COVER_MIN_MS`, `PWA_LAUNCH_COVER_MAX_MS` (Task 2).
- Produces: `type PwaLaunchPhase = 'idle' | 'covering' | 'done'`; `createPwaLaunchStore(timers)` returning `{ subscribe, phase, begin, ready }`; the singleton `pwaLaunch` (both from `lib/launch-store`); `usePwaLaunchPhase(): PwaLaunchPhase` (server snapshot `'idle'`, from `hooks/use-pwa-launch-phase`).

- [ ] **Step 1: Write the failing check**

Create `scripts/verify-pwa-launch-store.ts`:

```ts
/* eslint-disable no-console */
import assert from 'node:assert/strict'
import { PWA_LAUNCH_COVER_MAX_MS, PWA_LAUNCH_COVER_MIN_MS } from '@/shared/domains/pwa/constants/launch'
import { createPwaLaunchStore } from '@/shared/domains/pwa/lib/launch-store'

function clock() {
  let now = 0
  let nextId = 1
  const timers = new Map<number, { at: number, fn: () => void }>()
  return {
    timers: {
      now: () => now,
      setTimeout: (fn: () => void, ms: number) => {
        const id = nextId++
        timers.set(id, { at: now + ms, fn })
        return id
      },
      clearTimeout: (handle: unknown) => {
        timers.delete(handle as number)
      },
    },
    advance(ms: number) {
      now += ms
      const due = [...timers].filter(([, t]) => t.at <= now).sort((a, b) => a[1].at - b[1].at)
      for (const [id, t] of due) {
        timers.delete(id)
        t.fn()
      }
    },
  }
}

{
  const c = clock()
  const s = createPwaLaunchStore(c.timers)
  assert.equal(s.phase(), 'idle')
  s.ready()
  assert.equal(s.phase(), 'idle', 'ready before begin is a no-op')
  s.begin()
  assert.equal(s.phase(), 'covering')
  c.advance(PWA_LAUNCH_COVER_MIN_MS + 50)
  s.ready()
  c.advance(0)
  assert.equal(s.phase(), 'done', 'ready past the floor finishes at once')
}

{
  const c = clock()
  const s = createPwaLaunchStore(c.timers)
  s.begin()
  c.advance(100)
  s.ready()
  assert.equal(s.phase(), 'covering', 'still covering under the floor')
  c.advance(PWA_LAUNCH_COVER_MIN_MS - 100)
  assert.equal(s.phase(), 'done', 'finishes exactly at the floor')
}

{
  const c = clock()
  const s = createPwaLaunchStore(c.timers)
  s.begin()
  c.advance(PWA_LAUNCH_COVER_MAX_MS - 1)
  assert.equal(s.phase(), 'covering')
  c.advance(1)
  assert.equal(s.phase(), 'done', 'the bound ends it')
  s.begin()
  assert.equal(s.phase(), 'done', 'begin after done is a no-op')
}

{
  const c = clock()
  const s = createPwaLaunchStore(c.timers)
  const seen: string[] = []
  const unsubscribe = s.subscribe(() => seen.push(s.phase()))
  s.begin()
  s.begin()
  c.advance(PWA_LAUNCH_COVER_MIN_MS)
  s.ready()
  s.ready()
  c.advance(0)
  assert.deepEqual(seen, ['covering', 'done'], 'subscribers hear each change once')
  unsubscribe()
}

console.log('✅ pwa launch store verified')
```

Run: `pnpm exec tsx scripts/verify-pwa-launch-store.ts` — expected: fails to resolve `@/shared/domains/pwa/lib/launch-store`.

- [ ] **Step 2: Write the store**

Create `src/shared/domains/pwa/lib/launch-store.ts`:

```ts
import { PWA_LAUNCH_COVER_MAX_MS, PWA_LAUNCH_COVER_MIN_MS } from '@/shared/domains/pwa/constants/launch'

export type PwaLaunchPhase = 'idle' | 'covering' | 'done'

interface Timers {
  now: () => number
  setTimeout: (fn: () => void, ms: number) => unknown
  clearTimeout: (handle: unknown) => void
}

/**
 * The cover's clock. `begin` is the shell's first client render; `ready` is the dashboard layout
 * committed under the cover, skeletons and all. The floor keeps a warm launch from blinking, the bound
 * keeps a launch the server never answers from locking. A factory, so the clock can be faked.
 */
export function createPwaLaunchStore(timers: Timers) {
  let phase: PwaLaunchPhase = 'idle'
  let beganAt = 0
  let bound: unknown
  let floor: unknown
  const listeners = new Set<() => void>()

  function setPhase(next: PwaLaunchPhase) {
    if (phase === next) {
      return
    }
    phase = next
    for (const listener of listeners) {
      listener()
    }
  }

  function finish() {
    timers.clearTimeout(bound)
    timers.clearTimeout(floor)
    bound = undefined
    floor = undefined
    setPhase('done')
  }

  return {
    subscribe(listener: () => void) {
      listeners.add(listener)
      return () => {
        listeners.delete(listener)
      }
    },
    phase: () => phase,
    begin() {
      if (phase !== 'idle') {
        return
      }
      beganAt = timers.now()
      setPhase('covering')
      bound = timers.setTimeout(finish, PWA_LAUNCH_COVER_MAX_MS)
    },
    ready() {
      if (phase !== 'covering' || floor !== undefined) {
        return
      }
      floor = timers.setTimeout(finish, Math.max(0, beganAt + PWA_LAUNCH_COVER_MIN_MS - timers.now()))
    },
  }
}

export const pwaLaunch = createPwaLaunchStore({
  now: () => Date.now(),
  setTimeout: (fn, ms) => globalThis.setTimeout(fn, ms),
  clearTimeout: handle => globalThis.clearTimeout(handle as ReturnType<typeof setTimeout>),
})
```

- [ ] **Step 3: Write the hook**

Create `src/shared/domains/pwa/hooks/use-pwa-launch-phase.ts`:

```ts
'use client'

import type { PwaLaunchPhase } from '@/shared/domains/pwa/lib/launch-store'
import { useSyncExternalStore } from 'react'
import { pwaLaunch } from '@/shared/domains/pwa/lib/launch-store'

/** The server snapshot is `idle`, and so is the client's first one, so the shell document hydrates against its own HTML. */
export function usePwaLaunchPhase(): PwaLaunchPhase {
  return useSyncExternalStore(pwaLaunch.subscribe, pwaLaunch.phase, () => 'idle')
}
```

- [ ] **Step 4: Run the check and the gates**

Run: `pnpm exec tsx scripts/verify-pwa-launch-store.ts` — expected `✅ pwa launch store verified`.
Run: `CI=1 npx eslint --fix src/shared/domains/pwa/lib/launch-store.ts src/shared/domains/pwa/hooks/use-pwa-launch-phase.ts scripts/verify-pwa-launch-store.ts && pnpm tsc` — expected clean.

- [ ] **Step 5: Commit**

```bash
git add -- src/shared/domains/pwa/lib/launch-store.ts src/shared/domains/pwa/hooks/use-pwa-launch-phase.ts scripts/verify-pwa-launch-store.ts
git commit -F - -- src/shared/domains/pwa/lib/launch-store.ts src/shared/domains/pwa/hooks/use-pwa-launch-phase.ts scripts/verify-pwa-launch-store.ts <<'EOF'
feat(pwa): the launch cover's clock — covering from the shell's first render, done on ready past a floor or at a bound

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>
EOF
```

### Task 9: The cover in the root layout and the ready beacon in the dashboard layout

**Files:**
- Create: `src/shared/domains/pwa/ui/pwa-launch-cover.tsx`
- Create: `src/shared/domains/pwa/ui/pwa-launch-ready.tsx`
- Modify: `src/app/(frontend)/layout.tsx` (body)
- Modify: `src/app/(frontend)/dashboard/layout.tsx` (one line, above the sidebar provider)

**Interfaces:**
- Consumes: `SplashScreen` with `{ mode: 'held' }` + `entrance` (Task 7); `usePwaLaunchPhase`, `pwaLaunch` (Task 8); `ROOTS.pwa.shell` (Task 2).
- Produces: `<PwaLaunchCover />` (root layout, leaf); `<PwaLaunchReady />` (renders nothing; `ready()` on mount; mounted in the dashboard layout outside its Suspense slots). Task 15 extends the beacon. `DashboardSessionContent` is not touched.

- [ ] **Step 1: Write the cover**

Create `src/shared/domains/pwa/ui/pwa-launch-cover.tsx`:

```tsx
'use client'

import { usePathname } from 'next/navigation'
import { SplashScreen } from '@/shared/components/splash-screen/splash-screen'
import { ROOTS } from '@/shared/config/roots'
import { usePwaLaunchPhase } from '@/shared/domains/pwa/hooks/use-pwa-launch-phase'

function noop() {}

/**
 * The installed app's launch cover, continuing the native startup image: the mark at rest on the launch
 * field. Open in the server HTML of the shell document only, so it is that document's first paint; held
 * open through the shell's soft navigation by the launch phase; closed by the dashboard's ready beacon
 * or the bound. Any other document renders nothing. A leaf with no context, so it cannot disturb a
 * hydrating boundary below it.
 */
export function PwaLaunchCover() {
  const phase = usePwaLaunchPhase()
  const pathname = usePathname()
  const open = phase === 'covering' || (phase === 'idle' && pathname === ROOTS.pwa.shell)
  return <SplashScreen dismiss={{ mode: 'held' }} entrance={false} open={open} onDismiss={noop} />
}
```

- [ ] **Step 2: Write the beacon**

Create `src/shared/domains/pwa/ui/pwa-launch-ready.tsx`:

```tsx
'use client'

import { useEffect } from 'react'
import { pwaLaunch } from '@/shared/domains/pwa/lib/launch-store'

/**
 * Mounted in the dashboard layout outside its Suspense slots, so it fires on the layout's first commit:
 * the server has answered and its sidebar frame and route skeleton have painted under the cover. The
 * session and the page fill in afterwards behind a visible skeleton, as on any document load. A no-op
 * on every document that is not a launch.
 */
export function PwaLaunchReady() {
  useEffect(() => {
    pwaLaunch.ready()
  }, [])
  return null
}
```

- [ ] **Step 3: Mount the cover in the root layout**

In `src/app/(frontend)/layout.tsx` add `import { PwaLaunchCover } from '@/shared/domains/pwa/ui/pwa-launch-cover'` (after the `Providers` import) and change the body to:

```tsx
        <Providers>
          {children}
          <PwaLaunchCover />
        </Providers>
```

- [ ] **Step 4: Mount the beacon where the dashboard layout commits**

`src/app/(frontend)/dashboard/layout.tsx` — add `import { PwaLaunchReady } from '@/shared/domains/pwa/ui/pwa-launch-ready'` (next to the `PwaInstallPrompt` import) and render it right after `<PwaInstallPrompt />`, above `TablePreferencesProvider`, outside both cookie branches:

```tsx
      <GlobalDialogs />
      <PwaInstallPrompt />
      <PwaLaunchReady />
      <TablePreferencesProvider initial={readTablePreferences(cookieStore.getAll())}>
```

Nothing inside `SidebarProvider` changes, and `DashboardSessionContent` is not touched: the beacon must fire on the layout's commit, not on the session slot's.

- [ ] **Step 5: Gates, and the cover is absent from every ordinary document (Review Focus 5)**

Run: `CI=1 npx eslint --fix src/shared/domains/pwa/ui/pwa-launch-cover.tsx src/shared/domains/pwa/ui/pwa-launch-ready.tsx "src/app/(frontend)/layout.tsx" "src/app/(frontend)/dashboard/layout.tsx" && pnpm tsc` — expected clean.

Against the owner's dev server: `curl -s http://localhost:3000/ | grep -c 'data-splash'` → `0`; `curl -s http://localhost:3000/dashboard | grep -c 'data-splash'` → `0`. Playwright MCP: open `/dashboard` (signed out is fine) — no overlay, no console error.

- [ ] **Step 6: Commit**

```bash
git add -- src/shared/domains/pwa/ui/pwa-launch-cover.tsx src/shared/domains/pwa/ui/pwa-launch-ready.tsx
git commit -F - -- src/shared/domains/pwa/ui/pwa-launch-cover.tsx src/shared/domains/pwa/ui/pwa-launch-ready.tsx "src/app/(frontend)/layout.tsx" "src/app/(frontend)/dashboard/layout.tsx" <<'EOF'
feat(pwa): the launch cover lives in the root layout and lifts the moment the dashboard layout has committed

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>
EOF
```

### Task 10: The shell route, the handoff and its watchdogs

**Files:**
- Create: `src/shared/domains/pwa/ui/pwa-launch-handoff.tsx`
- Create: `src/features/agent-dashboard/ui/components/launch-shell.tsx`
- Create: `src/app/(frontend)/launch/page.tsx`
- Modify: `src/app/robots.ts`

**Interfaces:**
- Consumes: `pwaLaunch.begin()`, `ROOTS.pwa.shell`, `ROOTS.dashboard.root`, `PWA_LAUNCH_STALL_MS`, `DASHBOARD_MAIN_CLASS`, `AppSidebarSkeleton`, `DashboardGenericContentSkeleton`, `DashboardHomePendingView`, `DataViewPending`, `SidebarInset`, `SidebarProvider`.
- Produces: `<PwaLaunchHandoff />` (domain), `<LaunchShell />` (feature; Task 12 adds the registrar inside it); `window.__tprLaunch`.

- [ ] **Step 1: Write the handoff**

Create `src/shared/domains/pwa/ui/pwa-launch-handoff.tsx`:

```tsx
'use client'

import { useRouter } from 'next/navigation'
import { useEffect } from 'react'
import { ROOTS } from '@/shared/config/roots'
import { PWA_LAUNCH_STALL_MS } from '@/shared/domains/pwa/constants/launch'
import { pwaLaunch } from '@/shared/domains/pwa/lib/launch-store'

declare global {
  interface Window {
    /** Set before the shell navigates, so the document's own watchdog knows the bundle ran. */
    __tprLaunch?: true
  }
}

/**
 * The shell's only job: mark the launch so the cover stays up, then move to the dashboard in the same
 * document. If this component is still mounted when the stall bound passes, the soft navigation has
 * failed and a hard load of the unmarked dashboard takes over — the one hard load on the launch path.
 */
export function PwaLaunchHandoff() {
  const router = useRouter()

  useEffect(() => {
    window.__tprLaunch = true
    pwaLaunch.begin()
    router.replace(ROOTS.dashboard.root)
  }, [router])

  useEffect(() => {
    const timer = window.setTimeout(() => window.location.replace(ROOTS.dashboard.root), PWA_LAUNCH_STALL_MS)
    return () => window.clearTimeout(timer)
  }, [])

  return null
}
```

- [ ] **Step 2: Write the shell**

Create `src/features/agent-dashboard/ui/components/launch-shell.tsx`:

```tsx
import { Suspense } from 'react'
import { DASHBOARD_MAIN_CLASS } from '@/features/agent-dashboard/constants/dashboard-main'
import { AppSidebarSkeleton } from '@/features/agent-dashboard/ui/components/app-sidebar-skeleton'
import { DashboardGenericContentSkeleton } from '@/features/agent-dashboard/ui/components/dashboard-generic-content-skeleton'
import { DashboardHomePendingView } from '@/features/agent-dashboard/ui/components/dashboard-home-pending-view'
import { DataViewPending } from '@/shared/components/data-view-pending'
import { SidebarInset, SidebarProvider } from '@/shared/components/ui/sidebar'
import { PwaLaunchHandoff } from '@/shared/domains/pwa/ui/pwa-launch-handoff'

/**
 * The dashboard's loading frame, drawn with no session and no data so the page prerenders at build and
 * the service worker can hold it as a plain file. Same shape as the dashboard layout, so the swap to the
 * real layout moves nothing the cover might reveal early. The real layout reads the sidebar cookie; this
 * cannot, so the sidebar starts open. The home view reads URL state, which a static page must render
 * under a Suspense boundary.
 */
export function LaunchShell() {
  return (
    <>
      <SidebarProvider defaultOpen data-no-gutter-stable>
        <AppSidebarSkeleton />
        <SidebarInset className="h-full min-w-0 overflow-hidden bg-background">
          <div className="flex-1 min-h-0 pt-[env(safe-area-inset-top)]">
            <div className="flex h-full min-w-0 flex-col">
              <div className={DASHBOARD_MAIN_CLASS}>
                <Suspense fallback={<DashboardGenericContentSkeleton />}>
                  <DataViewPending>
                    <DashboardHomePendingView />
                  </DataViewPending>
                </Suspense>
              </div>
            </div>
          </div>
        </SidebarInset>
      </SidebarProvider>
      <PwaLaunchHandoff />
    </>
  )
}
```

- [ ] **Step 3: Write the page**

Create `src/app/(frontend)/launch/page.tsx`:

```tsx
/* eslint-disable react-dom/no-dangerously-set-innerhtml */
import type { Metadata } from 'next'
import { LaunchShell } from '@/features/agent-dashboard/ui/components/launch-shell'
import { ROOTS } from '@/shared/config/roots'
import { PWA_LAUNCH_STALL_MS } from '@/shared/domains/pwa/constants/launch'

export const dynamic = 'force-static'

export const metadata: Metadata = {
  robots: { index: false, follow: false },
}

// Runs even when no chunk executes (a cached document whose chunks the server no longer has): the handoff
// sets the flag before it navigates, so a working launch never reaches this.
const WATCHDOG = `setTimeout(function(){if(!window.__tprLaunch){location.replace(${JSON.stringify(ROOTS.dashboard.root)})}},${PWA_LAUNCH_STALL_MS})`

export default function LaunchPage() {
  return (
    <>
      <script dangerouslySetInnerHTML={{ __html: WATCHDOG }} />
      <LaunchShell />
    </>
  )
}
```

- [ ] **Step 4: Keep crawlers out**

In `src/app/robots.ts` add `'/launch',` to the `disallow` array (after `'/intake'`).

- [ ] **Step 5: Gates**

Run: `CI=1 npx eslint --fix src/shared/domains/pwa/ui/pwa-launch-handoff.tsx src/features/agent-dashboard/ui/components/launch-shell.tsx "src/app/(frontend)/launch/page.tsx" src/app/robots.ts && pnpm tsc` — expected clean.

- [ ] **Step 6: The shell's HTML carries the cover open**

Run: `curl -s http://localhost:3000/launch | grep -o 'data-splash[^>]*data-state="open"' | head -1` — expected one match. `curl -s http://localhost:3000/launch | grep -c '__tprLaunch'` — expected ≥ 1 (the inline watchdog).

- [ ] **Step 7: The handoff in a browser (signed out is enough)**

Playwright MCP, viewport 390×844: navigate to `http://localhost:3000/launch`. Expected, in order: the navy cover with the mark is the first thing on screen; within ~2 s the URL is `/dashboard`; the cover fades; the sign-in card (signed out) or the dashboard (signed in) is visible; `browser_console_messages` shows no error and no hydration warning. Take a screenshot before and after for the report.

- [ ] **Step 8: Review Focus 1 — the cover lifts on the layout's commit, not on the session**

`browser_run_code_unsafe`, one block. It installs an observer in every new document before any page script, delays the dashboard's RSC response so the floor cannot mask the order, visits the shell and reads the timings:

```js
await page.addInitScript(() => {
  const t = (window.__t = {})
  let initial = null
  new MutationObserver(() => {
    const now = performance.now()
    const wrapper = document.querySelector('[data-slot="sidebar-wrapper"]')
    if (wrapper && !initial) initial = wrapper
    // the shell's own frame is the first wrapper; the dashboard layout's commit replaces it with a new element
    if (!t.layout && initial && wrapper && wrapper !== initial) t.layout = now
    const skeleton = document.querySelector('[data-slot="dashboard-content-skeleton"]')
    if (!t.skeleton && skeleton) t.skeleton = now
    if (t.skeleton && !t.skeletonGone && !skeleton) t.skeletonGone = now
    if (!t.cover && document.querySelector('[data-splash][data-state="closed"]')) t.cover = now
  }).observe(document.documentElement, { childList: true, subtree: true, attributes: true, attributeFilter: ['data-state'] })
})
await page.route(url => url.pathname === '/dashboard' && url.searchParams.has('_rsc'), async (route) => {
  await new Promise(resolve => setTimeout(resolve, 1000))
  await route.continue()
})
await page.goto('http://localhost:3000/launch')
await page.waitForURL('**/dashboard')
await page.waitForTimeout(2500)
const t = await page.evaluate(() => window.__t)
await page.unrouteAll()
return t
```

Expected: `layout` is defined; `cover` is defined; `cover - layout` is under 100 ms (the beacon fired on that commit; the floor had long passed because of the 1 s delay). Signed in with a cookie, `skeleton` is also defined and `cover < skeletonGone`: the cover started lifting while the server's skeleton was still on screen. Signed out, `skeleton` is undefined (the sign-in screen renders directly) and `cover - layout < 100` is the whole check. Record the three numbers.

- [ ] **Step 9: Review Focus 3 and 4**

Back: after a plain handoff (Step 7), `browser_navigate_back` — expected: the browser leaves to whatever was before `/launch` (or stays if nothing was), never returns to `/launch`.
Reduced motion: `browser_emulate_media` with `reducedMotion: 'reduce'`, navigate to `/launch` again — expected: the cover shows, lifts once `/dashboard` has rendered, with no fade (the overlay's inline `transition-duration` is `0s`), and `document.querySelector('[data-splash]')` is `null` afterwards.

- [ ] **Step 10: Review Focus 6 — the watchdogs**

Playwright MCP: block the RSC fetch with `browser_run_code_unsafe` → `await page.route(url => url.pathname === '/dashboard' && url.searchParams.has('_rsc'), route => route.abort())`, then navigate to `/launch`. Expected: at ~4 s the cover fades and the shell's skeleton is visible; at ~8 s a full document navigation to `/dashboard` happens (a new `document` request in `browser_network_requests`, URL without `launch`); `page.unrouteAll()` afterwards.

- [ ] **Step 11: Commit**

```bash
git add -- src/shared/domains/pwa/ui/pwa-launch-handoff.tsx src/features/agent-dashboard/ui/components/launch-shell.tsx "src/app/(frontend)/launch/page.tsx"
git commit -F - -- src/shared/domains/pwa/ui/pwa-launch-handoff.tsx src/features/agent-dashboard/ui/components/launch-shell.tsx "src/app/(frontend)/launch/page.tsx" src/app/robots.ts <<'EOF'
feat(pwa): a static launch shell that paints the cover, then moves to the dashboard in the same document

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>
EOF
```

### Task 11: Phase 2 gate

- [ ] **Step 1: Clean-tree gates**

Run: `pnpm tsc && pnpm lint` — expected 0 errors in this plan's files.

- [ ] **Step 2: Record and stop**

Update spec §11 (Phase 2 rows, commits, the Step 8 timings). STOP and report to the owner:
1. Ship Phase 2 (owner's call). Nothing changes for users yet except that `/launch` exists and the splash primitive has two new options.
2. Owner device look: open `https://www.triprosremodeling.com/launch` in the installed app's browser (Safari on the phone is fine): the navy cover with the mark, then the dashboard skeleton, then the dashboard. This is what Phase 3 will serve from cache.
3. Phase 3 needs a production build for its browser checks (Task 16). Ask for approval of one `next build` in `.worktrees/launch-build` now, so Task 16 does not wait.

---

## Phase 3 — the service worker

### Task 12: One registration owner, the device switch, the registrar

**Files:**
- Create: `src/shared/domains/pwa/constants/storage-keys.ts`
- Create: `src/shared/domains/pwa/lib/register-service-worker.ts`
- Create: `src/shared/domains/pwa/ui/service-worker-registrar.tsx`
- Modify: `src/shared/domains/pwa/hooks/use-push-subscription.ts`
- Modify: `src/app/(frontend)/dashboard/layout.tsx`
- Modify: `src/features/agent-dashboard/ui/components/launch-shell.tsx`

**Interfaces:**
- Consumes: `isStandalonePWA` (`@/shared/domains/pwa/lib/device`, Task 1); `STORAGE_KEY_PREFIX` (`@/shared/constants/storage-keys`, existing).
- Produces: `PWA_SW_DISABLED_KEY` (`'tri-pros:sw-disabled'`); `registerServiceWorker(): Promise<ServiceWorkerRegistration | null>`; `requestShellRevalidation(): void`; `<ServiceWorkerRegistrar />`.
- Consumes (Task 14): the worker reads `?shell=1` from its own URL.

- [ ] **Step 1: The device switch key**

Create `src/shared/domains/pwa/constants/storage-keys.ts` (the funnels domain declares its keys the same way):

```ts
import { STORAGE_KEY_PREFIX } from '@/shared/constants/storage-keys'

/** '1' on a device switches the service worker off: it is removed, with its caches, on the next load. */
export const PWA_SW_DISABLED_KEY = `${STORAGE_KEY_PREFIX}sw-disabled`
```

- [ ] **Step 2: The helper**

Create `src/shared/domains/pwa/lib/register-service-worker.ts`:

```ts
import { PWA_SW_DISABLED_KEY } from '@/shared/domains/pwa/constants/storage-keys'
import { isStandalonePWA } from '@/shared/domains/pwa/lib/device'

// A document served by a worker under `next dev` never hydrates, so only production builds register
// the shell-serving variant; the worker reads the flag from its own URL.
// eslint-disable-next-line node/prefer-global/process
const SW_URL = process.env.NODE_ENV === 'production' ? '/sw.js?shell=1' : '/sw.js'
const OPTIONS: RegistrationOptions = { scope: '/', updateViaCache: 'none' }

let pending: Promise<ServiceWorkerRegistration | null> | undefined

function isSwitchedOff(): boolean {
  // eslint-disable-next-line node/prefer-global/process
  if (process.env.NEXT_PUBLIC_SW_DISABLED === '1') {
    return true
  }
  try {
    return localStorage.getItem(PWA_SW_DISABLED_KEY) === '1'
  }
  catch {
    return false
  }
}

/**
 * The one place that registers the worker. Every caller passes the same URL and options, so the calls
 * collapse into one registration and the push subscription stays bound to it. Switched off (the build
 * env or the device switch) it removes every registration and cache instead, so the worker cannot come
 * back on the next load.
 */
export function registerServiceWorker(): Promise<ServiceWorkerRegistration | null> {
  if (typeof window === 'undefined' || !('serviceWorker' in navigator)) {
    return Promise.resolve(null)
  }
  pending ??= (isSwitchedOff() ? remove() : register()).catch((error) => {
    pending = undefined
    throw error
  })
  return pending
}

async function register(): Promise<ServiceWorkerRegistration> {
  const registration = await navigator.serviceWorker.register(SW_URL, OPTIONS)
  if (isStandalonePWA() && navigator.storage?.persist) {
    // Granted silently to an installed app; the answer changes nothing here.
    void navigator.storage.persist().catch(() => false)
  }
  return registration
}

async function remove(): Promise<null> {
  const registrations = await navigator.serviceWorker.getRegistrations()
  await Promise.all(registrations.map(registration => registration.unregister()))
  if ('caches' in window) {
    const keys = await caches.keys()
    await Promise.all(keys.map(key => caches.delete(key)))
  }
  return null
}

/** Asks the controlling worker to refresh its launch shell; a no-op without one. */
export function requestShellRevalidation(): void {
  if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) {
    return
  }
  navigator.serviceWorker.controller?.postMessage({ type: 'tpr:revalidate-shell' })
}
```

- [ ] **Step 3: The registrar**

Create `src/shared/domains/pwa/ui/service-worker-registrar.tsx`:

```tsx
'use client'

import { useEffect } from 'react'
import { registerServiceWorker } from '@/shared/domains/pwa/lib/register-service-worker'

/** Registers (or removes) the worker as soon as the document is up; the push hook shares the registration. */
export function ServiceWorkerRegistrar() {
  useEffect(() => {
    registerServiceWorker().catch(() => null)
  }, [])
  return null
}
```

- [ ] **Step 4: The push hook uses the helper**

In `src/shared/domains/pwa/hooks/use-push-subscription.ts`:
- Add `import { registerServiceWorker } from '@/shared/domains/pwa/lib/register-service-worker'` after the `@/shared/domains/pwa/lib/device` import.
- Remove the `swPath` option: delete the `/** Must be served from the origin root with no-cache headers. */ swPath?: string` lines from `UsePushSubscriptionOptions`, delete `const DEFAULT_SW_PATH = '/sw.js'`, delete `const swPath = opts.swPath ?? DEFAULT_SW_PATH`, and change the effect's dependency array from `[vapidPublicKey, swPath]` to `[vapidPublicKey]`.
- Replace

```ts
        const registration = await navigator.serviceWorker.register(swPath)
        if (cancelled) {
          return
        }
        registrationRef.current = registration
```

with

```ts
        const registration = await registerServiceWorker()
        if (cancelled) {
          return
        }
        if (!registration) {
          setStatus('unsupported')
          return
        }
        registrationRef.current = registration
```

- [ ] **Step 5: Mount the registrar**

`src/app/(frontend)/dashboard/layout.tsx`: add `import { ServiceWorkerRegistrar } from '@/shared/domains/pwa/ui/service-worker-registrar'` (next to the `PwaLaunchReady` import) and render `<ServiceWorkerRegistrar />` right after `<PwaLaunchReady />`:

```tsx
      <PwaInstallPrompt />
      <PwaLaunchReady />
      <ServiceWorkerRegistrar />
      <TablePreferencesProvider initial={readTablePreferences(cookieStore.getAll())}>
```

`src/features/agent-dashboard/ui/components/launch-shell.tsx`: add `import { ServiceWorkerRegistrar } from '@/shared/domains/pwa/ui/service-worker-registrar'` (after the `PwaLaunchHandoff` import) and render `<ServiceWorkerRegistrar />` right after `<PwaLaunchHandoff />`.

- [ ] **Step 6: Gates and a dev-server look**

Run: `CI=1 npx eslint --fix src/shared/domains/pwa/constants/storage-keys.ts src/shared/domains/pwa/lib/register-service-worker.ts src/shared/domains/pwa/ui/service-worker-registrar.tsx src/shared/domains/pwa/hooks/use-push-subscription.ts "src/app/(frontend)/dashboard/layout.tsx" src/features/agent-dashboard/ui/components/launch-shell.tsx && pnpm tsc` — expected clean. `grep -rn "swPath" src` — expected none.

Playwright MCP on the dev server: open `/dashboard`, then `browser_evaluate` → `navigator.serviceWorker.getRegistrations().then(r => r.map(x => x.active?.scriptURL))` — expected one entry ending in `/sw.js` (no `?shell=1` under `next dev`). Set `localStorage.setItem('tri-pros:sw-disabled','1')`, reload, evaluate again — expected `[]`; remove the key, reload — expected one entry again.

- [ ] **Step 7: Commit**

```bash
git add -- src/shared/domains/pwa/constants/storage-keys.ts src/shared/domains/pwa/lib/register-service-worker.ts src/shared/domains/pwa/ui/service-worker-registrar.tsx
git commit -F - -- src/shared/domains/pwa/constants/storage-keys.ts src/shared/domains/pwa/lib/register-service-worker.ts src/shared/domains/pwa/ui/service-worker-registrar.tsx src/shared/domains/pwa/hooks/use-push-subscription.ts "src/app/(frontend)/dashboard/layout.tsx" src/features/agent-dashboard/ui/components/launch-shell.tsx <<'EOF'
feat(pwa): one owner registers the service worker, with a device switch that removes it for good

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>
EOF
```

### Task 13: The push payload never carries the launch marker

**Files:**
- Modify: `src/shared/services/providers/web-push/lib/build-payload.ts`
- Create: `scripts/verify-push-launch-marker.ts`

**Interfaces:**
- Consumes: `withoutPwaLaunchMarker` (Task 2), `buildPushPayload` (existing).
- Boundary note (spec §5.7): a provider `lib/` file imports a pure domain helper. The file already resolves against `publicUrl()` from shared config; the helper has no React, DAL or service behind it. The owner saw this in the spec; do not "fix" it by moving the builder.

- [ ] **Step 1: Write the failing check**

Create `scripts/verify-push-launch-marker.ts`:

```ts
/* eslint-disable no-console */
import './lib/load-env'
import assert from 'node:assert/strict'
import { buildPushPayload } from '@/shared/services/providers/web-push/lib/build-payload'

const marked = buildPushPayload({ title: 'Proposal signed', navigate: '/dashboard/proposals/abc?launch=1' })
assert.equal(new URL(marked.notification.navigate).search, '', 'the marker is stripped from a relative path')
assert.ok(marked.notification.navigate.endsWith('/dashboard/proposals/abc'), 'the path survives')

const kept = buildPushPayload({ title: 'Open the schedule', navigate: '/dashboard/schedule?show=meetings&launch=1' })
assert.equal(new URL(kept.notification.navigate).search, '?show=meetings', 'other params survive')

const absolute = buildPushPayload({ title: 'x', navigate: 'https://www.triprosremodeling.com/dashboard?launch=1' })
assert.equal(absolute.notification.navigate, 'https://www.triprosremodeling.com/dashboard', 'an absolute url is cleaned too')

const plain = buildPushPayload({ title: 'x', navigate: '/dashboard/customers' })
assert.ok(plain.notification.navigate.endsWith('/dashboard/customers'), 'an unmarked path is untouched')

console.log('✅ push payloads never carry the launch marker')
```

Run: `NODE_OPTIONS="--conditions=react-server" pnpm exec tsx scripts/verify-push-launch-marker.ts` — expected: the first assertion fails (the marker is still there).

- [ ] **Step 2: Guard the resolver**

In `src/shared/services/providers/web-push/lib/build-payload.ts` add `import { withoutPwaLaunchMarker } from '@/shared/domains/pwa/lib/launch-url'` after the `publicUrl` import, and replace `resolveNavigateUrl`:

```ts
// Resolve `/customers/123` -> `https://app.example.com/customers/123`. iOS
// only routes the deep link into the standalone PWA when the navigate URL
// matches the origin the PWA was installed FROM, which is why we resolve
// against `publicUrl()` (NGROK_URL in dev, prod URL in prod). The launch
// marker is dropped: the installed app's start_url carries it and the
// service worker answers that URL with the static shell, not a page.
function resolveNavigateUrl(navigate: string): string {
  return withoutPwaLaunchMarker(new URL(navigate, publicUrl())).href
}
```

- [ ] **Step 3: Run the check and the gates**

Run: `NODE_OPTIONS="--conditions=react-server" pnpm exec tsx scripts/verify-push-launch-marker.ts` — expected `✅ push payloads never carry the launch marker`.
Run: `pnpm tsc && CI=1 npx eslint src/shared/services/providers/web-push/lib/build-payload.ts scripts/verify-push-launch-marker.ts` — expected clean.

- [ ] **Step 4: Commit**

```bash
git add -- scripts/verify-push-launch-marker.ts
git commit -F - -- src/shared/services/providers/web-push/lib/build-payload.ts scripts/verify-push-launch-marker.ts <<'EOF'
fix(push): a deep link never carries the launch marker, so it is never answered with the shell

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>
EOF
```

### Task 14: The worker serves the launch shell

**Files:**
- Modify: `public/sw.js` (header comment, `install`, `activate`; new `fetch`, `message` and helper functions inserted **above** the `// ── push:` section). The three push handlers are not touched.

**Interfaces:**
- Consumes: the registration URL `?shell=1` (Task 12); the `/launch` document (Task 10); the message `{ type: 'tpr:revalidate-shell' }` (Task 12).
- Produces: Cache Storage `tpr-launch-shell` holding `https://<origin>/dashboard?launch=1` → the shell document, plus every `/_next/static/` URL it references.

- [ ] **Step 1: Replace the file's header and the install/activate handlers**

Replace everything from the top of `public/sw.js` down to (and including) the existing `activate` handler with:

```js
/* eslint-disable */
// Tri Pros service worker: push + deep-link handlers, plus the installed app's launch shell.
//
// Launch shell — the installed app's start_url is /dashboard?launch=1 (src/shared/domains/pwa/constants/launch.ts;
// the literals below mirror it, change them together). For that one navigation the worker answers from
// Cache Storage with the static /launch document and the chunks it references, precached as one set so a
// deploy can never leave a cached document pointing at chunks the server no longer has. Every other
// navigation goes to the network untouched — a push deep link is one of them. Only a production build
// registers this script with ?shell=1: a document served by a worker under `next dev` never hydrates.
//
// Three event handlers cover all the iOS PWA push paths:
//   - `push`                    → imperative fallback (iOS 16.4–18.3)
//   - `notificationclick`       → deep-link routing on every iOS version
//   - `pushsubscriptionchange`  → best-effort renewal when Apple rotates
//
// On iOS 18.4+ (Safari Declarative Web Push), the browser unwraps the
// payload natively and never invokes our `push` handler. The SW still
// runs `notificationclick` because the *click* always goes through us.

const SHELL_ON = new URL(self.location.href).searchParams.get('shell') === '1'
const LAUNCH_PATH = '/dashboard'
const LAUNCH_SEARCH = '?launch=1'
const SHELL_PATH = '/launch'
const SHELL_CACHE = 'tpr-launch-shell'
const STATIC_PREFIX = '/_next/static/'
const LAUNCH_URL = new URL(LAUNCH_PATH + LAUNCH_SEARCH, self.location.origin).href

self.addEventListener('install', (event) => {
  // Take control on first install instead of waiting for the next reload.
  self.skipWaiting()
  if (!SHELL_ON) return
  // A failed precache must never fail the install: push has to keep working.
  event.waitUntil(syncShell().catch(() => {}))
  addStaticRoutes(event)
})

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    await self.clients.claim()
    if (!SHELL_ON) return
    const keys = await caches.keys()
    await Promise.all(keys
      .filter(key => key !== SHELL_CACHE && (key.startsWith('tpr-launch-shell') || key.startsWith('app-shell-')))
      .map(key => caches.delete(key)))
    if (self.registration.navigationPreload) {
      await self.registration.navigationPreload.enable().catch(() => {})
    }
  })())
})

// Chrome 123+: the launch document and the precached chunks come from Cache Storage without starting the
// worker, and every other same-origin request goes straight to the network, so the public site never pays
// a worker boot. Safari takes the fetch handler below instead.
function addStaticRoutes(event) {
  if (typeof event.addRoutes !== 'function') return
  try {
    event.addRoutes([
      { condition: { urlPattern: { pathname: LAUNCH_PATH, search: LAUNCH_SEARCH.slice(1) }, requestMode: 'navigate' }, source: { cacheName: SHELL_CACHE } },
      { condition: { urlPattern: { pathname: STATIC_PREFIX + '*' } }, source: { cacheName: SHELL_CACHE } },
      { condition: { urlPattern: { pathname: '/*' } }, source: 'network' },
    ]).catch(() => {})
  } catch (_err) {
    // A Chrome that rejects the shape: the fetch handler covers it.
  }
}

self.addEventListener('fetch', (event) => {
  if (!SHELL_ON) return
  const { request } = event
  if (request.method !== 'GET') return
  const url = new URL(request.url)
  if (url.origin !== self.location.origin) return
  if (request.mode === 'navigate') {
    if (isLaunchNavigation(request, url)) {
      event.respondWith(serveShell(event))
    }
    // Every other navigation is left to the browser, which uses the preload response when one exists.
    return
  }
  if (url.pathname.startsWith(STATIC_PREFIX)) {
    event.respondWith(
      caches.open(SHELL_CACHE)
        .then(cache => cache.match(request))
        .then(hit => hit || fetch(request))
        .catch(() => fetch(request)),
    )
  }
})

self.addEventListener('message', (event) => {
  if (!SHELL_ON || !event.data || event.data.type !== 'tpr:revalidate-shell') return
  event.waitUntil(syncShell().catch(() => {}))
})

function isLaunchNavigation(request, url) {
  return url.pathname === LAUNCH_PATH
    && url.search === LAUNCH_SEARCH
    && !request.headers.has('rsc')
    && !request.headers.has('next-router-prefetch')
}

async function serveShell(event) {
  try {
    const cache = await caches.open(SHELL_CACHE)
    const hit = await cache.match(LAUNCH_URL)
    if (hit) {
      event.waitUntil(syncShell().catch(() => {}))
      return hit
    }
  } catch (_err) {
    // Cache Storage unavailable: the network answers, as on every launch before the shell existed.
  }
  event.waitUntil(syncShell().catch(() => {}))
  const preloaded = await event.preloadResponse
  return preloaded || fetch(event.request)
}

// The shell and the chunks it references are one set: assets go in first and the document last, so a
// launch during the swap finds a complete set or none, and the document never points at a chunk the
// cache lacks. An unchanged document costs one fetch and no writes.
async function syncShell() {
  const cache = await caches.open(SHELL_CACHE)
  const fresh = await fetchShell()
  const current = await cache.match(LAUNCH_URL)
  if (current && (await current.text()) === fresh.html) return
  const assets = staticUrls(fresh.html)
  const fetched = await Promise.all(assets.map(async (asset) => {
    if (await cache.match(asset)) return null
    const response = await fetch(asset, { credentials: 'omit' })
    if (!response.ok) throw new Error(`asset ${response.status}: ${asset}`)
    return [asset, response]
  }))
  for (const entry of fetched) {
    if (entry) await cache.put(entry[0], entry[1])
  }
  await cache.put(LAUNCH_URL, new Response(fresh.html, {
    status: 200,
    headers: { 'content-type': fresh.contentType, 'cache-control': 'no-store' },
  }))
  const keep = new Set(assets)
  const keys = await cache.keys()
  await Promise.all(keys
    .filter(key => key.url.includes(STATIC_PREFIX) && !keep.has(key.url))
    .map(key => cache.delete(key)))
}

async function fetchShell() {
  const response = await fetch(SHELL_PATH, { cache: 'reload', credentials: 'omit' })
  const contentType = response.headers.get('content-type') || ''
  if (!response.ok || response.status !== 200 || response.redirected || !contentType.includes('text/html')) {
    throw new Error(`shell ${response.status} ${contentType}`)
  }
  return { html: await response.text(), contentType }
}

// Every same-origin /_next/static URL the document references (scripts, stylesheets, fonts), with its
// ?dpl= deployment tag; HTML escapes `&` inside attributes.
function staticUrls(html) {
  const urls = new Set()
  const attribute = /(?:src|href)="(\/_next\/static\/[^"]+)"/g
  let match
  while ((match = attribute.exec(html)) !== null) {
    urls.add(new URL(match[1].replace(/&amp;/g, '&'), self.location.origin).href)
  }
  return [...urls]
}

```

The `// ── push: imperative fallback …` section and everything below it stay byte-for-byte.

- [ ] **Step 2: Prove the push handlers are untouched**

Run: `git diff public/sw.js | grep '^-' | grep -v '^---'` — expected: only lines from the old header comment, the old `install` handler and the old `activate` handler. Nothing from `addEventListener('push'`, `addEventListener('notificationclick'` or `addEventListener('pushsubscriptionchange'` and their bodies.

- [ ] **Step 3: Syntax check and a dev-server look**

Run: `node --check public/sw.js` — expected no output. Playwright MCP on the dev server: open `/dashboard`, `browser_evaluate` → `navigator.serviceWorker.getRegistrations().then(r => r.map(x => (x.active || x.installing || x.waiting)?.scriptURL))` — expected the dev URL without `?shell=1`; `caches.keys()` — expected no `tpr-launch-shell` (the shell is off under `next dev`); `browser_console_messages` — no worker errors.

- [ ] **Step 4: Commit**

```bash
git commit -F - -- public/sw.js <<'EOF'
feat(pwa): the worker answers the installed app's launch with the precached shell and its chunks; everything else stays on the network

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>
EOF
```

### Task 15: The beacon revalidates, `start_url` carries the marker, the docs catch up

**Files:**
- Modify: `src/shared/domains/pwa/ui/pwa-launch-ready.tsx`
- Modify: `src/app/manifest.ts` (`start_url`)
- Modify: `docs/codebase-conventions/app-shell.md` (`#html-theme-boot`, `#dashboard-layout-shape-fixed`)

**Interfaces:**
- Consumes: `requestShellRevalidation` (Task 12), `PWA_START_URL` (Task 2).

- [ ] **Step 1: The beacon asks for a fresh shell after a shell launch**

Replace `src/shared/domains/pwa/ui/pwa-launch-ready.tsx`:

```tsx
'use client'

import { useEffect } from 'react'
import { pwaLaunch } from '@/shared/domains/pwa/lib/launch-store'
import { requestShellRevalidation } from '@/shared/domains/pwa/lib/register-service-worker'

/**
 * Mounted in the dashboard layout outside its Suspense slots, so it fires on the layout's first commit:
 * the server has answered and its sidebar frame and route skeleton have painted under the cover. The
 * session and the page fill in afterwards behind a visible skeleton, as on any document load. `ready`
 * is a no-op on every document that is not a launch.
 *
 * The shell revalidation is asked for on every dashboard document, not only after a shell launch: on
 * Chrome the launch is answered from Cache Storage without the worker running, and after a deploy the
 * stale shell hard-loads before its own dashboard commits, so a plain dashboard load is the only moment
 * the worker can learn that the shell is stale. The worker fetches the static shell once and writes
 * nothing when it is unchanged; without a controlling worker the message is not sent.
 */
export function PwaLaunchReady() {
  useEffect(() => {
    pwaLaunch.ready()
    requestShellRevalidation()
  }, [])
  return null
}
```

- [ ] **Step 2: The marker goes on `start_url`**

In `src/app/manifest.ts` change the import to `import { PWA_LAUNCH_FIELD, PWA_START_URL } from '@/shared/domains/pwa/constants/launch'` and `start_url: ROOTS.dashboard.root,` to:

```ts
    // The marker is what the service worker answers with the launch shell; nothing else ever carries it.
    start_url: PWA_START_URL,
```

- [ ] **Step 3: The convention doc stops describing a block that no longer exists**

In `docs/codebase-conventions/app-shell.md`, under `### html-theme-boot`, replace the paragraph beginning `The intentional **always-dark** PWA cold-launch moment` with:

```markdown
The installed app's launch field is the native stage plus one overlay, never the page canvas: iOS paints a startup image from the matrix in `src/shared/domains/pwa/constants/startup-images.ts`, Android paints the manifest `background_color`, and `PwaLaunchCover` (root layout, from `src/shared/domains/pwa/ui/`) is open only in the `/launch` shell document and fades once the dashboard layout has committed. The app follows light/dark from its first paint.
```

Under `### dashboard-layout-shape-fixed`, add two lines above `<SidebarProvider>` in the JSX block (the branches below are unchanged):

```jsx
<PwaLaunchReady />                                       {/* the launch cover lifts when this layout commits */}
<ServiceWorkerRegistrar />                               {/* one registration owner; the push hook shares it */}
<SidebarProvider>                                        {/* height: 100% via CSS */}
```

- [ ] **Step 4: Gates**

Run: `pnpm tsc && CI=1 npx eslint src/shared/domains/pwa/ui/pwa-launch-ready.tsx src/app/manifest.ts` — expected clean. `curl -s http://localhost:3000/manifest.webmanifest | grep -o '"start_url":"[^"]*"'` — expected `"start_url":"/dashboard?launch=1"`.

- [ ] **Step 5: Commit**

```bash
git commit -F - -- src/shared/domains/pwa/ui/pwa-launch-ready.tsx src/app/manifest.ts docs/codebase-conventions/app-shell.md <<'EOF'
feat(pwa): the installed app launches on the marked start_url; the dashboard asks for a fresh shell once it is up

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>
EOF
```

### Task 16: Production build in an isolated worktree, browser checks, Phase 3 gate

**Files:**
- `.worktrees/launch-build/` (gitignored); nothing committed by this task except spec §11.

- [ ] **Step 1: Owner gate — the build**

If the owner has not approved the build at Task 11's stop, STOP here and ask: "Task 16 needs one `pnpm build` in `.worktrees/launch-build` (never the main tree). OK?" Continue only on a yes.

- [ ] **Step 2: Build and serve**

```bash
git worktree add --detach .worktrees/launch-build HEAD
ln -s "$PWD/.env" .worktrees/launch-build/.env 2>/dev/null; ln -s "$PWD/.env.local" .worktrees/launch-build/.env.local 2>/dev/null
cd .worktrees/launch-build && pnpm install --frozen-lockfile --prefer-offline && pnpm build
```

Expected in the build output: `/launch` marked `○` (Static). If it is `ƒ` (Dynamic), something in `LaunchShell` reads a dynamic API; find it with the build's own message and wrap or remove it before continuing.

Then, in the background: `cd .worktrees/launch-build && PORT=3020 pnpm start`. Expected `Ready` on :3020.

- [ ] **Step 3: Check 1 — the worker installs and precaches**

Playwright MCP, viewport 390×844. If `DEV_LOGIN_SECRET` can be read, open `http://localhost:3020/api/dev/playwright-session?secret=<secret>&redirect=/dashboard`; otherwise open `http://localhost:3020/dashboard` signed out. Wait 3 s. `browser_evaluate`:

```js
Promise.all([
  navigator.serviceWorker.getRegistrations().then(r => r.map(x => (x.active || x.installing || x.waiting)?.scriptURL)),
  caches.open('tpr-launch-shell').then(c => c.keys()).then(k => k.map(r => r.url)),
])
```

Expected: one script URL ending in `/sw.js?shell=1`; the key list contains `http://localhost:3020/dashboard?launch=1` and at least one `/_next/static/` URL. Count the `/_next/static/` keys and keep the number for check 2.

- [ ] **Step 4: Check 2 — the marked launch is served from cache, hands off in one document, and the cover lifts on the layout's commit**

`browser_run_code_unsafe`, the same block as Task 10 Step 8 with `page.goto('http://localhost:3020/dashboard?launch=1')` in place of the `/launch` URL (keep the init script, the 1 s RSC delay, the `waitForURL('**/dashboard')` and the `unrouteAll`). Expected: the first paint is the navy cover; the URL lands on `/dashboard`; `cover - layout` under 100 ms and, signed in, `cover < skeletonGone`; `browser_network_requests` shows the document request for `/dashboard?launch=1` fulfilled by the service worker (size from ServiceWorker, or the static route) and **no** request for `/launch`; every `/_next/static/` request of that launch came from cache or the worker; `performance.getEntriesByType('navigation').length === 1` after the handoff; no console errors, no hydration warnings. Screenshot before and after.

- [ ] **Step 5: Check 3 — nothing else is ever served the shell**

Navigate to `http://localhost:3020/dashboard` (unmarked), `http://localhost:3020/dashboard/meetings`, `http://localhost:3020/dashboard/customers?launch=0`, and `http://localhost:3020/` — expected: every document request goes to the network (not ServiceWorker), none renders the cover. Then `browser_evaluate` → `fetch('/dashboard', { headers: { rsc: '1' } }).then(r => r.headers.get('content-type'))` — expected `text/x-component…`, not HTML.

- [ ] **Step 6: Check 4 — the device switch**

`browser_evaluate` → `localStorage.setItem('tri-pros:sw-disabled', '1')`; navigate to `/dashboard`; wait 2 s; evaluate `navigator.serviceWorker.getRegistrations().then(r => r.length)` → `0` and `caches.keys()` → `[]`. Remove the key, navigate to `/dashboard` again, wait 3 s — expected one registration and the shell cache back.

- [ ] **Step 7: Check 5 — a deploy**

Change one byte in the shell (add a word inside the `LaunchShell` doc comment in the **worktree** only — never in the main tree; not a trailing space, which the build's lint rejects), rebuild in the worktree (`pnpm build`), restart `pnpm start` on :3020. Without touching the browser's storage, navigate to `http://localhost:3020/dashboard?launch=1`. Expected: the old shell is served from cache, hydrates, and one hard load of `/dashboard` (unmarked, from the network) follows; the dashboard renders. Wait 5 s, then navigate to `/dashboard?launch=1` again — expected: served from cache, no hard load (the revalidated shell matches the build). Revert the byte in the worktree.

- [ ] **Step 8: Checks 6 and 7 — signed out, reduced motion**

Signed out (never call a sign-out route from here; use a fresh browser context via `browser_run_code_unsafe` → `const ctx = await browser.newContext(); const p = await ctx.newPage(); await p.goto('http://localhost:3020/dashboard?launch=1')`): expected the cover, then the sign-in card, then the cover lifts. Reduced motion (`browser_emulate_media` `reducedMotion: 'reduce'`) on `/dashboard?launch=1`: cover present, lifts with no fade, no overlay left in the DOM.

- [ ] **Step 9: Tear down and record**

Stop the :3020 server; `git worktree remove --force .worktrees/launch-build`. Record every check's result in spec §11 (Phase 3 — browser check row) with the screenshot paths and the check 2 timings. Run `pnpm tsc && pnpm lint` in the main tree one last time.

- [ ] **Step 10: STOP — owner device checks and shipping**

Report to the owner, in this order:
1. Ship Phase 3 (owner's call). Vercel preview deployments with Deployment Protection on cannot precache (`/launch` answers 401 without cookies): test on production, or on a preview with protection off.
2. Remove and re-add the app on every device from `www.triprosremodeling.com` (the marked `start_url` and the new icons are read at install). Android: `about://webapks` → Update, or wait for the re-mint.
3. Launch #1 after re-adding goes to the network (expected). From launch #2: force-quit → tap, three times per device, light and dark, iPad in landscape too, one Android on current Chrome: the mark on navy from the first frame, the same mark in the web layer, one fade onto the dashboard skeleton the moment the server answers, the skeleton filling in, no white, no second mark.
4. Push: `pnpm push:test --to <owner email> --title "Launch check" --navigate /dashboard/customers`, tap it: the customers page opens, not the shell.
5. iOS 26 status strip: look at the top of the cover for a blur band; report it either way.
6. Chrome Canary on the Android phone, one cold launch.
7. Record in spec §11. When all rows are ✅, delete the spec, the research note and this plan in one commit (git keeps them) and close the memory entry.
