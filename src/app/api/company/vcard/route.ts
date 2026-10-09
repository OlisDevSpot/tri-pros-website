import { APP_HOSTS } from '@/shared/config/roots'
import { companyInfo } from '@/shared/constants/company'
import { toE164 } from '@/shared/lib/phone'
import { voipDidsService } from '@/shared/services/voip/voip-dids.service'

// The phone comes from the database, so the file is built per request, never at build time.
export const dynamic = 'force-dynamic'

function contact(accessor: 'mainOffice' | 'phone' | 'email'): string {
  return companyInfo.contactInfo.find(item => item.accessor === accessor)!.value
}

// The office address is one display string ("street, \ncity, ST zip"); vCard wants its parts.
function officeAddress(): { street: string, city: string, state: string, zip: string } {
  const [street = '', cityLine = ''] = contact('mainOffice').split('\n').map(part => part.trim().replace(/,$/, ''))
  const [city = '', stateZip = ''] = cityLine.split(',').map(part => part.trim())
  const [state = '', zip = ''] = stateZip.split(/\s+/)
  return { street, city, state, zip }
}

function escapeVcard(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/;/g, '\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n')
}

/** The contact card the visit summary's MMS carries, so the main line shows a name when it texts. */
export async function GET(): Promise<Response> {
  const mainLine = await voipDidsService.getMainLineDid()
  const phone = (mainLine.success && mainLine.data?.e164) || toE164(contact('phone'))!
  const address = officeAddress()
  const lines = [
    'BEGIN:VCARD',
    'VERSION:3.0',
    `FN:${escapeVcard(companyInfo.name)}`,
    `ORG:${escapeVcard(companyInfo.name)}`,
    `TEL;TYPE=CELL,VOICE:${phone}`,
    `EMAIL:${contact('email')}`,
    `URL:https://${APP_HOSTS.prod[0]}`,
    `ADR;TYPE=WORK:;;${escapeVcard(address.street)};${escapeVcard(address.city)};${address.state};${address.zip};USA`,
    'END:VCARD',
  ]
  return new Response(`${lines.join('\r\n')}\r\n`, {
    headers: {
      // Twilio wants a matching content type and a filename of 20 ASCII characters or fewer.
      'Content-Type': 'text/vcard; charset=utf-8',
      'Content-Disposition': 'attachment; filename="tri-pros.vcf"',
      'Cache-Control': 'public, max-age=86400',
    },
  })
}
