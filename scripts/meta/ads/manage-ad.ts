// scripts/meta/ads/manage-ad.ts
import { select } from '@inquirer/prompts'
import { metaEnv } from '../lib/env.js'
import { metaFetch } from '../lib/client.js'
import { printSuccess, printError, printInfo } from '../lib/formatters.js'
import type { Ad, MetaPaginatedResponse } from '../lib/types.js'

async function main() {
  printInfo('Fetching ads from your account...')

  const res = await metaFetch<MetaPaginatedResponse<Ad>>(
    `/${metaEnv.adAccountId}/ads`,
    {
      params: {
        fields: 'id,name,status,adset_id,campaign_id',
        limit: 50,
      },
    },
  )

  if (res.data.length === 0) {
    printInfo('No ads found in this account.')
    return
  }

  const adId = await select({
    message: 'Select an ad to manage:',
    choices: res.data.map(ad => ({
      value: ad.id,
      name: `${ad.name} [${ad.status}] (${ad.id})`,
    })),
  })

  const action = await select({
    message: 'What do you want to do?',
    choices: [
      { value: 'ACTIVE', name: '▶  Activate this ad' },
      { value: 'PAUSED', name: '⏸  Pause this ad' },
    ],
  })

  await metaFetch<{ success: boolean }>(`/${adId}`, {
    method: 'POST',
    body: { status: action },
  })

  const label = action === 'ACTIVE' ? 'activated' : 'paused'
  printSuccess(`Ad ${adId} ${label} successfully.`)
  printInfo(`Opening Ads Manager to confirm — check the browser window.`)

  // Playwright visual confirmation hint (Claude will open browser via MCP after this runs)
  console.log(`\n  ADS MANAGER URL: https://adsmanager.facebook.com/adsmanager/manage/ads?act=${metaEnv.adAccountId.replace('act_', '')}`)
}

main().catch((err) => {
  printError(err.message)
  process.exit(1)
})
