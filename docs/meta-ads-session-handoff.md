# Meta Ads — Session Handoff (2026-03-19)

## Where We Left Off

**One blocker remains before the account can be fully initialized:**

> Your Meta app is in **Unpublished (development) mode**.
> Switch it to **Published (live)** and then run `pnpm meta init-account`.

### How to fix (2 minutes)
1. Go to [developers.facebook.com/apps](https://developers.facebook.com/apps)
2. Click your app (the one whose App ID is in `.env.meta` as `META_APP_ID`)
3. Find the **Unpublished → Published** toggle (top of the left sidebar)
4. Switch to **Published** — Meta may ask for a Privacy Policy URL; use `https://tripros.com/privacy`
5. Run: `pnpm meta init-account`

---

## Current State of the Ad Account

| Resource | Status | ID |
|---|---|---|
| Facebook Pixel | ✅ Created | `2031257387425754` |
| Campaign | ❌ Not yet (blocked by app mode) | — |
| Ad Set | ❌ Not yet | — |
| Ad Creative | ❌ Not yet | — |
| Retargeting Audience | ❌ Not yet | — |

The ad account (`act_1552723459154642`) is active, has valid payment methods, and is ready — only the app mode is blocking creative creation.

---

## What `pnpm meta init-account` Will Create (All PAUSED — $0 spend)

| Step | What gets created | Config |
|---|---|---|
| 1 | Pixel | Reuses `2031257387425754` (already exists) |
| 2 | Campaign | "Tri Pros - SoCal Homeowners - Mar 2026", OUTCOME_LEADS |
| 3 | Ad Set | California, age 25–65 (Advantage+ floor), $50/day, LEAD_GENERATION |
| 4 | Ad Creative + Ad | "Transform Your SoCal Home" copy, GET_QUOTE CTA → tripros.com/contact |
| 5 | Retargeting Audience | 30-day website visitors (seeds future retargeting campaigns) |

---

## After `init-account` Succeeds — Required Next Steps Before Activating

The script prints these at the end, but here they are:

1. **Install the pixel** (`2031257387425754`) on tripros.com
   - Next.js: add via `next/script` in the root layout, or use Google Tag Manager
   - Verify at: `https://www.facebook.com/ads/manager/pixel/facebook_pixel?act=1552723459154642`

2. **Add a creative image** to the ad in Ads Manager
   - Use a high-quality before/after remodel photo (1200×628px)
   - Before/after splits outperform single images 2–3x in home improvement

3. **Refine geo targeting** from California → SoCal cities
   - Target: Los Angeles, Orange County, San Diego, Riverside, San Bernardino
   - Cuts wasted spend on NorCal audiences

4. **Review the landing page** at `https://tripros.com/contact`
   - Should have a short form (name, phone, zip, project type)
   - Must be mobile-first — 60%+ of Meta traffic is mobile

5. **Activate when ready** — all resources start PAUSED

---

## CLI Commands Reference

```bash
pnpm meta verify              # Smoke test credentials
pnpm meta init-account        # One-time setup (run this next)
pnpm meta performance [preset]  # Pull campaign stats (today / last_7d / this_month / etc.)
pnpm meta manage-ad           # Interactive: pause or activate an ad
pnpm meta create-campaign     # Interactive wizard for future campaigns
```

---

## Credentials File

`.env.meta` at project root (gitignored). Contains:
- `META_APP_ID` — your Meta app ID
- `META_ACCESS_TOKEN` — system user token (non-expiring)
- `META_AD_ACCOUNT_ID` — `act_1552723459154642`
- `META_PAGE_ID` — `661917947005358` (Tri Pros Remodeling page)

---

## Scripts Location

```
scripts/meta/
  index.ts                    ← pnpm meta dispatcher
  lib/
    client.ts                 ← metaFetch + MetaApiError
    env.ts                    ← loads .env.meta, validates required vars
    formatters.ts             ← printSuccess / printError / printInfo
    types.ts                  ← shared types
  setup/
    verify-credentials.ts     ← pnpm meta verify
    initialize-account.ts     ← pnpm meta init-account  ← RUN THIS NEXT
  reports/
    pull-performance.ts       ← pnpm meta performance
  ads/
    manage-ad.ts              ← pnpm meta manage-ad
  campaigns/
    create-campaign.ts        ← pnpm meta create-campaign
```

---

## Known Meta API Quirks (discovered this session)

| Field | Why required |
|---|---|
| `is_adset_budget_sharing_enabled: false` | Required on campaigns when budget lives on the ad set (not CBO) |
| `bid_strategy: 'LOWEST_COST_WITHOUT_CAP'` | Required on ad sets — Meta no longer defaults silently |
| `age_min` max is 25 with Advantage+ audience | `LOWEST_COST_WITHOUT_CAP` enables Advantage+; age floor capped at 25 |
| `error_user_msg` in error envelope | Always check this field — the `message` field is generic ("Invalid parameter") but `error_user_msg` is actionable |
