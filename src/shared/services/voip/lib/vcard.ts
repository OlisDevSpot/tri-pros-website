import { Buffer } from 'node:buffer'

export function escapeVcard(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n')
}

// RFC 2425: a content line over 75 octets continues on the next line after a CRLF and one space. Splits fall on character boundaries.
export function foldVcardLine(line: string): string {
  const parts: string[] = []
  let current = ''
  let limit = 75
  for (const char of line) {
    if (Buffer.byteLength(current + char, 'utf8') > limit) {
      parts.push(current)
      current = ''
      limit = 74
    }
    current += char
  }
  parts.push(current)
  return parts.join('\r\n ')
}
