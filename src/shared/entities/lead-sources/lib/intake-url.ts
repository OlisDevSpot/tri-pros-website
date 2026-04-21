/**
 * Canonical external intake URL for a lead source.
 *
 * Token-based path (`/intake/<token>`) — externally shared with third-party
 * lead providers. Never touches the dashboard; never requires auth. The token
 * is generated on lead-source creation and rotated only if leaked.
 *
 * Slug-based share (`/intake?source=<slug>`) is the legacy helper still used
 * by the `IntakeShareLinks` dropdown elsewhere in the app; do not use here.
 */
export function getIntakeUrl(token: string, origin: string): string {
  return `${origin}/intake/${token}`
}
