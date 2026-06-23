# Funnel ZIP service-area validation — design spec

Status: drafted (2026-06-22). Brainstormed in this session. Next: writing-plans.
Scope: the funnel's standalone ZIP step. (Intake + general-inquiry get ZIP from Google
address autocomplete — valid by construction — so they are NOT in scope.)

## Goal

Turn the funnel ZIP step's soft territory check into a **real service-area gate**: a ZIP
outside Tri Pros' service area is **rejected at the input** with "We don't serve your area
yet," the user edits the ZIP and retries, and only an in-area ZIP lets the funnel advance.
The **ZIP** is rejected, never the lead (the ZIP step precedes PII, so no lead exists yet).

## Background — what already exists (verified in code)

- `classifyZip(zip)` (`src/shared/domains/funnels/lib/resolve-zip.ts`) returns
  `'in-area' | 'out-of-area' | 'invalid-format'` — but **`'out-of-area'` is declared and
  never returned**: today the SoCal range `/^9[0-3]\d{3}$/` maps the *whole* range to
  `in-area`. So the territory gate is effectively off.
- `resolveZip(zip)` — local `CA_ZIP_CITIES` cache (free, instant) → **zippopotam.us** (free,
  no key) fallback for city/state; discriminated `ok | not-found | error`.
- `useLiveZipResolve` — debounced, abortable, only resolves when `classifyZip === 'in-area'`.
- **The out-of-area UX is already scaffolded but dark:** `zip-step.tsx` computes
  `showOutOfArea`, renders `content.outOfAreaLabel` in the reserved status slot, and the
  advance button is `disabled={!resolved}` (and `resolved` is only set for in-area ZIPs). So
  the moment `classifyZip` returns `out-of-area`, the message shows and the button stays
  disabled — **no new UX wiring needed.**

## Service area (locked)

| County | Inclusion |
|---|---|
| **Los Angeles** | Whole county (SFV, Santa Clarita, Antelope Valley incl. Lake LA, Pasadena/SGV — all). |
| **San Bernardino** | Western strip only (LA line east **through Fontana**): Chino Hills, Chino, Montclair, Ontario, Upland, Rancho Cucamonga, Fontana. Nothing past Fontana — **no** Rialto/Colton/San Bernardino city/Redlands, **no** High Desert (Victorville/Hesperia/Apple Valley), Mojave (Barstow/Needles/29 Palms), or mountains (Big Bear). |
| **Riverside** | Western sliver only, pressed against the LA/Orange corner: **Corona, Norco, Mira Loma**. **No** Riverside city, Moreno Valley, Perris, Temecula, Hemet, and **no** Coachella Valley (Palm Springs/Indio/etc.) or Blythe. |
| **Ventura** | West to and including the **city of Ventura** (Thousand Oaks, Simi, Moorpark, Camarillo, Oxnard, Ventura). |
| **Orange** | North/central, south to **~Laguna Beach** (excludes Dana Point / San Juan Capistrano / San Clemente). |
| **Kern** | **Rosamond only** (`93560`) — the north sliver. |

> **⚠️ CORRECTION (2026-06-22, post-implementation):** The original design (and the
> rationale/architecture/open-item sections below) modeled **San Bernardino and Riverside as
> whole counties**. That was wrong — it pulled in the entire Coachella Valley (Indio, Palm
> Springs, Blythe) and the SB High Desert/Mojave/mountains. The table above is the corrected,
> authoritative service area: **only LA / Orange / Ventura are county-level includes; SB and
> Riverside are explicit western-city ZIP lists** (SB through Fontana; Riverside = Corona/
> Norco/Mira Loma). Where the text below says "whole counties" for SB/Riverside, read it as
> superseded by this table and the generator (`scripts/generate-service-area-zips.ts`). Set
> size went 942 → 750.

## Locked decisions

1. **Real service-area gate.** Out-of-area ZIPs are hard-rejected at the input; the user can
   delete characters and enter a different ZIP that may qualify. Rejection is of the **ZIP**,
   not the lead.
2. **County-first data model, not a flat ZIP set.** Because LA/SB/Riverside are whole
   counties, membership is decided by **county**, with two **bounded-edge** ZIP subsets
   (Ventura ≤ Ventura city; Orange ≤ Laguna Beach) plus the Rosamond sliver. County is
   unambiguous, so this sidesteps ZIP-prefix overlap and needs far less maintenance than a
   ~600-ZIP hand-curated set.
3. **The gate is local (no API).** In/out is computed from a static ZIP→county map; no network
   call to decide service area. (The existing zippopotam resolve stays — but only to display
   the qualifying *city* badge for in-area ZIPs.)
4. **Funnel-only scope.** The `service-area.ts` constant + `isInServiceArea(zip)` helper are
   reusable, but intake/general-inquiry (Google-sourced ZIPs) are not gated by this work.

## Requirements

- **Z1** Out-of-area ZIP → `out-of-area` verdict → "We don't serve your area yet" in the
  status slot, advance button stays disabled, user edits ZIP → re-validates. (Reuses the
  existing `showOutOfArea` / `outOfAreaLabel` / disabled-button scaffolding.)
- **Z2** In-area ZIP → resolves its city (existing local cache → zippopotam fallback) for the
  "✓ your area qualifies — {City}" badge, button enables.
- **Z3** `classifyZip` returns `in-area | out-of-area | invalid-format` driven by the **real
  service area** (the `out-of-area` branch goes live). `invalid-format` = not a 5-digit ZIP.
- **Z4** Service area = LA/SB/Riverside (whole counties) + Ventura (≤ Ventura-city ZIP set) +
  Orange (≤ Laguna-Beach ZIP set) + Kern `93560`. Defined in
  `src/shared/constants/company/service-area.ts`.
- **Z5** In/out is decided **locally** from a static CA ZIP→county map — no API call for the
  gate.
- **Z6** A non-served but real ZIP and a non-existent ZIP both block the same way (can't
  advance, edit-and-retry). Message wording for the two is a minor UX choice (see open items).

## Architecture

- **`src/shared/constants/company/service-area.ts`** (new) — the service-area definition +
  the gate helper:
  - `SERVICE_AREA_WHOLE_COUNTIES = new Set(['Los Angeles','San Bernardino','Riverside'])`
  - `VENTURA_INCLUDED_ZIPS: Set<string>` and `ORANGE_INCLUDED_ZIPS: Set<string>` — the two
    curated bounded-edge subsets.
  - `EXTRA_INCLUDED_ZIPS = new Set(['93560'])` (Rosamond).
  - `isInServiceArea(zip: string): boolean` — `county(zip) ∈ whole-counties` OR
    `zip ∈ Ventura/Orange subset` OR `zip ∈ extra`. Pure, synchronous.
- **ZIP→county map** — a static dataset (e.g. `ca-zip-county.ts`, sourced once from an
  authoritative crosswalk; ~2,600 CA ZIPs). `county(zip)` reads from it. Non-CA / unknown ZIP
  → no county → out-of-area. (Planning decides: standalone dataset vs extending the existing
  `CA_ZIP_CITIES`, which already carries county for its entries.)
- **`resolve-zip.ts`** — `classifyZip` rewired: not-5-digits → `invalid-format`;
  `isInServiceArea(zip)` → `in-area`; else → `out-of-area`. (Drops the SoCal-regex shortcut.)
- **`zip-step.tsx`** — no structural change; the out-of-area path lights up automatically.
  Update `ZIP_STEP.content.outOfAreaLabel` copy if desired.

## Data flow (funnel ZIP step)

1. User types ZIP → on each change (debounced), `classifyZip(zip)` runs **locally**.
2. `invalid-format` (not 5 digits) → neutral, button disabled.
   `out-of-area` → "We don't serve your area yet," button disabled.
   `in-area` → `resolveZip` for the city badge (local cache → zippopotam), button enables.
3. User edits the ZIP → re-classifies from scratch (existing abort/clear behavior).
4. In-area + resolved → advance to the next step.

## Out of scope

- Intake + general-inquiry forms (Google-sourced ZIPs; not service-area-gated by this work).
- Phone validation (separate spec, already drafted).
- Capturing out-of-area leads for a "notify me when you expand" list (rejected: ZIP step is
  pre-lead; user just retypes).

## Open items to confirm during planning

- **Bounded-edge ZIP lists:** the exact Ventura (≤ Ventura city) and Orange (north-of-Laguna)
  included-ZIP sets — compiled from the boundary cities against the ZIP→county dataset.
- **Desert edges:** LA/SB/Riverside taken as whole counties includes far-desert ZIPs (e.g.
  Needles, Blythe, deep Mojave) that are unlikely lead sources. v1 keeps whole-county for
  simplicity; trim later if it ever matters.
- **ZIP→county data source:** authoritative crosswalk (HUD/USPS/SimpleMaps-style) vs extending
  `CA_ZIP_CITIES`.
- **Message wording:** keep a separate "couldn't find that ZIP" (non-existent) vs "we don't
  serve your area yet" (out-of-area), or collapse both into the out-of-area message.

## Testing / gate

No test runner in repo. Gate = `pnpm tsc` + `pnpm lint` + manual browser smoke (in-area ZIP
qualifies; out-of-area ZIP shows the message + keeps the button disabled; editing recovers).
`isInServiceArea` is the prime unit-test target if a runner is ever added.
