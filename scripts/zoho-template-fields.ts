/* eslint-disable no-console */
import { getZohoAccessToken } from '@/shared/services/zoho-sign/lib/get-access-token'

async function main() {
  const token = await getZohoAccessToken()
  for (const tid of ['563034000000046241', '563034000000055081']) {
    const r = await fetch(`https://sign.zoho.com/api/v1/templates/${tid}`, {
      headers: { Authorization: `Zoho-oauthtoken ${token}` },
    })
    const j = await r.json() as {
      templates?: {
        template_name?: string
        document_fields?: { fields?: Record<string, unknown>[] }[]
      }
    }
    const fields = (j.templates?.document_fields ?? []).flatMap(d => d.fields ?? [])
    console.log(`\n=== Template ${tid} (${j.templates?.template_name}) — ${fields.length} fields ===`)
    for (const f of fields) {
      const label = String(f.field_label ?? f.field_name ?? '')
      const type = f.field_type_name ?? f.field_type
      const maxC = f.max_chars ?? f.character_length ?? f.chars_allowed ?? f.max_characters ?? '?'
      console.log(`  ${label.padEnd(24)} type=${String(type)} max_chars=${String(maxC)} keys=[${Object.keys(f).join(',')}]`)
    }
  }
}
main().catch(e => { console.error(e); process.exit(1) })
