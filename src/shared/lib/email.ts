// Customer emails are stored as typed; matching people needs one canonical form.
export function normalizeEmail(raw: string | null | undefined): string | null {
  const email = raw?.trim().toLowerCase()
  return email || null
}
