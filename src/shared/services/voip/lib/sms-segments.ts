const GSM7_BASIC = new Set('@£$¥èéùìòÇ\nØø\rÅåΔ_ΦΓΛΩΠΨΣΘΞÆæßÉ !"#¤%&\'()*+,-./0123456789:;<=>?¡ABCDEFGHIJKLMNOPQRSTUVWXYZÄÖÑÜ§¿abcdefghijklmnopqrstuvwxyzäöñüà')
// Sent as an escape plus a character, so each costs two.
const GSM7_EXTENDED = new Set('^{}\\[~]|€\f')

export type SmsEncoding = 'gsm7' | 'ucs2'

/** The characters that push a text out of GSM-7, once each, in order. */
export function findNonGsm7(body: string): string[] {
  return [...new Set([...body].filter(char => !GSM7_BASIC.has(char) && !GSM7_EXTENDED.has(char)))]
}

/** One character outside GSM-7 switches the whole text to UCS-2 (70 per text, 67 per part), roughly tripling its cost. */
export function countSmsSegments(body: string): { chars: number, segments: number, encoding: SmsEncoding } {
  if (body.length === 0) {
    return { chars: 0, segments: 0, encoding: 'gsm7' }
  }
  if (findNonGsm7(body).length > 0) {
    const chars = body.length
    return { chars, segments: chars <= 70 ? 1 : Math.ceil(chars / 67), encoding: 'ucs2' }
  }
  const chars = [...body].reduce((total, char) => total + (GSM7_EXTENDED.has(char) ? 2 : 1), 0)
  return { chars, segments: chars <= 160 ? 1 : Math.ceil(chars / 153), encoding: 'gsm7' }
}
