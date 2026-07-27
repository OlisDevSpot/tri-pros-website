// scripts/meta/lib/marketing-api.ts
// Thin typed wrappers over metaFetch for the objects the sync engine manages.
// HARD RULES (design spec): creates are always PAUSED; updates never touch
// status; nothing here can delete. Activation is human-only in Ads Manager.
import { readFileSync } from 'node:fs'
import { basename } from 'node:path'
import { setTimeout as sleep } from 'node:timers/promises'
import { metaFetch, metaUpload } from './client.js'
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

/** Delivery settings applied to every managed ad set. Included in adSetFp — editing these triggers update-adset for all managed ad sets on next sync. */
export const AD_SET_DELIVERY_SETTINGS = {
  attributionSpec: [{ event_type: 'CLICK_THROUGH', window_days: 7 }],
  advantageAudience: 1,
} as const

function adSetBody(input: AdSetCreateInput) {
  return {
    name: input.name,
    campaign_id: input.campaignId,
    daily_budget: input.dailyBudgetCents,
    billing_event: 'IMPRESSIONS',
    optimization_goal: 'OFFSITE_CONVERSIONS', // optimize on pixel/CAPI conversions, not form fills
    bid_strategy: 'LOWEST_COST_WITHOUT_CAP',
    promoted_object: { pixel_id: metaEnv.pixelId, custom_event_type: input.optimizationEvent },
    // 7-day click only — no view-through: cleans lead-gen reporting AND changes
    // what delivery optimizes toward (Meta optimizes for conversions countable
    // under this setting). Design: 2026-07-26 spec §1.
    attribution_spec: AD_SET_DELIVERY_SETTINGS.attributionSpec,
    targeting: {
      geo_locations: { zips: input.metaZips },
      age_min: input.ageMin,
      age_max: input.ageMax, // 65 = "65+"; under Advantage+ audience the max is a suggestion anyway
      // Advantage+ audience ON: geo + age_min act as hard controls, everything
      // else is a starting suggestion Meta may expand past. Deliberate flip from
      // v1 (advantage_audience: 0) — 2026 delivery favors broad + creative-led.
      targeting_automation: { advantage_audience: AD_SET_DELIVERY_SETTINGS.advantageAudience },
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

// Individual Advantage+ enhancement opt-outs (required since v22; the old
// standard_enhancements bundle is deprecated). OPT_OUT keeps every creative
// exactly as specced — no Meta auto-rewrites. Shared by all creative shapes.
const CREATIVE_OPT_OUTS = {
  creative_features_spec: {
    image_enhancement: { enroll_status: 'OPT_OUT' },
    text_generation: { enroll_status: 'OPT_OUT' },
  },
}

const VIDEO_READY_POLL_INTERVAL_MS = 5_000
const VIDEO_READY_TIMEOUT_MS = 5 * 60_000

/** Meta processes uploads async; a creative referencing an unprocessed video is rejected. */
async function waitForVideoReady(videoId: string): Promise<void> {
  const deadline = Date.now() + VIDEO_READY_TIMEOUT_MS
  while (true) {
    const res = await metaFetch<{ status?: { video_status?: string } }>(`/${videoId}`, {
      params: { fields: 'status' },
    })
    const videoStatus = res.status?.video_status
    if (videoStatus === 'ready')
      return
    if (videoStatus === 'error')
      throw new Error(`Meta video ${videoId} failed processing (video_status=error)`)
    if (Date.now() >= deadline) {
      throw new Error(
        `Meta video ${videoId} not ready after ${VIDEO_READY_TIMEOUT_MS / 1000}s `
        + `(video_status=${videoStatus ?? 'unknown'}) — re-run sync to retry`,
      )
    }
    await sleep(VIDEO_READY_POLL_INTERVAL_MS)
  }
}

/** Non-chunked multipart upload — fine for files under ~50MB. Resolves once the video is processed. */
export async function uploadAdVideo(filePath: string): Promise<string> {
  const form = new FormData()
  form.append('source', new Blob([new Uint8Array(readFileSync(filePath))]), basename(filePath))
  const res = await metaUpload<{ id: string }>(`/${metaEnv.adAccountId}/advideos`, form)
  if (!res.id)
    throw new Error('advideos upload returned no video id')
  await waitForVideoReady(res.id)
  return res.id
}

export interface CreativeInput {
  name: string
  /** Clean landing URL — NO query params; tracking rides on urlTags. */
  baseUrl: string
  /** Query string WITHOUT leading '?' — the UI "URL parameters" (Tracking) field. Meta appends at delivery. */
  urlTags: string
  headlines: string[]
  primaryTexts: string[]
  descriptions?: string[]
  imageHash: string
  ctaType: 'APPLY_NOW' | 'LEARN_MORE'
}

export async function createLinkAdCreative(input: CreativeInput): Promise<string> {
  const res = await metaFetch<{ id: string }>(`/${metaEnv.adAccountId}/adcreatives`, {
    method: 'POST',
    body: {
      name: input.name,
      // Standard-ad-set multi-text shape (verified empirically 2026-07-07):
      // link_data anchors link/image/CTA + FIRST text variant; asset_feed_spec
      // carries ALL variants with DEGREES_OF_FREEDOM (= Ads Manager "Add text
      // option"). The images/ad_formats/link_urls asset-feed form is Dynamic
      // Creative-only and fails with "link field is required" here.
      object_story_spec: {
        page_id: metaEnv.pageId,
        link_data: {
          link: input.baseUrl,
          message: input.primaryTexts[0],
          name: input.headlines[0],
          ...(input.descriptions?.length ? { description: input.descriptions[0] } : {}),
          image_hash: input.imageHash,
          call_to_action: { type: input.ctaType },
        },
      },
      asset_feed_spec: {
        bodies: input.primaryTexts.map(text => ({ text })),
        titles: input.headlines.map(text => ({ text })),
        ...(input.descriptions?.length ? { descriptions: input.descriptions.map(text => ({ text })) } : {}),
        optimization_type: 'DEGREES_OF_FREEDOM',
      },
      degrees_of_freedom_spec: CREATIVE_OPT_OUTS,
      url_tags: input.urlTags,
    },
  })
  return res.id
}

export interface CarouselCardInput {
  imageHash: string
  headline: string
  description?: string
}

export interface CarouselCreativeInput {
  name: string
  /** Clean landing URL — NO query params; tracking rides on urlTags. */
  baseUrl: string
  /** Query string WITHOUT leading '?' — the UI "URL parameters" (Tracking) field. Meta appends at delivery. */
  urlTags: string
  primaryTexts: string[]
  /** false = Meta must not reorder cards by predicted performance. */
  multiShareOptimized: boolean
  cards: CarouselCardInput[]
  ctaType: 'APPLY_NOW' | 'LEARN_MORE'
}

export async function createCarouselAdCreative(input: CarouselCreativeInput): Promise<string> {
  const res = await metaFetch<{ id: string }>(`/${metaEnv.adAccountId}/adcreatives`, {
    method: 'POST',
    body: {
      name: input.name,
      // UNVERIFIED write-path caution: asset_feed_spec bodies alongside
      // link_data.child_attachments is NOT an empirically-verified combination
      // (the verified multi-text shape was single-image link_data) and may
      // conflict — so carousel creatives intentionally ship ONE primary text
      // (primaryTexts[0]). If Meta later confirms the combo works, add the
      // bodies-only asset_feed_spec here.
      object_story_spec: {
        page_id: metaEnv.pageId,
        link_data: {
          link: input.baseUrl,
          message: input.primaryTexts[0],
          multi_share_optimized: input.multiShareOptimized,
          multi_share_end_card: false, // no Meta auto end-card — the last card stays ours
          child_attachments: input.cards.map(card => ({
            link: input.baseUrl,
            image_hash: card.imageHash,
            name: card.headline,
            ...(card.description ? { description: card.description } : {}),
            call_to_action: { type: input.ctaType },
          })),
        },
      },
      degrees_of_freedom_spec: CREATIVE_OPT_OUTS,
      url_tags: input.urlTags,
    },
  })
  return res.id
}

// UNVERIFIED write-path caution: multi-text via asset_feed_spec is empirically
// verified for single-image link_data only. If Meta rejects it combined with
// video_data, flip this to false — video_data already carries the first variant
// of each text, so the fallback is exactly this one line.
const VIDEO_ASSET_FEED_MULTI_TEXT = true

export interface VideoCreativeInput {
  name: string
  /** Clean landing URL — NO query params; tracking rides on urlTags. */
  baseUrl: string
  /** Query string WITHOUT leading '?' — the UI "URL parameters" (Tracking) field. Meta appends at delivery. */
  urlTags: string
  headlines: string[]
  primaryTexts: string[]
  descriptions?: string[]
  videoId: string
  /** image_hash of the required thumbnail — Meta rejects video creatives without one. */
  thumbnailHash: string
  ctaType: 'APPLY_NOW' | 'LEARN_MORE'
}

export async function createVideoAdCreative(input: VideoCreativeInput): Promise<string> {
  const res = await metaFetch<{ id: string }>(`/${metaEnv.adAccountId}/adcreatives`, {
    method: 'POST',
    body: {
      name: input.name,
      // video_data has NO top-level `link` field — the destination rides
      // inside call_to_action.value.link.
      object_story_spec: {
        page_id: metaEnv.pageId,
        video_data: {
          video_id: input.videoId,
          image_hash: input.thumbnailHash,
          title: input.headlines[0],
          message: input.primaryTexts[0],
          ...(input.descriptions?.length ? { link_description: input.descriptions[0] } : {}),
          call_to_action: { type: input.ctaType, value: { link: input.baseUrl } },
        },
      },
      ...(VIDEO_ASSET_FEED_MULTI_TEXT
        ? {
            asset_feed_spec: {
              bodies: input.primaryTexts.map(text => ({ text })),
              titles: input.headlines.map(text => ({ text })),
              ...(input.descriptions?.length ? { descriptions: input.descriptions.map(text => ({ text })) } : {}),
              optimization_type: 'DEGREES_OF_FREEDOM',
            },
          }
        : {}),
      degrees_of_freedom_spec: CREATIVE_OPT_OUTS,
      url_tags: input.urlTags,
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
