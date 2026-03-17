import type { JsonbSection, JsonbSectionMap } from '@/shared/types/jsonb'

/**
 * Read a JSONB section from the correct entity (customer or meeting).
 *
 * Accepts any record-like object so callers can pass partial selects
 * (e.g. the customer subset returned by getById) without type errors.
 */
export function getJsonbSection<K extends JsonbSection>(
  source: Record<string, unknown> | null,
  jsonbKey: K,
): Partial<JsonbSectionMap[K]> & Record<string, unknown> {
  if (!source) {
    return {} as Partial<JsonbSectionMap[K]>
  }
  const section: unknown = source[jsonbKey]
  return (section as Partial<JsonbSectionMap[K]> | null | undefined) ?? ({} as Partial<JsonbSectionMap[K]>)
}
