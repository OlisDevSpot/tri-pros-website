import { metaFetch } from '../lib/client.js'
// scripts/meta/setup/verify-credentials.ts
import { metaEnv } from '../lib/env.js'
import { printError, printInfo, printSuccess } from '../lib/formatters.js'

interface MeResponse {
  id: string
  name: string
}

interface CampaignsResponse {
  data: { id: string, name: string }[]
}

async function main() {
  console.log('\n🔍  Verifying Meta credentials...\n')

  // 1. Verify access token
  try {
    const me = await metaFetch<MeResponse>('/me', { params: { fields: 'id,name' } })
    printSuccess(`Access token valid — authenticated as: ${me.name} (${me.id})`)
  }
  catch (err) {
    printError(`Access token invalid: ${(err as Error).message}`)
    process.exit(1)
  }

  // 2. Verify ad account access
  try {
    const campaigns = await metaFetch<CampaignsResponse>(`/${metaEnv.adAccountId}/campaigns`, {
      params: { limit: 1 },
    })
    printSuccess(`Ad account accessible — ${metaEnv.adAccountId} (${campaigns.data.length > 0 ? `found ${campaigns.data[0].name}` : 'no campaigns yet'})`)
  }
  catch (err) {
    printError(`Ad account access failed: ${(err as Error).message}`)
    process.exit(1)
  }

  // 3. Verify page access
  try {
    const page = await metaFetch<MeResponse>(`/${metaEnv.pageId}`, { params: { fields: 'id,name' } })
    printSuccess(`Page accessible — ${page.name} (${page.id})`)
  }
  catch (err) {
    printError(`Page access failed: ${(err as Error).message}`)
    process.exit(1)
  }

  printInfo('All credentials verified. Ready to run meta scripts.')
}

main().catch((err) => {
  printError(err.message)
  process.exit(1)
})
