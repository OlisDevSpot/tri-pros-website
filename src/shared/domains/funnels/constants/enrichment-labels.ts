// Canonical id→label maps for the four funnel enrichment dimensions.
// Source of truth: kitchens.ts step option labels (mirrored here so the note
// builder doesn't reach into funnel-spec constants at runtime).
// Named exports; plain const maps — no logic, no I/O.

export const HOME_TYPE_LABELS: Record<string, string> = {
  'single-family': 'Single-family',
  'condo': 'Condo',
  'mobile-home': 'Mobile home',
  'commercial': 'Commercial',
}

export const AGE_LABELS: Record<string, string> = {
  '0-5': '0–5 years',
  '5-15': '5–15 years',
  '15-plus': '15+ years',
  'original': 'Original / never renovated',
}

export const SCOPE_LABELS: Record<string, string> = {
  'full-gut': 'Full gut remodel',
  'cabinets-counters': 'Cabinets + counters',
  'refresh': 'Cosmetic refresh',
  'not-sure': 'Not sure yet',
}

export const TIMELINE_LABELS: Record<string, string> = {
  'asap': 'ASAP',
  '1-3': '1–3 months',
  '3-6': '3–6 months',
  'exploring': 'Just exploring',
}
