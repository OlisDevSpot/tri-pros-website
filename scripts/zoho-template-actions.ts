/* eslint-disable no-console */
import { getZohoAccessToken } from '@/shared/services/zoho-sign/lib/get-access-token'

async function main() {
  const token = await getZohoAccessToken()
  const ids = process.argv.slice(2).filter(Boolean)
  if (ids.length === 0) {
    console.error('Usage: pnpm tsx scripts/zoho-template-actions.ts <templateId> [<templateId> ...]')
    process.exit(1)
  }
  for (const tid of ids) {
    const r = await fetch(`https://sign.zoho.com/api/v1/templates/${tid}`, {
      headers: { Authorization: `Zoho-oauthtoken ${token}` },
    })
    const j = await r.json() as {
      templates?: {
        template_name?: string
        actions?: Record<string, unknown>[]
      }
    }
    const actions = j.templates?.actions ?? []
    console.log(`\n=== Template ${tid} (${j.templates?.template_name}) — ${actions.length} actions ===`)
    for (const a of actions) {
      console.log(`  action_id=${String(a.action_id)} role=${String(a.role)} type=${String(a.action_type)} order=${String(a.signing_order)} recipient=${String(a.recipient_name ?? '(unset)')}`)
    }
  }
}
main().catch((e) => { console.error(e); process.exit(1) })
