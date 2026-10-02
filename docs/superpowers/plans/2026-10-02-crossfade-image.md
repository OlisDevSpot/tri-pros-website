# CrossfadeImage (media display F1) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Every photo change shows one clean crossfade: the old photo never reappears and the frame never dips to dark. Display media lives in `modules/media/display`.

**Architecture:**
- Step 0 moves the media UI into `modules/media` and changes no behaviour.
- `OptimizedImage` then shows an already-loaded image before first paint, and keeps its blur placeholder mounted until the image has faded in over it.
- A new `CrossfadeImage` holds the image on screen until the next one is decoded off-screen, for at most 300 ms, then swaps once on the existing `AnimatePresence` pattern.
- Four surfaces adopt it.

**Tech Stack:** Next.js 15, React 19.2 (`useEffectEvent`, ref callbacks), motion 12.43 (`AnimatePresence`, `useReducedMotion`), Tailwind v4, Playwright 1.58 (local verification script only).

**Spec:** `docs/superpowers/specs/2026-09-27-crossfade-image-design.md`. Tracker: `docs/plans/2026-09-27-media-display-epic.md`.

## Global Constraints

- Names are owner-agreed (CONTEXT.md "Media display terms"): `CrossfadeImage`, `CrossfadeImageSource`, `decodeImage`, `OptimizedImageFile`, `CROSSFADE_TRANSITION`, `CROSSFADE_HOLD_MS`. Never use "stage" in new code (CONTEXT.md: Stage = pipeline stage).
- `CROSSFADE_TRANSITION = { duration: 0.4, ease: BRAND_EASE }`; `CROSSFADE_HOLD_MS = 300`.
- `CrossfadeImage` takes `{ file } | { src }`; `OptimizedImage` keeps its `file` prop (feature-layering D2 stays open).
- Display code goes to `src/shared/modules/media/display/`; management UI goes to `src/shared/modules/media/core/` (feature-layering D1 = b).
- No re-export shims. Every importer moves in the same commit as the file it imports.
- Comments say why, never what. No citations of plans, specs or tasks from code.
- Verification is `pnpm tsc` + `pnpm lint` + the trace script. There is no test runner; do not add one, and never run `pnpm build`.
- **Commits:** another session keeps files staged in the shared index. Commit ONLY with an explicit pathspec (`git commit -m … -- <paths>`). For a `git mv`, list both the old and the new path. Never `git add -A`, `git commit -a`, amend, stash, checkout or reset.
- Never write to the database to set up a test. The dev data used here already exists.
- The dev login secret must never appear in tool output: the script reads it from `.env.local` and redacts it from every error.

## Review Focus

1. **A cached image must show at once.** A photo that is already in the browser's memory cache when its `<img>` mounts must render opaque in the first painted frame: no blur placeholder, no fade. Pinned by Task 2's trace (`blurFramesWhileComplete = 0`).
2. **Rapid changes.** Five "Next photo" clicks 80 ms apart must end on the fifth photo without ever swapping back to an earlier one. Pinned by Task 3's `--rapid` run (`srcSeq` has no repeat; `activeThumbMatches: true`).
3. **A failed decode.** A broken or missing variant (404) must not freeze the photo: the swap happens immediately on the rejection, and `OptimizedImage`'s `onError` shows the broken state. Pinned in Task 3 Step 4 (the `.then(swap, swap)` reading) and its review checklist.
4. **Same image, new metadata.** When the caller passes the same image with a new `alt` (Portfolio's "photo n of m" changes per phase), there must be no crossfade, and the new `alt` must be used at once. Pinned in Task 3 Step 4 (`visible` falls back to the live props when the keys match) and checked in Task 3 Step 9.
5. **Reduced motion.** Under `prefers-reduced-motion: reduce` swaps are instant and cached images never fade. Pinned by Task 3's `--reduced-motion` run (each swap's two-layer window ≤ 1 frame, i.e. ≤ 34 ms).

---

## File Structure

| File | Responsibility |
|---|---|
| `src/shared/modules/media/display/components/optimized-image.tsx` | One media file as an `<img>` with blur placeholder (moved, then fixed in Task 2) |
| `src/shared/modules/media/display/components/crossfade-image.tsx` | NEW. Swaps images with one crossfade after decode or the hold |
| `src/shared/modules/media/display/lib/get-optimized-urls.ts` | Variant URL building (moved) |
| `src/shared/modules/media/display/lib/decode-image.ts` | NEW. Off-screen fetch + decode of one image |
| `src/shared/modules/media/core/components/{media-manager,media-card,media-reorder-grid,media-sortable-item,media-upload-button,photo-detail-dialog}.tsx` | Media management UI (moved) |
| `src/shared/modules/media/core/hooks/use-media-upload.ts` | Upload hook (moved) |
| `src/shared/modules/media/core/types.ts` | Gains `MediaItem`, `MediaGroup` |
| `src/shared/constants/motion.ts` | Gains `CROSSFADE_TRANSITION`, `CROSSFADE_HOLD_MS` |
| `src/features/meeting-flow/constants/showcase.ts` | Loses `SHOWCASE_CROSSFADE` |
| Portfolio `project-photo.tsx`, Specialties `showcase-media.tsx`, `story-before-after.tsx`, `photo-lightbox.tsx` | Adopt `CrossfadeImage` |
| `.superpowers/sdd/2026-10-02-crossfade-image/tools/trace-photo-swap.mjs` | Gitignored verification script (Task 2) |

---

### Task 1: Move the media UI into `modules/media` (no behaviour change)

**Files:**
- Move: `src/shared/components/optimized-image.tsx` → `src/shared/modules/media/display/components/optimized-image.tsx`
- Move: `src/shared/lib/get-optimized-urls.ts` → `src/shared/modules/media/display/lib/get-optimized-urls.ts`
- Move: `src/shared/components/media/{media-manager,media-card,media-reorder-grid,media-sortable-item,media-upload-button,photo-detail-dialog}.tsx` → `src/shared/modules/media/core/components/`
- Move: `src/shared/components/media/use-media-upload.ts` → `src/shared/modules/media/core/hooks/use-media-upload.ts`
- Merge then delete: `src/shared/components/media/types.ts` → appended to `src/shared/modules/media/core/types.ts`
- Modify (imports only): every file printed by Step 1, plus `src/shared/modules/media/DOCS.md:140,143` and `docs/superpowers/plans/2026-10-01-proposal-page-redesign.md:1539,1551,1799`

**Interfaces:**
- Consumes: nothing.
- Produces these import paths, used by every later task:
  - `OptimizedImage` from `@/shared/modules/media/display/components/optimized-image`
  - `getOptimizedSrc`, `getOptimizedSrcSet`, `deriveOriginalMediaUrl` from `@/shared/modules/media/display/lib/get-optimized-urls`
  - `MediaItem`, `MediaGroup` from `@/shared/modules/media/core/types`
  - `useMediaUpload` from `@/shared/modules/media/core/hooks/use-media-upload`
  - management components from `@/shared/modules/media/core/components/<file>`

- [ ] **Step 1: Preflight — record the importer list and the foreign staged files**

```bash
cd /home/olis-solutions/olis-v3/nextjs/tri-pros-website
git diff --cached --name-only          # foreign staged files: leave them alone, never commit them
grep -rlE "@/shared/components/optimized-image|@/shared/lib/get-optimized-urls|@/shared/components/media/" src scripts | sort > /tmp/media-move-importers.txt
wc -l /tmp/media-move-importers.txt    # expect 30 (24 OptimizedImage importers + 6 url-helper importers incl. optimized-image.tsx itself; the 2 media-manager consumers are among the 24); if different, list them in the report
git status --porcelain -- $(cat /tmp/media-move-importers.txt)   # must print nothing; if a file has someone else's edits, STOP and report
```

- [ ] **Step 2: Move the files**

```bash
mkdir -p src/shared/modules/media/display/components src/shared/modules/media/display/lib src/shared/modules/media/core/components src/shared/modules/media/core/hooks
git mv src/shared/components/optimized-image.tsx src/shared/modules/media/display/components/optimized-image.tsx
git mv src/shared/lib/get-optimized-urls.ts src/shared/modules/media/display/lib/get-optimized-urls.ts
for f in media-manager media-card media-reorder-grid media-sortable-item media-upload-button photo-detail-dialog; do
  git mv "src/shared/components/media/$f.tsx" "src/shared/modules/media/core/components/$f.tsx"
done
git mv src/shared/components/media/use-media-upload.ts src/shared/modules/media/core/hooks/use-media-upload.ts
{ printf '\n'; cat src/shared/components/media/types.ts; } >> src/shared/modules/media/core/types.ts
git rm -q src/shared/components/media/types.ts
ls src/shared/components/media 2>/dev/null && echo "UNEXPECTED: folder not empty"
```

- [ ] **Step 3: Rewrite the imports**

```bash
F=$(cat /tmp/media-move-importers.txt | sed \
  -e 's#^src/shared/components/optimized-image.tsx$#src/shared/modules/media/display/components/optimized-image.tsx#')
sed -i \
  -e 's#@/shared/components/optimized-image#@/shared/modules/media/display/components/optimized-image#g' \
  -e 's#@/shared/lib/get-optimized-urls#@/shared/modules/media/display/lib/get-optimized-urls#g' \
  -e 's#@/shared/components/media/types#@/shared/modules/media/core/types#g' \
  -e 's#@/shared/components/media/use-media-upload#@/shared/modules/media/core/hooks/use-media-upload#g' \
  -e 's#@/shared/components/media/\(media-[a-z-]*\)#@/shared/modules/media/core/components/\1#g' \
  $F
# the moved management components imported the old sibling './types'
sed -i "s#from './types'#from '@/shared/modules/media/core/types'#" src/shared/modules/media/core/components/*.tsx
# the pending proposal-page plan imports OptimizedImage at the old path in its code snippets
sed -i 's#@/shared/components/optimized-image#@/shared/modules/media/display/components/optimized-image#g' docs/superpowers/plans/2026-10-01-proposal-page-redesign.md
```

- [ ] **Step 4: Update the media module's DOCS.md citations**

In `src/shared/modules/media/DOCS.md`:
- line 140: `src/shared/components/media/*` → `src/shared/modules/media/core/components/*`
- line 143: `**Reference impl**: src/shared/components/media/media-manager.tsx + sibling files` → `**Reference impl**: src/shared/modules/media/core/components/media-manager.tsx + sibling files`

Change those paths only, nothing else in the file.

- [ ] **Step 5: Gate — no old path left, types and lint clean**

```bash
grep -rnE "@/shared/components/optimized-image|@/shared/lib/get-optimized-urls|@/shared/components/media/|shared/components/media/" src scripts docs/superpowers/plans/2026-10-01-proposal-page-redesign.md src/shared/modules/media/DOCS.md
# expected: no output
pnpm tsc
# expected: exit 0, no errors
pnpm lint 2>&1 | tail -5
# expected: 0 errors (warnings pre-exist; none may be in the moved files: check with the next command)
npx eslint src/shared/modules/media $(cat /tmp/media-move-importers.txt | grep -v '^src/shared/components/optimized-image.tsx$\|^src/shared/lib/get-optimized-urls.ts$')
# expected: 0 problems introduced by the move (an import-order fix from `--fix` is allowed if eslint reports perfectionist/sort-imports)
```

If `perfectionist/sort-imports` (or the antfu `import/order` equivalent) flags a rewritten import, run `npx eslint --fix` on just that file and re-run the gate.

- [ ] **Step 6: Commit with an explicit pathspec**

```bash
OLD="src/shared/components/optimized-image.tsx src/shared/lib/get-optimized-urls.ts src/shared/components/media"
NEW="src/shared/modules/media"
git add -- $NEW $(cat /tmp/media-move-importers.txt | grep -v '^src/shared/components/\|^src/shared/lib/get-optimized-urls.ts$') docs/superpowers/plans/2026-10-01-proposal-page-redesign.md
git commit -q -m "refactor(media): display media into modules/media/display, management UI into modules/media/core

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>" -- $OLD $NEW $(cat /tmp/media-move-importers.txt | grep -v '^src/shared/components/\|^src/shared/lib/get-optimized-urls.ts$') docs/superpowers/plans/2026-10-01-proposal-page-redesign.md
git show --stat HEAD | tail -5          # expect ~45 files, renames shown as renames
git diff --cached --name-only          # must equal Step 1's foreign list exactly
```

---

### Task 2: `OptimizedImage` — an already-loaded image shows at once, the blur placeholder stays until the image has faded in

**Files:**
- Create (gitignored): `.superpowers/sdd/2026-10-02-crossfade-image/tools/trace-photo-swap.mjs`
- Modify: `src/shared/modules/media/display/components/optimized-image.tsx`

**Interfaces:**
- Consumes: Task 1 paths.
- Produces:
  - `export interface OptimizedImageFile { id?: number, url: string, pathKey: string | null, bucket: string | null, optimizationStatus: string, optimizationVariants?: string[] | null, blurDataUrl?: string | null }`, exported from `optimized-image.tsx`.
  - `OptimizedImage`'s props are otherwise unchanged.
  - The trace script CLI, used by Tasks 3 and 4: `node trace-photo-swap.mjs --path <app path> --img <css> [--click <css>]… [--before <css>]… [--rapid <css>] [--reduced-motion] [--screenshot <png>]`. It prints a JSON array, one entry per action: `{ action, swaps, holdMs, minTotal, maxRebound, blurFramesWhileComplete, longestTwoLayerMs, srcSeq, finalSrc, finalAlt, activeThumbMatches?, requests }`.

- [ ] **Step 1: Write the trace script**

Create `.superpowers/sdd/2026-10-02-crossfade-image/tools/trace-photo-swap.mjs`:

```js
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { parseArgs } from 'node:util'

const ROOT = '/home/olis-solutions/olis-v3/nextjs/tri-pros-website'
const { chromium } = createRequire(`${ROOT}/package.json`)('playwright')

const { values } = parseArgs({ options: {
  'path': { type: 'string' },
  'img': { type: 'string' },
  'click': { type: 'string', multiple: true, default: [] },
  'before': { type: 'string', multiple: true, default: [] },
  'rapid': { type: 'string' },
  'reduced-motion': { type: 'boolean', default: false },
  'screenshot': { type: 'string' },
  'port': { type: 'string', default: '3000' },
} })

const secret = readFileSync(`${ROOT}/.env.local`, 'utf8').match(/^DEV_LOGIN_SECRET=["']?([^"'\n]+)/m)?.[1]
if (!secret || !values.path || !values.img) {
  console.error('usage: --path <app path> --img <css>  (and DEV_LOGIN_SECRET in .env.local)')
  process.exit(2)
}
const redact = text => String(text).split(encodeURIComponent(secret)).join('***').split(secret).join('***')

// Runs in the page: samples every frame for 2.5 s. A layer is a child of the image's host that
// carries motion's inline opacity; within it the real <img> and the blur placeholder (a data: URL).
function installSampler(imgSel) {
  const first = document.querySelector(imgSel)
  const host = first.closest('[style*="opacity"]')?.parentElement ?? first.parentElement
  const frames = []
  window.__trace = frames
  const t0 = performance.now()
  const tick = () => {
    const layers = [...host.children].filter(el => el.matches('[style*="opacity"]') && el.querySelector('img'))
    frames.push({
      t: Math.round(performance.now() - t0),
      layers: layers.map((layer) => {
        const img = layer.querySelector('img:not([src^="data:"])')
        const blur = layer.querySelector('img[src^="data:"]')
        return {
          layer: Number(getComputedStyle(layer).opacity),
          img: img ? Number(getComputedStyle(img).opacity) : 0,
          blur: blur ? Number(getComputedStyle(blur).opacity) : 0,
          complete: img?.complete ?? false,
          src: img?.currentSrc.split('/').pop() ?? '',
        }
      }),
    })
    if (performance.now() - t0 < 2500)
      requestAnimationFrame(tick)
  }
  requestAnimationFrame(tick)
}

function analyse(frames) {
  let swaps = 0
  let holdMs = null
  let minTotal = 1
  let maxRebound = 0
  let blurFramesWhileComplete = 0
  let longestTwoLayerMs = 0
  let periodStart = null
  let runningMinOld = Infinity
  const srcSeq = []
  for (const frame of frames) {
    const shown = frame.layers.map(l => l.layer * Math.max(l.img, l.blur))
    const total = 1 - shown.reduce((rest, a) => rest * (1 - a), 1)
    minTotal = Math.min(minTotal, total)
    const newest = frame.layers.at(-1)
    if (newest && newest.src && srcSeq.at(-1) !== newest.src)
      srcSeq.push(newest.src)
    if (newest && newest.complete && newest.blur > 0.05 && newest.img < 0.95)
      blurFramesWhileComplete++
    if (frame.layers.length >= 2) {
      if (periodStart === null) {
        periodStart = frame.t
        swaps++
        holdMs ??= frame.t
        runningMinOld = Infinity
      }
      const older = 1 - shown.slice(0, -1).reduce((rest, a) => rest * (1 - a), 1)
      const old = older * (1 - shown.at(-1))
      runningMinOld = Math.min(runningMinOld, old)
      maxRebound = Math.max(maxRebound, old - runningMinOld)
      longestTwoLayerMs = Math.max(longestTwoLayerMs, frame.t - periodStart)
    }
    else {
      periodStart = null
    }
  }
  const round = n => Math.round(n * 100) / 100
  return { swaps, holdMs, minTotal: round(minTotal), maxRebound: round(maxRebound), blurFramesWhileComplete, longestTwoLayerMs, srcSeq, finalSrc: srcSeq.at(-1) ?? null }
}

const browser = await chromium.launch()
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, reducedMotion: values['reduced-motion'] ? 'reduce' : 'no-preference' })
  const cdp = await page.context().newCDPSession(page)
  await cdp.send('Network.enable')
  const requests = []
  cdp.on('Network.requestWillBeSent', (e) => {
    if (e.request.url.includes('media.triprosremodeling.com'))
      requests.push({ id: e.requestId, url: e.request.url.split('/').pop(), cache: 'net' })
  })
  cdp.on('Network.requestServedFromCache', (e) => {
    const r = requests.find(x => x.id === e.requestId)
    if (r)
      r.cache = 'mem'
  })

  await page.goto(`http://localhost:${values.port}/api/dev/playwright-session?secret=${encodeURIComponent(secret)}&redirect=${encodeURIComponent(values.path)}`, { timeout: 150_000, waitUntil: 'commit' })
  await page.waitForSelector(values.img, { state: 'attached', timeout: 150_000 })
  for (let i = 0; i < 20 && await page.$('[data-splash="true"]'); i++) {
    await page.mouse.click(720, 450).catch(() => {})
    await page.waitForTimeout(1500)
  }
  for (const selector of values.before) {
    await page.locator(selector).first().click({ timeout: 15_000 })
    await page.waitForTimeout(1500)
  }
  await page.waitForTimeout(3000)

  const results = []
  const trace = async (action, run) => {
    const from = requests.length
    await page.evaluate(installSampler, values.img)
    await run()
    await page.waitForTimeout(2600)
    const result = { action, ...analyse(await page.evaluate(() => window.__trace)) }
    result.finalAlt = await page.evaluate(sel => [...document.querySelectorAll(sel)].at(-1)?.alt ?? null, values.img)
    result.requests = requests.slice(from).map(r => `${r.url} [${r.cache}]`)
    results.push(result)
    return result
  }

  for (const selector of values.click)
    await trace(`click ${selector}`, () => page.locator(selector).first().click({ timeout: 10_000 }))

  if (values.rapid) {
    const result = await trace(`rapid x5 ${values.rapid}`, async () => {
      for (let i = 0; i < 5; i++) {
        await page.locator(values.rapid).first().click({ timeout: 10_000 })
        await page.waitForTimeout(80)
      }
    })
    const base = name => name?.replace(/-(xs|sm|md|lg)\.webp$/, '').replace(/\.[a-z]+$/i, '')
    const activeThumb = await page.evaluate(() => document.querySelector('button[aria-current="true"] img:not([src^="data:"])')?.currentSrc.split('/').pop() ?? null)
    result.activeThumbMatches = activeThumb !== null && base(activeThumb) === base(result.finalSrc)
  }

  if (values.screenshot)
    await page.screenshot({ path: values.screenshot })
  console.log(JSON.stringify(results, null, 1))
}
catch (error) {
  console.error(redact(error?.stack ?? error))
  process.exitCode = 1
}
finally {
  await browser.close()
}
```

- [ ] **Step 2: Run it against today's code (the failing baseline)**

Preflight: `ss -ltnp | grep ':3000'` must show a `next-server`. If none is running, start `pnpm dev` in the background and wait until `curl -s -o /dev/null -w '%{http_code}' http://localhost:3000/` prints `200` or `307`.

```bash
T=.superpowers/sdd/2026-10-02-crossfade-image/tools/trace-photo-swap.mjs
node $T --path '/dashboard/meetings/cd8b5810-8d60-4917-baab-fdd78c1636a4?step=3' --img 'img[sizes="100vw"]' \
  --click 'button[aria-label="Next photo"]' --click 'button[aria-label="Next photo"]' 2>&1 | grep -v 'secret='
```

The output is a JSON array with two entries, one per click. Expected FAIL, the bug, for each click:
- `maxRebound` ≥ 0.5 (the old photo comes back)
- `minTotal` ≤ 0.4 (the dark dip)
- `blurFramesWhileComplete` ≥ 1

Paste the two entries into the task report as the baseline. If meeting `cd8b5810-8d60-4917-baab-fdd78c1636a4` 404s, pick any meeting from `/dashboard/meetings` (any meeting's Portfolio step shows projects), use it everywhere this plan names the meeting, and say so in the report.

- [ ] **Step 3: Export the file type and check `complete` before first paint**

In `src/shared/modules/media/display/components/optimized-image.tsx`, replace the props block and the hooks above `const src = …`.

Old:

```tsx
import { LoaderIcon, RefreshCwIcon } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'

import { getOptimizedSrc, getOptimizedSrcSet } from '@/shared/modules/media/display/lib/get-optimized-urls'
import { cn } from '@/shared/lib/utils'

interface OptimizedImageProps {
  file: {
    id?: number
    url: string
    pathKey: string | null
    bucket: string | null
    optimizationStatus: string
    optimizationVariants?: string[] | null
    blurDataUrl?: string | null
  }
```

New:

```tsx
import { LoaderIcon, RefreshCwIcon } from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'

import { getOptimizedSrc, getOptimizedSrcSet } from '@/shared/modules/media/display/lib/get-optimized-urls'
import { cn } from '@/shared/lib/utils'

export interface OptimizedImageFile {
  id?: number
  url: string
  pathKey: string | null
  bucket: string | null
  optimizationStatus: string
  optimizationVariants?: string[] | null
  blurDataUrl?: string | null
}

interface OptimizedImageProps {
  file: OptimizedImageFile
```

(Keep the import order eslint wants; if it reorders `@/shared/lib/utils` above the media import, accept the `--fix`.)

Old:

```tsx
  const [loaded, setLoaded] = useState(false)
  const [timedOut, setTimedOut] = useState(false)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const imgRef = useRef<HTMLImageElement>(null)

  // SSR'd images can finish loading before hydration attaches onLoad — the
  // event never replays, so catch up from img.complete on mount. Without this
  // the blur placeholder sticks over an already-downloaded image.
  useEffect(() => {
    if (imgRef.current?.complete) {
      setLoaded(true)
    }
  }, [])
```

New:

```tsx
  const [loaded, setLoaded] = useState(false)
  const [loadedAtMount, setLoadedAtMount] = useState(false)
  const [timedOut, setTimedOut] = useState(false)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // A ref callback runs in the commit, before the browser paints, so an image the browser already
  // holds (cached, or SSR'd and loaded before hydration attached onLoad) is shown in the first frame
  // instead of flashing its blur placeholder and fading in. Stable identity: it runs once, on mount.
  const catchUpIfLoaded = useCallback((img: HTMLImageElement | null) => {
    if (img?.complete) {
      setLoaded(true)
      setLoadedAtMount(true)
    }
  }, [])
```

- [ ] **Step 4: Keep the blur placeholder mounted, skip transitions for an already-loaded image, respect reduced motion**

Replace the blur placeholder and the real `<img>` blocks.

Old:

```tsx
      {/* Blur placeholder — shown while loading, optionally persists as background behind image */}
      {isOptimized && file.blurDataUrl && (!loaded || persistBlur) && (
        <img
          src={file.blurDataUrl}
          alt=""
          aria-hidden
          className={cn(
            'absolute inset-0 z-0 h-full w-full object-cover scale-110 blur-xl transition-opacity duration-500',
            loaded && persistBlur ? 'opacity-40' : loaded ? 'opacity-0' : 'opacity-100',
          )}
        />
      )}

      {/* Real image — ALWAYS shown, z-10 to sit above blur */}
      <img
        ref={imgRef}
```

New:

```tsx
      {/* Stays mounted under the image until it has faded in: unmounting it on load leaves the container empty for the fade's first frames. */}
      {isOptimized && file.blurDataUrl && (persistBlur || !loadedAtMount) && (
        <img
          src={file.blurDataUrl}
          alt=""
          aria-hidden
          className={cn(
            'absolute inset-0 z-0 h-full w-full object-cover scale-110 blur-xl',
            !loadedAtMount && 'transition-opacity duration-500 motion-reduce:transition-none',
            loaded && persistBlur ? 'opacity-40' : loaded ? 'opacity-0' : 'opacity-100',
          )}
        />
      )}

      <img
        ref={catchUpIfLoaded}
```

and in the same `<img>`, old:

```tsx
        className={cn(
          'relative z-10 h-full w-full object-cover transition-opacity duration-300',
          isOptimized && file.blurDataUrl && !loaded ? 'opacity-0' : 'opacity-100',
          className,
        )}
```

New:

```tsx
        className={cn(
          'relative z-10 h-full w-full object-cover',
          !loadedAtMount && 'transition-opacity duration-300 motion-reduce:transition-none',
          isOptimized && file.blurDataUrl && !loaded ? 'opacity-0' : 'opacity-100',
          className,
        )}
```

Leave everything else as it is: the timeout effect, `handleRetry`, the badges. `useEffect` is still imported for the timeout effect.

- [ ] **Step 5: Type-check and lint**

```bash
pnpm tsc
npx eslint src/shared/modules/media/display/components/optimized-image.tsx
```

Expected: `pnpm tsc` exits 0; eslint reports 0 problems.

- [ ] **Step 6: Re-run the trace (the "test passes" step for cached swaps)**

```bash
node $T --path '/dashboard/meetings/cd8b5810-8d60-4917-baab-fdd78c1636a4?step=3' --img 'img[sizes="100vw"]' \
  --click 'button[aria-label="Next photo"]' --click 'button[aria-label="Next photo"]' 2>&1 | grep -v 'secret='
```

Expected for both clicks:
- `blurFramesWhileComplete: 0`
- `maxRebound` ≤ 0.05
- `minTotal` ≥ 0.7

The crossfade is still the old one, which fades both layers at once, so the frame still dips to ~0.75 at the midpoint. Task 3's crossfade keeps the outgoing image opaque underneath and lifts this to ≥ 0.95. If `blurFramesWhileComplete` is still > 0, the cached image was not `complete` at commit. STOP and report the frames: do not add timers or retries.

- [ ] **Step 7: Commit**

```bash
git add -- src/shared/modules/media/display/components/optimized-image.tsx
git commit -q -m "fix(media): OptimizedImage shows an already-loaded image at once; blur placeholder stays until the image has faded in

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>" -- src/shared/modules/media/display/components/optimized-image.tsx
```

---

### Task 3: `CrossfadeImage` + `decodeImage` + constants; Portfolio and Specialties adopt it

**Files:**
- Create: `src/shared/modules/media/display/lib/decode-image.ts`
- Create: `src/shared/modules/media/display/components/crossfade-image.tsx`
- Modify: `src/shared/constants/motion.ts` (append)
- Modify: `src/features/meeting-flow/constants/showcase.ts` (delete `SHOWCASE_CROSSFADE`)
- Modify: `src/features/meeting-flow/ui/components/steps/portfolio/project-photo.tsx`
- Modify: `src/features/meeting-flow/ui/components/steps/specialties/showcase-media.tsx`

**Interfaces:**
- Consumes: `OptimizedImage`, `OptimizedImageFile` (Task 2), `getOptimizedSrc`, `getOptimizedSrcSet` (Task 1).
- Produces:
  - `decodeImage(source: { src: string, srcSet?: string, sizes?: string }): Promise<void>`
  - `CrossfadeImage(props: { image: CrossfadeImageSource, alt: string, sizes: string, className?: string, persistBlur?: boolean, priority?: boolean })`
  - `type CrossfadeImageSource = { file: OptimizedImageFile } | { src: string }`
  - `CROSSFADE_TRANSITION`, `CROSSFADE_HOLD_MS` from `@/shared/constants/motion`

- [ ] **Step 1: Add the constants**

Append to `src/shared/constants/motion.ts`, after `BRAND_EASE`; the literal below reads `BRAND_EASE` at module load, so it must come after it:

```ts

/** The photo crossfade: opacity only, the brand curve. */
export const CROSSFADE_TRANSITION = { duration: 0.4, ease: BRAND_EASE } as const

/** How long a photo change waits for the next image to decode before showing its blur placeholder instead. */
export const CROSSFADE_HOLD_MS = 300
```

- [ ] **Step 2: Write `decodeImage`**

Create `src/shared/modules/media/display/lib/decode-image.ts`:

```ts
/**
 * Fetches and decodes one image off-screen. `sizes` is set before `srcset` and `src` so the browser
 * picks the same variant the page's own <img> with that `sizes` will pick, and serves it from cache.
 */
export function decodeImage({ src, srcSet, sizes }: { src: string, srcSet?: string, sizes?: string }): Promise<void> {
  const image = new window.Image()
  if (sizes) {
    image.sizes = sizes
  }
  if (srcSet) {
    image.srcset = srcSet
  }
  image.src = src
  return image.decode()
}
```

- [ ] **Step 3: Write `CrossfadeImage`**

Create `src/shared/modules/media/display/components/crossfade-image.tsx`:

```tsx
'use client'

import type { OptimizedImageFile } from '@/shared/modules/media/display/components/optimized-image'
import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import Image from 'next/image'
import { useEffect, useEffectEvent, useState } from 'react'
import { CROSSFADE_HOLD_MS, CROSSFADE_TRANSITION } from '@/shared/constants/motion'
import { OptimizedImage } from '@/shared/modules/media/display/components/optimized-image'
import { decodeImage } from '@/shared/modules/media/display/lib/decode-image'
import { getOptimizedSrc, getOptimizedSrcSet } from '@/shared/modules/media/display/lib/get-optimized-urls'

export type CrossfadeImageSource = { file: OptimizedImageFile } | { src: string }

interface CrossfadeImageProps {
  image: CrossfadeImageSource
  alt: string
  sizes: string
  /** Applied to the <img>: `object-cover` / `object-contain`. */
  className?: string
  persistBlur?: boolean
  priority?: boolean
}

interface ShownImage {
  image: CrossfadeImageSource
  alt: string
}

function imageKey(image: CrossfadeImageSource): string {
  return 'file' in image ? getOptimizedSrc(image.file) : image.src
}

function decode(image: CrossfadeImageSource, sizes: string): Promise<void> {
  if ('src' in image) {
    return decodeImage({ src: image.src })
  }
  const srcSet = getOptimizedSrcSet(image.file)
  return decodeImage({ src: getOptimizedSrc(image.file), srcSet, sizes: srcSet ? sizes : undefined })
}

/**
 * One image at a time, filling its positioned parent. A new image replaces the shown one with a
 * single crossfade once it is decoded, so the swap never lands on a blank or half-loaded frame; if
 * decoding outlasts the hold, it swaps anyway and the new image's blur placeholder sharpens in place.
 */
export function CrossfadeImage({ image, alt, sizes, className, persistBlur = false, priority = false }: CrossfadeImageProps) {
  const [shown, setShown] = useState<ShownImage>({ image, alt })
  const reduceMotion = useReducedMotion()
  const nextKey = imageKey(image)
  const shownKey = imageKey(shown.image)
  // Same image, fresher props (alt text, optimization status): render the live ones without a swap.
  const visible = nextKey === shownKey ? { image, alt } : shown

  const showNext = useEffectEvent(() => setShown({ image, alt }))
  const decodeNext = useEffectEvent(() => decode(image, sizes))

  useEffect(() => {
    if (nextKey === shownKey) {
      return
    }
    let pending = true
    const swap = () => {
      if (pending) {
        pending = false
        clearTimeout(timer)
        showNext()
      }
    }
    const timer = setTimeout(swap, CROSSFADE_HOLD_MS)
    // A failed decode (missing variant) swaps at once; OptimizedImage shows the broken image's own state.
    decodeNext().then(swap, swap)
    return () => {
      pending = false
      clearTimeout(timer)
    }
  }, [nextKey, shownKey])

  const transition = reduceMotion ? { duration: 0 } : CROSSFADE_TRANSITION

  return (
    <AnimatePresence initial={false}>
      <motion.div
        key={shownKey}
        animate={{ opacity: 1 }}
        className="absolute inset-0"
        // The outgoing image stays opaque under the incoming one until that has fully faded in; fading
        // both at once lets the background show through mid-way (a quarter of the frame at the midpoint).
        exit={{ opacity: 0, transition: { duration: 0, delay: transition.duration } }}
        initial={{ opacity: 0 }}
        transition={transition}
      >
        {'file' in visible.image
          ? <OptimizedImage alt={visible.alt} className={className} fill file={visible.image.file} persistBlur={persistBlur} priority={priority} sizes={sizes} />
          : <Image alt={visible.alt} className={className} fill priority={priority} sizes={sizes} src={visible.image.src} />}
      </motion.div>
    </AnimatePresence>
  )
}
```

`key={shownKey}` deliberately uses the shown image's key, not `visible`'s: they are equal whenever `visible` uses the live props. The exit relies on `AnimatePresence` keeping the outgoing layer *before* the incoming one in the DOM (so the incoming one paints on top); the baseline trace confirmed that order.

- [ ] **Step 4: Check the edge cases by reading the code (Review Focus 3 and 4)**

Confirm in the file you just wrote, and quote the lines in the report:
- (a) A rejected `decodeNext()` calls `swap`: `.then(swap, swap)`.
- (b) A newer `image` runs the effect cleanup (`pending = false`) before the next effect starts, so a late decode from the older change cannot swap.
- (c) When `nextKey === shownKey`, the effect returns early and `visible` uses the live `alt`, so no crossfade and no stale `alt`.

- [ ] **Step 5: Portfolio adopts it**

Replace `src/features/meeting-flow/ui/components/steps/portfolio/project-photo.tsx` with:

```tsx
'use client'

import type { ProjectMediaFile } from '@/shared/db/schema'
import { PORTFOLIO_COPY } from '@/features/meeting-flow/constants/portfolio-step'
import { usePreloadPhoto } from '@/features/meeting-flow/hooks/use-preload-photo'
import { CrossfadeImage } from '@/shared/modules/media/display/components/crossfade-image'

interface ProjectPhotoProps {
  file: ProjectMediaFile
  alt: string
  /** The photo Space shows next; fetched now so the crossfade never lands on a blank frame. */
  upcoming: ProjectMediaFile | null
  canAdvance: boolean
  onAdvance: () => void
}

export function ProjectPhoto({ file, alt, upcoming, canAdvance, onAdvance }: ProjectPhotoProps) {
  usePreloadPhoto(upcoming)

  return (
    <>
      <CrossfadeImage alt={alt} className="object-cover" image={{ file }} priority sizes="100vw" />
      {/* Empty overlay: a labelled button whose children are presentational would swallow the photo's own alt text from screen readers. */}
      <button
        aria-label={PORTFOLIO_COPY.nextPhoto}
        className="absolute inset-0 cursor-pointer outline-none focus-visible:outline-2 focus-visible:-outline-offset-4 focus-visible:outline-white disabled:cursor-default"
        disabled={!canAdvance}
        type="button"
        onClick={onAdvance}
      />
    </>
  )
}
```

Before replacing, diff the current file against the old block quoted in the spec (§6). If the overlay `<button>`'s classes differ from the ones above (another session's theme work), keep the current classes and change only the photo part.

- [ ] **Step 6: Specialties adopts it**

In `src/features/meeting-flow/ui/components/steps/specialties/showcase-media.tsx`:
- Replace the imports of `AnimatePresence, motion`, `next/image`, `SHOWCASE_CROSSFADE` and `OptimizedImage` with `import { CrossfadeImage } from '@/shared/modules/media/display/components/crossfade-image'`.
- Replace the whole `<AnimatePresence initial={false}>…</AnimatePresence>` block with:

```tsx
      <CrossfadeImage
        alt={media.caption}
        className="object-cover"
        image={media.kind === 'project' ? { file: media.file } : { src: media.photo.src }}
        priority
        sizes="(min-width: 1024px) 60vw, 100vw"
      />
```

- Replace the component's doc comment, which cites a spec and describes the old keying, with:

```tsx
/** The scrim is tall and dense in the band layout (text sits on it) and short at two columns (only the caption). */
```

Keep the scrim `<div>` and the caption `<p>` exactly as they are.

- [ ] **Step 7: Delete `SHOWCASE_CROSSFADE`**

In `src/features/meeting-flow/constants/showcase.ts`, delete these two lines:

```ts
/** Showcase photo crossfade: opacity only, the brand easing (`--ease-brand`), 400ms (`--dur-base`). */
export const SHOWCASE_CROSSFADE = { duration: 0.4, ease: [0.32, 0.72, 0, 1] } as const
```

plus the blank line that follows them. Then confirm the constant is gone everywhere:

```bash
grep -rn "SHOWCASE_CROSSFADE" src
# expected: no output
```

- [ ] **Step 8: Type-check and lint**

```bash
pnpm tsc
npx eslint src/shared/constants/motion.ts src/shared/modules/media/display src/features/meeting-flow/constants/showcase.ts src/features/meeting-flow/ui/components/steps/portfolio/project-photo.tsx src/features/meeting-flow/ui/components/steps/specialties/showcase-media.tsx
```

Expected: `pnpm tsc` exits 0; eslint reports 0 problems. In particular, there must be no `react-hooks/exhaustive-deps` warning on `crossfade-image.tsx`: effect events are not dependencies.

- [ ] **Step 8b: Re-read Global Constraints and Review Focus against the diff**

`git diff HEAD -- <this task's files>`: no "stage" in new names, no spec or plan citations in comments, `CROSSFADE_HOLD_MS` used rather than a bare `300`.

- [ ] **Step 9: Trace Portfolio — cached, uncached, rapid**

```bash
M='/dashboard/meetings/cd8b5810-8d60-4917-baab-fdd78c1636a4?step=3'
node $T --path "$M" --img 'img[sizes="100vw"]' \
  --click 'button[aria-label="Next photo"]' --click 'button[aria-label="Next photo"]' \
  --click 'button[aria-label*="photos"] >> nth=-1' \
  --click 'button[aria-label*=" photo "][aria-label*=" of "] >> nth=-1' \
  --rapid 'button[aria-label="Next photo"]' 2>&1 | grep -v 'secret='
```

Expected:
- **Both "Next photo" clicks (cached):** `maxRebound` ≤ 0.02, `minTotal` ≥ 0.95, `blurFramesWhileComplete` 0, `swaps` 1.
- **Story-phase jump and last-thumbnail jump (uncached):**
  - `holdMs` ≤ 350.
  - `minTotal` ≥ 0.95.
  - `swaps` 1.
  - Their `requests` show the `-lg.webp` (or original) fetched on the click.
- **Rapid:** `srcSeq` has no file name twice, and `activeThumbMatches: true`.
- **Review Focus 4:** the story-phase jump's `finalAlt` names the last story phase and reads `photo 1 of N`, and the last-thumbnail jump's `finalAlt` reads `photo N of N` in that same phase. That shows the live `alt` follows the photo.

- [ ] **Step 10: Trace Portfolio under reduced motion**

```bash
node $T --path "$M" --img 'img[sizes="100vw"]' --reduced-motion \
  --click 'button[aria-label="Next photo"]' --click 'button[aria-label="Next photo"]' 2>&1 | grep -v 'secret='
```

Expected for each click: `longestTwoLayerMs` ≤ 34 and `blurFramesWhileComplete` 0.

- [ ] **Step 11: Trace Specialties (curated trade photo → project photo, uncached)**

```bash
node $T --path '/dashboard/meetings/cd8b5810-8d60-4917-baab-fdd78c1636a4?step=2' \
  --img 'section[aria-labelledby] div[style*="opacity"] img:not([src^="data:"]):not([sizes="72px"])' \
  --click 'button:has(img[sizes="72px"]) >> nth=0' --screenshot /tmp/specialties-after.png 2>&1 | grep -v 'secret='
```

Expected: `swaps` 1, `holdMs` ≤ 350, `minTotal` ≥ 0.95, `maxRebound` ≤ 0.02. Open `/tmp/specialties-after.png`: the project photo fills the photo column with the scrim and caption over it, as before.

If any expectation fails, STOP and report the full JSON. Do not tune the thresholds.

- [ ] **Step 12: Commit**

```bash
FILES="src/shared/constants/motion.ts src/shared/modules/media/display/lib/decode-image.ts src/shared/modules/media/display/components/crossfade-image.tsx src/features/meeting-flow/constants/showcase.ts src/features/meeting-flow/ui/components/steps/portfolio/project-photo.tsx src/features/meeting-flow/ui/components/steps/specialties/showcase-media.tsx"
git add -- $FILES
git commit -q -m "feat(media): CrossfadeImage — one crossfade per photo change, after decode or a 300 ms hold; Portfolio and Specialties adopt it

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>" -- $FILES
```

---

### Task 4: The project page's before/after slider and lightbox adopt `CrossfadeImage`; close out F1

**Files:**
- Modify: `src/features/project-management/ui/components/story-before-after.tsx`
- Modify: `src/features/project-management/ui/components/photo-lightbox.tsx`
- Modify: `docs/plans/2026-09-27-media-display-epic.md` (F1 status and log)

**Interfaces:**
- Consumes: `CrossfadeImage` (Task 3); trace script CLI (Task 2).
- Produces: nothing new.

- [ ] **Step 1: Baseline trace of the before/after slider (expected to show the bug)**

```bash
P='/portfolio/projects/travertine'
BA='img[sizes="(max-width: 768px) 100vw, (max-width: 1280px) 80vw, 1200px"]'
node $T --path "$P" --img "$BA" --click '[data-slot="badge"].cursor-pointer >> nth=1' --click '[data-slot="badge"].cursor-pointer >> nth=2' 2>&1 | grep -v 'secret='
```

Record the JSON (the `--img` selector matches the before side first). Expect `minTotal` < 0.95 or `blurFramesWhileComplete` > 0 on at least one click. If `travertine` has no pair badges on dev, use `picasso` or `eclipse` (≥ 10 pairs each) and say so.

- [ ] **Step 2: Before/after slider adopts it**

In `src/features/project-management/ui/components/story-before-after.tsx`, replace the `itemOne` block.

Old:

```tsx
              <div className="relative h-full w-full">
                <AnimatePresence mode="popLayout">
                  <motion.div
                    key={activePair.before.id}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.3 }}
                    className="absolute inset-0"
                  >
                    <OptimizedImage
                      file={activePair.before}
                      alt={`${activePair.label} — Before`}
                      fill
                      sizes="(max-width: 768px) 100vw, (max-width: 1280px) 80vw, 1200px"
                      priority={activePairIndex === 0}
                    />
                  </motion.div>
                </AnimatePresence>
              </div>
```

New:

```tsx
              <div className="relative h-full w-full">
                <CrossfadeImage
                  alt={`${activePair.label} — Before`}
                  image={{ file: activePair.before }}
                  priority={activePairIndex === 0}
                  sizes="(max-width: 768px) 100vw, (max-width: 1280px) 80vw, 1200px"
                />
              </div>
```

Replace the `itemTwo` block the same way, writing it out in full:

```tsx
              <div className="relative h-full w-full">
                <CrossfadeImage
                  alt={`${activePair.label} — After`}
                  image={{ file: activePair.after }}
                  priority={activePairIndex === 0}
                  sizes="(max-width: 768px) 100vw, (max-width: 1280px) 80vw, 1200px"
                />
              </div>
```

Imports:
- `import { AnimatePresence, motion, useInView } from 'motion/react'` becomes `import { motion, useInView } from 'motion/react'`; `motion.div` is still used for the header and the pills.
- Replace `import { OptimizedImage } from '@/shared/modules/media/display/components/optimized-image'` with `import { CrossfadeImage } from '@/shared/modules/media/display/components/crossfade-image'`, after checking with `grep -n "OptimizedImage" <file>` that no other `OptimizedImage` use remains. If one does, keep both imports.

- [ ] **Step 3: Lightbox adopts it**

In `src/features/project-management/ui/components/photo-lightbox.tsx`, replace the main image block.

Old:

```tsx
          <motion.div
            key={photo.id}
            initial={{ opacity: 0, scale: 0.97 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.2 }}
            className="relative mx-auto h-full w-full max-w-4xl overflow-hidden rounded-lg"
          >
            <OptimizedImage
              file={photo}
              alt={photo.name}
              fill
              persistBlur
              className="object-contain"
              sizes="(max-width: 896px) 100vw, 896px"
              priority
            />
          </motion.div>
```

New:

```tsx
          <div className="relative mx-auto h-full w-full max-w-4xl overflow-hidden rounded-lg">
            <CrossfadeImage
              alt={photo.name}
              className="object-contain"
              image={{ file: photo }}
              persistBlur
              priority
              sizes="(max-width: 896px) 100vw, 896px"
            />
          </div>
```

Add `import { CrossfadeImage } from '@/shared/modules/media/display/components/crossfade-image'`.
- Keep the `OptimizedImage` import: the thumbnail strip still uses it.
- Keep `AnimatePresence, motion`: the overlay's own fade still uses them.

- [ ] **Step 4: Type-check and lint**

```bash
pnpm tsc
npx eslint src/features/project-management/ui/components/story-before-after.tsx src/features/project-management/ui/components/photo-lightbox.tsx
```

Expected: `pnpm tsc` exits 0; eslint reports 0 problems (no unused imports).

- [ ] **Step 5: Trace the slider and the lightbox, with screenshots**

```bash
node $T --path "$P" --img "$BA" --click '[data-slot="badge"].cursor-pointer >> nth=1' --click '[data-slot="badge"].cursor-pointer >> nth=2' --click '[data-slot="badge"].cursor-pointer >> nth=1' --screenshot /tmp/before-after.png 2>&1 | grep -v 'secret='
node $T --path "$P" --img 'img[sizes="(max-width: 896px) 100vw, 896px"]' --before 'button.aspect-4\/3 >> nth=0' \
  --click 'button[aria-label="Next photo"]' --click 'button[aria-label="Next photo"]' --click 'button[aria-label="Previous photo"]' --screenshot /tmp/lightbox.png 2>&1 | grep -v 'secret='
```

Expected:
- **Slider:** every click `minTotal` ≥ 0.95 and `maxRebound` ≤ 0.02; the third click (back to pair 1, cached) has `blurFramesWhileComplete` 0.
- **Lightbox:** every click `minTotal` ≥ 0.95; the "Previous photo" click (cached) has `blurFramesWhileComplete` 0.
- **`/tmp/lightbox.png`:** the photo is letterboxed (`object-contain`) with the soft blur placeholder visible behind it, and no zoom.
- **`/tmp/before-after.png`:** the slider shows the selected pair.

If the gallery button selector `button.aspect-4\/3` matches nothing, use `section button:has(img) >> nth=0` inside the gallery and say so.

- [ ] **Step 6: Confirm the old pattern is gone**

```bash
for f in $(grep -rl "OptimizedImage" src --include=*.tsx); do grep -q "AnimatePresence" "$f" && echo "$f"; done
```

Expected: only `src/features/project-management/ui/components/portfolio-project-card.tsx`, `src/features/landing/ui/components/portfolio/project-card.tsx` and `src/features/project-management/ui/components/photo-lightbox.tsx`. The first two animate an overlay, not the image; the lightbox's `AnimatePresence` is its open/close fade. Open each and confirm that none keys an `OptimizedImage` on a photo id.

- [ ] **Step 7: Update the tracker**

In `docs/plans/2026-09-27-media-display-epic.md`:
- F1's status cell `🟦` → `🟩`.
- Append to `## Log`:

```markdown
- 2026-10-02 — F1 done: `OptimizedImage` shows an already-loaded image at once and keeps its blur placeholder until the image has faded in; `CrossfadeImage` (hold ≤ 300 ms for decode, then one crossfade) on Portfolio, Specialties, the before/after slider and the lightbox. Media UI moved into `modules/media/{display,core}`. Trace before → after (Portfolio cached Space): maxRebound <baseline> → <after>, minTotal <baseline> → <after>. Next: F2.
```

Fill the four numbers from Task 2 Step 2 (baseline) and Task 3 Step 9 (after).

- [ ] **Step 8: Commit**

```bash
FILES="src/features/project-management/ui/components/story-before-after.tsx src/features/project-management/ui/components/photo-lightbox.tsx docs/plans/2026-09-27-media-display-epic.md"
git add -- $FILES
git commit -q -m "feat(media): the project page's before/after slider and lightbox crossfade through CrossfadeImage

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>" -- $FILES
```

---

## After the last task

- `CONTEXT.md` holds the "Media display terms" section (owner-agreed 2026-09-27) but is not committed: another session has uncommitted edits in the same file. The controller commits that section on its own once that session's edits are in, or tells the owner.
- Delete this plan and the spec once F1 has shipped (CLAUDE.md), and keep the tracker: F2–F4 and N1 are still open.
