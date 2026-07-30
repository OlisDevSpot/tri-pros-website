// ACL facade over metaClient.fetchAdInsights: numeric ad_id → adKey (via the
// campaign-as-code lock), string metrics → numbers. Returns adKey-keyed domain
// rows. NEVER imports @/shared/db. Mirrors meta-sync.service.ts.
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import process from 'node:process'
import { metaClient } from '@/shared/services/providers/meta/client'
import { isMetaInsightsConfigured } from '@/shared/services/providers/meta/lib/config'

export interface AdInsightRow {
  adKey: string
  spend: number
  impressions: number
  reach: number
  frequency: number
  cpm: number
  ctr: number
  cpc: number
  inlineLinkClicks: number
  metaLeads: number
  landingPageViews: number
}

interface AdLockEntry {
  id: string
  creativeId: string
  fp: string
}

interface MetaLockShape {
  ads: Record<string, AdLockEntry>
}

const INSIGHTS_FIELDS
  = 'ad_id,ad_name,spend,impressions,reach,frequency,cpm,ctr,cpc,inline_link_clicks,actions,cost_per_action_type'

function loadAdKeyById(): Map<string, string> {
  const lockPath = join(process.cwd(), 'scripts/meta/meta.lock.json')
  if (!existsSync(lockPath)) {
    return new Map()
  }
  const lock = JSON.parse(readFileSync(lockPath, 'utf8')) as MetaLockShape
  const byId = new Map<string, string>()
  for (const [adKey, entry] of Object.entries(lock.ads)) byId.set(entry.id, adKey)
  return byId
}

function extractAction(
  actions: { action_type: string, value: string }[] | undefined,
  type: string,
): number {
  const hit = actions?.find(a => a.action_type === type)
  return hit ? Number(hit.value) : 0
}

function num(value: string | undefined): number {
  return value ? Number(value) : 0
}

function createMetaInsightsSyncService() {
  return {
    async byAd(range: { start: Date, end: Date }): Promise<AdInsightRow[]> {
      if (!isMetaInsightsConfigured())
        return []

      const byId = loadAdKeyById()
      const raw = await metaClient.fetchAdInsights({
        since: range.start.toISOString().slice(0, 10),
        until: range.end.toISOString().slice(0, 10),
        fields: INSIGHTS_FIELDS,
      })

      return raw.flatMap((row) => {
        const adKey = byId.get(row.ad_id)
        if (!adKey)
          return []
        return [{
          adKey,
          spend: num(row.spend),
          impressions: num(row.impressions),
          reach: num(row.reach),
          frequency: num(row.frequency),
          cpm: num(row.cpm),
          ctr: num(row.ctr),
          cpc: num(row.cpc),
          inlineLinkClicks: num(row.inline_link_clicks),
          metaLeads: extractAction(row.actions, 'offsite_conversion.fb_pixel_lead'),
          landingPageViews: extractAction(row.actions, 'landing_page_view'),
        }]
      })
    },
  }
}

export const metaInsightsSyncService = createMetaInsightsSyncService()
export type MetaInsightsSyncService = ReturnType<typeof createMetaInsightsSyncService>
