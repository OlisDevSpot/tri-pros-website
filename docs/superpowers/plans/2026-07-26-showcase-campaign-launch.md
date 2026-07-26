# Showcase Campaign Launch Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Launch the single "Showcase" Meta campaign (kitchens + bathrooms ad sets, 5 ads each) with new-lead push+email notifications, built on an engine upgraded to multi-ad-set campaign specs.

**Architecture:** The campaign-as-code engine (`scripts/meta/`) gets a v2 spec schema — campaign = offer, `adSets[]` = products, each ad set owning its funnel/landing URL and ads. A new `showcase.campaign.ts` replaces the two v1 specs. A generic `notificationService.notifyNewLead` (push + Resend email, config-driven recipients) fires from the funnel ingest mutation. Spec: `docs/superpowers/specs/2026-07-26-showcase-campaign-launch-design.md`.

**Tech Stack:** TypeScript, Zod, Meta Marketing API (raw fetch client in `scripts/meta/lib/`), Drizzle, tRPC, web-push, Resend + react-email, ffmpeg (creative prep).

## Global Constraints

- **No test framework exists in this repo.** Verification = `pnpm tsc` + `pnpm lint` + `pnpm meta sync` dry-run output + manual dev checks. NEVER `pnpm build`.
- Engine hard guardrails are untouchable: creates PAUSED, never sends `status`, never deletes, budget ceiling `16_600` cents/day total.
- Ad copy vocabulary/CTA rules: `docs/marketing/showcase-offer.md` (CTA enum stays `APPLY_NOW | LEARN_MORE`; never GET_QUOTE).
- Naming doctrine (evergreen — codified in Task 5): campaign key = offer slug (`showcase`), ad set key = product slug (`kitchens`), ad key = `<product>-<concept>-<nn>` (unique campaign-wide; product prefix required because ad lock keys are `<campaignKey>/<adKey>`).
- UTM convention unchanged: `utm_source=meta&utm_medium=paid&utm_campaign=<campaignKey>&utm_content=<adKey>` via creative `url_tags`.
- Video files live in `public/funnels/<slug>/ads/videos/` — **gitignored, never commit**. Images in `public/funnels/<slug>/ads/` are committed at source resolution (not funnel-WebP-compressed).
- Work on main; stage explicitly by path (never `git add -A`).
- Import style inside `scripts/meta/`: relative with `.js` extension (ESM); `@/` alias only for `src/` imports.

---

### Task 1: Engine v2 — multi-ad-set spec schema

**Files:**
- Modify: `scripts/meta/campaign-specs/lib/types.ts`
- Modify: `scripts/meta/campaign-specs/lib/guardrails.ts`
- Modify: `scripts/meta/sync/fingerprint.ts`
- Modify: `scripts/meta/sync/ad-link.ts`
- Modify: `scripts/meta/sync/diff.ts`
- Modify: `scripts/meta/sync/apply.ts`
- Modify: `scripts/meta/sync/run.ts`
- Modify: `scripts/meta/lib/marketing-api.ts`
- Modify: `scripts/meta/campaign-specs/registry.ts` (temporarily empty)
- Delete: `scripts/meta/campaign-specs/kitchens.campaign.ts`, `scripts/meta/campaign-specs/bathrooms.campaign.ts`

**Interfaces:**
- Produces (Task 2 relies on): `defineCampaign(input)` accepting `{ key, name, objective, adSets: [{ key, name, funnelSlug, landingBaseUrl, dailyBudgetCents, ageMin, ageMax, optimizationEvent, geoZips, ads: AdSpec[] }] }`. `AdSpec` variants (single-image / carousel / video) unchanged from v1.
- Produces (Task 7 relies on): `pnpm meta sync` handling multi-ad-set specs; lock keys `campaigns[<campaignKey>]`, `adSets[<campaignKey>/<adSetKey>]`, `ads[<campaignKey>/<adKey>]`.

- [ ] **Step 1: Rewrite `types.ts`** — move `funnelSlug`, `landingBaseUrl`, and `ads` into the ad set; campaign holds `adSets` array. Replace `adSetSpecSchema` and `campaignSpecSchema` (ad spec schemas + `ctaTypeSchema` + `specKey` stay byte-identical):

```ts
export const adSetSpecSchema = z.object({
  key: specKey,
  name: z.string().min(1),
  /** Which funnel's assets + landing page this ad set sells. Assets under public/funnels/<funnelSlug>/ads/. */
  funnelSlug: z.enum(['kitchens', 'bathrooms']),
  /** Funnel origin with trailing slash, e.g. https://kitchens.triprosremodeling.com/ */
  landingBaseUrl: z.string().url(),
  dailyBudgetCents: z.number().int().positive(),
  ageMin: z.number().int().min(18).max(65),
  /** Meta rejects age_max > 65; 65 means "65+" (unbounded upper bucket). */
  ageMax: z.number().int().min(18).max(65),
  /** Maps to promoted_object.custom_event_type. */
  optimizationEvent: z.enum(['LEAD', 'SCHEDULE']),
  geoZips: z.array(z.string().regex(/^\d{5}$/)).min(1),
  ads: z.array(adSpecSchema).min(1),
})

export const campaignSpecSchema = z.object({
  key: specKey,
  name: z.string().min(1),
  objective: z.literal('OUTCOME_LEADS'),
  /** campaign = offer; one ad set per product. */
  adSets: z.array(adSetSpecSchema).min(1),
})
  .refine(s => s.adSets.every(a => a.ageMin <= a.ageMax), { message: 'ageMin must be ≤ ageMax' })
  .refine((s) => {
    const keys = s.adSets.flatMap(a => a.ads.map(ad => ad.key))
    return new Set(keys).size === keys.length
  }, { message: 'ad keys must be unique across the whole campaign (they key the lock as <campaignKey>/<adKey>)' })
  .refine((s) => {
    const keys = s.adSets.map(a => a.key)
    return new Set(keys).size === keys.length
  }, { message: 'ad set keys must be unique within the campaign' })
```

Update the exported types accordingly (`AdSetSpec` now includes `funnelSlug`/`landingBaseUrl`/`ads`; `CampaignSpec` has `adSets`).

- [ ] **Step 2: Update `guardrails.ts`** — budget sums across all ad sets:

```ts
const totalCents = specs.reduce(
  (sum, spec) => sum + spec.adSets.reduce((s, a) => s + a.dailyBudgetCents, 0),
  0,
)
```

- [ ] **Step 3: Update `ad-link.ts`** — signature takes the campaign key (ad sets don't appear in UTMs; product is embedded in the ad key):

```ts
export function buildUrlTags(campaignKey: string, adKey: string): string {
  return new URLSearchParams({
    utm_source: 'meta',
    utm_medium: 'paid',
    utm_campaign: campaignKey,
    utm_content: adKey,
  }).toString()
}
```

- [ ] **Step 4: Update `fingerprint.ts`** — `adSetFp` takes the ad set; `adFp` takes `(campaignKey, adSet, ad, assetShas)` (link comes from the ad set, urlTags from campaignKey+adKey). The single-image byte-compat comment is obsolete (new campaign = fresh lock entries) — delete it:

```ts
export function adSetFp(adSet: AdSetSpec): string {
  return sha256Hex(JSON.stringify({
    name: adSet.name,
    dailyBudgetCents: adSet.dailyBudgetCents,
    ageMin: adSet.ageMin,
    ageMax: adSet.ageMax,
    optimizationEvent: adSet.optimizationEvent,
    zips: [...adSet.geoZips].sort(),
  }))
}

export function adFp(campaignKey: string, adSet: AdSetSpec, ad: AdSpec, assetShas: AdAssetShas): string {
  if (ad.format === 'carousel') {
    return sha256Hex(JSON.stringify({
      primaryTexts: ad.primaryTexts,
      ctaType: ad.ctaType,
      cards: ad.cards.map(c => ({
        imageSha: assetShas[c.imageFile],
        headline: c.headline,
        description: c.description ?? null,
      })),
      link: adSet.landingBaseUrl,
      urlTags: buildUrlTags(campaignKey, ad.key),
      multiShareOptimized: ad.multiShareOptimized,
    }))
  }
  if (ad.format === 'video') {
    return sha256Hex(JSON.stringify({
      headlines: ad.headlines,
      primaryTexts: ad.primaryTexts,
      descriptions: ad.descriptions ?? null,
      ctaType: ad.ctaType,
      videoSha: assetShas[ad.videoFile],
      thumbnailSha: assetShas[ad.thumbnailFile],
      link: adSet.landingBaseUrl,
      urlTags: buildUrlTags(campaignKey, ad.key),
    }))
  }
  return sha256Hex(JSON.stringify({
    headlines: ad.headlines,
    primaryTexts: ad.primaryTexts,
    descriptions: ad.descriptions ?? null,
    ctaType: ad.ctaType,
    imageSha: assetShas[ad.imageFile],
    link: adSet.landingBaseUrl,
    urlTags: buildUrlTags(campaignKey, ad.key),
  }))
}
```

`campaignFp` unchanged (`{ name, objective }`).

- [ ] **Step 5: Update `diff.ts`** — asset-path helpers key off the ad set's `funnelSlug`; plan ops carry `adSetKey`; inner loops nest campaign → adSets → ads:

```ts
export type PlanOp =
  | { op: 'create-campaign', campaignKey: string }
  | { op: 'update-campaign', campaignKey: string, id: string }
  | { op: 'create-adset', campaignKey: string, adSetKey: string }
  | { op: 'update-adset', campaignKey: string, adSetKey: string, id: string }
  | { op: 'create-ad', campaignKey: string, adSetKey: string, adKey: string, assetShas: AdAssetShas }
  | { op: 'refresh-creative', campaignKey: string, adSetKey: string, adKey: string, adId: string, assetShas: AdAssetShas }
  | { op: 'skip-ad-missing-asset', campaignKey: string, adSetKey: string, adKey: string, assetPath: string }
  | { op: 'orphan', kind: 'campaign' | 'adset' | 'ad', id: string, name: string }

export function adImagePath(funnelSlug: string, imageFile: string): string {
  return join(process.cwd(), 'public/funnels', funnelSlug, 'ads', imageFile)
}

export function adVideoPath(funnelSlug: string, videoFile: string): string {
  return join(process.cwd(), 'public/funnels', funnelSlug, 'ads/videos', videoFile)
}

export function adAssetPaths(adSet: AdSetSpec, ad: AdSpec): Record<string, string> {
  if (ad.format === 'carousel')
    return Object.fromEntries(ad.cards.map(c => [c.imageFile, adImagePath(adSet.funnelSlug, c.imageFile)]))
  if (ad.format === 'video') {
    return {
      [ad.videoFile]: adVideoPath(adSet.funnelSlug, ad.videoFile),
      [ad.thumbnailFile]: adImagePath(adSet.funnelSlug, ad.thumbnailFile),
    }
  }
  return { [ad.imageFile]: adImagePath(adSet.funnelSlug, ad.imageFile) }
}
```

In `computePlan`, replace the single `spec.adSet` block and the `spec.ads` loop with:

```ts
    for (const adSet of spec.adSets) {
      const asKey = `${spec.key}/${adSet.key}`
      specBackedAdSetKeys.add(asKey)
      const asLock = lock.adSets[asKey]
      if (!asLock || !remoteIds.has(asLock.id)) {
        const adoptId = remoteAdSetByName.get(adSet.name)
        if (adoptId)
          ops.push({ op: 'update-adset', campaignKey: spec.key, adSetKey: adSet.key, id: adoptId })
        else
          ops.push({ op: 'create-adset', campaignKey: spec.key, adSetKey: adSet.key })
      }
      else if (asLock.fp !== adSetFp(adSet)) {
        ops.push({ op: 'update-adset', campaignKey: spec.key, adSetKey: adSet.key, id: asLock.id })
      }

      for (const ad of adSet.ads) {
        const adLockKey = `${spec.key}/${ad.key}`
        specBackedAdKeys.add(adLockKey)
        const assetPaths = adAssetPaths(adSet, ad)
        const missingPath = Object.values(assetPaths).find(path => !existsSync(path))
        if (missingPath) {
          ops.push({ op: 'skip-ad-missing-asset', campaignKey: spec.key, adSetKey: adSet.key, adKey: ad.key, assetPath: missingPath })
          continue
        }
        const assetShas: AdAssetShas = Object.fromEntries(
          Object.entries(assetPaths).map(([file, path]) => [file, sha256Hex(readFileSync(path))]),
        )
        const aLock = lock.ads[adLockKey]
        if (!aLock || !remoteIds.has(aLock.id)) {
          const adoptName = `${spec.key} — ${ad.key}`
          const adoptId = remoteAdByName.get(adoptName)
          if (adoptId)
            ops.push({ op: 'refresh-creative', campaignKey: spec.key, adSetKey: adSet.key, adKey: ad.key, adId: adoptId, assetShas })
          else
            ops.push({ op: 'create-ad', campaignKey: spec.key, adSetKey: adSet.key, adKey: ad.key, assetShas })
        }
        else if (aLock.fp !== adFp(spec.key, adSet, ad, assetShas)) {
          ops.push({ op: 'refresh-creative', campaignKey: spec.key, adSetKey: adSet.key, adKey: ad.key, adId: aLock.id, assetShas })
        }
      }
    }
```

Orphan-reporting sections are unchanged.

- [ ] **Step 6: Update `apply.ts`** — resolve the ad set per op, thread `adSet` through creative creation:

```ts
function adSetByKey(spec: CampaignSpec, adSetKey: string): AdSetSpec {
  const adSet = spec.adSets.find(a => a.key === adSetKey)
  if (!adSet)
    throw new Error(`No ad set ${adSetKey} in campaign ${spec.key}`)
  return adSet
}
```

`createCreativeForAd(lock, campaignKey, adSet, ad, assetShas)`:

```ts
  const base = {
    name: `${campaignKey}/${ad.key}`,
    baseUrl: adSet.landingBaseUrl,
    urlTags: buildUrlTags(campaignKey, ad.key),
  }
```

…and every `adImagePath(spec, …)` / `adVideoPath(spec, …)` becomes `adImagePath(adSet.funnelSlug, …)` / `adVideoPath(adSet.funnelSlug, …)`.

In `applyPlan`, the ad-set and ad branches now use `op.adSetKey`:

```ts
    const adSet = 'adSetKey' in op ? adSetByKey(spec, op.adSetKey) : null

    // create-adset | update-adset
    const adSetInput = {
      name: adSet.name,
      campaignId: lock.campaigns[spec.key]?.id ?? '',
      dailyBudgetCents: adSet.dailyBudgetCents,
      ageMin: adSet.ageMin,
      ageMax: adSet.ageMax,
      optimizationEvent: adSet.optimizationEvent,
      metaZips: toMetaZips(adSet.geoZips),
    }
    const asKey = `${spec.key}/${adSet.key}`
    // lock writes: lock.adSets[asKey] = { id, fp: adSetFp(adSet) }
```

Ad branch: `const ad = adSet.ads.find(a => a.key === op.adKey)`; ad lock fp = `adFp(spec.key, adSet, ad, op.assetShas)`; ad name at Meta stays `` `${spec.key} — ${ad.key}` ``.

- [ ] **Step 7: Update `marketing-api.ts` `adSetBody`** — Advantage+ audience ON (min-age floor is the hard control) + 7-day-click attribution:

```ts
    promoted_object: { pixel_id: metaEnv.pixelId, custom_event_type: input.optimizationEvent },
    // 7-day click only — no view-through: cleans lead-gen reporting AND changes
    // what delivery optimizes toward (Meta optimizes for conversions countable
    // under this setting). Design: 2026-07-26 spec §1.
    attribution_spec: [{ event_type: 'CLICK_THROUGH', window_days: 7 }],
    targeting: {
      geo_locations: { zips: input.metaZips },
      age_min: input.ageMin,
      age_max: input.ageMax, // 65 = "65+"; under Advantage+ audience the max is a suggestion anyway
      // Advantage+ audience ON: geo + age_min act as hard controls, everything
      // else is a starting suggestion Meta may expand past. Deliberate flip from
      // v1 (advantage_audience: 0) — 2026 delivery favors broad + creative-led.
      targeting_automation: { advantage_audience: 1 },
    },
```

- [ ] **Step 8: Update `run.ts` plan printer** — include the ad set in the detail line:

```ts
    const detail = 'adKey' in op
      ? `${op.campaignKey}/${op.adSetKey}/${op.adKey}`
      : 'adSetKey' in op
        ? `${op.campaignKey}/${op.adSetKey}`
        : 'campaignKey' in op
          ? op.campaignKey
          : `${op.kind} ${op.name} (${op.id})`
```

- [ ] **Step 9: Delete old specs; empty the registry (temporarily)** so the package compiles before Task 2:

```ts
// scripts/meta/campaign-specs/registry.ts
import type { CampaignSpec } from './lib/types.js'

export const CAMPAIGN_SPECS: CampaignSpec[] = []
```

```bash
git rm scripts/meta/campaign-specs/kitchens.campaign.ts scripts/meta/campaign-specs/bathrooms.campaign.ts
```

- [ ] **Step 10: Verify** — `pnpm tsc` passes; `pnpm lint` passes.

- [ ] **Step 11: Commit**

```bash
git add scripts/meta/campaign-specs/lib/types.ts scripts/meta/campaign-specs/lib/guardrails.ts scripts/meta/sync/fingerprint.ts scripts/meta/sync/ad-link.ts scripts/meta/sync/diff.ts scripts/meta/sync/apply.ts scripts/meta/sync/run.ts scripts/meta/lib/marketing-api.ts scripts/meta/campaign-specs/registry.ts
git commit -m "feat(meta): engine v2 — multi-ad-set campaign specs (campaign = offer, ad set = product)

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 2: `showcase.campaign.ts` — the offer campaign

**Files:**
- Create: `scripts/meta/campaign-specs/showcase.campaign.ts`
- Modify: `scripts/meta/campaign-specs/registry.ts`

**Interfaces:**
- Consumes: Task 1's `defineCampaign` shape.
- Produces: `showcaseCampaign` spec; asset filenames that Task 3 must place on disk (per trade, under `public/funnels/<slug>/ads/`): `reel-NN.mp4` ×2 (videos/ subdir), `reel-NN-thumb.jpg` ×2, `before-after-card-01.jpg`, `hero-card-01.jpg`, `carousel-01.jpg`…`carousel-04.jpg`. Kitchens NN = 07/08, bathrooms NN = 11/12. All statics are Remotion-rendered layered cards (Task 3), not raw photos.

- [ ] **Step 1: Write the spec.** Campaign `showcase` / "TPR — Showcase — Leads". Two ad sets ($58/day each — total $116/day, under ceiling). Copy below is complete and Showcase-compliant (checkmark + narrative + question variants per ad; scarcity first-person about the program; no viewer attributes; no pricing numbers). Reel/thumbnail/carousel filenames are the Task 3 contract; reel picks are Oliver-approved in Task 3 and, if he swaps files, only Task 3's copy step changes (filenames here stay).

```ts
import { SERVICE_AREA_ZIPS } from '@/shared/constants/company/service-area-zips'
import { defineCampaign } from './lib/define-campaign.js'

// Ad copy implements the Showcase offer — vocabulary, framing, and CTA rules
// are canonical in docs/marketing/showcase-offer.md. Read it before editing.
// Structure doctrine (campaign = offer, ad set = product, 5 distinct concepts
// per ad set): scripts/meta/DOCS.md#campaign-as-offer.
export const showcaseCampaign = defineCampaign({
  key: 'showcase',
  name: 'TPR — Showcase — Leads',
  objective: 'OUTCOME_LEADS',
  adSets: [
    {
      key: 'kitchens',
      name: 'Kitchens · Service-Area ZIPs · 35+',
      funnelSlug: 'kitchens',
      landingBaseUrl: 'https://kitchens.triprosremodeling.com/',
      dailyBudgetCents: 5_800, // $58/day ≈ $1,750/mo
      ageMin: 35,
      ageMax: 65, // Meta max — 65 means "65+"
      optimizationEvent: 'LEAD',
      geoZips: [...SERVICE_AREA_ZIPS],
      ads: [
        {
          key: 'kitchens-casting-reel-01',
          format: 'video',
          videoFile: 'reel-07.mp4',
          thumbnailFile: 'reel-07-thumb.jpg',
          headlines: [
            'We’re Selecting 5 Kitchens in Your Area',
            '5 Kitchen Showcase Spots — See If You Qualify',
            'Is Your Kitchen One of the 5?',
          ],
          primaryTexts: [
            '🏠 We’re selecting 5 kitchens in your area to feature in our showcase.\n\n'
            + 'If your home qualifies, you get:\n'
            + '✅ A AAA-grade kitchen remodel\n'
            + '✅ At a Showcase price\n'
            + '✅ Featured in our portfolio\n\n'
            + 'Homeowners only. See if your home qualifies.',
            'Get a AAA-grade kitchen remodel — at a Showcase price. '
            + 'Tri Pros Remodeling is selecting 5 kitchens in your area to be featured in our showcase. '
            + 'If selected, your kitchen gets our best-of-the-best work — quality that has to photograph beautifully. '
            + 'Homeowners only. See if your home qualifies.',
            'Could your kitchen be one of the 5? 👀\n\n'
            + 'Tri Pros Remodeling is choosing 5 homes in your area for AAA-grade kitchen remodels at a '
            + 'Showcase price — quality built to be photographed, featured in our showcase.\n\n'
            + 'Homeowners only. See if your home qualifies.',
          ],
          descriptions: ['See if your home qualifies.'],
          ctaType: 'APPLY_NOW',
        },
        {
          key: 'kitchens-story-reel-01',
          format: 'video',
          videoFile: 'reel-08.mp4',
          thumbnailFile: 'reel-08-thumb.jpg',
          headlines: [
            'What Every Showcase Kitchen Includes',
            'Showcase-Grade Work, Guaranteed',
          ],
          primaryTexts: [
            'What every Showcase kitchen gets:\n'
            + '✅ AAA-grade materials\n'
            + '✅ Beautiful AND functional\n'
            + '✅ Built to be photographed\n\n'
            + 'We’re selecting 5 kitchens in your area for our showcase. '
            + 'Homeowners only. See if your home qualifies.',
            'Watch what a Showcase kitchen looks like from start to finish. '
            + 'Every home we select gets our best-of-the-best work at a Showcase price — '
            + 'because the result is featured in our showcase. '
            + '5 kitchens in your area. See if yours qualifies.',
            'Think your kitchen could carry a showcase? 👀\n\n'
            + 'We’re selecting 5 kitchens in your area — AAA-grade remodels at a Showcase price, '
            + 'featured in our portfolio.\n\nHomeowners only. See if your home qualifies.',
          ],
          descriptions: ['Showcase-grade work, guaranteed.'],
          ctaType: 'APPLY_NOW',
        },
        {
          key: 'kitchens-before-after-01',
          headlines: [
            'Your Kitchen Could Be Next — 5 Spots',
            'This Is Showcase-Grade. Yours Could Be Too.',
          ],
          primaryTexts: [
            'This is the standard every Showcase kitchen is held to:\n'
            + '✅ AAA-grade materials\n'
            + '✅ Beautiful AND functional\n'
            + '✅ Built to be photographed\n\n'
            + 'We’re selecting 5 kitchens in your area this month for a Showcase-priced remodel, '
            + 'featured in our portfolio. See if your home qualifies.',
            'From dated to designed-to-be-photographed. 📸\n\n'
            + 'Every kitchen we select for the Showcase gets our best-of-the-best work — at a Showcase price. '
            + '5 spots in your area this month.\n\n'
            + 'See if your home qualifies.',
            'This is the standard every Showcase kitchen is held to — AAA-grade, built to be photographed. '
            + 'We’re selecting 5 kitchens in your area this month for a Showcase-priced remodel, '
            + 'featured in our portfolio. See if your home qualifies.',
          ],
          descriptions: ['AAA-grade, at a Showcase price.'],
          imageFile: 'before-after-card-01.jpg',
          ctaType: 'APPLY_NOW',
        },
        {
          key: 'kitchens-portfolio-carousel-01',
          format: 'carousel',
          primaryTexts: [
            'Real Tri Pros kitchens. Real homes in your area. 👀\n\n'
            + 'We’re selecting 5 kitchens for our next Showcase round — AAA-grade remodels at a '
            + 'Showcase price, featured in our portfolio.\n\n'
            + 'Homeowners only. Swipe through, then see if your home qualifies.',
          ],
          ctaType: 'APPLY_NOW',
          cards: [
            { imageFile: 'carousel-01.jpg', headline: 'Every Showcase kitchen is held to this standard' },
            { imageFile: 'carousel-02.jpg', headline: 'AAA-grade materials, everyday function' },
            { imageFile: 'carousel-03.jpg', headline: 'Built to be photographed' },
            { imageFile: 'carousel-04.jpg', headline: 'See if your home qualifies', description: '5 kitchens. Your area.' },
          ],
        },
        {
          key: 'kitchens-hero-01',
          headlines: [
            'Would Your Home Make the Cut?',
            'We’re Selecting 5 Kitchens in Your Area',
          ],
          primaryTexts: [
            'Would your home make the cut? 👀\n\n'
            + 'We’re selecting 5 kitchens in your area to remodel at a Showcase price and feature '
            + 'in our portfolio.\n\nHomeowners only. See if your home qualifies.',
            'Some kitchens are built to be photographed. Yours could be one of them.\n\n'
            + 'Tri Pros Remodeling is selecting 5 kitchens in your area for AAA-grade, '
            + 'Showcase-priced remodels. See if your home qualifies.',
            'The Showcase list is open:\n'
            + '✅ 5 kitchens in your area\n'
            + '✅ AAA-grade remodel at a Showcase price\n'
            + '✅ Featured in our portfolio\n\n'
            + 'Homeowners only. See if your home qualifies.',
          ],
          descriptions: ['See if your home qualifies.'],
          imageFile: 'hero-card-01.jpg',
          ctaType: 'LEARN_MORE',
        },
      ],
    },
    {
      key: 'bathrooms',
      name: 'Bathrooms · Service-Area ZIPs · 35+',
      funnelSlug: 'bathrooms',
      landingBaseUrl: 'https://bathrooms.triprosremodeling.com/',
      dailyBudgetCents: 5_800, // $58/day ≈ $1,750/mo
      ageMin: 35,
      ageMax: 65, // Meta max — 65 means "65+"
      optimizationEvent: 'LEAD',
      geoZips: [...SERVICE_AREA_ZIPS],
      ads: [
        {
          key: 'bathrooms-casting-reel-01',
          format: 'video',
          videoFile: 'reel-11.mp4',
          thumbnailFile: 'reel-11-thumb.jpg',
          headlines: [
            'We’re Selecting 5 Bathrooms in Your Area',
            '5 Bathroom Showcase Spots — See If You Qualify',
            'Is Your Bathroom One of the 5?',
          ],
          primaryTexts: [
            '🛁 We’re selecting 5 bathrooms in your area for our next Showcase.\n\n'
            + 'If your home qualifies, you get:\n'
            + '✅ A AAA-grade bathroom remodel\n'
            + '✅ At a Showcase price\n'
            + '✅ Featured in our portfolio\n\n'
            + 'Homeowners only. See if you qualify.',
            'A bathroom you’ll actually love — at a Showcase price. '
            + 'Tri Pros Remodeling is selecting 5 bathrooms in your area to be featured in our showcase. '
            + 'If selected, you get our best-of-the-best work at a Showcase price. '
            + 'Homeowners only. See if your home qualifies.',
            'Could your bathroom be one of the 5? 👀\n\n'
            + 'We’re choosing 5 homes in your area to feature in our bathroom showcase — '
            + 'best-of-the-best work, built to photograph beautifully, at a Showcase price.\n\n'
            + 'Homeowners only. See if your home qualifies.',
          ],
          descriptions: ['See if your home qualifies.'],
          ctaType: 'APPLY_NOW',
        },
        {
          key: 'bathrooms-story-reel-01',
          format: 'video',
          videoFile: 'reel-12.mp4',
          thumbnailFile: 'reel-12-thumb.jpg',
          headlines: [
            'What Every Showcase Bathroom Includes',
            'Showcase-Grade Work, Guaranteed',
          ],
          primaryTexts: [
            'What every Showcase bathroom gets:\n'
            + '✅ AAA-grade materials\n'
            + '✅ Spa feel, everyday function\n'
            + '✅ Built to be photographed\n\n'
            + 'We’re selecting 5 bathrooms in your area for our showcase. '
            + 'Homeowners only. See if your home qualifies.',
            'Watch what a Showcase bathroom looks like from start to finish. '
            + 'Every home we select gets our best-of-the-best work at a Showcase price — '
            + 'because the result is featured in our showcase. '
            + '5 bathrooms in your area. See if yours qualifies.',
            'Think your bathroom could carry a showcase? 👀\n\n'
            + 'We’re selecting 5 bathrooms in your area — AAA-grade remodels at a Showcase price, '
            + 'featured in our portfolio.\n\nHomeowners only. See if your home qualifies.',
          ],
          descriptions: ['Showcase-grade work, guaranteed.'],
          ctaType: 'APPLY_NOW',
        },
        {
          key: 'bathrooms-before-after-01',
          headlines: [
            'Your Bathroom Could Be Next — 5 Spots',
            'This Is Showcase-Grade. Yours Could Be Too.',
          ],
          primaryTexts: [
            'This is the standard every Showcase bathroom is held to:\n'
            + '✅ AAA-grade materials\n'
            + '✅ Spa feel, everyday function\n'
            + '✅ Built to be photographed\n\n'
            + 'We’re selecting 5 bathrooms in your area this month for a Showcase-priced remodel, '
            + 'featured in our portfolio. See if your home qualifies.',
            'From dated to Showcase-grade. 📸\n\n'
            + 'Every bathroom we select gets AAA-quality work — because it has to photograph beautifully. '
            + '5 spots in your area this month.\n\n'
            + 'See if your home qualifies.',
            'From dated to Showcase-grade. Every bathroom we select gets AAA-quality work — '
            + 'because it has to photograph beautifully. '
            + 'We’re selecting 5 bathrooms in your area this month. See if your home qualifies.',
          ],
          descriptions: ['AAA-grade, at a Showcase price.'],
          imageFile: 'before-after-card-01.jpg',
          ctaType: 'APPLY_NOW',
        },
        {
          key: 'bathrooms-portfolio-carousel-01',
          format: 'carousel',
          primaryTexts: [
            'Real Tri Pros bathrooms. Real homes in your area. 👀\n\n'
            + 'We’re selecting 5 bathrooms for our next Showcase round — AAA-grade remodels at a '
            + 'Showcase price, featured in our portfolio.\n\n'
            + 'Homeowners only. Swipe through, then see if your home qualifies.',
          ],
          ctaType: 'APPLY_NOW',
          cards: [
            { imageFile: 'carousel-01.jpg', headline: 'Every Showcase bathroom is held to this standard' },
            { imageFile: 'carousel-02.jpg', headline: 'AAA-grade materials, spa-level feel' },
            { imageFile: 'carousel-03.jpg', headline: 'Built to be photographed' },
            { imageFile: 'carousel-04.jpg', headline: 'See if your home qualifies', description: '5 bathrooms. Your area.' },
          ],
        },
        {
          key: 'bathrooms-hero-01',
          headlines: [
            'Would Your Home Make the Cut?',
            'We’re Selecting 5 Bathrooms in Your Area',
          ],
          primaryTexts: [
            'Would your home make the cut? 👀\n\n'
            + 'We’re selecting 5 bathrooms in your area to remodel at a Showcase price and feature '
            + 'in our portfolio.\n\nHomeowners only. See if your home qualifies.',
            'Some bathrooms are built to be photographed. Yours could be one of them.\n\n'
            + 'Tri Pros Remodeling is selecting 5 bathrooms in your area for AAA-grade, '
            + 'Showcase-priced remodels. See if your home qualifies.',
            'The Showcase list is open:\n'
            + '✅ 5 bathrooms in your area\n'
            + '✅ AAA-grade remodel at a Showcase price\n'
            + '✅ Featured in our portfolio\n\n'
            + 'Homeowners only. See if your home qualifies.',
          ],
          descriptions: ['See if your home qualifies.'],
          imageFile: 'hero-card-01.jpg',
          ctaType: 'LEARN_MORE',
        },
      ],
    },
  ],
})
```

- [ ] **Step 2: Registry:**

```ts
import type { CampaignSpec } from './lib/types.js'
import { showcaseCampaign } from './showcase.campaign.js'

export const CAMPAIGN_SPECS: CampaignSpec[] = [showcaseCampaign]
```

- [ ] **Step 3: Verify** — `pnpm tsc && pnpm lint` pass. Then `pnpm meta sync` (dry run): expect `+ create campaign showcase`, 2 `+ create ad set`, `⚠ skip ad (asset missing)` for **all 10 ads** (every asset is produced in Task 3 — the spec's static filenames are Remotion-rendered cards that don't exist yet), and orphan lines for `kitchens-leads` / `bathrooms-leads` ("spec removed; lock-managed") plus the account's unmanaged campaigns. **No update/delete ops against the old campaigns.**

- [ ] **Step 4: Commit**

```bash
git add scripts/meta/campaign-specs/showcase.campaign.ts scripts/meta/campaign-specs/registry.ts
git commit -m "feat(ads): showcase campaign spec — campaign = offer, kitchens + bathrooms ad sets, 5-concept lineups

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 3: Creative staging — reels + Remotion still cards (layered, real text)

**Decision (2026-07-26, Oliver):** all static creatives are **Remotion still compositions** in the existing `video/` ad package — background image layer (real portfolio photo; Higgsfield only for non-proof layers) + shape/scrim layers + REAL text blocks in brand fonts. No text baked into AI images, no third-party canvas tool. Templates are evergreen building blocks: next offer = same components, new props.

**Files:**
- Create (in `video/` package — local-only, never committed to main repo): `video/src/stills/carousel-card.tsx`, `video/src/stills/before-after-card.tsx`, `video/src/stills/hero-card.tsx`; register compositions in `video/src/root.tsx`; props JSONs in `video/props/stills/`
- Create (gitignored): `public/funnels/kitchens/ads/videos/reel-07.mp4`, `reel-08.mp4`; `public/funnels/bathrooms/ads/videos/reel-11.mp4`, `reel-12.mp4`
- Create (committed): per trade under `public/funnels/<slug>/ads/`: `reel-NN-thumb.jpg` ×2, `before-after-card-01.jpg`, `hero-card-01.jpg`, `carousel-01.jpg`…`carousel-04.jpg`
- Modify: `.claude/skills/showcase-ads/SKILL.md` (document the stills pipeline)

**Interfaces:**
- Consumes: Task 2's filename contract; `video/` package conventions (Remotion 4, `@remotion/google-fonts`, brand assets under `video/public/brand/`).
- Produces: all 16 committed statics + 4 gitignored videos so Task 7's sync creates all 10 ads.

- [ ] **Step 1: Present reel picks to Oliver (blocking gate).** Default proposal = the two most recent per trade: kitchens `video/out/kitchens-showcase-reel-07.mp4` + `kitchens-showcase-reel-08.mp4`; bathrooms `bathrooms-showcase-reel-11.mp4` + `bathrooms-showcase-reel-12.mp4`. Read `.claude/skills/showcase-ads/SKILL.md` + `docs/marketing/editing/variation-axes.md` first and summarize each candidate's variant axes (hook style, edit style) so he chooses two *different-hook* reels per trade, matching the casting-vs-story slot split. If picks change reel numbers, update `videoFile`/`thumbnailFile` in `showcase.campaign.ts` and re-run `pnpm tsc`.

- [ ] **Step 2: Copy approved reels into engine paths:**

```bash
mkdir -p public/funnels/kitchens/ads/videos public/funnels/bathrooms/ads/videos
cp video/out/kitchens-showcase-reel-07.mp4 public/funnels/kitchens/ads/videos/reel-07.mp4
cp video/out/kitchens-showcase-reel-08.mp4 public/funnels/kitchens/ads/videos/reel-08.mp4
cp video/out/bathrooms-showcase-reel-11.mp4 public/funnels/bathrooms/ads/videos/reel-11.mp4
cp video/out/bathrooms-showcase-reel-12.mp4 public/funnels/bathrooms/ads/videos/reel-12.mp4
```

Confirm `git status` shows NO new files under `videos/` (gitignored). If it does, STOP — do not commit videos.

- [ ] **Step 3: Generate reel thumbnails** — strongest early "after" frame; grab t=1s and eyeball, adjust `-ss` per reel if mid-transition:

```bash
for f in kitchens/ads/videos/reel-07 kitchens/ads/videos/reel-08 bathrooms/ads/videos/reel-11 bathrooms/ads/videos/reel-12; do
  slug=${f%%/*}; n=$(basename "$f")
  ffmpeg -y -ss 1 -i "public/funnels/$f.mp4" -frames:v 1 -q:v 2 "public/funnels/$slug/ads/$n-thumb.jpg"
done
```

Read each with the Read tool to verify a clean, non-blurry frame.

- [ ] **Step 4: Source background photos (real work only).** Proof imagery must be genuine Tri Pros portfolio photos (`docs/marketing/showcase-offer.md#hard-guardrails` — truthfulness). Sources: the existing high-res photos in `public/funnels/*/ads/` (`dream-kitchen-01.jpg`, `spa-bathroom-01.jpg`, the `before-after-01.jpg` composites' source projects) + portfolio media in R2 — discover via `src/shared/db/schema/` (read for the media table's exact name/columns) then a `pnpm tsx` drizzle query on the dev DB listing kitchen/bathroom portfolio images with URLs. Need per trade: 1 hero shot, 1 before + 1 after of the same project (for the split card; if true before/after originals can't be found, fall back to the existing composite as a single background layer), 3 distinct finished shots (carousel cards 1–3). Download to the scratchpad. Card 4 (CTA card) needs no photo — brand-color background; a Higgsfield-generated *texture* is allowed there (non-proof) but then the ad gets the AI-disclosure toggle in Task 7's checklist.

- [ ] **Step 5: Build the still components in `video/`.** First read `video/src/root.tsx`, one existing composition, and `video/src/lib/` to adopt the package's exact font loading (`@remotion/google-fonts`), brand tokens, and zod-props (`@remotion/zod-types`) conventions — the stills must reuse them, not invent parallel ones. Three components, all `durationInFrames: 1`, layered as AbsoluteFill stacks (bottom→top: photo layer → gradient scrim → text blocks / frosted badge — the frosted-glass treatment matching the funnel design aesthetic). Shape (props/zod omitted here; follow package conventions):

```tsx
// video/src/stills/hero-card.tsx — 1080×1350 (4:5)
// Layers: <Img src={staticFile(bg)}> full-bleed →
//   bottom gradient scrim (rgba(0,0,0,0) → rgba(0,0,0,0.72)) →
//   frosted badge top-left: uppercase tracking-wide "SHOWCASE — 5 SPOTS" →
//   headline block (bottom third, brand display font, ~72px, white):
//     e.g. "We’re selecting 5 kitchens in your area" →
//   sub line (~40px, white/85%): "See if your home qualifies"
// Props: { bg: string, badge: string, headline: string, sub: string }

// video/src/stills/before-after-card.tsx — 1080×1350 (4:5)
// Layers: top half <Img before> / bottom half <Img after> (vertical stack —
//   survives 9:16 auto-crops better than side-by-side) →
//   thin divider strip with two frosted labels: "BEFORE" / "AFTER" →
//   bottom scrim + one short line (~56px): "Same kitchen." (trade-appropriate)
// Props: { before: string, after: string, caption: string }

// video/src/stills/carousel-card.tsx — 1080×1080 (1:1)
// Variant "photo" (cards 1–3): full-bleed photo, small frosted corner badge
//   "SHOWCASE STANDARD" — NO other text (the card headline lives in Meta's
//   card field below the image; photo does the talking).
// Variant "cta" (card 4): brand-color background layer (or approved texture),
//   centered display text "See if your home qualifies" + sub "5 kitchens. Your area."
// Props: { variant: 'photo' | 'cta', bg?: string, badge?: string, headline?: string, sub?: string }
```

Register nine composition IDs? No — three compositions, props-driven. Register in `root.tsx`: `still-hero` (1080×1350), `still-before-after` (1080×1350), `still-carousel` (1080×1080). All on-image text must sit inside Meta safe zones (≥6% side margins; nothing in top 14% / bottom 20% for the 4:5s since they may serve cropped to 9:16).

- [ ] **Step 6: Write props JSONs + render.** One props file per output under `video/props/stills/` (e.g. `kitchens-hero.json` = `{ "bg": "stills-src/kitchens-hero.jpg", "badge": "SHOWCASE — 5 SPOTS", "headline": "We’re selecting 5 kitchens in your area", "sub": "See if your home qualifies" }`; bathroom twins say "bathrooms"; source photos copied into `video/public/stills-src/`). Render all 12 stills from `video/`:

```bash
cd video
pnpm exec remotion still still-hero          ../public/funnels/kitchens/ads/hero-card-01.jpg          --props=props/stills/kitchens-hero.json          --image-format=jpeg --jpeg-quality=92
pnpm exec remotion still still-before-after  ../public/funnels/kitchens/ads/before-after-card-01.jpg  --props=props/stills/kitchens-before-after.json  --image-format=jpeg --jpeg-quality=92
pnpm exec remotion still still-carousel      ../public/funnels/kitchens/ads/carousel-01.jpg           --props=props/stills/kitchens-carousel-01.json   --image-format=jpeg --jpeg-quality=92
# … carousel-02..04, then the four bathrooms twins
```

- [ ] **Step 7: Review gate.** Read every rendered card with the Read tool (composition, text legibility, safe zones, no clipped descenders), fix and re-render as needed, then present all 12 to Oliver with a one-liner each (background project + text). Iterate props until he approves. This is the main hook surface — do not rush it; tweaks are just prop edits + re-render.

- [ ] **Step 8: Document the stills pipeline** — append a short section to `.claude/skills/showcase-ads/SKILL.md`: still compositions live in `video/src/stills/`, props in `video/props/stills/`, render via `remotion still`, outputs commit to `public/funnels/<slug>/ads/`, real-text-layers rule (never bake text into generated images), truthfulness rule for proof imagery.

- [ ] **Step 9: Verify + commit statics** (videos and `video/` package stay untracked):

```bash
pnpm meta sync   # dry run — expect ZERO skip-ad-missing-asset lines now
git add public/funnels/kitchens/ads/*.jpg public/funnels/bathrooms/ads/*.jpg .claude/skills/showcase-ads/SKILL.md
git commit -m "feat(ads): showcase statics — Remotion layered cards (hero, before/after, carousel) + reel thumbnails

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

⚠️ `.claude/skills/showcase-ads/SKILL.md` already has uncommitted local edits (pre-session) — review its diff before staging; keep Oliver's edits, add ours below them.

---

### Task 4: `notifyNewLead` — push + email on funnel ingest

**Files:**
- Create: `src/shared/constants/company/new-lead-notifications.ts`
- Create: `src/shared/services/providers/resend/emails/new-lead-email.tsx`
- Modify: `src/shared/services/email.service.ts`
- Modify: `src/shared/services/notification.service.ts`
- Modify: `src/trpc/routers/funnels.router.ts` (after the ingest success at ~line 145)

**Interfaces:**
- Produces: `notificationService.notifyNewLead(params: { customerId: string, source: string })` — generic; any future lead source calls the same method.

- [ ] **Step 1: Recipients constant** (the extension point — widening recipients later is a one-line change):

```ts
// src/shared/constants/company/new-lead-notifications.ts

/**
 * Who hears about new leads (push + email). Emails must match dashboard login
 * emails for push resolution. Widen the list to add recipients — no code change.
 */
export const NEW_LEAD_NOTIFICATION_EMAILS: readonly string[] = [
  'info@triprosremodeling.com',
]
```

- [ ] **Step 2: Email template** `new-lead-email.tsx`, mirroring `general-inquiry-email.tsx` (same imports: `@react-email/components`, `emailStyles as s`, `publicUrl`, logo header). Props and body:

```tsx
interface NewLeadEmailProps {
  name: string
  phone: string | null
  city: string | null
  zip: string | null
  source: string
  dashboardUrl: string
}

export function NewLeadEmail({ name, phone, city, zip, source, dashboardUrl }: NewLeadEmailProps) {
  const preview = `New lead: ${name} — ${source}`
  // Html > Head > Preview > Body > Container: logo Section, Heading "New lead",
  // Text rows: Name / Phone (formatPhone, only if present) / City · ZIP (only if
  // present) / Source, Hr, Link "Open dashboard" → dashboardUrl. Reuse s.* styles
  // exactly as general-inquiry-email.tsx does — no new style objects.
}
```

- [ ] **Step 3: `email.service.ts`** — add alongside the existing methods (same conventions: `RESEND_FROM.default`, recipients param):

```ts
    sendNewLeadNotificationEmail: async (params: {
      to: string[]
      name: string
      phone: string | null
      city: string | null
      zip: string | null
      source: string
    }) => {
      await resendClient.emails.send({
        from: RESEND_FROM.default,
        to: params.to,
        subject: `New lead: ${params.name} — ${params.source}`,
        react: NewLeadEmail({
          name: params.name,
          phone: params.phone,
          city: params.city,
          zip: params.zip,
          source: params.source,
          dashboardUrl: `${publicUrl()}${ROOTS.dashboard.customers.root()}`,
        }),
      })
    },
```

(Match the exact `resendClient.emails.send` call shape used by `sendGeneralInquiryEmail` — if it wraps errors or returns the result, do the same.)

- [ ] **Step 4: `notification.service.ts`** — add the generic method (mirror `notifyMeetingParticipantAdded`'s query style; push title follows the file's documented `"<EventType> | <Customer>"` truncation convention):

```ts
    /**
     * Generic new-lead alert (push + email) — source-agnostic: funnels today,
     * webhooks/manual intake tomorrow. Recipients: NEW_LEAD_NOTIFICATION_EMAILS.
     */
    notifyNewLead: async (params: { customerId: string, source: string }) => {
      const [customer] = await db
        .select({ id: customers.id, name: customers.name, phone: customers.phone, city: customers.city, zip: customers.zip })
        .from(customers)
        .where(eq(customers.id, params.customerId))
        .limit(1)
      if (!customer) {
        console.warn(`[notificationService] notifyNewLead: customer ${params.customerId} not found`)
        return
      }

      const emails = [...NEW_LEAD_NOTIFICATION_EMAILS]
      const recipients = await db
        .select({ id: user.id })
        .from(user)
        .where(inArray(user.email, emails))

      const name = customer.name ?? 'Unknown'
      const locationLabel = [customer.city, customer.zip].filter(Boolean).join(' ')
      const body = locationLabel ? `${params.source} · ${locationLabel}` : params.source

      const pushResults = await Promise.allSettled(recipients.map(r =>
        sendPushToUser(r.id, {
          title: `New lead | ${name}`,
          body,
          navigate: ROOTS.dashboard.customers.root(),
          urgency: 'high',
        }),
      ))
      const failedPushes = pushResults.filter(r => r.status === 'rejected').length
      if (failedPushes > 0)
        console.warn(`[notificationService] notifyNewLead: ${failedPushes} push send(s) failed`)

      await emailService.sendNewLeadNotificationEmail({
        to: emails,
        name,
        phone: customer.phone,
        city: customer.city,
        zip: customer.zip,
        source: params.source,
      })
    },
```

Verify the `customers` schema column names (`city`, `zip`, `phone`) against `src/shared/db/schema/` before writing; adjust the select to the real columns. Check `sendPushToUser`'s exact options type in `src/shared/services/push/send.ts` (`urgency` exists per the push pattern doc — confirm).

- [ ] **Step 5: Wire the trigger** in `funnels.router.ts` right after `const customerId = result.data.customer.id` (fire-and-forget — push/email latency must NEVER block the mutation):

```ts
      // New-lead alert (push + email). Fire-and-forget: never blocks the lead submit.
      void notificationService
        .notifyNewLead({ customerId, source: `${input.leadSourceSlug} funnel` })
        .catch(err => console.warn('[funnels.ingestLead] notifyNewLead failed:', err))
```

- [ ] **Step 6: Verify** — `pnpm tsc && pnpm lint`. Pipeline check: `pnpm push:test --to info@triprosremodeling.com --title "New lead | Test" --navigate /dashboard/customers`. End-to-end: `pnpm dev`, submit the kitchens funnel on dev with test data, confirm push arrives on Oliver's device AND email lands in info@ inbox, and the mutation response wasn't delayed.

- [ ] **Step 7: Commit**

```bash
git add src/shared/constants/company/new-lead-notifications.ts src/shared/services/providers/resend/emails/new-lead-email.tsx src/shared/services/email.service.ts src/shared/services/notification.service.ts src/trpc/routers/funnels.router.ts
git commit -m "feat(notifications): generic notifyNewLead — push + Resend email on funnel lead ingest

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 5: Docs — campaign-as-offer doctrine + optimization-ladder correction

**Files:**
- Modify: `scripts/meta/DOCS.md`

**Interfaces:** none (docs). Referenced by Task 2's spec comment (`#campaign-as-offer`).

- [ ] **Step 1: Add a `## campaign-as-offer` section** (after `## showcase-offer`):

```markdown
## campaign-as-offer

Structure doctrine (research-validated 2026-07-26, spec:
`docs/superpowers/specs/2026-07-26-showcase-campaign-launch-design.md`):

- **Campaign = offer.** One campaign per offer (`showcase`). A new offer = a new
  spec file composing the same building blocks (`defineCampaign`, geo, guardrails,
  ad formats) — never a copy-paste of an old spec.
- **Ad set = product.** The ONLY sanctioned ad-set split (different landing pages
  + per-product budget guarantees). Never split by interests/demographics — the
  learning phase lives per ad set and fragmentation starves it.
- **ABO, not CBO.** Budgets live on ad sets. With identical audiences, CBO
  arbitrates on cheapest lead and over-funds the cheaper product.
- **Naming:** campaign key = offer slug; ad set key = product slug; ad key =
  `<product>-<concept>-<nn>` (unique campaign-wide — ad lock keys are
  `<campaignKey>/<adKey>`).
- **5 distinct concepts per ad set** (2 reels / before-after static / carousel /
  hero static), copy variation INSIDE each ad via multiple text options (≤5
  primary texts). Near-duplicate ads collapse under Meta's ranking — vary
  concepts across ads, text within them.
- **Settings:** Advantage+ audience ON (geo + age_min are the hard controls),
  attribution 7-day click only, highest-volume bidding, 24/7.
- **Learning reality:** at ~$58/day/ad set, "Learning Limited" is permanent and
  fine. Judge on 2–4-week windows. Budget changes ≤20% per move; never duplicate
  ad sets to test.
- **Housing-SAC fallback:** if Meta ever flags remodeling as the housing special
  category, ZIP lists + age floors lock; fallback = 15-mile radius, 18–65+.
```

- [ ] **Step 2: Rewrite `## optimization-ladder`** (replace the whole section — the 50/week gate is unreachable math at this spend):

```markdown
## optimization-ladder

Ad sets optimize on `LEAD` (pixel+CAPI dedup pair, renter-gated server-side) —
and stay there. The old "graduate to SCHEDULE at ~50 conversions/week per ad
set" gate is retired: at ~$58/day and realistic CPLs that volume is ~5x budget
away, and Meta's Conversion-Leads-style optimization is instant-forms-only (not
available for website leads).

The ladder now:

1. **Quality lives in the Lead event.** Every server-side disqualifier (renter
   gate today; future: bad phone, out-of-area) sharpens what Meta trains on.
2. **`Schedule` via CAPI is for measurement, not optimization** — cost-per-
   Schedule (custom conversion in Ads Manager) is the creative/ad-set
   scoreboard, replacing CPL.
3. Consider testing `SCHEDULE` optimization (parallel ad set, expect permanent
   Learning Limited) only at ~15–25 Schedule events/week account-wide. Below
   ~10/week, don't bother.

Funnel event semantics are being redesigned separately —
`docs/plans/2026-07-26-funnel-event-model-redesign-handoff.md`. If that work
changes the optimization event's name or firing point, update the campaign
spec + this section in the same PR.
```

- [ ] **Step 3: Update the `## campaign-as-code` section's copy about specs** — one edit: "Ad copy … lives typed in the campaign spec" paragraph stays; change the image-path sentence to "Image files live in `public/funnels/<funnelSlug>/ads/` where `funnelSlug` is set **per ad set**".

- [ ] **Step 4: Verify + commit**

```bash
pnpm lint
git add scripts/meta/DOCS.md
git commit -m "docs(meta): campaign-as-offer doctrine + retire 50/week optimization-ladder gate

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 6: One-off rename of obsolete campaigns (NOT committed)

**Files:**
- Create then delete (never committed): `scripts/meta/tmp-rename-obsolete.ts`

**Interfaces:**
- Consumes: `fetchAccountState()` and `updateCampaignName(id, name)` from `scripts/meta/lib/marketing-api.ts`; `readLock()` from `scripts/meta/sync/lock.ts`.

- [ ] **Step 1: Write the throwaway script.** First open `scripts/meta/setup/verify-credentials.ts` and copy its exact env-bootstrapping import lines (whatever it does before touching `metaEnv` — replicate verbatim so credentials load the same way). Then:

```ts
// scripts/meta/tmp-rename-obsolete.ts — ONE-OFF. Delete after running. Never commit.
// <env-bootstrapping imports copied from setup/verify-credentials.ts>
import process from 'node:process'
import { fetchAccountState, updateCampaignName } from './lib/marketing-api.js'
import { readLock } from './sync/lock.js'

const OLD_PREFIX = '[OLD] '

async function main() {
  const apply = process.argv.includes('--apply')
  const lock = readLock()
  const managedCampaignIds = new Set(Object.values(lock.campaigns).map(e => e.id))
  const state = await fetchAccountState()

  const targets = state.campaigns.filter(c =>
    !managedCampaignIds.has(c.id) && !c.name.startsWith(OLD_PREFIX),
  )

  if (targets.length === 0) {
    console.log('Nothing to rename.')
    return
  }
  console.log(`${apply ? 'Renaming' : 'DRY RUN — would rename'} ${targets.length} campaign(s):`)
  for (const c of targets) console.log(`  ${c.id}  "${c.name}" → "${OLD_PREFIX}${c.name}"`)
  if (!apply) {
    console.log('\nRe-run with --apply to execute.')
    return
  }
  for (const c of targets) {
    await updateCampaignName(c.id, `${OLD_PREFIX}${c.name}`)
    console.log(`  ✓ ${c.id}`)
  }
}

main().catch((err) => { console.error(err); process.exit(1) })
```

Note the managed-ID exclusion uses the lock: after Task 7's apply, the lock's `campaigns` map still contains `kitchens-leads`/`bathrooms-leads` entries (spec-less) — those two OLD campaigns SHOULD be renamed, so drop them from the lock exclusion by excluding only the `showcase` entry: `const managedCampaignIds = new Set([lock.campaigns.showcase?.id].filter(Boolean))`. Use this narrower exclusion, not the full map.

- [ ] **Step 2: Run AFTER Task 7's apply** (so the new campaign exists and is excluded): `pnpm tsx scripts/meta/tmp-rename-obsolete.ts` → paste the dry-run list to Oliver in chat → on his OK, re-run with `--apply`. Expect the two old TPR Showcase campaigns AND both "[GM]" campaigns in the list (renaming does not touch delivery/status).

- [ ] **Step 3: Delete the script; confirm clean tree:**

```bash
rm scripts/meta/tmp-rename-obsolete.ts
git status --short   # must show nothing from this task
```

---

### Task 7: Sync, verify, launch handoff

**Files:**
- Modify (generated): `scripts/meta/meta.lock.json`
- Modify: memory `project-meta-ads-strategy.md` (launch state note)

**Interfaces:**
- Consumes: everything above.

- [ ] **Step 1: Final dry run** — `pnpm meta sync`. Expected plan: 1 create-campaign (`showcase`), 2 create-adset (`showcase/kitchens`, `showcase/bathrooms`), 10 create-ad, 0 skips, orphan report lists old campaigns. Anything unexpected → STOP and diagnose before apply.

- [ ] **Step 2: Apply** — `pnpm meta sync --apply`. Videos upload + poll (minutes). Then re-run `pnpm meta sync` → expect "In sync — nothing to do." plus orphan lines only.

- [ ] **Step 3: Commit the lock**

```bash
git add scripts/meta/meta.lock.json
git commit -m "chore(meta): lock — showcase campaign tree applied (PAUSED)

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

- [ ] **Step 4: Run Task 6's rename now** (it depends on the fresh lock).

- [ ] **Step 5: Preflight** — `pnpm lint && pnpm tsc` clean on the final tree.

- [ ] **Step 6: Update memory** — in `project-meta-ads-strategy.md`: campaign-as-offer restructure applied <date>; single `showcase` campaign (id from lock) with kitchens/bathrooms ad sets; old campaigns renamed `[OLD]`; activation remains Oliver-manual; notifyNewLead live. Keep the activation-hold line updated to reflect Oliver's launch decision this session.

- [ ] **Step 7: Hand Oliver the manual launch checklist** (chat message, not a file):
  1. Ads Manager → verify "TPR — Showcase — Leads" tree: 2 ad sets, 5 ads each, all PAUSED; preview each creative (text options render, thumbnails right, carousels ordered).
  2. Toggle AI-disclosure on any AI-modified creative (the reels using AI-composited footage).
  3. Pause both "[OLD] [GM] …" campaigns (they're active and spending).
  4. Flip Showcase campaign + both ad sets + all 10 ads ACTIVE.
  5. Delete `[OLD]` campaigns at your leisure (after deletion, tell this session — we prune the stale `kitchens-leads`/`bathrooms-leads` entries from `meta.lock.json` and commit).
  6. 72h: no edits; watch delivery starts, spend pacing, CPL. Week 4–6: first creative-refresh checkpoint (kill bottom 1–2 ads by cost-per-qualified-lead, add 2–3 new concepts).
