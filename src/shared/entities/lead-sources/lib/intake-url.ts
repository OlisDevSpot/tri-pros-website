/** Canonical external intake URL for a lead source. */
export function getIntakeUrl(slug: string, token: string, origin: string): string {
  const params = new URLSearchParams({ source: slug, token })
  return `${origin}/intake?${params.toString()}`
}
