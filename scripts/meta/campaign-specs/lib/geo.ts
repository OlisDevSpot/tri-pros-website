// scripts/meta/campaign-specs/lib/geo.ts

/** Meta geo_locations.zips entries: { key: 'US:90001' }. */
export function toMetaZips(zips: Iterable<string>): { key: string }[] {
  return [...zips].sort().map(zip => ({ key: `US:${zip}` }))
}
