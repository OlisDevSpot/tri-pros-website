// Curated CA service-area ZIPs → city/county. Unknown ZIPs fall back to the
// Zippopotam API in resolve-zip.ts. Expand as coverage grows.
//
// Source: docs/seo/playbook.md §9.1 "Anchor 15 — city + ZIP reference"
// Coverage: 15 anchor cities + HQ (Reseda) across SFV/SGV, Antelope Valley,
//           Westside, and IE. 44 unique ZIPs + HQ ZIP = 45 entries total.
export const CA_ZIP_CITIES: Record<string, { city: string, county: string }> = {
  // HQ — Reseda (San Fernando Valley)
  91335: { city: 'Reseda', county: 'Los Angeles' },

  // SFV / SGV ──────────────────────────────────────────────────────────────
  // Encino
  91316: { city: 'Encino', county: 'Los Angeles' },
  91436: { city: 'Encino', county: 'Los Angeles' },

  // Tarzana
  91356: { city: 'Tarzana', county: 'Los Angeles' },

  // Sherman Oaks
  91403: { city: 'Sherman Oaks', county: 'Los Angeles' },
  91423: { city: 'Sherman Oaks', county: 'Los Angeles' },

  // Studio City
  91604: { city: 'Studio City', county: 'Los Angeles' },

  // Woodland Hills
  91364: { city: 'Woodland Hills', county: 'Los Angeles' },
  91367: { city: 'Woodland Hills', county: 'Los Angeles' },

  // Calabasas
  91302: { city: 'Calabasas', county: 'Los Angeles' },

  // Burbank
  91501: { city: 'Burbank', county: 'Los Angeles' },
  91502: { city: 'Burbank', county: 'Los Angeles' },
  91504: { city: 'Burbank', county: 'Los Angeles' },
  91505: { city: 'Burbank', county: 'Los Angeles' },
  91506: { city: 'Burbank', county: 'Los Angeles' },

  // Glendale
  91201: { city: 'Glendale', county: 'Los Angeles' },
  91202: { city: 'Glendale', county: 'Los Angeles' },
  91203: { city: 'Glendale', county: 'Los Angeles' },
  91204: { city: 'Glendale', county: 'Los Angeles' },
  91205: { city: 'Glendale', county: 'Los Angeles' },
  91206: { city: 'Glendale', county: 'Los Angeles' },
  91207: { city: 'Glendale', county: 'Los Angeles' },
  91208: { city: 'Glendale', county: 'Los Angeles' },

  // Pasadena
  91101: { city: 'Pasadena', county: 'Los Angeles' },
  91103: { city: 'Pasadena', county: 'Los Angeles' },
  91104: { city: 'Pasadena', county: 'Los Angeles' },
  91105: { city: 'Pasadena', county: 'Los Angeles' },
  91106: { city: 'Pasadena', county: 'Los Angeles' },
  91107: { city: 'Pasadena', county: 'Los Angeles' },
  91108: { city: 'Pasadena', county: 'Los Angeles' },

  // ANTELOPE VALLEY ─────────────────────────────────────────────────────────
  // Palmdale
  93550: { city: 'Palmdale', county: 'Los Angeles' },
  93551: { city: 'Palmdale', county: 'Los Angeles' },
  93552: { city: 'Palmdale', county: 'Los Angeles' },

  // HALO — Westside premium ─────────────────────────────────────────────────
  // Beverly Hills
  90210: { city: 'Beverly Hills', county: 'Los Angeles' },
  90211: { city: 'Beverly Hills', county: 'Los Angeles' },
  90212: { city: 'Beverly Hills', county: 'Los Angeles' },

  // IE — EVIDENCE-BACKED ────────────────────────────────────────────────────
  // Upland (San Bernardino County)
  91784: { city: 'Upland', county: 'San Bernardino' },
  91786: { city: 'Upland', county: 'San Bernardino' },

  // Fullerton (Orange County)
  92831: { city: 'Fullerton', county: 'Orange' },
  92832: { city: 'Fullerton', county: 'Orange' },
  92833: { city: 'Fullerton', county: 'Orange' },
  92835: { city: 'Fullerton', county: 'Orange' },

  // Pomona (Los Angeles County)
  91766: { city: 'Pomona', county: 'Los Angeles' },
  91767: { city: 'Pomona', county: 'Los Angeles' },
  91768: { city: 'Pomona', county: 'Los Angeles' },

  // Rancho Cucamonga (San Bernardino County)
  91701: { city: 'Rancho Cucamonga', county: 'San Bernardino' },
  91730: { city: 'Rancho Cucamonga', county: 'San Bernardino' },
  91737: { city: 'Rancho Cucamonga', county: 'San Bernardino' },
  91739: { city: 'Rancho Cucamonga', county: 'San Bernardino' },
}
