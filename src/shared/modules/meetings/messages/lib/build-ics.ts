export interface IcsParty {
  name: string
  email: string
}

export interface IcsEventInput {
  method: 'REQUEST' | 'CANCEL'
  prodId: string
  /** Stable for the life of the event: a resend with the same UID updates the entry instead of adding one. */
  uid: string
  /** Calendars ignore an update whose SEQUENCE is not higher than the one they hold. */
  sequence: number
  start: Date | string
  durationMs: number
  summary: string
  description?: string
  location?: string
  url?: string
  organizer: IcsParty
  attendee: IcsParty
  /** DTSTAMP. Passed in so the output is the same for the same input. */
  now: Date
}

const MAX_LINE_OCTETS = 75
const encoder = new TextEncoder()

function utcStamp(date: Date | string): string {
  return new Date(date).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '')
}

function escapeText(value: string): string {
  return value
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\r?\n/g, '\\n')
}

function paramValue(value: string): string {
  const clean = value.replace(/"/g, '')
  return /[,;:]/.test(clean) ? `"${clean}"` : clean
}

// RFC 5545 caps a line at 75 octets; a continuation starts with one space, which counts.
function fold(line: string): string {
  const parts: string[] = []
  let current = ''
  let octets = 0
  for (const char of line) {
    const size = encoder.encode(char).length
    if (octets + size > MAX_LINE_OCTETS) {
      parts.push(current)
      current = ' '
      octets = 1
    }
    current += char
    octets += size
  }
  parts.push(current)
  return parts.join('\r\n')
}

export function buildIcs(input: IcsEventInput): string {
  const start = new Date(input.start)
  const end = new Date(start.getTime() + input.durationMs)

  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    `PRODID:${input.prodId}`,
    'CALSCALE:GREGORIAN',
    `METHOD:${input.method}`,
    'BEGIN:VEVENT',
    `UID:${input.uid}`,
    `SEQUENCE:${input.sequence}`,
    `DTSTAMP:${utcStamp(input.now)}`,
    `DTSTART:${utcStamp(start)}`,
    `DTEND:${utcStamp(end)}`,
    `SUMMARY:${escapeText(input.summary)}`,
    ...(input.description ? [`DESCRIPTION:${escapeText(input.description)}`] : []),
    ...(input.location ? [`LOCATION:${escapeText(input.location)}`] : []),
    ...(input.url ? [`URL:${input.url}`] : []),
    `ORGANIZER;CN=${paramValue(input.organizer.name)}:mailto:${input.organizer.email}`,
    `ATTENDEE;CN=${paramValue(input.attendee.name)};ROLE=REQ-PARTICIPANT;PARTSTAT=NEEDS-ACTION;RSVP=TRUE:mailto:${input.attendee.email}`,
    `STATUS:${input.method === 'CANCEL' ? 'CANCELLED' : 'CONFIRMED'}`,
    'END:VEVENT',
    'END:VCALENDAR',
  ]

  return `${lines.map(fold).join('\r\n')}\r\n`
}
