// Legacy dimension-id → label fallback for pre-refactor kitchen leads whose
// enrichment is the old flat { homeType: 'condo', … } shape. New leads are
// self-describing and don't use this map.
export const LEGACY_ENRICHMENT_LABELS: Record<string, string> = {
  homeType: 'Home type',
  age: 'Project age',
  scope: 'Scope',
  timeline: 'Timeline',
}
