function utcStamp(date: Date | string): string {
  return new Date(date).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '')
}

/** For a homeowner whose mail client ignores the attached invite. */
export function buildGoogleCalendarLink(input: {
  summary: string
  start: Date | string
  durationMs: number
  location?: string
  description?: string
}): string {
  const start = new Date(input.start)
  const end = new Date(start.getTime() + input.durationMs)
  const search = new URLSearchParams({
    action: 'TEMPLATE',
    text: input.summary,
    dates: `${utcStamp(start)}/${utcStamp(end)}`,
  })
  if (input.location) {
    search.set('location', input.location)
  }
  if (input.description) {
    search.set('details', input.description)
  }
  return `https://calendar.google.com/calendar/render?${search.toString()}`
}
