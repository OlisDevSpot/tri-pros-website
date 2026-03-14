import type { JsonbSection } from '@/features/meetings/types'

/**
 * Read a JSONB section from the correct entity (customer or meeting).
 *
 * Accepts any record-like object so callers can pass partial selects
 * (e.g. the customer subset returned by getById) without type errors.
 */
export function getJsonbSection(
  source: Record<string, unknown> | null,
  jsonbKey: JsonbSection,
): Record<string, unknown> {
  if (!source) {
    return {}
  }
  const section: unknown = source[jsonbKey]
  return (section as Record<string, unknown> | null | undefined) ?? {}
}
