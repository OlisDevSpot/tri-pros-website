// scripts/meta/reports/pull-ad-insights.ts
// READ-ONLY ad-level performance for the A/B optimization loop. Pulls Meta
// insights at level=ad, extracts Leads from `actions`, maps each ad_id back to
// its campaign-as-code spec key via meta.lock.json, and prints CPL / CTR /
// frequency per ad grouped by ad set. Never writes to Meta or the lock.
//
// Usage: pnpm meta insights [date_preset]   (default: last_28d — DOCS.md says
// judge on 2–4-week windows; at ~$58/day daily/7d slices are too noisy.)
import type { MetaPaginatedResponse } from '../lib/types.js'
import { metaFetch } from '../lib/client.js'
import { metaEnv } from '../lib/env.js'
import { printError, printInfo, printTable } from '../lib/formatters.js'
import { readLock } from '../sync/lock.js'

const VALID_PRESETS = ['today', 'yesterday', 'last_7d', 'last_14d', 'last_28d', 'last_30d', 'last_month', 'this_month'] as const
type DatePreset = (typeof VALID_PRESETS)[number]

const rawPreset = process.argv[2] ?? 'last_28d'
if (!VALID_PRESETS.includes(rawPreset as DatePreset)) {
  console.error(`❌  Invalid date preset: "${rawPreset}"`)
  console.error(`    Valid options: ${VALID_PRESETS.join(', ')}`)
  process.exit(1)
}
const DATE_PRESET = rawPreset as DatePreset

interface Action { action_type: string, value: string }
interface AdInsightRow {
  ad_id: string
  ad_name: string
  adset_name: string
  spend: string
  impressions: string
  reach: string
  frequency: string
  clicks: string
  ctr: string
  cpc: string
  cpm: string
  actions?: Action[]
}

// Meta reports a lead under several action_types depending on how it was fired.
// Prefer the most specific pixel/offsite lead; fall back to the generic `lead`.
// Priority order — first present wins, never summed (summing double-counts).
const LEAD_ACTION_TYPES = [
  'offsite_conversion.fb_pixel_lead',
  'onsite_conversion.lead_grouped',
  'lead',
] as const

function extractLeads(actions: Action[] | undefined): number {
  if (!actions?.length)
    return 0
  for (const type of LEAD_ACTION_TYPES) {
    const hit = actions.find(a => a.action_type === type)
    if (hit)
      return Number(hit.value)
  }
  return 0
}

function extractLandingPageViews(actions: Action[] | undefined): number {
  const hit = actions?.find(a => a.action_type === 'landing_page_view')
  return hit ? Number(hit.value) : 0
}

async function main() {
  printInfo(`Fetching AD-level performance (${DATE_PRESET}, 7-day-click attribution)…`)

  // Invert the lock: Meta ad_id → spec key (e.g. "showcase/kitchens-hero-01").
  const lock = readLock()
  const idToSpecKey = new Map(Object.entries(lock.ads).map(([key, entry]) => [entry.id, key]))

  const rows: AdInsightRow[] = []
  let endpoint: string | null = `/${metaEnv.adAccountId}/insights`
  let params: Record<string, string | number> | undefined = {
    level: 'ad',
    date_preset: DATE_PRESET,
    fields: 'ad_id,ad_name,adset_name,spend,impressions,reach,frequency,clicks,ctr,cpc,cpm,actions',
    limit: 200,
  }
  // Follow pagination defensively (account is small today, but don't cap silently).
  while (endpoint) {
    const res: MetaPaginatedResponse<AdInsightRow> = await metaFetch<MetaPaginatedResponse<AdInsightRow>>(endpoint, { params })
    rows.push(...res.data)
    endpoint = res.paging?.next ? res.paging.next.replace(/^https:\/\/[^/]+\/v\d+\.\d+/, '') : null
    params = undefined // the `next` URL already carries all query params
  }

  if (rows.length === 0) {
    printInfo('No ad-level data for this period. (Ads may still be in learning, or none were ACTIVE in the window.)')
    return
  }

  const table = rows
    .map((row) => {
      const spend = Number(row.spend)
      const leads = extractLeads(row.actions)
      const lpv = extractLandingPageViews(row.actions)
      const specKey = idToSpecKey.get(row.ad_id)
      return {
        _spend: spend,
        _cpl: leads > 0 ? spend / leads : Number.POSITIVE_INFINITY,
        'Ad Set': row.adset_name.replace(/ · .*$/, ''), // trim the long "· ZIPs · 35+" suffix
        'Ad (spec key)': specKey ?? `⚠ orphan (${row.ad_name})`,
        'Spend': `$${spend.toFixed(2)}`,
        'Leads': leads,
        'CPL': leads > 0 ? `$${(spend / leads).toFixed(2)}` : '—',
        'LPV': lpv,
        'CTR': `${Number(row.ctr).toFixed(2)}%`,
        'CPC': `$${Number(row.cpc).toFixed(2)}`,
        'Freq': Number(row.frequency).toFixed(2),
      }
    })
    // Sort: by ad set, then cheapest-CPL first (winners at top of each group).
    .sort((a, b) => a['Ad Set'].localeCompare(b['Ad Set']) || a._cpl - b._cpl)

  // Ad-set roll-up (honest totals: sum spend, sum leads, then divide).
  const byAdSet = new Map<string, { spend: number, leads: number }>()
  for (const r of table) {
    const agg = byAdSet.get(r['Ad Set']) ?? { spend: 0, leads: 0 }
    agg.spend += r._spend
    agg.leads += Number(r.Leads)
    byAdSet.set(r['Ad Set'], agg)
  }

  printTable(table.map(({ _spend, _cpl, ...visible }) => visible))

  printInfo('Ad-set roll-up (blended CPL = total spend ÷ total leads):')
  printTable(
    [...byAdSet.entries()].map(([adSet, { spend, leads }]) => ({
      'Ad Set': adSet,
      'Spend': `$${spend.toFixed(2)}`,
      'Leads': leads,
      'Blended CPL': leads > 0 ? `$${(spend / leads).toFixed(2)}` : '—',
    })),
  )
}

main().catch((err) => {
  printError(err instanceof Error ? err.message : String(err))
  process.exit(1)
})
