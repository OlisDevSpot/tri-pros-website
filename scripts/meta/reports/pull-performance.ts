// scripts/meta/reports/pull-performance.ts
import { metaEnv } from '../lib/env.js'
import { metaFetch } from '../lib/client.js'
import { printTable, printInfo, printError } from '../lib/formatters.js'
import type { Insight, MetaPaginatedResponse } from '../lib/types.js'

const DATE_PRESET = process.argv[2] ?? 'last_7d'
// Supported: today, yesterday, last_7d, last_14d, last_28d, last_30d, last_month, this_month

async function main() {
  printInfo(`Fetching campaign performance (${DATE_PRESET})...`)

  const res = await metaFetch<MetaPaginatedResponse<Insight>>(
    `/${metaEnv.adAccountId}/insights`,
    {
      params: {
        level: 'campaign',
        date_preset: DATE_PRESET,
        fields: 'campaign_id,campaign_name,spend,impressions,clicks,cpm,cpc',
        limit: 50,
      },
    },
  )

  if (res.data.length === 0) {
    printInfo('No campaign data found for this period.')
    return
  }

  printTable(
    res.data.map(row => ({
      Campaign: row.campaign_name,
      Spend: `$${Number(row.spend).toFixed(2)}`,
      Impressions: Number(row.impressions).toLocaleString(),
      Clicks: row.clicks,
      CPM: `$${Number(row.cpm).toFixed(2)}`,
      CPC: `$${Number(row.cpc).toFixed(2)}`,
    })),
  )
}

main().catch((err) => {
  printError(err.message)
  process.exit(1)
})
