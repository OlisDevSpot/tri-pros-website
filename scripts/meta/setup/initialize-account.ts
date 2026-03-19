// scripts/meta/setup/initialize-account.ts
/**
 * One-time Tri Pros Remodeling account initialization.
 *
 * Creates (all PAUSED / no spend until you activate):
 *   1. Facebook Pixel  — install on website to track visitors & conversions
 *   2. Campaign        — SoCal homeowner traffic to contact page
 *   3. Ad Set          — California, age 35-65, link-click optimized
 *   4. Ad Creative + Ad — professional copy, link to contact page
 *   5. Retargeting Audience — 30-day website visitors (seeds future campaigns)
 *
 * Run once after pnpm meta verify passes.
 * Activate ads only after reviewing in Ads Manager and adding creative images.
 */

import { metaEnv } from '../lib/env.js'
import { metaFetch, MetaApiError } from '../lib/client.js'
import { printSuccess, printError, printInfo } from '../lib/formatters.js'

const TODAY_LABEL = new Date().toLocaleDateString('en-US', { month: 'short', year: 'numeric' })

// Module-scope tracking so the catch handler can report orphaned resources
let pixelId: string | undefined
let audienceId: string | undefined
let campaignId: string | undefined
let adSetId: string | undefined
let creativeId: string | undefined

// ── Marketing configuration ──────────────────────────────────────────────────
// Budget: $50/day is a good test budget for a high-ticket remodeling service.
// Actual CPC in home-improvement verticals is $2–6; at $50/day you get
// 8–25 clicks/day to test which creative/targeting combination works.
const DAILY_BUDGET_CENTS = 5_000 // $50.00 USD

// Geography: California state-level. Refine to SoCal DMAs in Ads Manager
// once you see where conversions cluster (LA metro, OC, San Diego, IE).
const GEO_REGIONS = [{ key: '3847', name: 'California', country: 'US' }]

// Age floor: Advantage+ audience (required by LOWEST_COST_WITHOUT_CAP bidding) caps
// age_min at 25 as a hard control. The algorithm still skews toward homeowner-age
// demographics (35-65) based on creative and behavioral signals — so set the floor to 25
// and let Meta's AI find the right people within that range.
const AGE_MIN = 25
const AGE_MAX = 65

// Copy: Lead with the trust signal (Southern California's trusted), the
// service breadth (kitchens, bathrooms, whole-home), and a low-friction CTA
// (free estimate removes the price objection before they even call).
const HEADLINE = 'Transform Your SoCal Home'
const PRIMARY_TEXT
  = "Southern California's trusted remodeling experts. Kitchens · Bathrooms · Whole-Home renovations. Get your FREE in-home estimate — no obligation, no pressure."
const CTA_TYPE = 'GET_QUOTE'
const LANDING_URL = 'https://tripros.com/contact'
// ────────────────────────────────────────────────────────────────────────────

async function main() {
  console.log('\n🚀  Tri Pros — Meta Account Initialization\n')
  console.log('   All resources will be created PAUSED.')
  console.log('   Nothing spends until you activate in Ads Manager.\n')

  // ── Step 1: Facebook Pixel ─────────────────────────────────────────────────
  // The pixel fires on every page of your website. Once installed it tracks
  // visitors (for retargeting) and form completions (your leads/conversions).
  // Each ad account is limited to one pixel — re-use existing if present.
  printInfo('Checking for existing pixel...')
  const existingPixels = await metaFetch<{ data: { id: string; name: string }[] }>(
    `/${metaEnv.adAccountId}/adspixels`,
    { params: { fields: 'id,name' } },
  )
  let pixel: { id: string }
  if (existingPixels.data.length > 0) {
    pixel = existingPixels.data[0]
    printInfo(`Using existing pixel: ${pixel.id} (${existingPixels.data[0].name})`)
  }
  else {
    printInfo('Creating Facebook Pixel...')
    pixel = await metaFetch<{ id: string }>(`/${metaEnv.adAccountId}/adspixels`, {
      method: 'POST',
      body: { name: 'Tri Pros Remodeling - Website Pixel' },
    })
    printSuccess(`Pixel created: ${pixel.id}`)
  }
  pixelId = pixel.id

  // ── Step 2: Campaign ───────────────────────────────────────────────────────
  // OUTCOME_TRAFFIC: drives qualified homeowners to your contact page.
  // Why not OUTCOME_LEADS (Instant Form)? High-ticket services like remodeling
  // ($15K–$100K+ jobs) convert better from real conversations initiated on your
  // own website than from a pre-filled Facebook form. Once the pixel accumulates
  // ~50 conversion events, upgrade to OUTCOME_LEADS + OFFSITE_CONVERSIONS.
  printInfo('Creating campaign...')
  const campaign = await metaFetch<{ id: string }>(`/${metaEnv.adAccountId}/campaigns`, {
    method: 'POST',
    body: {
      name: `Tri Pros - SoCal Homeowners - ${TODAY_LABEL}`,
      objective: 'OUTCOME_LEADS',
      status: 'PAUSED',
      special_ad_categories: [],
      // Budget lives on the ad set (not the campaign), so we must explicitly opt out of CBO
      is_adset_budget_sharing_enabled: false,
    },
  })
  campaignId = campaign.id
  printSuccess(`Campaign created: ${campaign.id}`)

  // ── Step 3: Ad Set ─────────────────────────────────────────────────────────
  // LINK_CLICKS optimization: works before your pixel has enough data.
  // Once you have 50+ website-visit events, switch to LANDING_PAGE_VIEWS
  // in Ads Manager for better traffic quality.
  const startTime = new Date(Date.now() + 60_000).toISOString()
  printInfo('Creating ad set...')
  const adSet = await metaFetch<{ id: string }>(`/${metaEnv.adAccountId}/adsets`, {
    method: 'POST',
    body: {
      name: `SoCal Homeowners 35-65 - CA (Advantage+)`,
      campaign_id: campaign.id,
      daily_budget: DAILY_BUDGET_CENTS,
      billing_event: 'IMPRESSIONS',
      optimization_goal: 'LEAD_GENERATION',
      bid_strategy: 'LOWEST_COST_WITHOUT_CAP', // Let Meta optimize for lowest cost per lead
      targeting: {
        geo_locations: { regions: GEO_REGIONS },
        age_min: AGE_MIN,
        age_max: AGE_MAX,
      },
      status: 'PAUSED',
      start_time: startTime,
    },
  })
  adSetId = adSet.id
  printSuccess(`Ad set created: ${adSet.id}`)

  // ── Step 4: Ad Creative + Ad ───────────────────────────────────────────────
  // Text-only link ad. Before activating, add a high-quality before/after
  // remodel photo in Ads Manager — image ads outperform text-only by 2–3x
  // in the home-improvement vertical.
  printInfo('Creating ad creative...')
  const creative = await metaFetch<{ id: string }>(`/${metaEnv.adAccountId}/adcreatives`, {
    method: 'POST',
    body: {
      name: `Tri Pros Creative — ${TODAY_LABEL}`,
      object_story_spec: {
        page_id: metaEnv.pageId,
        link_data: {
          link: LANDING_URL,
          message: PRIMARY_TEXT,
          name: HEADLINE,
          call_to_action: { type: CTA_TYPE, value: { link: LANDING_URL } },
        },
      },
    },
  })
  creativeId = creative.id
  printSuccess(`Creative created: ${creative.id}`)

  printInfo('Creating ad...')
  const ad = await metaFetch<{ id: string }>(`/${metaEnv.adAccountId}/ads`, {
    method: 'POST',
    body: {
      name: `Tri Pros — Get Quote — ${TODAY_LABEL}`,
      adset_id: adSet.id,
      creative: { creative_id: creative.id },
      status: 'PAUSED',
    },
  })
  printSuccess(`Ad created: ${ad.id}`)

  // ── Step 5: Retargeting Audience (Website Visitors — 30 Days) ─────────────
  // Seeds your retargeting funnel. Once your pixel fires on enough real visitors,
  // you can create a second campaign targeting this audience with a stronger
  // offer (e.g., "Still thinking about that remodel? Here's 3 reasons homeowners
  // choose Tri Pros...") — these audiences convert 2–5x better than cold traffic.
  printInfo('Creating retargeting audience (website visitors — 30 days)...')
  const audience = await metaFetch<{ id: string }>(`/${metaEnv.adAccountId}/customaudiences`, {
    method: 'POST',
    body: {
      name: 'Website Visitors — 30 Days',
      description: 'People who visited tripros.com in the last 30 days — retargeting seed audience',
      pixel_id: pixel.id,
      subtype: 'WEBSITE',
      retention_days: 30,
      rule: {
        inclusions: {
          operator: 'or',
          rules: [
            {
              event_sources: [{ id: pixel.id, type: 'pixel' }],
              retention_seconds: 2_592_000, // 30 days
              filter: {
                operator: 'and',
                filters: [{ field: 'event', operator: '=', value: 'PageView' }],
              },
            },
          ],
        },
      },
    },
  })
  audienceId = audience.id
  printSuccess(`Retargeting audience created: ${audience.id}`)

  // ── Summary ───────────────────────────────────────────────────────────────
  const accountNum = metaEnv.adAccountId.replace('act_', '')
  console.log('\n────────────────────────────────────────────────────────────')
  console.log('✅  Account initialization complete (all PAUSED — $0 spent)\n')
  console.log(`   Pixel ID:    ${pixel.id}`)
  console.log(`   Campaign:    ${campaign.id}`)
  console.log(`   Ad Set:      ${adSet.id}`)
  console.log(`   Ad:          ${ad.id}`)
  console.log(`   Audience:    ${audience.id}`)
  console.log(`\n   ADS MANAGER: https://adsmanager.facebook.com/adsmanager/manage/campaigns?act=${accountNum}`)
  console.log('\n────────────────────────────────────────────────────────────')
  console.log('\n📋  REQUIRED NEXT STEPS before activating:\n')
  console.log(`   1. INSTALL PIXEL (${pixel.id}) on your website`)
  console.log(`      — Add to <head> of every page on tripros.com`)
  console.log(`      — For Next.js: use next/script or install via Google Tag Manager`)
  console.log(`      — Verify at: https://www.facebook.com/ads/manager/pixel/facebook_pixel?act=${accountNum}`)
  console.log('\n   2. ADD A CREATIVE IMAGE to the ad in Ads Manager')
  console.log('      — Use a high-quality before/after remodel photo (1200×628px)')
  console.log('      — Before/after splits outperform single images in home improvement')
  console.log('\n   3. REFINE GEO TARGETING in the ad set from California → SoCal cities')
  console.log('      — Target: Los Angeles, Orange County, San Diego, Riverside, San Bernardino')
  console.log('      — This cuts wasted spend on NorCal audiences')
  console.log('\n   4. REVIEW LANDING PAGE at https://tripros.com/contact')
  console.log('      — Should have a clear headline + short form (name, phone, zip, project type)')
  console.log('      — Mobile-first: 60%+ of traffic will be mobile')
  console.log('\n   5. Once pixel has 50+ PageView events → upgrade optimization to LANDING_PAGE_VIEWS')
  console.log('      — This improves traffic quality significantly\n')
}

main().catch((err) => {
  printError(err.message ?? 'Unknown error')
  if (err instanceof MetaApiError) {
    console.error(`    code: ${err.code}  subcode: ${err.subcode ?? 'n/a'}  fbtrace_id: ${err.fbtrace_id}`)
    // Subcode 1885183 = app is in development mode — give actionable instructions
    if (err.subcode === 1885183) {
      console.error('\n  🔧  ACTION REQUIRED: Your Meta app is in development mode.')
      console.error('      1. Go to https://developers.facebook.com/apps')
      console.error('      2. Open your app → toggle Development → Live')
      console.error('      3. Re-run: pnpm meta init-account')
    }
  }
  if (pixelId ?? campaignId ?? adSetId ?? creativeId ?? audienceId) {
    console.error('\n  ⚠️  Partial creation — resources that may need cleanup in Ads Manager:')
    if (pixelId) console.error(`    Pixel:     ${pixelId}`)
    if (campaignId) console.error(`    Campaign:  ${campaignId}`)
    if (adSetId) console.error(`    Ad Set:    ${adSetId}`)
    if (creativeId) console.error(`    Creative:  ${creativeId}`)
    if (audienceId) console.error(`    Audience:  ${audienceId}`)
  }
  process.exit(1)
})
