# ShowcaseReel v5 Baseline Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Raise the default quality of every showcase-ads reel: inverted-reveal hook, logo dock intro, gapless 3-word caption pages, and a second before→after morph — per approved spec `docs/superpowers/specs/2026-07-09-showcase-reel-v5-baseline-design.md`.

**Architecture:** All rendering stays in the self-contained Remotion package at `video/` (own node_modules/tsconfig, excluded from root tsc/eslint). New creative = new committed props JSON (`video/props/kitchens-showcase-reel-02.json`); generated media stays gitignored under `video/public/`. One new pure-TS module (`paginate-captions.ts`) carries the only unit-testable logic; components stay thin.

**Tech Stack:** Remotion 4 (zod schema props), whisper.cpp via `video/scripts/transcribe.mjs`, Higgsfield CLI (`seedance_2_0`, `text2speech_v2`), `tsx --test` + `node:test` for the pager tests.

## Global Constraints

- Work on `main`; stage explicitly by path (never `git add -A`); commit messages end with `Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>`.
- Verify with `cd video && pnpm tsc` (NEVER `pnpm build`). Root `pnpm lint` ignores `video/**`.
- `video/public/*` is gitignored except `brand/`; renders are never committed; props JSON is the committed source of truth.
- Truthfulness: the Travertine morph uses a genuine same-room pair from `projects.before_after_pairs_json` only.
- Voice = **Gia** (`text2speech_v2 --variant elevenlabs`); generation credits are NOT a constraint (<$100 cumulative).
- Safe zone: top 14% / bottom 35% / sides 6%. Never remove the caption `wordSpacing` compensation (thick stroke swallows spaces).
- ⛔ No Meta publish steps in this plan; draft delivery = copy mp4 to `/mnt/c/Users/porat/Downloads/`.
- All commands below run from `/home/olis-solutions/olis-v3/nextjs/tri-pros-website/video` unless stated otherwise.

---

### Task 1: Fix transcribe.mjs crash (`mapped` is not defined)

`video/scripts/transcribe.mjs:119` references `mapped.length`, a leftover from a rename — the props file is written (line 118) but the script then crashes with `ReferenceError: mapped is not defined`. Must be fixed before Task 5 reruns transcription.

**Files:**
- Modify: `video/scripts/transcribe.mjs:119`

**Interfaces:**
- Consumes: nothing new.
- Produces: unchanged CLI contract (`node scripts/transcribe.mjs --audio <mp3> --script "<text>" --props <json>` → writes `wordCaptions` into the props JSON).

- [ ] **Step 1: Fix the log line**

Replace line 119:

```js
console.log(`✅ ${mapped.length} word captions (${Math.round(matchRatio * 100)}% script match) → ${propsPath}`)
```

with:

```js
console.log(`✅ ${scriptWords.length} word captions (${Math.round(matchRatio * 100)}% script match) → ${propsPath}`)
```

- [ ] **Step 2: Syntax-check**

Run: `node --check scripts/transcribe.mjs`
Expected: exits 0, no output.

- [ ] **Step 3: Commit**

```bash
git add scripts/transcribe.mjs
git commit -m "fix(video): transcribe.mjs crashed after writing props (stale 'mapped' identifier)

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 2: Caption pager — pure module + tests

The v4 bugs live in pagination/timing, so extract that logic into a pure function and test it. Grouping: max 3 words, max 16 joined chars, break after sentence punctuation. Timing: **gapless** — a page appears the moment its predecessor's last word ends (never later than its own first word) and holds until its successor appears.

**Files:**
- Create: `video/src/lib/paginate-captions.ts`
- Test: `video/src/lib/paginate-captions.test.ts`
- Modify: `video/package.json` (add `tsx` devDep)

**Interfaces:**
- Consumes: nothing.
- Produces (Task 3 imports these):

```ts
export interface CaptionToken { text: string, fromMs: number, toMs: number }
export interface CaptionPage { startMs: number, endMs: number, tokens: CaptionToken[] }
export interface WordInput { text: string, startMs: number, endMs: number }
export function paginateCaptions(words: WordInput[]): CaptionPage[]
```

- [ ] **Step 1: Install the test runner**

Run: `pnpm add -D tsx`
Expected: `tsx` appears in `video/package.json` devDependencies.

- [ ] **Step 2: Write the failing tests**

Create `video/src/lib/paginate-captions.test.ts`:

```ts
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { paginateCaptions } from './paginate-captions'

function w(text: string, startMs: number, endMs: number) {
  return { text, startMs, endMs }
}

test('groups at most 3 words per page', () => {
  const pages = paginateCaptions([
    w('see', 0, 100), w(' if', 100, 200), w(' your', 200, 300),
    w(' home', 300, 400), w(' fits', 400, 500),
  ])
  assert.equal(pages.length, 2)
  assert.deepEqual(pages[0]!.tokens.map(t => t.text), ['see', 'if', 'your'])
  assert.deepEqual(pages[1]!.tokens.map(t => t.text), ['home', 'fits'])
})

test('char budget (16) breaks a page before 3 words', () => {
  // "AAA-grade materials," = 9 + 1 + 10 = 20 chars joined → must split
  const pages = paginateCaptions([
    w('AAA-grade', 0, 500), w(' materials,', 500, 1000), w(' built', 1000, 1200),
  ])
  assert.deepEqual(pages[0]!.tokens.map(t => t.text), ['AAA-grade'])
})

test('sentence punctuation ends the page', () => {
  const pages = paginateCaptions([
    w('remodel!', 0, 400), w(' AAA-grade', 400, 900), w(' work', 900, 1100),
  ])
  assert.deepEqual(pages[0]!.tokens.map(t => t.text), ['remodel!'])
  assert.deepEqual(pages[1]!.tokens.map(t => t.text), ['AAA-grade', 'work'])
})

test('pages are gapless: each page ends exactly when the next starts', () => {
  const pages = paginateCaptions([
    w('one', 0, 200), w(' two', 200, 400), w(' three', 400, 600),
    // 500ms VO pause here
    w(' four', 1100, 1300), w(' five', 1300, 1500),
  ])
  for (let i = 0; i < pages.length - 1; i++)
    assert.equal(pages[i]!.endMs, pages[i + 1]!.startMs)
})

test('a page after a VO pause appears when the previous page finishes (snap-back)', () => {
  const pages = paginateCaptions([
    w('one', 0, 200), w(' two', 200, 400), w(' three', 400, 600),
    w(' four', 1100, 1300),
  ])
  assert.equal(pages.length, 2)
  // NOT 1100 — the v4 lag bug. Appears at 600, highlight waits for 1100.
  assert.equal(pages[1]!.startMs, 600)
})

test('trims token whitespace and drops empty words', () => {
  const pages = paginateCaptions([w(' hello', 0, 100), w('  ', 100, 150), w(' there', 150, 250)])
  assert.deepEqual(pages[0]!.tokens.map(t => t.text), ['hello', 'there'])
})

test('last page lingers 300ms past its final word', () => {
  const pages = paginateCaptions([w('done.', 0, 500)])
  assert.equal(pages[0]!.endMs, 800)
})

test('empty input yields no pages', () => {
  assert.deepEqual(paginateCaptions([]), [])
})
```

- [ ] **Step 3: Run tests to verify they fail**

Run: `pnpm exec tsx --test src/lib/paginate-captions.test.ts`
Expected: FAIL — cannot find module `./paginate-captions`.

- [ ] **Step 4: Implement the pager**

Create `video/src/lib/paginate-captions.ts`:

```ts
export interface CaptionToken {
  text: string
  fromMs: number
  toMs: number
}

export interface CaptionPage {
  /** Display window. Gapless by construction: page N ends exactly when N+1 starts. */
  startMs: number
  endMs: number
  tokens: CaptionToken[]
}

export interface WordInput {
  text: string
  startMs: number
  endMs: number
}

const MAX_WORDS = 3
/** Joined length ceiling — at fontSize 56 this can never overflow 1080px. */
const MAX_CHARS = 16
const LAST_PAGE_LINGER_MS = 300
/** End the page after sentence punctuation so boundaries never straddle pages. */
const SENTENCE_END = /[.!?…]$/

export function paginateCaptions(words: WordInput[]): CaptionPage[] {
  const tokens: CaptionToken[] = words
    .map(word => ({ text: word.text.trim(), fromMs: word.startMs, toMs: word.endMs }))
    .filter(token => token.text.length > 0)
  if (tokens.length === 0)
    return []

  const groups: CaptionToken[][] = []
  let current: CaptionToken[] = []
  let chars = 0
  for (const token of tokens) {
    const joined = current.length > 0 ? chars + 1 + token.text.length : token.text.length
    if (current.length > 0 && (current.length >= MAX_WORDS || joined > MAX_CHARS)) {
      groups.push(current)
      current = []
      chars = 0
    }
    current.push(token)
    chars = current.length === 1 ? token.text.length : chars + 1 + token.text.length
    if (SENTENCE_END.test(token.text)) {
      groups.push(current)
      current = []
      chars = 0
    }
  }
  if (current.length > 0)
    groups.push(current)

  // Gapless timing. A page appears the moment its predecessor's last word ends
  // (never later than its own first word — kills the v4 lag where a page with
  // late interpolated timing showed a word behind the voice) and holds until
  // its successor appears (kills the v4 dead-gap blink between pages).
  const starts = groups.map((group, i) =>
    i === 0 ? group[0]!.fromMs : Math.min(groups[i - 1]!.at(-1)!.toMs, group[0]!.fromMs),
  )
  return groups.map((group, i) => ({
    startMs: starts[i]!,
    endMs: i < groups.length - 1 ? starts[i + 1]! : group.at(-1)!.toMs + LAST_PAGE_LINGER_MS,
    tokens: group,
  }))
}
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `pnpm exec tsx --test src/lib/paginate-captions.test.ts`
Expected: all 8 pass.

- [ ] **Step 6: Type-check and commit**

```bash
pnpm tsc
git add src/lib/paginate-captions.ts src/lib/paginate-captions.test.ts package.json ../pnpm-lock.yaml
git commit -m "feat(video): gapless 3-word caption pager (fixes v4 page-lag + overflow by construction)

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

(If the lockfile lives at `video/pnpm-lock.yaml` instead, stage that path.)

---

### Task 3: KaraokeCaptions rewrite on the new pager

Swap `createTikTokStyleCaptions` for `paginateCaptions`. Page lookup uses the gapless display window; the active-word highlight still flips on true word timing. Font drops 58 → 56. Single-line pages are guaranteed by the pager, so add `whiteSpace: 'nowrap'` on the container (safe now, prevents any surprise wrap).

**Files:**
- Modify: `video/src/components/karaoke-captions.tsx` (full rewrite below)

**Interfaces:**
- Consumes: `paginateCaptions`, `WordInput` from `../lib/paginate-captions` (Task 2).
- Produces: same component signature as v4 — `KaraokeCaptions({ wordCaptions, voStartFrame, hideBeforeFrame, vertical })` — so `showcase-reel.tsx` needs no change in this task. `wordCaptions` prop type becomes `WordInput[]` (schema's word captions are structurally compatible; extra `timestampMs`/`confidence` fields are ignored).

- [ ] **Step 1: Rewrite the component**

Replace the entire contents of `video/src/components/karaoke-captions.tsx` with:

```tsx
import type { WordInput } from '../lib/paginate-captions'
import { useMemo } from 'react'
import { spring, useCurrentFrame, useVideoConfig } from 'remotion'
import { BODY_FONT } from '../lib/fonts'
import { paginateCaptions } from '../lib/paginate-captions'
import { BRAND } from '../lib/tokens'

/**
 * CapCut-style karaoke captions: 3-word single-line pages, the currently
 * spoken word highlighted in brand blue with a scale pop. Page visibility is
 * gapless (paginate-captions.ts); the highlight flips on each word's true
 * whisper timing, so neither the page nor the highlight can lag the voice.
 */
export function KaraokeCaptions({
  wordCaptions,
  voStartFrame,
  hideBeforeFrame,
  vertical,
}: {
  wordCaptions: WordInput[]
  voStartFrame: number
  /** Suppress pages while the hook title owns the screen (no double text). */
  hideBeforeFrame: number
  vertical: number
}) {
  const frame = useCurrentFrame()
  const { fps } = useVideoConfig()
  const pages = useMemo(() => paginateCaptions(wordCaptions), [wordCaptions])

  if (frame < hideBeforeFrame)
    return null

  const audioMs = ((frame - voStartFrame) / fps) * 1000
  const page = pages.find(p => audioMs >= p.startMs && audioMs < p.endMs)
  if (!page)
    return null

  const pageStartFrame = voStartFrame + Math.round((page.startMs / 1000) * fps)
  const enter = spring({
    frame: frame - Math.max(pageStartFrame, hideBeforeFrame),
    fps,
    config: { damping: 200, stiffness: 240 },
  })

  return (
    <div
      style={{
        position: 'absolute',
        top: `${vertical * 100}%`,
        left: 0,
        right: 0,
        transform: `translateY(-50%) scale(${0.92 + enter * 0.08})`,
        display: 'flex',
        justifyContent: 'center',
        opacity: enter,
      }}
    >
      <div
        style={{
          fontFamily: BODY_FONT,
          fontWeight: 800,
          fontSize: 56,
          lineHeight: 1.3,
          textAlign: 'center',
          textTransform: 'uppercase',
          whiteSpace: 'nowrap',
          color: '#ffffff',
          WebkitTextStroke: '10px rgba(0,0,0,0.9)',
          paintOrder: 'stroke',
          // The stroke expands each glyph ~5px per side and visually swallows
          // the natural word space — compensate or words read as jammed.
          wordSpacing: 14,
          textShadow: '0 4px 24px rgba(0,0,0,0.5)',
        }}
      >
        {page.tokens.map((token, i) => {
          const active = token.fromMs <= audioMs && token.toMs > audioMs
          return (
            <span key={`${token.fromMs}-${i}`} style={{ whiteSpace: 'pre' }}>
              {i > 0 ? ' ' : ''}
              <span
                style={{
                  color: active ? BRAND.blue : '#ffffff',
                  display: 'inline-block',
                  transform: active ? 'scale(1.1)' : 'scale(1)',
                }}
              >
                {token.text}
              </span>
            </span>
          )
        })}
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Type-check**

Run: `pnpm tsc`
Expected: clean. (`@remotion/captions` import is gone from this file; the package may remain a dependency — `transcribe.mjs` still uses `toCaptions` from `@remotion/install-whisper-cpp`, and removing deps is out of scope.)

- [ ] **Step 3: Visual smoke-test against the v4 props (regression check)**

```bash
pnpm exec remotion still ShowcaseReel /tmp/claude-1000/-home-olis-solutions-olis-v3-nextjs-tri-pros-website/b3179ea6-3ca1-46f7-a1a7-19401cdb62da/scratchpad/captions-qa-1.png --props=props/kitchens-showcase-reel-01.json --frame=120
pnpm exec remotion still ShowcaseReel /tmp/claude-1000/-home-olis-solutions-olis-v3-nextjs-tri-pros-website/b3179ea6-3ca1-46f7-a1a7-19401cdb62da/scratchpad/captions-qa-2.png --props=props/kitchens-showcase-reel-01.json --frame=165
```

View both PNGs (Read tool). Expected: a caption page of ≤3 words, fully inside the frame with clear margin both sides, visible word spaces, one word highlighted blue.

- [ ] **Step 4: Commit**

```bash
git add src/components/karaoke-captions.tsx
git commit -m "feat(video): karaoke captions v2 — gapless 3-word pages, nowrap, font 56

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 4: Schema v5 + composition wiring (hook timing, zoom-out reveal, Ken Burns direction, watermark gating)

New knobs, all defaulted so the committed v4 props stay valid — but both props files and `root.tsx` defaultProps also get the fields explicitly (defaults never load-bear at render time).

**Files:**
- Modify: `video/src/lib/schema.ts`
- Modify: `video/src/components/clip-media.tsx`
- Modify: `video/src/compositions/showcase-reel.tsx`
- Modify: `video/src/root.tsx`
- Modify: `video/props/kitchens-showcase-reel-01.json` (add neutral values for new fields)

**Interfaces:**
- Consumes: nothing from Tasks 1–3.
- Produces (Tasks 5–6 rely on these exact names):
  - `logoIntroSchema` = `{ src: string, enterFrame: number, dockFrame: number }`; `showcaseReelSchema` gains `logoIntro` (nullable), `zoomOutReveals: number[]` (frames), `hookStartFrame: number`, `hookDurationInFrames: number`, `watermarkWidth: number`; `clipSchema` gains `kenBurns: 'in' | 'out'`.
  - `ClipMedia` accepts new prop `kenBurns: 'in' | 'out'`.
  - Composition consumes `DOCK_FRAMES` and `LogoIntro` from `../components/logo-intro` — **created in Task 5**; in THIS task, wire everything except the two `LogoIntro` lines (marked below), so `pnpm tsc` stays green at the task boundary.

- [ ] **Step 1: Schema additions**

In `video/src/lib/schema.ts`, add to `clipSchema` (after the `label` field):

```ts
  /** Ken Burns direction for `kind: 'image'`: slow push in, or settle out. */
  kenBurns: z.enum(['in', 'out']).default('in'),
```

Add after `sfxSchema`:

```ts
/**
 * Opening brand moment: lockup springs in centered over the cold-open shot,
 * then glides in one continuous motion into the watermark slot, where the
 * persistent watermark takes over on the landing frame (dockFrame + 15).
 */
export const logoIntroSchema = z.object({
  /** Full lockup art — use the same file as watermarkSrc for a seamless dock. */
  src: z.string(),
  enterFrame: z.number().int().min(0),
  dockFrame: z.number().int().min(0),
})
```

Add to `showcaseReelSchema` (after `watermarkSrc`):

```ts
  /** Watermark width in px (also the logo-dock landing width). */
  watermarkWidth: z.number().positive().default(110),
  /** Opening logo entrance→dock; null = no logo intro (end card only). */
  logoIntro: logoIntroSchema.nullable().default(null),
  /** Zoom-out reveals: 150→100% over 10f starting at each frame (after-shot arrivals). */
  zoomOutReveals: z.array(z.number().int().min(0)).default([]),
```

Change the hook comment + add timing fields (replace the existing `/** Kinetic hook headline... */ hook: z.string(),` block):

```ts
  /** Kinetic hook headline; shows hookStartFrame → hookStartFrame + hookDurationInFrames. */
  hook: z.string(),
  hookStartFrame: z.number().int().min(0).default(0),
  hookDurationInFrames: z.number().int().positive().default(75),
```

- [ ] **Step 2: ClipMedia Ken Burns direction**

In `video/src/components/clip-media.tsx`, add `kenBurns` to the props and use it:

```tsx
export function ClipMedia({
  src,
  kind,
  durationInFrames,
  kenBurns = 'in',
}: {
  src: string
  kind: 'video' | 'image'
  durationInFrames: number
  kenBurns?: 'in' | 'out'
}) {
```

and replace the zoom interpolation:

```tsx
  const zoom = interpolate(
    frame,
    [0, durationInFrames],
    kenBurns === 'in' ? [1, 1.08] : [1.08, 1],
    { extrapolateRight: 'clamp' },
  )
```

Then thread it through both call sites: in `showcase-reel.tsx` the full-bleed branch becomes `<ClipMedia src={clip.src} kind={clip.kind} durationInFrames={clip.durationInFrames} kenBurns={clip.kenBurns} />`; check `framed-clip.tsx` — if it renders `ClipMedia`, pass `kenBurns` through the same way (add the prop to `FramedClip` and forward it from the framed branch).

- [ ] **Step 3: Composition wiring**

In `video/src/compositions/showcase-reel.tsx`:

a) Replace `const hookFrames = Math.min(75, props.clips[0]!.durationInFrames)` with:

```ts
  const hookEnd = props.hookStartFrame + props.hookDurationInFrames
```

b) Add zoom-out reveal scale after the `punchScale` reduce, and combine:

```ts
  // Zoom-out reveal: after-shot arrives oversized and settles (150→100% over 10f).
  const revealScale = props.zoomOutReveals.reduce((acc, f) => {
    const elapsed = frame - f
    if (elapsed < 0)
      return acc
    return Math.max(acc, interpolate(elapsed, [0, 10], [1.5, 1], {
      extrapolateRight: 'clamp',
      easing: Easing.out(Easing.cubic),
    }))
  }, 1)
```

Import `Easing` from `remotion`. Change the clips wrapper to `<AbsoluteFill style={{ transform: `scale(${punchScale * revealScale})` }}>`.

c) Watermark gating — replace the watermark block with:

```tsx
      {props.watermarkSrc && (() => {
        const watermarkFrom = props.logoIntro ? props.logoIntro.dockFrame + DOCK_FRAMES : 0
        return (
          <Sequence from={watermarkFrom} durationInFrames={clipsTotal - watermarkFrom}>
            <div style={{ position: 'absolute', top: '14%', right: '6%', opacity: 0.85 }}>
              <Img src={staticFile(props.watermarkSrc)} style={{ width: props.watermarkWidth }} />
            </div>
          </Sequence>
        )
      })()}
```

For THIS task only, stub `const DOCK_FRAMES = 15` as a local constant with a `// replaced by import in Task 5` comment; Task 5 swaps it for the real import.

d) Hook sequence timing — replace `<Sequence durationInFrames={hookFrames}>` with `<Sequence from={props.hookStartFrame} durationInFrames={props.hookDurationInFrames}>`, and replace every other `hookFrames` reference with `hookEnd` (karaoke `hideBeforeFrame={hookEnd}`, legacy branch `from={hookEnd} durationInFrames={clipsTotal - hookEnd}` and the caption retiming `- hookEnd`).

- [ ] **Step 4: Add new fields explicitly to root.tsx defaultProps and the v4 props file**

`video/src/root.tsx` defaultProps — add:

```ts
        hookStartFrame: 0,
        hookDurationInFrames: 75,
        watermarkWidth: 110,
        logoIntro: null,
        zoomOutReveals: [],
```

and `kenBurns: 'in' as const` on each clip entry in defaultProps.

`video/props/kitchens-showcase-reel-01.json` — add `"kenBurns": "in"` to each clip object, and top-level `"hookStartFrame": 0, "hookDurationInFrames": 75, "watermarkWidth": 110, "logoIntro": null, "zoomOutReveals": []`.

- [ ] **Step 5: Verify — types + v4 regression render**

```bash
pnpm tsc
pnpm exec remotion still ShowcaseReel /tmp/claude-1000/-home-olis-solutions-olis-v3-nextjs-tri-pros-website/b3179ea6-3ca1-46f7-a1a7-19401cdb62da/scratchpad/schema-qa.png --props=props/kitchens-showcase-reel-01.json --frame=40
```

Expected: tsc clean; the still shows the v4 hook + watermark exactly as before (defaults neutral).

- [ ] **Step 6: Commit**

```bash
git add src/lib/schema.ts src/components/clip-media.tsx src/components/framed-clip.tsx src/compositions/showcase-reel.tsx src/root.tsx props/kitchens-showcase-reel-01.json
git commit -m "feat(video): v5 schema — logoIntro, zoomOutReveals, hook timing, kenBurns direction, watermarkWidth

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 5: LogoIntro component

Center entrance (spring scale+fade) → one continuous glide into the watermark slot. The landing frame matches the watermark exactly (top 14%, right 6%, width `watermarkWidth`, opacity 0.85), and the watermark's Sequence starts on that exact frame (Task 4c), so one logo exists at all times.

**Files:**
- Create: `video/src/components/logo-intro.tsx`
- Modify: `video/src/compositions/showcase-reel.tsx` (render it; swap the stubbed `DOCK_FRAMES`)

**Interfaces:**
- Consumes: `logoIntro` + `watermarkWidth` props from Task 4's schema.
- Produces: `DOCK_FRAMES = 15` (exported const) and `LogoIntro({ src, enterFrame, dockFrame, watermarkWidth })`.

- [ ] **Step 1: Create the component**

Create `video/src/components/logo-intro.tsx`:

```tsx
import { Easing, Img, interpolate, spring, staticFile, useCurrentFrame, useVideoConfig } from 'remotion'

/** Dock glide length; the watermark Sequence must start at dockFrame + DOCK_FRAMES. */
export const DOCK_FRAMES = 15

/**
 * Opening brand moment: the lockup springs in centered over the cold-open
 * shot, holds, then glides in ONE continuous motion into the watermark slot
 * (top 14% / right 6% / watermarkWidth) where the persistent watermark takes
 * over on the landing frame — one logo exists at all times, no pop.
 */
export function LogoIntro({
  src,
  enterFrame,
  dockFrame,
  watermarkWidth,
}: {
  src: string
  enterFrame: number
  dockFrame: number
  watermarkWidth: number
}) {
  const frame = useCurrentFrame()
  const { fps, width, height } = useVideoConfig()

  const enter = spring({ frame: frame - enterFrame, fps, config: { damping: 200, stiffness: 120 } })
  const dock = interpolate(frame, [dockFrame, dockFrame + DOCK_FRAMES], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
    easing: Easing.inOut(Easing.cubic),
  })

  const centerWidth = 460
  const startX = (width - centerWidth) / 2
  const startY = height * 0.3
  const endX = width - width * 0.06 - watermarkWidth
  const endY = height * 0.14

  const w = interpolate(dock, [0, 1], [centerWidth, watermarkWidth])
  const x = interpolate(dock, [0, 1], [startX, endX])
  const y = interpolate(dock, [0, 1], [startY, endY])
  const opacity = enter * interpolate(dock, [0, 1], [1, 0.85])
  // Shadow lifts the lockup off bright footage centered, fades to the flat watermark look.
  const shadow = 1 - dock

  return (
    <div
      style={{
        position: 'absolute',
        left: x,
        top: y,
        width: w,
        opacity,
        transform: `scale(${0.9 + enter * 0.1})`,
        transformOrigin: 'center',
        filter: `drop-shadow(0 ${8 * shadow}px ${32 * shadow}px rgba(0,0,0,${0.45 * shadow}))`,
      }}
    >
      <Img src={staticFile(src)} style={{ width: '100%' }} />
    </div>
  )
}
```

- [ ] **Step 2: Render it in the composition**

In `showcase-reel.tsx`: delete the local `const DOCK_FRAMES = 15` stub, add `import { DOCK_FRAMES, LogoIntro } from '../components/logo-intro'`, and add directly after the watermark block:

```tsx
      {props.logoIntro && (
        <Sequence durationInFrames={props.logoIntro.dockFrame + DOCK_FRAMES}>
          <LogoIntro
            src={props.logoIntro.src}
            enterFrame={props.logoIntro.enterFrame}
            dockFrame={props.logoIntro.dockFrame}
            watermarkWidth={props.watermarkWidth}
          />
        </Sequence>
      )}
```

- [ ] **Step 3: Verify the dock is seamless**

```bash
pnpm tsc
```

Then render the handoff frames against a probe props: copy `props/kitchens-showcase-reel-01.json` to the scratchpad as `logo-qa.json`, set `"logoIntro": {"src": "brand/logo-dark-right.svg", "enterFrame": 0, "dockFrame": 40}` and `"watermarkSrc": "brand/logo-dark-right.svg", "watermarkWidth": 150` in the copy, then:

```bash
for f in 5 20 40 48 54 55 56 70; do pnpm exec remotion still ShowcaseReel /tmp/claude-1000/-home-olis-solutions-olis-v3-nextjs-tri-pros-website/b3179ea6-3ca1-46f7-a1a7-19401cdb62da/scratchpad/logo-qa-$f.png --props=/tmp/claude-1000/-home-olis-solutions-olis-v3-nextjs-tri-pros-website/b3179ea6-3ca1-46f7-a1a7-19401cdb62da/scratchpad/logo-qa.json --frame=$f; done
```

View all stills. Expected: centered entrance (5→20), glide (48), frames 54/55/56 show NO jump in position/size/opacity at the handoff, 70 shows only the corner watermark.

- [ ] **Step 4: Commit**

```bash
git add src/components/logo-intro.tsx src/compositions/showcase-reel.tsx
git commit -m "feat(video): LogoIntro — center entrance docking seamlessly into the watermark slot

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 6: Generate v5 assets (Picasso frames, Travertine morph, Gia VO)

All generated files land in gitignored `video/public/`; work files in the scratchpad. Higgsfield workspace must be set (`higgsfield account status`; if "No workspace selected": `higgsfield workspace set effb3267-2848-47fd-b29f-eb7964450824`).

**Files:**
- Create (gitignored): `video/public/stills/kitchens-picasso-after.png`, `video/public/clips/kitchens-travertine-transform.mp4`, `video/public/audio/kitchens-vo-gia-v1.mp3`

**Interfaces:**
- Consumes: nothing from prior tasks (independent of Tasks 1–5; can run in parallel with them).
- Produces: the three asset paths above, referenced verbatim by Task 7's props JSON. Also the chosen Travertine pair (record label + media IDs for the commit message).

- [ ] **Step 1: Extract the Picasso after-frame (cold-open beauty shot)**

```bash
pnpm exec remotion ffmpeg -sseof -0.15 -i public/clips/kitchens-picasso-transform.mp4 -frames:v 1 -update 1 public/stills/kitchens-picasso-after.png
```

View it. Expected: the finished Picasso kitchen, sharp, no mid-morph artifacts. If the last frame has motion blur, re-extract at `-sseof -0.4`.

- [ ] **Step 2: Download the three Travertine kitchen pairs and pick one**

```bash
cd /tmp/claude-1000/-home-olis-solutions-olis-v3-nextjs-tri-pros-website/b3179ea6-3ca1-46f7-a1a7-19401cdb62da/scratchpad
curl -sO https://pub-06be62a0a47b42cbb944ba281f4df793.r2.dev/projects/1b432267-8834-4ba1-9a32-460e72a701ac/before/86e77750-88ab-4e16-ae91-d5ea6870e6bc.jpg   # before 815 (Kitchen, 0.9)
curl -sO https://pub-06be62a0a47b42cbb944ba281f4df793.r2.dev/projects/1b432267-8834-4ba1-9a32-460e72a701ac/main/223930c9-48fe-48ab-add9-27e8a3219b59.jpg     # after  877 (Kitchen, 0.9)
curl -sO https://pub-06be62a0a47b42cbb944ba281f4df793.r2.dev/projects/1b432267-8834-4ba1-9a32-460e72a701ac/before/fad4bddf-ce44-4626-866b-a0402b3035ab.jpg   # before 821 (Sink View, 0.85)
curl -sO https://pub-06be62a0a47b42cbb944ba281f4df793.r2.dev/projects/1b432267-8834-4ba1-9a32-460e72a701ac/after/b9caa1a4-40c9-4bbb-8b19-89a5b63a765b.jpg    # after  786 (Sink View, 0.85)
curl -sO https://pub-06be62a0a47b42cbb944ba281f4df793.r2.dev/projects/1b432267-8834-4ba1-9a32-460e72a701ac/before/5e8199b6-55eb-4efc-a0c5-eace78981d24.jpg   # before 825 (Kitchen 2, 0.9)
curl -sO https://pub-06be62a0a47b42cbb944ba281f4df793.r2.dev/projects/1b432267-8834-4ba1-9a32-460e72a701ac/after/2e85ecb7-72b0-4e65-9c17-da2efdde11f0.jpg    # after  790 (Kitchen 2, 0.9)
```

View all six (Read tool). Pick the pair with (a) the most dramatic delta, (b) matching camera angle before/after, (c) visual distinctness from the Picasso kitchen. Selection criteria over aesthetics: angle match matters most — Seedance morphs badly across viewpoint changes.

- [ ] **Step 3: Generate the Travertine morph (background Bash, ~72cr)**

```bash
higgsfield generate create seedance_2_0 \
  --prompt "Fixed-tripod time-lapse of a full kitchen renovation. The camera never moves. The dated kitchen transforms smoothly into the finished remodeled kitchen: cabinets, countertops, backsplash, lighting and flooring change while the room's walls and window positions stay constant. Photorealistic, no people, natural daylight." \
  --start-image <chosen-before.jpg> --end-image <chosen-after.jpg> \
  --duration 8 --resolution 1080p --aspect_ratio 9:16 --generate_audio false --wait
```

Run in background Bash (`--wait` blocks several minutes). Download the result URL with curl to `public/clips/kitchens-travertine-transform.mp4`. QA: extract frames at 0s/4s/8s with `pnpm exec remotion ffmpeg`, view — start must read as the real before, end as the real after, no warped geometry mid-morph. Re-roll once with an adjusted prompt if the midpoint is mushy; escalate to Oliver after two failed rolls.

- [ ] **Step 4: Generate the Gia VO (2 takes)**

Fetch Gia's full voice id (it exists in this account's job history):

```bash
higgsfield generate list --json --size 100 | jq -r '[.[] | select(.params.voice.name=="Gia")][0].params.voice.id'
```

Script (exact text — Task 7's transcription step must reuse it verbatim):

> We're selecting five kitchens in your area for a Showcase remodel! AAA-grade materials, built to be photographed... at a Showcase price. And we do it again... and again. Homeowners only — see if your home qualifies.

```bash
higgsfield generate create text2speech_v2 --variant elevenlabs --voice_id <gia-id> --voice_type preset \
  --prompt "We're selecting five kitchens in your area for a Showcase remodel! AAA-grade materials, built to be photographed... at a Showcase price. And we do it again... and again. Homeowners only — see if your home qualifies." --wait
```

Generate two takes; listen is Oliver's job later — pick the take with livelier prosody by waveform/duration sanity (12–17s) and save as `public/audio/kitchens-vo-gia-v1.mp3`. Copy BOTH takes to `/mnt/c/Users/porat/Downloads/` so Oliver can veto.

- [ ] **Step 5: No commit** — all assets are gitignored; nothing to commit. Verify with `git status --short` (expect no new tracked files).

---

### Task 7: v5 props + transcription + render + deliver

Assemble the new timeline as `kitchens-showcase-reel-02.json`, transcribe the Gia VO into it, align beat-timed accents to the real word timings, render, QA, deliver.

**Files:**
- Create: `video/props/kitchens-showcase-reel-02.json`
- Modify (values only, after transcription): same file

**Interfaces:**
- Consumes: every schema field from Task 4, assets from Task 6, `transcribe.mjs` (fixed in Task 1).
- Produces: committed props JSON + delivered draft `kitchens-showcase-reel-02-draft1.mp4`.

- [ ] **Step 1: Write the props file**

Create `video/props/kitchens-showcase-reel-02.json` (timeline: cold open 0–75 → snap+morph1 75–315 → crew 315–390 → morph2 390–630 → checkmarks 630–780 → end card 780–900):

```json
{
  "clips": [
    { "src": "stills/kitchens-picasso-after.png", "kind": "image", "durationInFrames": 75, "layout": "full", "aspect": 0.5625, "label": null, "kenBurns": "out" },
    { "src": "clips/kitchens-picasso-transform.mp4", "kind": "video", "durationInFrames": 240, "layout": "full", "aspect": 0.5625, "label": null, "kenBurns": "in" },
    { "src": "stills/kitchens-during-construction-01.png", "kind": "image", "durationInFrames": 75, "layout": "framed", "aspect": 1.4906, "label": "OUR CREW, ON SITE", "kenBurns": "in" },
    { "src": "clips/kitchens-travertine-transform.mp4", "kind": "video", "durationInFrames": 240, "layout": "full", "aspect": 0.5625, "label": null, "kenBurns": "in" },
    { "src": "clips/kitchens-island-track.mp4", "kind": "video", "durationInFrames": 150, "layout": "framed", "aspect": 1.5706, "label": null, "kenBurns": "in" }
  ],
  "hook": "We’re Selecting 5 Kitchens in Your Area",
  "hookStartFrame": 40,
  "hookDurationInFrames": 75,
  "checkmarks": ["AAA-grade materials", "Beautiful AND functional", "Built to be photographed"],
  "checkmarkClipIndex": 4,
  "captions": [],
  "wordCaptions": [],
  "voStartFrame": 15,
  "captionVertical": 0.58,
  "punchIns": [
    { "frame": 190, "scale": 1.18 },
    { "frame": 255, "scale": 1.2 }
  ],
  "flashFrames": [75],
  "zoomOutReveals": [612],
  "logoIntro": { "src": "brand/logo-dark-right.svg", "enterFrame": 0, "dockFrame": 40 },
  "sfx": [
    { "src": "audio/sfx/uiclick.wav", "frame": 55, "volume": 0.2 },
    { "src": "audio/sfx/shutter.wav", "frame": 75, "volume": 0.5 },
    { "src": "audio/sfx/whoosh2.wav", "frame": 312, "volume": 0.35 },
    { "src": "audio/sfx/whoosh2.wav", "frame": 387, "volume": 0.28 },
    { "src": "audio/sfx/riser-short.wav", "frame": 572, "volume": 0.35 },
    { "src": "audio/sfx/uiclick.wav", "frame": 660, "volume": 0.22 },
    { "src": "audio/sfx/uiclick.wav", "frame": 669, "volume": 0.26 },
    { "src": "audio/sfx/uiclick.wav", "frame": 678, "volume": 0.3 },
    { "src": "audio/sfx/thud.wav", "frame": 780, "volume": 0.4 }
  ],
  "voiceoverSrc": "audio/kitchens-vo-gia-v1.mp3",
  "musicSrc": "audio/music-bed-02-upbeat.m4a",
  "watermarkSrc": "brand/logo-dark-right.svg",
  "watermarkWidth": 150,
  "musicVolume": 0.12,
  "endCard": {
    "headline": "Could Your Kitchen Be One of the 5?",
    "sub": "AAA-grade work, at a Showcase price. Homeowners only.",
    "cta": "See If Your Home Qualifies"
  },
  "endCardFrames": 120
}
```

- [ ] **Step 2: Transcribe the Gia VO into the props**

```bash
node scripts/transcribe.mjs \
  --audio public/audio/kitchens-vo-gia-v1.mp3 \
  --script "We're selecting five kitchens in your area for a Showcase remodel! AAA-grade materials, built to be photographed... at a Showcase price. And we do it again... and again. Homeowners only — see if your home qualifies." \
  --props props/kitchens-showcase-reel-02.json
```

Expected: `✅ 36 word captions (…% script match)` with match ≥70%.

- [ ] **Step 3: Align beat accents to the real word timings**

Read `wordCaptions` from the props and retime (`frame = round(15 + startMs × 30 / 1000)`):

- `punchIns[0].frame` → start of "AAA-grade" (stress punch, morph 1).
- `punchIns[1].frame` → start of "Showcase" in "Showcase price".
- Add a third punch `{ "scale": 1.15 }` on the SECOND "again" (the new line) — this lands near morph 2's start and sells the repeat.
- If the VO runs long (ends past ~frame 600), nudge `voStartFrame` down or accept — but "again... and again" must fall within 390–630 (morph 2 on screen). Verify and adjust.

- [ ] **Step 4: Type-check and render draft 1**

```bash
pnpm tsc
pnpm exec remotion render ShowcaseReel out/kitchens-showcase-reel-02-draft1.mp4 --props=props/kitchens-showcase-reel-02.json
```

- [ ] **Step 5: Frame QA**

Extract and view stills at frames 5, 30, 54, 56, 74, 76, 150, 320, 400, 612, 620, 700, 800:

```bash
for f in 5 30 54 56 74 76 150 320 400 612 620 700 800; do pnpm exec remotion ffmpeg -y -i out/kitchens-showcase-reel-02-draft1.mp4 -vf "select=eq(n\,$f)" -vsync 0 -frames:v 1 /tmp/claude-1000/-home-olis-solutions-olis-v3-nextjs-tri-pros-website/b3179ea6-3ca1-46f7-a1a7-19401cdb62da/scratchpad/qa-$f.png; done
```

Checklist: logo centered (5), docking mid-glide (54/56 seamless), snap flash + shutter beat (74/76 = after→before with white flash), captions ≤3 words fully in-frame with visible spacing (150+), crew card (320), Travertine morph mid (400), zoom-out reveal oversized→settled (612/620), checkmarks (700), end card (800). Fix props values and re-render until clean.

- [ ] **Step 6: Deliver + commit**

```bash
cp out/kitchens-showcase-reel-02-draft1.mp4 /mnt/c/Users/porat/Downloads/
git add props/kitchens-showcase-reel-02.json
git commit -m "feat(video): kitchens reel 02 — inverted-reveal hook, logo dock, double morph, captions v2 (draft 1)

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

Report to Oliver: draft location, which Travertine pair was chosen, both Gia takes in Downloads.

---

### Task 8: SKILL.md baseline rewrite

Every future ad inherits the v5 baseline.

**Files:**
- Modify: `.claude/skills/showcase-ads/SKILL.md` (repo root, not `video/`)

**Interfaces:**
- Consumes: final v5 props shape from Task 7 (reference it as the canonical example).
- Produces: updated skill text only.

- [ ] **Step 1: Rewrite the house-template paragraph**

In the "Assemble & render" section, replace the "House timeline: portrait hook (5s) → …" paragraph with:

```markdown
House timeline (v5 baseline — `props/kitchens-showcase-reel-02.json` is the
canonical example): cold open on an AFTER beauty frame with the logo intro
(2.5s) → hard snap to the BEFORE (shutter + flash) → morph #1 plays (8s) →
framed crew/during still (2.5s, "OUR CREW, ON SITE") → morph #2, a DIFFERENT
project, with zoom-out reveal + riser on its after moment (8s) → framed
checkmarks clip (5s) → end card (4s). The inverted-reveal hook (after-first)
is the DEFAULT hook pattern for transform-capable trades. VO = Gia
(house voice), starts frame 15, and must include a line over morph #2.
```

- [ ] **Step 2: Add the logo-intro rule**

Add a new bullet under "Canonical rules":

```markdown
- Logo intro is MANDATORY: `logoIntro` prop — lockup springs in centered over
  the cold open, docks into the watermark slot at `dockFrame` (+15f glide),
  where the persistent watermark (same art file, `watermarkWidth` 150) takes
  over seamlessly. Use `brand/logo-dark-right.svg` for both.
```

- [ ] **Step 3: Update the captions section**

In "Captions — word-synced", append after the "Rendering:" paragraph:

```markdown
Pagination is ours, not the library's (`src/lib/paginate-captions.ts`,
unit-tested): max 3 words / 16 chars per page (single line, can never
overflow), sentence punctuation breaks pages, and timing is GAPLESS — a page
appears the moment its predecessor's last word ends and holds until its
successor appears, so pages can never lag the voice or blink out between
sentences.
```

- [ ] **Step 4: Update the editing-patterns knobs list**

In "Editing patterns", update the schema-knobs bullet to include the new knobs (`zoomOutReveals` — 150→100% over 10f on after-arrivals; `hookStartFrame`/`hookDurationInFrames`; per-clip `kenBurns: in|out`), state the default accent map (snap = shutter+flash · logo dock = quiet click · reveal = riser peaking ON the reveal + zoom-out · checkmark rows = ascending clicks · end card = soft thud), and remove "karaoke word-highlight captions" from the not-yet-implemented list (now shipped); zoom-out reveal likewise moves from not-implemented to implemented.

- [ ] **Step 5: Commit**

```bash
cd /home/olis-solutions/olis-v3/nextjs/tri-pros-website
git add .claude/skills/showcase-ads/SKILL.md
git commit -m "docs(skills): showcase-ads v5 baseline — inverted-reveal default, mandatory logo intro, captions v2, accent map

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```
