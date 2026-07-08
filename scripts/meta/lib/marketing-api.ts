// scripts/meta/lib/marketing-api.ts
// Thin typed wrappers over metaFetch for the objects the sync engine manages.
// HARD RULES (design spec): creates are always PAUSED; updates never touch
// status; nothing here can delete. Activation is human-only in Ads Manager.
import { metaFetch } from './client.js'
import { metaEnv } from './env.js'

export interface RemoteObj {
  id: string
  name: string
  status: string
}

export interface AccountState {
  campaigns: RemoteObj[]
  adSets: RemoteObj[]
  ads: RemoteObj[]
}

export async function fetchAccountState(): Promise<AccountState> {
  const fields = { fields: 'id,name,status', limit: 200 }
  const [campaigns, adSets, ads] = await Promise.all([
    metaFetch<{ data: RemoteObj[] }>(`/${metaEnv.adAccountId}/campaigns`, { params: fields }),
    metaFetch<{ data: RemoteObj[] }>(`/${metaEnv.adAccountId}/adsets`, { params: fields }),
    metaFetch<{ data: RemoteObj[] }>(`/${metaEnv.adAccountId}/ads`, { params: fields }),
  ])
  return { campaigns: campaigns.data, adSets: adSets.data, ads: ads.data }
}

export async function createCampaign(name: string): Promise<string> {
  const res = await metaFetch<{ id: string }>(`/${metaEnv.adAccountId}/campaigns`, {
    method: 'POST',
    body: {
      name,
      objective: 'OUTCOME_LEADS',
      status: 'PAUSED',
      special_ad_categories: [], // remodeling services ≠ Meta "housing" special category (housing = sale/rental/insurance opportunities)
      is_adset_budget_sharing_enabled: false, // budget lives on the ad set — explicit CBO opt-out
    },
  })
  return res.id
}

export async function updateCampaignName(id: string, name: string): Promise<void> {
  await metaFetch(`/${id}`, { method: 'POST', body: { name } })
}

export interface AdSetCreateInput {
  name: string
  campaignId: string
  dailyBudgetCents: number
  ageMin: number
  ageMax: number
  optimizationEvent: 'LEAD' | 'SCHEDULE'
  metaZips: { key: string }[]
}

function adSetBody(input: AdSetCreateInput) {
  return {
    name: input.name,
    campaign_id: input.campaignId,
    daily_budget: input.dailyBudgetCents,
    billing_event: 'IMPRESSIONS',
    optimization_goal: 'OFFSITE_CONVERSIONS', // optimize on pixel/CAPI conversions, not form fills
    bid_strategy: 'LOWEST_COST_WITHOUT_CAP',
    promoted_object: { pixel_id: metaEnv.pixelId, custom_event_type: input.optimizationEvent },
    targeting: {
      geo_locations: { zips: input.metaZips },
      age_min: input.ageMin,
      age_max: input.ageMax,
      // Strict demographic controls: the spec pins 35–70 as a HARD range.
      // (advantage_audience: 1 would demote age to a suggestion Meta can expand past.)
      // If the API rejects with "advantage_audience required" (Meta has been forcing
      // it on some new accounts), surface the error verbatim and decide then.
      targeting_automation: { advantage_audience: 0 },
    },
  }
}

export async function createAdSet(input: AdSetCreateInput): Promise<string> {
  const res = await metaFetch<{ id: string }>(`/${metaEnv.adAccountId}/adsets`, {
    method: 'POST',
    body: { ...adSetBody(input), status: 'PAUSED' },
  })
  return res.id
}

export async function updateAdSet(id: string, input: AdSetCreateInput): Promise<void> {
  // campaign_id is immutable on update — strip it; never send status.
  const { campaign_id: _omit, ...body } = adSetBody(input)
  await metaFetch(`/${id}`, { method: 'POST', body })
}

export async function uploadAdImage(bytes: Buffer): Promise<string> {
  const res = await metaFetch<{ images: Record<string, { hash: string }> }>(
    `/${metaEnv.adAccountId}/adimages`,
    { method: 'POST', body: { bytes: bytes.toString('base64') } },
  )
  const first = Object.values(res.images)[0]
  if (!first?.hash)
    throw new Error('adimages upload returned no image hash')
  return first.hash
}

export interface CreativeInput {
  name: string
  link: string
  headline: string
  primaryText: string
  description?: string
  imageHash: string
  ctaType: 'APPLY_NOW' | 'LEARN_MORE'
}

export async function createLinkAdCreative(input: CreativeInput): Promise<string> {
  const res = await metaFetch<{ id: string }>(`/${metaEnv.adAccountId}/adcreatives`, {
    method: 'POST',
    body: {
      name: input.name,
      object_story_spec: {
        page_id: metaEnv.pageId,
        link_data: {
          link: input.link,
          message: input.primaryText,
          name: input.headline,
          ...(input.description ? { description: input.description } : {}),
          image_hash: input.imageHash,
          call_to_action: { type: input.ctaType, value: { link: input.link } },
        },
      },
    },
  })
  return res.id
}

export async function createAd(input: { name: string, adSetId: string, creativeId: string }): Promise<string> {
  const res = await metaFetch<{ id: string }>(`/${metaEnv.adAccountId}/ads`, {
    method: 'POST',
    body: {
      name: input.name,
      adset_id: input.adSetId,
      creative: { creative_id: input.creativeId },
      status: 'PAUSED',
    },
  })
  return res.id
}

export async function setAdCreative(adId: string, creativeId: string): Promise<void> {
  await metaFetch(`/${adId}`, { method: 'POST', body: { creative: { creative_id: creativeId } } })
}
