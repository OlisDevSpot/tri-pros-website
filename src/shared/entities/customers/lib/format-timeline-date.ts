/**
 * Absolute "Mon D, YYYY, H:MM AM/PM" date, used for the native tooltip on the
 * timeline row's relative timestamp and the note author's absolute time.
 */
export function formatTimelineDate(timestamp: string): string {
  return new Date(timestamp).toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
}
