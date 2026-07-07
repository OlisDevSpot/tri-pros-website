// scripts/meta/campaign-specs/lib/geo.ts

/**
 * ZIPs Meta ad targeting rejects with `(#100) Invalid zip code` — PO-box /
 * unique-use ZIPs with no residential population (discovered empirically on
 * first apply, 2026-07-07). Excluded from AD TARGETING only; the funnel's
 * service-area gate still accepts leads from them.
 */
export const META_UNSUPPORTED_ZIPS: ReadonlySet<string> = new Set([
  '90097',
  '90174',
  '90185',
  '90665',
  '91050',
  '91051',
  '91175',
  '91186',
  '91187',
  '91312',
])

/** Meta geo_locations.zips entries: { key: 'US:90001' }. */
export function toMetaZips(zips: Iterable<string>): { key: string }[] {
  return [...zips]
    .filter(zip => !META_UNSUPPORTED_ZIPS.has(zip))
    .sort()
    .map(zip => ({ key: `US:${zip}` }))
}
