# Showcase-Ads Variation System Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make every Showcase reel provably different from the last — full variation-knob inventory in the Remotion composition, a redesigned build-as-spoken caption system, a curated music library, a committed variation ledger, and a restructured skill that enforces one coherent pick per axis per reel.

**Architecture:** Pure-function libs (`transitions.ts`, `accents.ts`, emphasis parsing) carry all the math and get node:test coverage; components stay thin renderers. The zod schema gains knobs with `.default()` so both existing props files parse unchanged — but Remotion passes RAW input props to components (zod only validates), so **every read of a new field must be defensive** (`clip.cardStyle ?? 'native'`). Skill-level docs (variation axes, ledger) live canonically in `docs/marketing/editing/` with symlinks under the skill's `references/`, matching the existing convention.

**Tech Stack:** Remotion 4.0.487 · zod 3 · node:test via tsx · @remotion/google-fonts · Higgsfield CLI (sonilo music) · whisper.cpp via scripts/transcribe.mjs.

**Spec:** `docs/superpowers/specs/2026-07-13-showcase-ads-variation-system-design.md`

## Global Constraints

- Working dir for all commands: `video/` (i.e. `cd /home/olis-solutions/olis-v3/nextjs/tri-pros-website/video`). Repo-root paths below are prefixed `video/`.
- Verify with `pnpm tsc` (in `video/`). NEVER `pnpm build`.
- Tests: `pnpm exec tsx --test src/lib/<name>.test.ts` (node:test style, see `src/lib/paginate-captions.test.ts`).
- Work on `main`; stage explicitly by path (`git add <paths>` — never `git add -A`). Renders (`video/out/`) and generated media (`video/public/{clips,stills,audio}/*` except `music-manifest.json`) are NEVER committed.
- Back-compat gate: `video/props/kitchens-showcase-reel-02.json` and `video/props/bathrooms-showcase-reel-01.json` must parse with the new schema WITHOUT edits.
- **One motion per moment** (Oliver ruling ×2): each clip/photo gets exactly ONE entrance motion; never stack two scale animations within ~1s or straddling a cut. `punchIns`/`zoomOutReveals` stay in the schema (legacy props) but remain deprecated.
- No `Math.random()`/`Date.now()` in composition code — renders must be frame-deterministic (hash-based jitter only).
- Brand tokens from `video/src/lib/tokens.ts` (`BRAND.blue` = `#03afed`, `BRAND.darkBg`); safe zone component exists (`SafeZone`, 14/35/6).
- Commit messages: conventional commits, end with `Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>`.
- First commit of the work: stage the spec + this plan (`docs/superpowers/specs/2026-07-13-showcase-ads-variation-system-design.md`, `docs/superpowers/plans/2026-07-13-showcase-ads-variation-system.md`) with message `docs(specs): showcase-ads variation system design + plan`.

---

### Task 1: Transition math lib

**Files:**
- Create: `video/src/lib/transitions.ts`
- Test: `video/src/lib/transitions.test.ts`

**Interfaces:**
- Produces: `TransitionType` (`'none' | 'fade' | 'whip' | 'wipe' | 'dissolve' | 'zoomPunch'`), `TransitionDirection` (`'left' | 'right' | 'up' | 'down'`), `TRANSITION_FRAMES: Record<TransitionType, number>`, `enterStyle(type, direction, frames): TransitionStyle`, `exitStyle(nextType, direction, frames): TransitionStyle`, `wipeEdge(type, frames): number | null`. `TransitionStyle = { opacity: number, transform: string, clipPath?: string, filter?: string }`. No remotion imports (keeps it node-testable); easing is local.

- [ ] **Step 1: Write the failing test**

```ts
// video/src/lib/transitions.test.ts
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { enterStyle, exitStyle, TRANSITION_FRAMES, wipeEdge } from './transitions'

test('none and finished transitions are identity', () => {
  assert.deepEqual(enterStyle('none', 'left', 0), { opacity: 1, transform: 'none' })
  assert.deepEqual(enterStyle('fade', 'left', TRANSITION_FRAMES.fade), { opacity: 1, transform: 'none' })
  assert.deepEqual(exitStyle('fade', 'left', 3), { opacity: 1, transform: 'none' })
})

test('fade ramps opacity linearly over 10f', () => {
  assert.equal(enterStyle('fade', 'left', 0).opacity, 0)
  assert.equal(enterStyle('fade', 'left', 5).opacity, 0.5)
})

test('whip enter comes from the opposite side and exits with the motion', () => {
  const enter = enterStyle('whip', 'left', 0)
  assert.match(enter.transform, /translate\(110(\.\d+)?%/) // incoming starts fully right, moves left
  assert.equal(enter.filter, 'url(#whip-blur-x)')
  const exit = exitStyle('whip', 'left', TRANSITION_FRAMES.whip - 1)
  assert.match(exit.transform, /translate\(-\d/) // outgoing has moved left
})

test('wipe clips the incoming and reports its edge', () => {
  const mid = enterStyle('wipe', 'left', 7)
  assert.ok(mid.clipPath?.startsWith('inset('))
  assert.equal(wipeEdge('wipe', -1), null)
  assert.equal(wipeEdge('fade', 5), null)
  const edge = wipeEdge('wipe', 7)
  assert.ok(edge !== null && edge > 0 && edge < 100)
})

test('zoomPunch: incoming settles from 1.3, outgoing blows out past 1.3', () => {
  assert.match(enterStyle('zoomPunch', 'left', 0).transform, /scale\(1\.3\)/)
  const out = exitStyle('zoomPunch', 'left', TRANSITION_FRAMES.zoomPunch - 1)
  assert.match(out.transform, /scale\(1\.[3-9]/)
  assert.ok(out.opacity < 1)
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm exec tsx --test src/lib/transitions.test.ts`
Expected: FAIL — `Cannot find module './transitions'`

- [ ] **Step 3: Write the implementation**

```ts
// video/src/lib/transitions.ts
export type TransitionType = 'none' | 'fade' | 'whip' | 'wipe' | 'dissolve' | 'zoomPunch'
export type TransitionDirection = 'left' | 'right' | 'up' | 'down'

/** Overlap frames: how long the previous clip keeps running under the incoming one. */
export const TRANSITION_FRAMES: Record<TransitionType, number> = {
  none: 0,
  fade: 10,
  whip: 7,
  wipe: 14,
  dissolve: 14,
  zoomPunch: 9,
}

export interface TransitionStyle {
  opacity: number
  transform: string
  clipPath?: string
  filter?: string
}

const IDENTITY: TransitionStyle = { opacity: 1, transform: 'none' }

// direction = the whip/wipe motion direction (outgoing exits that way, incoming follows).
const AXIS: Record<TransitionDirection, { x: number, y: number }> = {
  left: { x: -1, y: 0 },
  right: { x: 1, y: 0 },
  up: { x: 0, y: -1 },
  down: { x: 0, y: 1 },
}

const easeOutCubic = (t: number) => 1 - (1 - t) ** 3
const easeInCubic = (t: number) => t ** 3
const easeInOutCubic = (t: number) => (t < 0.5 ? 4 * t ** 3 : 1 - (-2 * t + 2) ** 3 / 2)

/** Style for the INCOMING clip, given frames since its sequence started. */
export function enterStyle(type: TransitionType, direction: TransitionDirection, frames: number): TransitionStyle {
  const total = TRANSITION_FRAMES[type]
  if (type === 'none' || frames >= total)
    return IDENTITY
  const t = Math.max(frames / total, 0)
  switch (type) {
    case 'fade':
      return { opacity: t, transform: 'none' }
    case 'dissolve':
      return { opacity: easeInOutCubic(t), transform: 'none' }
    case 'whip': {
      const p = easeOutCubic(t)
      const { x, y } = AXIS[direction]
      return {
        opacity: 1,
        transform: `translate(${-x * (1 - p) * 110}%, ${-y * (1 - p) * 110}%)`,
        filter: y === 0 ? 'url(#whip-blur-x)' : 'url(#whip-blur-y)',
      }
    }
    case 'wipe': {
      const p = easeInOutCubic(t) * 100
      const inset
        = direction === 'left'
          ? `0 ${100 - p}% 0 0`
          : direction === 'right'
            ? `0 0 0 ${100 - p}%`
            : direction === 'up'
              ? `0 0 ${100 - p}% 0`
              : `${100 - p}% 0 0 0`
      return { opacity: 1, transform: 'none', clipPath: `inset(${inset})` }
    }
    case 'zoomPunch': {
      const p = easeOutCubic(t)
      return {
        opacity: Math.min(1, t * 2),
        transform: `scale(${1.3 - p * 0.3})`,
        filter: `blur(${(1 - p) * 14}px)`,
      }
    }
    default:
      return IDENTITY
  }
}

/** Style for the OUTGOING clip during the overlap (frames since the INCOMING clip started). */
export function exitStyle(nextType: TransitionType, direction: TransitionDirection, frames: number): TransitionStyle {
  const total = TRANSITION_FRAMES[nextType]
  if (total === 0 || frames < 0 || frames >= total)
    return IDENTITY
  const t = frames / total
  switch (nextType) {
    case 'whip': {
      const p = easeInCubic(t)
      const { x, y } = AXIS[direction]
      return {
        opacity: 1,
        transform: `translate(${x * p * 110}%, ${y * p * 110}%)`,
        filter: y === 0 ? 'url(#whip-blur-x)' : 'url(#whip-blur-y)',
      }
    }
    case 'zoomPunch': {
      const p = easeInCubic(t)
      return { opacity: 1 - t * 0.4, transform: `scale(${1 + p * 0.6})`, filter: `blur(${p * 12}px)` }
    }
    default:
      // fade/dissolve/wipe: the previous clip just keeps playing beneath.
      return IDENTITY
  }
}

/** Wipe divider position 0–100 (percent along the wipe axis), or null when no divider draws. */
export function wipeEdge(type: TransitionType, frames: number): number | null {
  if (type !== 'wipe' || frames < 0 || frames >= TRANSITION_FRAMES.wipe)
    return null
  return easeInOutCubic(frames / TRANSITION_FRAMES.wipe) * 100
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm exec tsx --test src/lib/transitions.test.ts`
Expected: PASS (5 tests)

- [ ] **Step 5: Type-check and commit**

Run: `pnpm tsc` — expected clean.

```bash
git add video/src/lib/transitions.ts video/src/lib/transitions.test.ts
git commit -m "feat(video): transition math lib — whip/wipe/dissolve/zoomPunch enter+exit styles

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 2: Accent math lib (color pop + screen shake)

**Files:**
- Create: `video/src/lib/accents.ts`
- Test: `video/src/lib/accents.test.ts`

**Interfaces:**
- Produces: `colorPopSaturation(frame: number, pops: number[]): number` (1 = normal; 0.25 desaturated hold for 45f before each pop, snap back to 1 over 3f ON the pop frame) and `screenShakeOffset(frame: number, shakes: { frame: number, intensity: number }[]): { x: number, y: number }` (10f decaying jitter, ±10px × intensity, deterministic hash reseeded every 2 frames — NO Math.random).

- [ ] **Step 1: Write the failing test**

```ts
// video/src/lib/accents.test.ts
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { colorPopSaturation, screenShakeOffset } from './accents'

test('color pop: normal → desaturated hold → snap back over 3f', () => {
  assert.equal(colorPopSaturation(0, [100]), 1) // before the hold window
  assert.equal(colorPopSaturation(60, [100]), 0.25) // inside the 45f hold
  assert.equal(colorPopSaturation(100, [100]), 0.25) // snap starts ON the frame
  assert.ok(colorPopSaturation(102, [100]) > 0.6) // mid-snap
  assert.equal(colorPopSaturation(103, [100]), 1) // done
  assert.equal(colorPopSaturation(50, []), 1)
})

test('screen shake: zero outside the window, bounded and decaying inside, deterministic', () => {
  assert.deepEqual(screenShakeOffset(10, [{ frame: 100, intensity: 1 }]), { x: 0, y: 0 })
  const early = screenShakeOffset(101, [{ frame: 100, intensity: 1 }])
  assert.ok(Math.abs(early.x) <= 10 && Math.abs(early.y) <= 10)
  assert.ok(Math.abs(early.x) + Math.abs(early.y) > 0)
  // deterministic: same frame → same offset
  assert.deepEqual(early, screenShakeOffset(101, [{ frame: 100, intensity: 1 }]))
  // decays: frame 109 amplitude ceiling is 1/10th of frame 100's
  const late = screenShakeOffset(109, [{ frame: 100, intensity: 1 }])
  assert.ok(Math.abs(late.x) <= 1.01 && Math.abs(late.y) <= 1.01)
  assert.deepEqual(screenShakeOffset(110, [{ frame: 100, intensity: 1 }]), { x: 0, y: 0 })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm exec tsx --test src/lib/accents.test.ts`
Expected: FAIL — `Cannot find module './accents'`

- [ ] **Step 3: Write the implementation**

```ts
// video/src/lib/accents.ts
const POP_HOLD_FRAMES = 45
const POP_SNAP_FRAMES = 3
const SHAKE_FRAMES = 10
const SHAKE_MAX_PX = 10

/**
 * Color pop: hold the scene desaturated for 45f leading into the pop frame,
 * then snap to full color over 3f — the reveal "switches on".
 */
export function colorPopSaturation(frame: number, pops: number[]): number {
  for (const p of pops) {
    if (frame >= p - POP_HOLD_FRAMES && frame < p)
      return 0.25
    if (frame >= p && frame < p + POP_SNAP_FRAMES)
      return 0.25 + (0.75 * (frame - p)) / POP_SNAP_FRAMES
  }
  return 1
}

/** Deterministic 0..1 hash — render-safe substitute for Math.random. */
function hash01(n: number): number {
  const s = Math.sin(n * 12.9898) * 43758.5453
  return s - Math.floor(s)
}

/**
 * Impact shake: decaying random translate, reseeded every 2 frames so it
 * reads as jitter, not drift. Translate-only (no scale) — one motion per
 * moment stays intact.
 */
export function screenShakeOffset(
  frame: number,
  shakes: { frame: number, intensity: number }[],
): { x: number, y: number } {
  for (const s of shakes) {
    const local = frame - s.frame
    if (local < 0 || local >= SHAKE_FRAMES)
      continue
    const decay = 1 - local / SHAKE_FRAMES
    const seed = Math.floor(frame / 2)
    const amp = SHAKE_MAX_PX * s.intensity * decay
    return {
      x: (hash01(seed + 1) * 2 - 1) * amp,
      y: (hash01(seed + 7.31) * 2 - 1) * amp,
    }
  }
  return { x: 0, y: 0 }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm exec tsx --test src/lib/accents.test.ts`
Expected: PASS (2 tests)

- [ ] **Step 5: Type-check and commit**

Run: `pnpm tsc` — expected clean.

```bash
git add video/src/lib/accents.ts video/src/lib/accents.test.ts
git commit -m "feat(video): accent math lib — color pop + deterministic screen shake

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 3: Schema expansion + back-compat parse tests

**Files:**
- Modify: `video/src/lib/schema.ts`
- Test: `video/src/lib/schema.test.ts` (create)

**Interfaces:**
- Produces (consumed by every later task): `clipSchema` gains `cardStyle` (`'native' | 'polaroid' | 'split' | 'letterbox' | 'offset'`, default `'native'`), `secondarySrc` (`string | null`, default null), `transitionIn` extended enum, `transitionDirection` (default `'left'`), `kenBurns` as union of legacy string and `{ zoom, pan }` object. `wordCaptionSchema` gains `emphasis` (boolean, default false). Top-level gains `hookStyle` (`'wordStagger' | 'punch' | 'freeze' | 'typewriter'`, default `'wordStagger'`), `colorPops: number[]`, `screenShakes: { frame, intensity }[]`. `photoBurst` gains `style` (`'fullbleed' | 'polaroid-scatter' | 'grid'`, default `'fullbleed'`). Exports `kenBurnsSchema`, `KenBurns` type, `normalizeKenBurns(v): { zoom: 'in' | 'out', pan: 'none' | 'left' | 'right' | 'up' | 'down' }`.
- ⚠️ Remotion passes RAW props to the component (zod validates, does not transform) — later tasks must read new fields defensively (`?? default`).

- [ ] **Step 1: Write the failing test**

```ts
// video/src/lib/schema.test.ts
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { test } from 'node:test'
import { normalizeKenBurns, showcaseReelSchema } from './schema'

const propsDir = path.join(import.meta.dirname, '../../props')

test('back-compat: both shipped props files parse without edits', () => {
  for (const file of ['kitchens-showcase-reel-02.json', 'bathrooms-showcase-reel-01.json']) {
    const raw = JSON.parse(readFileSync(path.join(propsDir, file), 'utf8'))
    const parsed = showcaseReelSchema.parse(raw)
    assert.equal(parsed.hookStyle, 'wordStagger') // new fields default in
    assert.equal(parsed.clips[0]!.cardStyle, 'native')
    assert.deepEqual(parsed.colorPops, [])
  }
})

test('new knobs accept the full menus', () => {
  const raw = JSON.parse(readFileSync(path.join(propsDir, 'kitchens-showcase-reel-02.json'), 'utf8'))
  raw.hookStyle = 'typewriter'
  raw.colorPops = [300]
  raw.screenShakes = [{ frame: 756, intensity: 0.8 }]
  raw.clips[2].transitionIn = 'whip'
  raw.clips[2].transitionDirection = 'up'
  raw.clips[2].cardStyle = 'polaroid'
  raw.clips[4].cardStyle = 'split'
  raw.clips[4].secondarySrc = 'stills/after.jpg'
  raw.clips[0].kenBurns = { zoom: 'out', pan: 'left' }
  raw.photoBurst.style = 'polaroid-scatter'
  raw.wordCaptions[11].emphasis = true
  const parsed = showcaseReelSchema.parse(raw)
  assert.equal(parsed.clips[2]!.transitionIn, 'whip')
  assert.deepEqual(parsed.clips[0]!.kenBurns, { zoom: 'out', pan: 'left' })
})

test('normalizeKenBurns maps legacy strings and passes objects through', () => {
  assert.deepEqual(normalizeKenBurns('in'), { zoom: 'in', pan: 'none' })
  assert.deepEqual(normalizeKenBurns('out'), { zoom: 'out', pan: 'none' })
  assert.deepEqual(normalizeKenBurns({ zoom: 'in', pan: 'right' }), { zoom: 'in', pan: 'right' })
  assert.deepEqual(normalizeKenBurns(undefined), { zoom: 'in', pan: 'none' }) // raw-props safety
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm exec tsx --test src/lib/schema.test.ts`
Expected: FAIL — `normalizeKenBurns` not exported / unknown keys rejected.

- [ ] **Step 3: Modify the schema**

In `video/src/lib/schema.ts`:

Add above `clipSchema`:

```ts
export const kenBurnsSchema = z.union([
  z.enum(['in', 'out']),
  z.object({
    zoom: z.enum(['in', 'out']),
    pan: z.enum(['none', 'left', 'right', 'up', 'down']),
  }),
])
export type KenBurns = z.infer<typeof kenBurnsSchema>

/**
 * Remotion passes RAW input props (zod validates, never transforms) — always
 * normalize at the use-site; undefined-safe for props written pre-expansion.
 */
export function normalizeKenBurns(v: KenBurns | undefined): { zoom: 'in' | 'out', pan: 'none' | 'left' | 'right' | 'up' | 'down' } {
  if (v === undefined)
    return { zoom: 'in', pan: 'none' }
  return typeof v === 'string' ? { zoom: v, pan: 'none' } : v
}
```

In `clipSchema`, replace the `kenBurns` and `transitionIn` lines and add the new fields:

```ts
  /** Card treatment when layout is `framed` — see variation-axes.md. */
  cardStyle: z.enum(['native', 'polaroid', 'split', 'letterbox', 'offset']).default('native'),
  /** Second source for `cardStyle: 'split'` (src = BEFORE half, secondarySrc = AFTER half). */
  secondarySrc: z.string().nullable().default(null),
  /** Ken Burns for `kind: 'image'`: legacy string or `{ zoom, pan }` object. */
  kenBurns: kenBurnsSchema.default('in'),
  /**
   * How this clip enters (ONE transition family per reel — variation-axes.md).
   * `none` = hard cut, reserved for the snap moment.
   */
  transitionIn: z.enum(['none', 'fade', 'whip', 'wipe', 'dissolve', 'zoomPunch']).default('none'),
  /** Motion direction for whip/wipe. */
  transitionDirection: z.enum(['left', 'right', 'up', 'down']).default('left'),
```

In `wordCaptionSchema` add:

```ts
  /** Marked `*word*` in the VO script — renders in the luxe serif + brand blue. */
  emphasis: z.boolean().default(false),
```

In `showcaseReelSchema` add (near `hookDurationInFrames`):

```ts
  /** Hook text treatment — one of the variation-axis menu (axis 1). */
  hookStyle: z.enum(['wordStagger', 'punch', 'freeze', 'typewriter']).default('wordStagger'),
```

and (near `flashFrames`):

```ts
  /** Color pops: desaturated 45f hold → snap to full color ON each frame. */
  colorPops: z.array(z.number().int().min(0)).default([]),
  /** Impact shakes: 10f decaying translate jitter at each frame (boom moments). */
  screenShakes: z.array(z.object({ frame: z.number().int().min(0), intensity: z.number().min(0).max(1) })).default([]),
```

In the `photoBurst` object add:

```ts
      /** Burst treatment — full-bleed snaps (house v5), polaroid scatter, or 2×2 grid assemble. */
      style: z.enum(['fullbleed', 'polaroid-scatter', 'grid']).default('fullbleed'),
```

Mark the deprecated knobs in place (comment only — keep parsing):

```ts
  /** @deprecated One motion per moment (2026-07-13) — leave []; kept for legacy props. */
  punchIns: z.array(punchInSchema),
  ...
  /** @deprecated One motion per moment (2026-07-13) — leave []; kept for legacy props. */
  zoomOutReveals: z.array(z.number().int().min(0)).default([]),
```

- [ ] **Step 4: Run tests + type-check**

Run: `pnpm exec tsx --test src/lib/schema.test.ts` — expected PASS (3 tests).
Run: `pnpm tsc` — expected clean. If `root.tsx` defaultProps errors on the clip type, add the new defaulted fields explicitly to each defaultProps clip (`cardStyle: 'native' as const, secondarySrc: null, transitionDirection: 'left' as const`) — defaults make them optional in `z.input`, so this should not be needed.

- [ ] **Step 5: Commit**

```bash
git add video/src/lib/schema.ts video/src/lib/schema.test.ts
git commit -m "feat(video): schema variation knobs — cardStyle, transitions, kenBurns pan, hookStyle, accents, burst style, caption emphasis

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 4: Ken Burns pan in ClipMedia

**Files:**
- Modify: `video/src/components/clip-media.tsx`
- Modify: `video/src/components/framed-clip.tsx` (prop type only)
- Modify: `video/src/compositions/showcase-reel.tsx` (prop type only)

**Interfaces:**
- Consumes: `KenBurns`, `normalizeKenBurns` from Task 3.
- Produces: `ClipMedia` accepts `kenBurns?: KenBurns`; pan drifts the image ±2.5% along the pan axis over the clip duration, with a 1.06 minimum scale so edges never show.

- [ ] **Step 1: Update ClipMedia**

Replace `video/src/components/clip-media.tsx` with:

```tsx
import type { KenBurns } from '../lib/schema'
import { Img, interpolate, OffthreadVideo, staticFile, useCurrentFrame } from 'remotion'
import { normalizeKenBurns } from '../lib/schema'

/**
 * Renders a clip source: video plays as-is; image gets a slow Ken Burns move
 * (zoom in/out, optional pan drift) so stills read as footage inside the reel.
 */
export function ClipMedia({
  src,
  kind,
  durationInFrames,
  kenBurns = 'in',
}: {
  src: string
  kind: 'video' | 'image'
  durationInFrames: number
  kenBurns?: KenBurns
}) {
  const frame = useCurrentFrame()

  if (kind === 'video') {
    return (
      <OffthreadVideo
        src={staticFile(src)}
        muted
        style={{ width: '100%', height: '100%', objectFit: 'cover' }}
      />
    )
  }

  const { zoom, pan } = normalizeKenBurns(kenBurns)
  const zoomRange = zoom === 'in' ? [1, 1.08] : [1.08, 1]
  // Panning needs headroom or the drift exposes the frame edge.
  const minScale = pan === 'none' ? 1 : 1.06
  const scale = Math.max(
    minScale,
    interpolate(frame, [0, durationInFrames], zoomRange, { extrapolateRight: 'clamp' }),
  )
  const drift = interpolate(frame, [0, durationInFrames], [0, 2.5], { extrapolateRight: 'clamp' })
  const tx = pan === 'left' ? -drift : pan === 'right' ? drift : 0
  const ty = pan === 'up' ? -drift : pan === 'down' ? drift : 0
  return (
    <Img
      src={staticFile(src)}
      style={{
        width: '100%',
        height: '100%',
        objectFit: 'cover',
        transform: `scale(${scale}) translate(${tx}%, ${ty}%)`,
      }}
    />
  )
}
```

- [ ] **Step 2: Widen the pass-through prop types**

In `video/src/components/framed-clip.tsx`: change the `kenBurns` prop type from `'in' | 'out'` to `KenBurns` (import `type { KenBurns } from '../lib/schema'`). No logic change — it forwards to `ClipMedia`.
In `video/src/compositions/showcase-reel.tsx`: no change needed (it forwards `clip.kenBurns` which is now the union type) — confirm tsc.

- [ ] **Step 3: Type-check, spot-render, commit**

Run: `pnpm tsc` — expected clean.
Run: `pnpm exec remotion still ShowcaseReel /tmp/claude-1000/-home-olis-solutions-olis-v3-nextjs-tri-pros-website/ccadbe1d-6080-4a64-aae8-7acacd09a593/scratchpad/kb-pan.png --props=props/bathrooms-showcase-reel-01.json --frame=40` — expected: renders without error (legacy string kenBurns path).

```bash
git add video/src/components/clip-media.tsx video/src/components/framed-clip.tsx
git commit -m "feat(video): ken burns pan axis in ClipMedia

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 5: Wire transitions into the composition

**Files:**
- Modify: `video/src/compositions/showcase-reel.tsx`

**Interfaces:**
- Consumes: `enterStyle`, `exitStyle`, `wipeEdge`, `TRANSITION_FRAMES` from Task 1.
- Produces: per-clip `transitionIn`/`transitionDirection` render for all six types; SVG whip-blur filter defs; blue wipe divider line.

- [ ] **Step 1: Replace the fade-only transition block**

In `showcase-reel.tsx`, replace the `FADE_FRAMES`/`clipSequences` block (currently lines 45–62) with:

```tsx
  // Transitions: the incoming clip renders ON TOP of the still-running
  // previous clip (its Sequence extends TRANSITION_FRAMES beneath). The
  // incoming gets enterStyle, the outgoing gets exitStyle (whip/zoomPunch
  // move it out; fade/dissolve/wipe leave it playing until covered).
  let clipStart = 0
  const clipSequences = props.clips.map((clip, index) => {
    const from = clipStart
    clipStart += clip.durationInFrames
    const next = props.clips[index + 1]
    const nextTransition = next?.transitionIn ?? 'none'
    const nextDirection = next?.transitionDirection ?? 'left'
    const nextFrom = from + clip.durationInFrames
    const holdUnder = TRANSITION_FRAMES[nextTransition]
    const enter = enterStyle(clip.transitionIn ?? 'none', clip.transitionDirection ?? 'left', frame - from)
    const exit = exitStyle(nextTransition, nextDirection, frame - nextFrom)
    const edge = wipeEdge(clip.transitionIn ?? 'none', frame - from)
    return { ...clip, from, index, holdUnder, enter, exit, wipeEdgePct: edge }
  })
```

Add the imports:

```tsx
import { enterStyle, exitStyle, TRANSITION_FRAMES, wipeEdge } from '../lib/transitions'
```

- [ ] **Step 2: Apply the styles in the clip render**

Replace the clip `<AbsoluteFill style={{ opacity: clip.enterOpacity }}>` wrapper with:

```tsx
          <AbsoluteFill
            style={{
              opacity: clip.enter.opacity * clip.exit.opacity,
              transform: clip.exit.transform !== 'none' ? clip.exit.transform : clip.enter.transform,
              clipPath: clip.enter.clipPath,
              filter: clip.exit.filter ?? clip.enter.filter,
            }}
          >
```

Inside that wrapper, after the brand-block conditional, add the wipe divider:

```tsx
            {clip.wipeEdgePct !== null && (clip.transitionDirection ?? 'left') === 'left' && (
              <div style={{ position: 'absolute', top: 0, bottom: 0, left: `${clip.wipeEdgePct}%`, width: 4, background: BRAND.blue }} />
            )}
            {clip.wipeEdgePct !== null && (clip.transitionDirection ?? 'left') === 'right' && (
              <div style={{ position: 'absolute', top: 0, bottom: 0, right: `${clip.wipeEdgePct}%`, width: 4, background: BRAND.blue }} />
            )}
            {clip.wipeEdgePct !== null && (clip.transitionDirection ?? 'left') === 'up' && (
              <div style={{ position: 'absolute', left: 0, right: 0, bottom: `${clip.wipeEdgePct}%`, height: 4, background: BRAND.blue }} />
            )}
            {clip.wipeEdgePct !== null && (clip.transitionDirection ?? 'left') === 'down' && (
              <div style={{ position: 'absolute', left: 0, right: 0, top: `${clip.wipeEdgePct}%`, height: 4, background: BRAND.blue }} />
            )}
```

Import `BRAND` (`import { BRAND } from '../lib/tokens'`).

- [ ] **Step 3: Add the whip-blur SVG filter defs**

At the top of the returned `<AbsoluteFill>` (before the clips layer), add:

```tsx
      {/* Directional motion-blur filters for whip transitions (referenced by url()). */}
      <svg width="0" height="0" style={{ position: 'absolute' }}>
        <defs>
          <filter id="whip-blur-x"><feGaussianBlur stdDeviation="40 0" /></filter>
          <filter id="whip-blur-y"><feGaussianBlur stdDeviation="0 40" /></filter>
        </defs>
      </svg>
```

- [ ] **Step 4: Verify back-compat + new types render**

Run: `pnpm tsc` — expected clean.
Run: `pnpm exec tsx --test src/lib/transitions.test.ts src/lib/schema.test.ts` — expected PASS.
Back-compat spot check (fade path must look identical): `pnpm exec remotion still ShowcaseReel /tmp/claude-1000/-home-olis-solutions-olis-v3-nextjs-tri-pros-website/ccadbe1d-6080-4a64-aae8-7acacd09a593/scratchpad/fade-mid.png --props=props/bathrooms-showcase-reel-01.json --frame=320` (frame 320 = 5f into the crew card's fade) — view the PNG: crew card semi-transparent over the morph, same as the shipped draft.

- [ ] **Step 5: Commit**

```bash
git add video/src/compositions/showcase-reel.tsx
git commit -m "feat(video): render whip/wipe/dissolve/zoomPunch clip transitions

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 6: Card styles in FramedClip

**Files:**
- Modify: `video/src/components/framed-clip.tsx`
- Modify: `video/src/compositions/showcase-reel.tsx` (pass `cardStyle` + `secondarySrc`)

**Interfaces:**
- Consumes: `ClipMedia` (Task 4).
- Produces: `FramedClip` accepts `cardStyle?: 'native' | 'polaroid' | 'split' | 'letterbox' | 'offset'` (default `'native'`) and `secondarySrc?: string | null`. All five render inside the existing enter spring (one motion per moment — the spring IS the entrance).

- [ ] **Step 1: Implement the card variants**

In `framed-clip.tsx`, add the props (`cardStyle = 'native'`, `secondarySrc = null`) and replace the single card `<div>` (the one with `aspectRatio`) with a variant switch. Keep the surrounding label/above flex column untouched.

```tsx
  const media = <ClipMedia src={src} kind={kind} durationInFrames={durationInFrames} kenBurns={kenBurns} />
  const enterTransform = `scale(${0.96 + enter * 0.04})`

  const card
    = cardStyle === 'polaroid'
      ? (
          // Instant-photo frame: white mat, deep chin, slight tilt.
          <div
            style={{
              width: '88%',
              alignSelf: 'center',
              background: '#ffffff',
              padding: '18px 18px 96px',
              borderRadius: 10,
              boxShadow: '0 24px 90px rgba(0,0,0,0.6)',
              opacity: enter,
              transform: `${enterTransform} rotate(-1.6deg)`,
            }}
          >
            <div style={{ aspectRatio: `${aspect}`, overflow: 'hidden', borderRadius: 4 }}>{media}</div>
          </div>
        )
      : cardStyle === 'split' && secondarySrc
        ? (
            // Before | after halves with a brand divider — the remodeling-native card.
            <div
              style={{
                width: '100%',
                aspectRatio: `${aspect}`,
                borderRadius: 28,
                overflow: 'hidden',
                display: 'flex',
                boxShadow: '0 24px 90px rgba(0,0,0,0.6)',
                opacity: enter,
                transform: enterTransform,
              }}
            >
              <div style={{ position: 'relative', flex: 1, overflow: 'hidden' }}>
                {media}
                <SplitTag text="BEFORE" />
              </div>
              <div style={{ width: 4, background: BRAND.blue }} />
              <div style={{ position: 'relative', flex: 1, overflow: 'hidden' }}>
                <ClipMedia src={secondarySrc} kind="image" durationInFrames={durationInFrames} kenBurns={kenBurns} />
                <SplitTag text="AFTER" />
              </div>
            </div>
          )
        : cardStyle === 'letterbox'
          ? (
              // Cinematic bleed: edge-to-edge (escapes the SafeZone padding), hairline rules.
              <div
                style={{
                  width: '113%',
                  alignSelf: 'center',
                  aspectRatio: `${aspect}`,
                  borderTop: `2px solid ${BRAND.blue}`,
                  borderBottom: `2px solid ${BRAND.blue}`,
                  overflow: 'hidden',
                  opacity: enter,
                  transform: enterTransform,
                }}
              >
                {media}
              </div>
            )
          : cardStyle === 'offset'
            ? (
                // Editorial asymmetry: card hugs the left, vertical rule fills the right gap.
                <div style={{ width: '100%', display: 'flex', alignItems: 'stretch', gap: 24, opacity: enter, transform: enterTransform }}>
                  <div style={{ width: '84%', aspectRatio: `${aspect}`, borderRadius: 28, overflow: 'hidden', boxShadow: '0 24px 90px rgba(0,0,0,0.6)' }}>
                    {media}
                  </div>
                  <div style={{ flex: 1, display: 'flex', justifyContent: 'center' }}>
                    <div style={{ width: 4, borderRadius: 2, background: BRAND.blue }} />
                  </div>
                </div>
              )
            : (
                // native — the house v5 card, unchanged.
                <div
                  style={{
                    width: '100%',
                    aspectRatio: `${aspect}`,
                    borderRadius: 28,
                    overflow: 'hidden',
                    boxShadow: '0 24px 90px rgba(0,0,0,0.6)',
                    opacity: enter,
                    transform: enterTransform,
                  }}
                >
                  {media}
                </div>
              )
```

Render `{card}` where the old card div was. Add the tag helper in the same file (used only by split):

```tsx
function SplitTag({ text }: { text: string }) {
  return (
    <div
      style={{
        position: 'absolute',
        bottom: 14,
        left: 14,
        fontFamily: BODY_FONT,
        fontWeight: 800,
        fontSize: 20,
        letterSpacing: '0.18em',
        color: '#ffffff',
        background: 'rgba(0,0,0,0.55)',
        borderRadius: 6,
        padding: '6px 12px',
      }}
    >
      {text}
    </div>
  )
}
```

- [ ] **Step 2: Pass the new props from the composition**

In `showcase-reel.tsx`, the `FramedClip` call gains:

```tsx
                    cardStyle={clip.cardStyle ?? 'native'}
                    secondarySrc={clip.secondarySrc ?? null}
```

- [ ] **Step 3: Type-check, spot-render each style, commit**

Run: `pnpm tsc` — expected clean.
Spot-render: copy `props/bathrooms-showcase-reel-01.json` to the scratchpad, set `clips[2].cardStyle` to each of `polaroid`, `letterbox`, `offset` in turn and `remotion still --frame=340` each to the scratchpad; for `split`, also set `clips[2].secondarySrc: "stills/bathrooms-final-picasso.jpg"`. View all four PNGs — card renders, label chip still above, nothing clipped outside safe zones (letterbox intentionally bleeds horizontally).

```bash
git add video/src/components/framed-clip.tsx video/src/compositions/showcase-reel.tsx
git commit -m "feat(video): five framed-card styles — native, polaroid, split, letterbox, offset

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 7: PhotoBurst styles

**Files:**
- Modify: `video/src/components/photo-burst.tsx`
- Modify: `video/src/compositions/showcase-reel.tsx` (pass `style`)

**Interfaces:**
- Produces: `PhotoBurst` accepts `style?: 'fullbleed' | 'polaroid-scatter' | 'grid'` (default `'fullbleed'` = current behavior, untouched code path).

- [ ] **Step 1: Implement the variants**

In `photo-burst.tsx`, add the `style = 'fullbleed'` prop. Keep the existing map body as the `fullbleed` branch. Add:

```tsx
        // Deterministic per-photo layout (no Math.random — renders must be reproducible).
        const SCATTER = [
          { left: '6%', top: '12%', rotate: -6 },
          { left: '30%', top: '30%', rotate: 4 },
          { left: '10%', top: '46%', rotate: -3 },
          { left: '34%', top: '10%', rotate: 7 },
        ]
        const GRID = [
          { left: '2%', top: '16%' },
          { left: '51%', top: '16%' },
          { left: '2%', top: '50%' },
          { left: '51%', top: '50%' },
        ]
```

For `polaroid-scatter`, each photo (same `settle` spring; entrance is the one motion) renders:

```tsx
          <div
            key={photo.src}
            style={{
              position: 'absolute',
              left: SCATTER[i % SCATTER.length]!.left,
              top: SCATTER[i % SCATTER.length]!.top,
              width: '58%',
              background: '#ffffff',
              padding: '12px 12px 56px',
              borderRadius: 8,
              boxShadow: '0 18px 60px rgba(0,0,0,0.55)',
              opacity: Math.min(1, local / 2),
              transform: `scale(${1.08 - settle * 0.08}) rotate(${SCATTER[i % SCATTER.length]!.rotate}deg)`,
            }}
          >
            <Img src={staticFile(photo.src)} style={{ width: '100%', aspectRatio: '4 / 5', objectFit: 'cover', borderRadius: 3 }} />
          </div>
```

For `grid`, each photo lands in its 2×2 cell (47% × 32% cells, positioned by `GRID[i % 4]`), same opacity/settle entrance, no rotation, `borderRadius: 20`, no drift. Behind the cells, nothing changes — the underlying clip stays visible in the gutters.

- [ ] **Step 2: Pass from composition**

```tsx
              <PhotoBurst
                style={props.photoBurst.style ?? 'fullbleed'}
                photos={props.photoBurst.photos.map(p => ({ ...p, frame: p.frame - clip.from }))}
              />
```

- [ ] **Step 3: Type-check, spot-render, commit**

Run: `pnpm tsc` — clean. Spot-render bathrooms props with `photoBurst.style: "polaroid-scatter"` at `--frame=470` and `"grid"` at `--frame=560` to the scratchpad; view — photos land in scatter/grid positions, no overflow past frame edges.

```bash
git add video/src/components/photo-burst.tsx video/src/compositions/showcase-reel.tsx
git commit -m "feat(video): photo-burst styles — polaroid scatter + grid assemble

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 8: Hook styles in HookTitle

**Files:**
- Modify: `video/src/components/hook-title.tsx`
- Modify: `video/src/compositions/showcase-reel.tsx` (pass `hookStyle`)

**Interfaces:**
- Produces: `HookTitle` accepts `style?: 'wordStagger' | 'punch' | 'freeze' | 'typewriter'` (default `'wordStagger'` = current). All variants keep the blue underline draw-on and the existing typography.

- [ ] **Step 1: Implement variants**

Keep the outer flex/typography div. Branch the word rendering:

- `wordStagger`: current per-word spring (unchanged).
- `punch`: whole title as one block — `spring({ frame, fps, config: { damping: 12, stiffness: 200 } })`, `opacity: Math.min(1, frame / 3)`, `transform: scale(${0.85 + progress * 0.15})` (overshoots ~1.05 by damping 12, editing-patterns text-punch params). Pair with a 2f flash + thud in props (documented in variation-axes.md, not code).
- `freeze`: instant full text at frame 0 (`opacity: Math.min(1, frame / 2)`), wrapper `transform: scale(${interpolate(frame, [0, 75], [1, 1.06])})` — the slow 110% push from the freeze-frame pattern, applied to the title block.
- `typewriter`: characters appear sequentially, 1.5f per char, with a `▍` caret after the last visible char while typing:

```tsx
        const chars = text.split('')
        const visible = Math.floor(frame / 1.5)
        return (
          <div style={{ whiteSpace: 'pre-wrap' }}>
            {chars.slice(0, visible).join('')}
            {visible < chars.length && <span style={{ color: BRAND.blue }}>▍</span>}
          </div>
        )
```

The underline draw-on stays for all variants (its spring starts after the text completes: `words.length * 3` for wordStagger, `10` for punch/freeze, `chars.length * 1.5` for typewriter).

- [ ] **Step 2: Pass from composition**

```tsx
          <HookTitle text={props.hook} style={props.hookStyle ?? 'wordStagger'} />
```

- [ ] **Step 3: Type-check, spot-render, commit**

Run: `pnpm tsc` — clean. Spot-render bathrooms props with `hookStyle` set to each variant at `--frame=55` (mid-hook) to the scratchpad; view all four — text legible over the scrim, underline present, typewriter caret visible mid-type.

```bash
git add video/src/components/hook-title.tsx video/src/compositions/showcase-reel.tsx
git commit -m "feat(video): hook styles — punch, freeze-push, typewriter variants

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 9: Wire accents (color pop + screen shake)

**Files:**
- Modify: `video/src/compositions/showcase-reel.tsx`

**Interfaces:**
- Consumes: `colorPopSaturation`, `screenShakeOffset` from Task 2.

- [ ] **Step 1: Apply to the clips layer**

In `showcase-reel.tsx`, import both from `../lib/accents`, then compute above the return:

```tsx
  const saturation = colorPopSaturation(frame, props.colorPops ?? [])
  const shake = screenShakeOffset(frame, props.screenShakes ?? [])
```

Change the clips-layer wrapper (currently `transform: scale(${punchScale * revealScale})`) to:

```tsx
      <AbsoluteFill
        style={{
          transform: `translate(${shake.x}px, ${shake.y}px) scale(${punchScale * revealScale})`,
          filter: saturation < 1 ? `saturate(${saturation})` : undefined,
        }}
      >
```

(`punchScale`/`revealScale` stay — deprecated but still honored for legacy props; both arrays are `[]` going forward.)

- [ ] **Step 2: Type-check, spot-render, commit**

Run: `pnpm tsc` — clean. Spot-render bathrooms props with `"colorPops": [300]` at `--frame=280` (desaturated) and `--frame=302` (color snapping back) to the scratchpad; view both.

```bash
git add video/src/compositions/showcase-reel.tsx
git commit -m "feat(video): color-pop and screen-shake accents in ShowcaseReel

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 10: Caption emphasis plumbing (pagination + transcribe markup)

**Files:**
- Modify: `video/src/lib/paginate-captions.ts` (carry `emphasis` through tokens)
- Modify: `video/src/lib/paginate-captions.test.ts` (add emphasis case)
- Create: `video/scripts/lib/parse-emphasis.mjs`
- Test: `video/scripts/lib/parse-emphasis.test.mjs`
- Modify: `video/scripts/transcribe.mjs`

**Interfaces:**
- Produces: `CaptionToken` and `WordInput` gain `emphasis?: boolean`; `paginateCaptions` copies the flag onto tokens. `parseScriptEmphasis(script: string): { words: string[], emphasis: boolean[], plainScript: string }` — `*…*` spans (single word or multi-word phrase) mark emphasis; `plainScript` has the markers stripped. `transcribe.mjs` accepts the marked-up `--script`, matches against `plainScript` words, and writes `emphasis: true` onto the marked words in `wordCaptions`.

- [ ] **Step 1: Write the failing tests**

Append to `video/src/lib/paginate-captions.test.ts`:

```ts
test('emphasis flag rides through to tokens', () => {
  const pages = paginateCaptions([
    { text: 'a', startMs: 0, endMs: 100 },
    { text: ' spa', startMs: 100, endMs: 300, emphasis: true },
    { text: ' feeling', startMs: 300, endMs: 600, emphasis: true },
  ])
  assert.deepEqual(pages[0]!.tokens.map(t => t.emphasis ?? false), [false, true, true])
})
```

Create `video/scripts/lib/parse-emphasis.test.mjs`:

```js
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { parseScriptEmphasis } from './parse-emphasis.mjs'

test('single emphasized word', () => {
  const r = parseScriptEmphasis('built with *AAA-grade* materials')
  assert.deepEqual(r.words, ['built', 'with', 'AAA-grade', 'materials'])
  assert.deepEqual(r.emphasis, [false, false, true, false])
  assert.equal(r.plainScript, 'built with AAA-grade materials')
})

test('multi-word emphasized phrase', () => {
  const r = parseScriptEmphasis('that *spa feeling*, every day')
  assert.deepEqual(r.words, ['that', 'spa', 'feeling,', 'every', 'day'])
  assert.deepEqual(r.emphasis, [false, true, true, false, false])
})

test('no markers = no emphasis', () => {
  const r = parseScriptEmphasis('homeowners only')
  assert.deepEqual(r.emphasis, [false, false])
})
```

Run: `pnpm exec tsx --test src/lib/paginate-captions.test.ts scripts/lib/parse-emphasis.test.mjs`
Expected: FAIL (module missing + tokens lack emphasis).

- [ ] **Step 2: Implement**

`paginate-captions.ts` — add `emphasis?: boolean` to both `CaptionToken` and `WordInput`; in the token map add `emphasis: word.emphasis ?? false`.

`video/scripts/lib/parse-emphasis.mjs`:

```js
/**
 * `*span*` markup → per-word emphasis flags. Spans may cover multiple words
 * ("*spa feeling*"); punctuation outside the markers stays attached to the
 * word ("*spa feeling*," → "feeling,"). plainScript is what whisper matching
 * and TTS should see — markers stripped, text otherwise identical.
 */
export function parseScriptEmphasis(script) {
  const segments = script.split('*')
  const words = []
  const emphasis = []
  for (let i = 0; i < segments.length; i++) {
    const emphasized = i % 2 === 1
    for (const chunk of segments[i].split(/\s+/)) {
      if (!chunk)
        continue
      // Punctuation trailing a closing marker glues onto the previous word.
      if (/^[.,!?…—-]+$/.test(chunk) === false || words.length === 0) {
        words.push(chunk)
        emphasis.push(emphasized)
      }
      else {
        words[words.length - 1] += chunk
      }
    }
  }
  // Re-glue punctuation that directly followed a closing `*` with no space.
  const merged = []
  const mergedEmphasis = []
  for (let i = 0; i < words.length; i++) {
    if (i > 0 && /^[.,!?…]/.test(words[i]) && !/\s/.test(words[i])) {
      merged[merged.length - 1] += words[i]
      continue
    }
    merged.push(words[i])
    mergedEmphasis.push(emphasis[i])
  }
  return { words: merged, emphasis: mergedEmphasis, plainScript: merged.join(' ') }
}
```

⚠️ Implementation note: the two-pass glue above is the subtle part — `"*spa feeling*, every"` splits into segments `['', 'spa feeling', ', every']`, so segment 3 starts with `', every'` whose first chunk is `,` alone IF the comma is space-separated, but here `.split(/\s+/)` on `', every'` yields `[',', 'every']` — the leading `,` must merge onto `feeling`. Make the tests pass exactly as written; simplify the implementation if a cleaner one passes them.

`transcribe.mjs` — replace the script-word handling:

```js
import { parseScriptEmphasis } from './lib/parse-emphasis.mjs'
// ...
const { words: scriptWords, emphasis } = parseScriptEmphasis(script)
```

(delete the old `const scriptWords = script.split(/\s+/).filter(Boolean)`), and in the final props write:

```js
props.wordCaptions = scriptWords.map((word, j) => ({
  text: `${j === 0 ? '' : ' '}${word}`,
  ...result[j],
  emphasis: emphasis[j],
}))
```

- [ ] **Step 3: Run tests, type-check, commit**

Run: `pnpm exec tsx --test src/lib/paginate-captions.test.ts scripts/lib/parse-emphasis.test.mjs` — PASS.
Run: `pnpm tsc` — clean.

```bash
git add video/src/lib/paginate-captions.ts video/src/lib/paginate-captions.test.ts video/scripts/lib/parse-emphasis.mjs video/scripts/lib/parse-emphasis.test.mjs video/scripts/transcribe.mjs
git commit -m "feat(video): *word* emphasis markup — transcribe → wordCaptions → pagination

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 11: RevealCaptions component (retire KaraokeCaptions)

**Files:**
- Create: `video/src/components/reveal-captions.tsx`
- Delete: `video/src/components/karaoke-captions.tsx`
- Modify: `video/src/lib/fonts.ts` (emphasis font candidates)
- Modify: `video/src/compositions/showcase-reel.tsx` (swap component)
- Modify: `.claude/skills/showcase-ads/SKILL.md` is NOT touched here (Task 15 owns it)

**Interfaces:**
- Consumes: `paginateCaptions` tokens with `emphasis` (Task 10).
- Produces: `RevealCaptions` with the same props shape as the old `KaraokeCaptions` (`wordCaptions`, `voStartFrame`, `hideBeforeFrame`, `vertical`). Behavior: page holds gapless as before, but each word is INVISIBLE until its own `fromMs`, then fades/rises in over 3 frames — the line assembles under the voice. Emphasis words render in `EMPHASIS_FONT`, `BRAND.blue`, `scale(1.15)`, normal-case italic (they break the uppercase wall deliberately).

- [ ] **Step 1: Add the emphasis font**

`video/src/lib/fonts.ts` — Playfair italic is candidate #1 (already the display family; italic adds no new family), Fraunces italic #2, Cormorant Garamond italic #3. Ship with all three loaded so the Task 12 samples are pure prop switches, then strip the losers in Task 12:

```ts
import { loadFont as loadCormorant } from '@remotion/google-fonts/CormorantGaramond'
import { loadFont as loadFraunces } from '@remotion/google-fonts/Fraunces'
import { loadFont as loadNunito } from '@remotion/google-fonts/Nunito'
import { loadFont as loadPlayfair } from '@remotion/google-fonts/PlayfairDisplay'

const playfair = loadPlayfair('normal', { weights: ['700', '800'] })
const playfairItalic = loadPlayfair('italic', { weights: ['700'] })
const fraunces = loadFraunces('italic', { weights: ['700'] })
const cormorant = loadCormorant('italic', { weights: ['700'] })
const nunito = loadNunito('normal', { weights: ['600', '700', '800'] })

export const DISPLAY_FONT = playfair.fontFamily
export const BODY_FONT = nunito.fontFamily
/** Luxe serif for emphasized caption words — Oliver picks from rendered samples, then freeze. */
export const EMPHASIS_FONT_CANDIDATES = {
  playfair: playfairItalic.fontFamily,
  fraunces: fraunces.fontFamily,
  cormorant: cormorant.fontFamily,
} as const
export const EMPHASIS_FONT = EMPHASIS_FONT_CANDIDATES.playfair
```

- [ ] **Step 2: Write RevealCaptions**

```tsx
// video/src/components/reveal-captions.tsx
import type { WordInput } from '../lib/paginate-captions'
import { useMemo } from 'react'
import { interpolate, useCurrentFrame, useVideoConfig } from 'remotion'
import { BODY_FONT, EMPHASIS_FONT } from '../lib/fonts'
import { paginateCaptions } from '../lib/paginate-captions'
import { BRAND } from '../lib/tokens'

/**
 * Build-as-spoken captions: the page's words are invisible until each word's
 * own whisper timestamp, then fade/rise in over 3 frames — the line assembles
 * exactly under the narrator. Page visibility stays gapless
 * (paginate-captions.ts), so the text block never blinks between sentences.
 * Emphasis words (marked `*word*` in the VO script) break the uppercase wall:
 * luxe serif italic, brand blue, 1.15×.
 */
export function RevealCaptions({
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

  const REVEAL_FRAMES = 3
  const msPerFrame = 1000 / fps

  return (
    <div
      style={{
        position: 'absolute',
        top: `${vertical * 100}%`,
        left: 0,
        right: 0,
        transform: 'translateY(-50%)',
        display: 'flex',
        justifyContent: 'center',
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
          // Word reveals at its own timestamp; already-spoken words on a
          // fresh page show instantly (the page itself just appeared).
          const framesSinceSpoken = (audioMs - token.fromMs) / msPerFrame
          const reveal = interpolate(framesSinceSpoken, [0, REVEAL_FRAMES], [0, 1], {
            extrapolateLeft: 'clamp',
            extrapolateRight: 'clamp',
          })
          const emphasized = token.emphasis === true
          return (
            <span key={`${token.fromMs}-${i}`} style={{ whiteSpace: 'pre' }}>
              {i > 0 ? ' ' : ''}
              <span
                style={{
                  display: 'inline-block',
                  opacity: reveal,
                  transform: `translateY(${(1 - reveal) * 14}px)${emphasized ? ' scale(1.15)' : ''}`,
                  ...(emphasized
                    ? {
                        fontFamily: EMPHASIS_FONT,
                        fontStyle: 'italic',
                        textTransform: 'none',
                        color: BRAND.blue,
                      }
                    : {}),
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

- [ ] **Step 3: Swap in the composition, delete the old component**

In `showcase-reel.tsx`: replace the `KaraokeCaptions` import + usage with `RevealCaptions` (identical props). Delete `video/src/components/karaoke-captions.tsx`.

- [ ] **Step 4: Type-check, spot-render, commit**

Run: `pnpm tsc` — clean (the delete surfaces any stale imports).
Spot-render bathrooms props at `--frame=170` (mid-sentence: some words revealed, the current one mid-rise) and `--frame=176` to the scratchpad; view — words assemble left-to-right, no page blink.
To see emphasis: in the scratchpad props copy, set `"emphasis": true` on the `"AAA-grade"` wordCaption, render `--frame=170`, view — serif italic blue word inside the white uppercase line.

```bash
git add video/src/components/reveal-captions.tsx video/src/lib/fonts.ts video/src/compositions/showcase-reel.tsx
git rm video/src/components/karaoke-captions.tsx
git commit -m "feat(video): build-as-spoken RevealCaptions with luxe emphasis words; retire karaoke captions

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 12: Emphasis font pick — HITL gate ⛔

**Files:**
- Modify: `video/src/lib/fonts.ts` (freeze the winner, strip losers)

- [ ] **Step 1: Render the three candidates**

Using the Task 11 scratchpad props (bathrooms with `AAA-grade` emphasized), render the same caption frame three times, switching `EMPHASIS_FONT = EMPHASIS_FONT_CANDIDATES.playfair | .fraunces | .cormorant` between renders:

```bash
pnpm exec remotion still ShowcaseReel /mnt/c/Users/porat/Downloads/caption-font-A-playfair.png --props=<scratchpad-props> --frame=170
# edit fonts.ts EMPHASIS_FONT → fraunces, render caption-font-B-fraunces.png; → cormorant, caption-font-C-cormorant.png
```

- [ ] **Step 2: STOP for Oliver's pick**

Deliver the three PNGs to Downloads and stop: "Pick the emphasis serif — A Playfair italic / B Fraunces italic / C Cormorant italic."

- [ ] **Step 3: Freeze the pick**

Set `EMPHASIS_FONT` to the winner; delete the losing `loadFont` calls and the `EMPHASIS_FONT_CANDIDATES` map (keep a comment naming the ruling + date).

Run: `pnpm tsc` — clean.

```bash
git add video/src/lib/fonts.ts
git commit -m "feat(video): freeze house emphasis serif (Oliver pick 2026-07-13)

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 13: Music library build + manifest

**Files:**
- Create: `video/public/audio/music-manifest.json` (committed — the one exception in the gitignored audio dir; verify `git check-ignore` and add a negation line to the ignore file if needed)
- Generated (NOT committed): `video/public/audio/music-bed-03…-10.m4a`

- [ ] **Step 1: Check Higgsfield + generate 7 new beds**

`higgsfield account status` (balance was ~130cr on 2026-07-10; 7 beds ≈ 14cr). Then for each brief, `higgsfield generate create sonilo_music --duration 30 --prompt "<brief>" --wait` (background Bash, sequential is fine). Briefs — every one names an explicit BPM and "no vocals":

1. `music-bed-03-cinematic-build` — "cinematic build, warm strings and soft piano swelling to a bright finish, hopeful, 90 BPM, no vocals"
2. `music-bed-04-warm-piano` — "intimate warm piano with soft pads, elegant and calm, premium home feel, 80 BPM, no vocals"
3. `music-bed-05-clap-stomp` — "percussive clap-and-stomp rhythm with bright acoustic hits, confident and punchy, 110 BPM, no vocals"
4. `music-bed-06-soul-retro` — "retro soul groove, warm bass, wurlitzer keys, feel-good swagger, 100 BPM, no vocals"
5. `music-bed-07-minimal-pulse` — "minimal electronic pulse, clean modern tech feel, understated confidence, 120 BPM, no vocals"
6. `music-bed-08-acoustic-sunrise` — "gentle acoustic fingerpicking with light shaker, fresh morning optimism, 95 BPM, no vocals"
7. `music-bed-09-orchestral-luxe` — "light orchestral strings with plucked pizzicato, luxury real-estate elegance, 105 BPM, no vocals"

Download each result URL with curl into the scratchpad, listen-check via a 5s ffmpeg waveform sanity (non-silent), copy keepers to `video/public/audio/<name>.m4a`. Re-roll any dud once.

- [ ] **Step 2: Write the manifest**

`video/public/audio/music-manifest.json`:

```json
{
  "beds": [
    { "file": "music-bed-01.m4a", "brief": "legacy bed (pre-manifest); regenerate via sonilo if lost", "bpm": null, "vibe": "mellow" },
    { "file": "music-bed-02-upbeat.m4a", "brief": "upbeat feel-good, bright acoustic strums, claps, light driving percussion, optimistic, radio-ad polish, no vocals", "bpm": null, "vibe": "upbeat acoustic — used by kitchens-02 AND bathrooms-01" },
    { "file": "music-bed-03-cinematic-build.m4a", "brief": "cinematic build, warm strings and soft piano swelling to a bright finish, hopeful, 90 BPM, no vocals", "bpm": 90, "vibe": "cinematic build" }
  ]
}
```

…one entry per bed (all 9), each `brief` verbatim-regenerable, `bpm` as prompted. Beat grid note in a top-level `"note"` field: `"beat = 1800/bpm frames @30fps; snap chapter cuts + SFX hits to downbeats"`.

- [ ] **Step 3: Commit the manifest**

`git check-ignore video/public/audio/music-manifest.json` — if ignored, append `!video/public/audio/music-manifest.json` (adjusted to the actual ignore file location/pattern) and stage the ignore file too.

```bash
git add video/public/audio/music-manifest.json
git commit -m "feat(video): curated music-bed library manifest (9 beds, BPM beat grids)

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 14: Back-compat re-renders + knob-demo QA

**Files:**
- Generated only (scratchpad + `video/out/`, nothing committed)

- [ ] **Step 1: Re-render both shipped reels**

```bash
pnpm exec remotion render ShowcaseReel out/kitchens-showcase-reel-02-newcaptions.mp4 --props=props/kitchens-showcase-reel-02.json
pnpm exec remotion render ShowcaseReel out/bathrooms-showcase-reel-01-newcaptions.mp4 --props=props/bathrooms-showcase-reel-01.json
```

Extract QA frames at the known beats (hook 55, snap 76, captions 170/240, crew 340, burst 470, checkmarks 700, end card 800) and VIEW each: everything identical to the shipped drafts EXCEPT captions, which now build word-by-word. Copy both mp4s to `/mnt/c/Users/porat/Downloads/` for Oliver (he reviews the new caption look on real reels).

- [ ] **Step 2: Knob demo**

Build `<scratchpad>/demo-variations.json` from the bathrooms props: clip transitions set to `whip(left)`, `wipe(right)`, `dissolve`, `zoomPunch` across clips 1–4; `cardStyle` polaroid on clip 2, split on clip 4 (secondarySrc = picasso still); `photoBurst.style: "grid"`; `hookStyle: "typewriter"`; `colorPops: [300]`; `screenShakes: [{"frame": 756, "intensity": 0.7}]`. Render, extract frames mid-transition (each cut frame +4) and at each styled beat, VIEW all. Fix anything broken before proceeding (this is the integration test for Tasks 5–9).

- [ ] **Step 3: Report**

No commit (renders never committed). Note QA results in the session; deliver demo mp4 to Downloads only if something is worth Oliver's eyes.

---

### Task 15: Variation ledger + variation-axes doc + SKILL.md restructure

**Files:**
- Create: `video/props/variation-ledger.md`
- Create: `docs/marketing/editing/variation-axes.md` (canonical)
- Create symlink: `.claude/skills/showcase-ads/references/variation-axes.md` → `../../../../docs/marketing/editing/variation-axes.md` (match the existing symlink style — check with `ls -la .claude/skills/showcase-ads/references/`)
- Modify: `.claude/skills/showcase-ads/SKILL.md`

- [ ] **Step 1: Write the ledger with backfill**

```markdown
# Variation ledger — Showcase reels

One row per reel. RULE: a new reel may not repeat the previous reel's value on ANY of
axes 1–5 (hook, transitions, cards, pacing, music). Axes 6–7 vary freely but are recorded.
Append the new row in the SAME commit as the props file. Full menus: variation-axes.md.

| Date | Trade | Props | 1 Hook (style · phrasing) | 2 Transitions | 3 Cards · Burst | 4 Pacing | 5 Music | 6 Accent | 7 Text set |
|---|---|---|---|---|---|---|---|---|---|
| 2026-07-08 | kitchens | kitchens-showcase-reel-02.json | wordStagger · "We're Selecting 5 Kitchens in Your Area" | fade | framed-native · fullbleed | standard | music-bed-02-upbeat | none | checkmarks-v1 |
| 2026-07-10 | bathrooms | bathrooms-showcase-reel-01.json | wordStagger · "We're Selecting 5 Bathrooms in Your Area" | fade | framed-native · fullbleed | standard | music-bed-02-upbeat | none | checkmarks-v1 |

⚠️ Rows 1–2 are identical on every axis — that duplication is exactly what this ledger exists to prevent.
```

- [ ] **Step 2: Write `docs/marketing/editing/variation-axes.md`**

Content: the spec's §1 table verbatim (constants list + 7-axis table + hard rule), plus per-axis implementation notes mapping menu → schema knob (`hookStyle` values; `transitionIn`/`transitionDirection` with the one-family-per-reel rule and the snap exemption; `cardStyle`/`secondarySrc` + `photoBurst.style`; pacing recipes as concrete `durationInFrames` guidance — standard = v5 timings listed, brisk = holds ×0.7 with min 60f and one extra burst beat, cinematic = holds ×1.3 + `dissolve` family + kenBurns pans; music = manifest rotation + beat-grid math `beat = 1800/bpm frames`; accents = `colorPops`/`screenShakes` + one-motion-per-moment constraint; text sets = named checkmark/end-card copy variants with the two current sets defined inline). Include the audit rule: every menu item must exist in the composition and vice versa — reconcile on any change to either.

- [ ] **Step 3: Restructure SKILL.md**

Edits (keep everything not listed):
1. **"Assemble & render" section** — replace "House timeline (v5 baseline — `props/kitchens-showcase-reel-02.json` is the canonical example)" with **"The fixed narrative skeleton"**: the sequence only (cold open+logo → snap → morph → crew card → burst hero → proof/checkmarks card → end card), VO/script-skeleton rules, and this warning verbatim: *"Every step's PRESENTATION comes from the variation menus (`references/variation-axes.md`) — `kitchens-showcase-reel-02.json` is ONE point in variation space; copying its presentation values into a new reel is a defect, not a shortcut."*
2. **New section "Variation axes + ledger (MANDATORY for create mode)"** right after the skeleton: pointer to `references/variation-axes.md` + `video/props/variation-ledger.md`; the hard rule (axes 1–5 differ from previous reel); the workflow: *draft the creative direction from the ledger BEFORE asset generation and present it AT THE SAME STOP as the base-pair gallery (one combined HITL gate); after approval the props realize it; append the ledger row in the same commit as the props file.*
3. **Captions section** — rewrite the rendering paragraph: `RevealCaptions` (build-as-spoken: words fade/rise at their own whisper timing; emphasis words marked `*word*` in the `--script` render in the frozen luxe serif + brand blue; the `wordSpacing` gotcha note stays). Add: mark 1–3 emphasis spans per script, always the offer-loaded words ("AAA-grade", "Showcase price", trade-specific hero phrases like "spa feeling").
4. **Music bullet** in Higgsfield recipes — replace the house-default line with: rotate via `video/public/audio/music-manifest.json` (bed ≠ previous reel's, per ledger); new beds only when the library gap is real; always an explicit BPM in the prompt; snap chapter cuts + SFX to `1800/bpm`-frame downbeats.
5. **Editing-patterns section** — update the "Schema knobs already implemented" list to include the new knobs (`hookStyle`, extended `transitionIn` + `transitionDirection`, `cardStyle` + `secondarySrc`, `kenBurns {zoom, pan}`, `photoBurst.style`, `colorPops`, `screenShakes`) and delete the "Not yet implemented" bullet's whip/wipe/color-pop entries (keep speed ramps as not-implemented).

- [ ] **Step 4: Symlink + verify + commit**

```bash
ls -la .claude/skills/showcase-ads/references/  # confirm existing symlink style
ln -s ../../../../docs/marketing/editing/variation-axes.md .claude/skills/showcase-ads/references/variation-axes.md
pnpm tsc  # (video/) still clean
git add video/props/variation-ledger.md docs/marketing/editing/variation-axes.md .claude/skills/showcase-ads/references/variation-axes.md .claude/skills/showcase-ads/SKILL.md
git commit -m "docs(skills): showcase-ads variation axes, ledger, creative-direction gate; demote kitchens-02 to one-point-in-space

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 16: Full verification + memory sync

- [ ] **Step 1: Full test + type pass**

```bash
cd video && pnpm tsc && pnpm exec tsx --test src/lib/*.test.ts scripts/lib/*.test.mjs
```

Expected: clean tsc, all tests pass.

- [ ] **Step 2: Update session memory**

Update `memory/project-video-creative-pipeline.md` (memory dir): note the variation system shipped (axes/ledger/RevealCaptions/music manifest), pointer to the spec + `variation-axes.md`. One-line hook already exists in MEMORY.md — extend it if the description changed materially.

- [ ] **Step 3: Final report to Oliver**

Summarize: what shipped, the two re-rendered reels in Downloads (new captions — his call whether to re-publish), the font pick made in Task 12, remaining Higgsfield balance after the music session, and that the next reel created MUST exercise the ledger (first real proof).
