import { format as formatDateFns, isSameDay, isSameWeek } from 'date-fns'

export function formatDate(date: string | Date) {
  return new Date(date).toLocaleDateString('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  })
}

export function formatAsPhoneNumber(phone: string) {
  return phone.replace(/(\d{3})(\d{3})(\d{4})/, '($1) $2-$3')
}

export function formatAddress(address: string, city: string, state: string, zipCode: string) {
  return `${address},\n${city}, ${state}, ${zipCode}`
}

export interface AddressParts {
  address?: string | null
  city?: string | null
  state?: string | null
  zip?: string | null
}

export interface FormattedAddress {
  /** True when at least one component is populated. */
  hasAddress: boolean
  /** Street line (e.g. "26070 Adamor Road"). Empty if missing. */
  line1: string
  /** City + state + zip line (e.g. "Calabasas, CA 91302"). Empty if missing. */
  line2: string
  /** Full address joined with commas — use for geocoding, deep links, copy. */
  singleLine: string
}

/**
 * Canonical address formatter. Produces a single, two-line, or single-line
 * view of a customer address. Consumers render whichever shape fits their
 * layout (e.g. `line1` + `line2` stacked on mobile, `singleLine` on desktop).
 */
export function formatCustomerAddress(parts: AddressParts): FormattedAddress {
  const line1 = (parts.address ?? '').trim()
  const city = (parts.city ?? '').trim()
  const state = (parts.state ?? '').trim()
  const zip = (parts.zip ?? '').trim()
  const stateZip = [state, zip].filter(Boolean).join(' ')
  const line2 = [city, stateZip].filter(Boolean).join(', ')
  const singleLine = [line1, line2].filter(Boolean).join(', ')
  return {
    hasAddress: singleLine.length > 0,
    line1,
    line2,
    singleLine,
  }
}

export function formatStringAsDate(stringDate: string, options: Intl.DateTimeFormatOptions = {}) {
  return new Date(stringDate).toLocaleDateString('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
    timeZone: 'PST',
    hour: 'numeric',
    minute: 'numeric',
    ...options,
  })
}

export function capitalize(roofType: string) {
  return roofType.charAt(0).toUpperCase() + roofType.slice(1).replace(/([A-Z])/g, ' $1')
}

export function numberToUSD(number: number) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(number)
}

export function formatAsDollars(value: number) {
  return value.toLocaleString('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  })
}

export function formatAsPercent(value: number) {
  return `${value.toFixed(0)}%`
}

export function convertToNumber(value: string, startFormat: 'currency' | 'percent' = 'currency') {
  switch (startFormat) {
    case 'currency':
      return Number(value.replace(/\D/g, ''))
    case 'percent':
      return Number(value.replace(/%/g, ''))
  }
}

export function convertUTCToPST(date: Date | string) {
  const pstDate = new Date(date)
  pstDate.setHours(pstDate.getHours() - 8)
  return pstDate
}

/**
 * Condensed meeting stamp for use alongside the relative-time badge.
 * - Same day        → `Today @2PM`
 * - Same ISO week   → `Thu @2PM`
 * - Further out     → `Thu May 2 @2PM`
 *
 * Null input → empty string so callers can render nothing when scheduledFor is absent.
 */
export function formatMeetingShortStamp(scheduledFor: string | Date | null | undefined): string {
  if (!scheduledFor) {
    return ''
  }
  const date = new Date(scheduledFor)
  const now = new Date()

  if (isSameDay(date, now)) {
    return `Today @${formatDateFns(date, 'ha')}`
  }
  if (isSameWeek(date, now, { weekStartsOn: 0 })) {
    return formatDateFns(date, 'EEE \'@\'ha')
  }
  return formatDateFns(date, 'EEE MMM d \'@\'ha')
}

/**
 * Returns a two-line date display:
 * - `relative`: "Today", "Yesterday", "3 days ago", or "Mar 5, 2026"
 * - `dayAtTime`: "Monday at 5:00 PM"
 */
export function formatDateCell(dateInput: string | Date): { relative: string, dayAtTime: string } {
  const d = new Date(dateInput)
  const now = new Date()

  // Strip time for day comparison
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const startOfDate = new Date(d.getFullYear(), d.getMonth(), d.getDate())
  const diffDays = Math.round((startOfToday.getTime() - startOfDate.getTime()) / (1000 * 60 * 60 * 24))

  let relative: string
  if (diffDays === 0) {
    relative = 'Today'
  }
  else if (diffDays === 1) {
    relative = 'Yesterday'
  }
  else if (diffDays > 1 && diffDays <= 7) {
    relative = `${diffDays} days ago`
  }
  else if (diffDays === -1) {
    relative = 'Tomorrow'
  }
  else {
    relative = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
  }

  const dayOfWeek = d.toLocaleDateString('en-US', { weekday: 'long' })
  const time = d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })
  const dayAtTime = `${dayOfWeek} at ${time}`

  return { relative, dayAtTime }
}
