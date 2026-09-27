export function normalizeEmail(raw: string | null | undefined): string | null {
  const email = raw?.trim().toLowerCase()
  return email || null
}
