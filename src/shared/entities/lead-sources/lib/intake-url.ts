/**
 * Canonical external intake URL for a lead source.
 *
 * Both `source` (slug, readable in the URL) and `token` (unguessable secret)
 * are required query params. The public route validates both, so guessing a
 * slug alone is insufficient. Tokens never auto-rotate — only the manual
 * "Rotate" action regenerates them, so URLs shared with partners stay stable.
 */
export function getIntakeUrl(slug: string, token: string, origin: string): string {
  const params = new URLSearchParams({ source: slug, token })
  return `${origin}/intake?${params.toString()}`
}
