// scripts/meta/campaigns/create-campaign.ts
import { input, select, number } from '@inquirer/prompts'
import { metaEnv } from '../lib/env.js'
import { metaFetch } from '../lib/client.js'
import { printSuccess, printError, printInfo } from '../lib/formatters.js'

const OBJECTIVES = [
  { value: 'OUTCOME_LEADS', name: 'Lead Generation — collect contact info (recommended for Tri Pros)' },
  { value: 'OUTCOME_AWARENESS', name: 'Awareness — maximize reach and brand visibility' },
  { value: 'OUTCOME_TRAFFIC', name: 'Traffic — drive clicks to your website' },
  { value: 'OUTCOME_ENGAGEMENT', name: 'Engagement — boost post likes, comments, shares' },
] as const

async function main() {
  console.log('\n🚀  Meta Campaign Creator — Tri Pros Remodeling\n')

  // ── Step 1: Campaign ──────────────────────────────────────────────
  const campaignName = await input({
    message: 'Campaign name:',
    default: `Tri Pros — ${new Date().toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}`,
  })

  const objective = await select({
    message: 'Campaign objective:',
    choices: OBJECTIVES,
  })

  const dailyBudgetDollars = (await number({
    message: 'Daily budget (USD):',
    default: 50,
    min: 1,
    required: true,
  })) as number

  printInfo('Creating campaign...')
  const campaign = await metaFetch<{ id: string }>(`/${metaEnv.adAccountId}/campaigns`, {
    method: 'POST',
    body: {
      name: campaignName,
      objective,
      status: 'PAUSED', // Always start paused — activate manually after review
      special_ad_categories: [],
    },
  })
  printSuccess(`Campaign created: ${campaign.id}`)

  // ── Step 2: Ad Set ────────────────────────────────────────────────
  const adSetName = await input({
    message: 'Ad set name:',
    default: `${campaignName} — Ad Set 1`,
  })

  const ageMin = (await number({ message: 'Minimum age:', default: 35, min: 18, max: 65, required: true })) as number
  const ageMax = (await number({ message: 'Maximum age:', default: 65, min: ageMin, max: 65, required: true })) as number

  printInfo('Creating ad set...')
  const adSet = await metaFetch<{ id: string }>(`/${metaEnv.adAccountId}/adsets`, {
    method: 'POST',
    body: {
      name: adSetName,
      campaign_id: campaign.id,
      daily_budget: Math.round(dailyBudgetDollars * 100), // Meta uses cents
      billing_event: 'IMPRESSIONS',
      optimization_goal: objective === 'OUTCOME_LEADS' ? 'LEAD_GENERATION' : 'REACH',
      targeting: {
        geo_locations: {
          regions: [{ key: '3847', name: 'California', country: 'US' }], // Southern California
        },
        age_min: ageMin,
        age_max: ageMax,
      },
      status: 'PAUSED',
      start_time: new Date(Date.now() + 60_000).toISOString(), // 1 min from now
    },
  })
  printSuccess(`Ad set created: ${adSet.id}`)

  // ── Step 3: Ad Creative + Ad ──────────────────────────────────────
  const adName = await input({
    message: 'Ad name:',
    default: `${campaignName} — Ad 1`,
  })

  const headline = await input({
    message: 'Ad headline (max 40 chars):',
    default: 'Transform Your Home with Tri Pros',
  })

  const primaryText = await input({
    message: 'Primary text (the body copy):',
    default: 'Southern California\'s trusted remodeling experts. Kitchen, bath, whole-home. Get a free in-home estimate today.',
  })

  const ctaType = await select({
    message: 'Call to action:',
    choices: [
      { value: 'LEARN_MORE', name: 'Learn More' },
      { value: 'GET_QUOTE', name: 'Get Quote' },
      { value: 'CONTACT_US', name: 'Contact Us' },
      { value: 'SIGN_UP', name: 'Sign Up' },
    ],
  })

  const websiteUrl = await input({
    message: 'Destination URL:',
    default: 'https://tripros.com',
  })

  printInfo('Creating ad creative...')
  const creative = await metaFetch<{ id: string }>(`/${metaEnv.adAccountId}/adcreatives`, {
    method: 'POST',
    body: {
      name: `${adName} Creative`,
      object_story_spec: {
        page_id: metaEnv.pageId,
        link_data: {
          link: websiteUrl,
          message: primaryText,
          name: headline,
          call_to_action: { type: ctaType, value: { link: websiteUrl } },
        },
      },
    },
  })
  printSuccess(`Creative created: ${creative.id}`)

  printInfo('Creating ad...')
  const ad = await metaFetch<{ id: string }>(`/${metaEnv.adAccountId}/ads`, {
    method: 'POST',
    body: {
      name: adName,
      adset_id: adSet.id,
      creative: { creative_id: creative.id },
      status: 'PAUSED',
    },
  })
  printSuccess(`Ad created: ${ad.id}`)

  // ── Summary ───────────────────────────────────────────────────────
  console.log('\n📋  Campaign created (all PAUSED — review before activating):')
  console.log(`    Campaign:  ${campaign.id}  →  ${campaignName}`)
  console.log(`    Ad Set:    ${adSet.id}`)
  console.log(`    Ad:        ${ad.id}`)
  console.log(`\n  ADS MANAGER URL: https://adsmanager.facebook.com/adsmanager/manage/campaigns?act=${metaEnv.adAccountId.replace('act_', '')}`)
  console.log('\n  ⚠️   Campaign is PAUSED. Review in Ads Manager and activate when ready.\n')
}

main().catch((err) => {
  printError(err.message)
  process.exit(1)
})
