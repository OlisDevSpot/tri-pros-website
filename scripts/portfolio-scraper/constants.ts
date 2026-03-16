import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

export const ALLOWED_EXTENSIONS = ['jpg', 'jpeg', 'png', 'webp']

// Only skip URLs that are VERY clearly not project photos.
// Use specific patterns to avoid false positives (e.g., "icon" matching "silicon").
export const SKIP_URL_PATTERNS = [
  'favicon.ico',
  '/icon/',
  '-icon.',
  '_icon.',
  '/logo/',
  '-logo.',
  '_logo.',
  '/sprite',
  '/tracking',
  '/pixel',
  '1x1.',
  'data:image',
  '.svg',
  '.gif',
]

// Minimum file size in bytes — applied at download time, not scrape time
export const MIN_FILE_SIZE = 5000

export const OUTPUT_BASE_DIR = path.resolve(
  __dirname, '..', '..', '..', '_assets', 'portfolio-projects',
)

export const DOWNLOAD_CONCURRENCY = 5

export const IMAGE_MAGIC_BYTES: Record<string, number[]> = {
  jpg: [0xFF, 0xD8, 0xFF],
  png: [0x89, 0x50, 0x4E, 0x47],
  webp: [0x52, 0x49, 0x46, 0x46], // RIFF
}

export const STORYTELLING_SYSTEM_PROMPT = `
You are a portfolio copywriter for Tri Pros Remodeling, a Southern California residential construction and remodeling company.

Your job is to write high-converting portfolio project descriptions that make potential customers feel confident choosing Tri Pros for their own home improvement project.

## WRITING FRAMEWORK

Use these principles from our sales methodology:

**SWCE Framework** (our competitive differentiator):
- Security: Licensed, insured, permits pulled — the homeowner is protected
- Warranty: Manufacturer-backed + workmanship warranty — the work is guaranteed
- Craftsmanship: Done right the first time by experienced crews
- Experience: Hundreds of projects completed in Southern California

**Emotional Drivers** (how homeowners decide):
1. Fear/Risk Aversion — relief from anxiety about a failing system or aging home
2. Loss Aversion — framing inaction as an ongoing cost (wasted energy, declining value)
3. Pride of Ownership — "this is my home, I want it done right"
4. Social Proof — other families in similar situations chose Tri Pros and loved the result
5. Trust & Safety — we don't disappear after the job; we're a real, accountable company

## OUTPUT RULES

- **description**: Max 255 characters. A punchy portfolio card summary that sells the transformation. Lead with the outcome, not the process.
- **backstory**: 2-3 sentences. Paint the homeowner's situation before the project. Make it relatable — use common pain points for this type of project.
- **challengeDescription**: 2-3 sentences. What specific problems needed solving? Be concrete — mention specific issues (leaks, drafts, outdated fixtures, cramped layout, etc.).
- **solutionDescription**: 2-3 sentences. What Tri Pros did and WHY those choices were made. Mention specific materials or techniques that demonstrate expertise. Reference craftsmanship and attention to detail.
- **resultDescription**: 2-3 sentences. The transformation and its impact on the homeowner's life. Focus on emotion: comfort, pride, peace of mind, daily enjoyment. Mention tangible benefits (energy savings, increased value, etc.) where applicable.
- **homeownerQuote**: 1-2 sentences. A realistic, conversational testimonial. Should sound like a real person, not marketing copy. Reference a specific aspect of the experience or result.

## TONE
- Confident and premium, but not arrogant
- Warm and relatable, not corporate
- Specific and concrete, not vague
- Sell the outcome and lifestyle improvement, not the construction process
- Never mention pricing, contract amounts, or payment terms
- Avoid technical jargon unless it demonstrates expertise (e.g., "cool-roof reflective shingles" is good, "TPO membrane with 60-mil thickness" is too much)

## TRADE-SPECIFIC KNOWLEDGE

**Energy-Efficient Trades** (Roofing, HVAC, Windows, Insulation, Solar):
- Emphasize utility savings, rebates, tax credits
- Mention comfort improvements (consistent temperatures, no drafts)
- Reference environmental responsibility when natural

**General Remodeling** (Kitchen, Bathroom, Flooring, Paint, Foundation, Decking):
- Emphasize daily lifestyle upgrade and home value increase
- Kitchen: highest ROI (60-80% at resale)
- Bathroom: daily comfort + resale value
- Foundation: structural safety + peace of mind
- Flooring/Paint: visual transformation impact
- Decking: outdoor living space expansion
`

// --- AUTO-GENERATION DATA ---

// 100 high-impact, low-usage, awe-inspiring single-word project titles.
// Evoke the feeling of walking through a museum and seeing a unique piece.
export const PROJECT_TITLES = [
  'Aureate',
  'Vestige',
  'Luminary',
  'Patina',
  'Threshold',
  'Meridian',
  'Reverie',
  'Hearthstone',
  'Paragon',
  'Solstice',
  'Alchemy',
  'Cornerstone',
  'Panorama',
  'Zenith',
  'Silhouette',
  'Keystone',
  'Aether',
  'Cadence',
  'Bastion',
  'Provenance',
  'Terrazzo',
  'Lodestar',
  'Pinnacle',
  'Halcyon',
  'Atelier',
  'Monolith',
  'Seraphim',
  'Crucible',
  'Helios',
  'Tessera',
  'Vantage',
  'Obelisk',
  'Tableau',
  'Elysian',
  'Fulcrum',
  'Pathos',
  'Citadel',
  'Veranda',
  'Quartzite',
  'Ephemera',
  'Celadon',
  'Portico',
  'Cornice',
  'Obsidian',
  'Reliquary',
  'Palladium',
  'Vestibule',
  'Travertine',
  'Axiom',
  'Chrysalis',
  'Belvedere',
  'Rotunda',
  'Terranova',
  'Verdigris',
  'Alcove',
  'Tempera',
  'Helix',
  'Parapet',
  'Pavilion',
  'Arbor',
  'Fenestra',
  'Capstone',
  'Lustrum',
  'Prism',
  'Cupola',
  'Loggia',
  'Enclave',
  'Finial',
  'Trestle',
  'Colonnade',
  'Arabesque',
  'Clerestory',
  'Lintel',
  'Buttress',
  'Fascia',
  'Nave',
  'Grotto',
  'Plinth',
  'Oculus',
  'Pergola',
  'Rosetta',
  'Lantern',
  'Archway',
  'Cambria',
  'Solace',
  'Terrene',
  'Lustrous',
  'Quarry',
  'Mirador',
  'Belfry',
  'Lunette',
  'Cartouche',
  'Oriel',
  'Frieze',
  'Chancel',
  'Narthex',
  'Spandrel',
  'Volute',
  'Garland',
  'Entablature',
] as const

// Populated SoCal cities within ~40 miles of Studio City, CA
export const SOCAL_CITIES = [
  'Los Angeles',
  'Burbank',
  'Glendale',
  'Pasadena',
  'Arcadia',
  'Alhambra',
  'Monrovia',
  'West Hollywood',
  'Beverly Hills',
  'Santa Monica',
  'Culver City',
  'Inglewood',
  'Hawthorne',
  'Torrance',
  'Downey',
  'Whittier',
  'Pomona',
  'West Covina',
  'Covina',
  'Azusa',
  'Claremont',
  'La Verne',
  'Glendora',
  'Rancho Cucamonga',
  'Ontario',
  'Upland',
  'Fontana',
  'San Dimas',
  'Diamond Bar',
  'Fullerton',
  'Anaheim',
  'Orange',
  'Tustin',
  'Irvine',
  'Long Beach',
  'Lakewood',
  'Cerritos',
  'Norwalk',
  'La Mirada',
  'Brea',
  'Yorba Linda',
  'Northridge',
  'Encino',
  'Tarzana',
  'Woodland Hills',
  'Calabasas',
  'Thousand Oaks',
  'Simi Valley',
  'Moorpark',
  'Camarillo',
] as const

// First names — diverse mix
const FIRST_NAMES = [
  'James', 'Maria', 'Robert', 'Jennifer', 'Michael', 'Linda', 'David', 'Patricia',
  'Carlos', 'Rosa', 'Kevin', 'Angela', 'Daniel', 'Sarah', 'Anthony', 'Karen',
  'Jose', 'Yolanda', 'Christopher', 'Michelle', 'Brian', 'Stephanie', 'Mark', 'Brenda',
  'Miguel', 'Luz', 'Steven', 'Diane', 'Andrew', 'Tina',
  'Rafael', 'Carmen', 'Eric', 'Samantha', 'Jason', 'Heather',
  'Marco', 'Priya', 'Andrei', 'Mei', 'Tariq', 'Aiko',
  'Giovanni', 'Fatima', 'Dmitri', 'Keiko', 'Hassan', 'Ingrid',
  'Omar', 'Yuki', 'Raj', 'Leila', 'Alejandro', 'Nadia',
  'Tom', 'Lisa', 'Greg', 'Amy', 'Scott', 'Rachel',
]

// Last names — diverse mix
const LAST_NAMES = [
  'Johnson', 'Garcia', 'Williams', 'Martinez', 'Brown', 'Lopez', 'Davis', 'Hernandez',
  'Miller', 'Gonzalez', 'Wilson', 'Anderson', 'Thomas', 'Taylor', 'Moore', 'Jackson',
  'Lee', 'Kim', 'Nguyen', 'Patel', 'Chen', 'Wang', 'Tanaka', 'Rossi',
  'Santos', 'Park', 'Morales', 'Reyes', 'Cruz', 'Rivera',
  'Petrov', 'Yamamoto', 'Singh', 'Ali', 'Johansson', 'Mueller',
  'Nakamura', 'Schmidt', 'Larsen', 'Fischer',
  'Campbell', 'Stewart', 'Phillips', 'Evans', 'Turner', 'Hughes',
  'Cooper', 'Reed', 'Bailey', 'Bennett',
]

// Track which titles have been used (persisted via a simple JSON file next to the output)
const USED_TITLES_FILE = path.join(OUTPUT_BASE_DIR, '.used-titles.json')

function loadUsedTitles(): Set<string> {
  try {
    const raw = fs.readFileSync(USED_TITLES_FILE, 'utf-8')
    return new Set(JSON.parse(raw))
  }
  catch {
    return new Set()
  }
}

function saveUsedTitles(used: Set<string>): void {
  try {
    fs.mkdirSync(path.dirname(USED_TITLES_FILE), { recursive: true })
    fs.writeFileSync(USED_TITLES_FILE, JSON.stringify([...used], null, 2))
  }
  catch {
    // Non-critical — worst case a title gets reused
  }
}

export function pickProjectTitle(): string {
  const used = loadUsedTitles()
  const available = PROJECT_TITLES.filter(t => !used.has(t))

  if (available.length === 0) {
    // All 100 used — reset and start over
    used.clear()
    const title = PROJECT_TITLES[Math.floor(Math.random() * PROJECT_TITLES.length)]
    used.add(title)
    saveUsedTitles(used)
    return title
  }

  const title = available[Math.floor(Math.random() * available.length)]
  used.add(title)
  saveUsedTitles(used)
  return title
}

export function pickCity(): string {
  return SOCAL_CITIES[Math.floor(Math.random() * SOCAL_CITIES.length)]
}

export function generateHomeownerName(): string {
  const first = FIRST_NAMES[Math.floor(Math.random() * FIRST_NAMES.length)]
  const last = LAST_NAMES[Math.floor(Math.random() * LAST_NAMES.length)]
  return `${first} ${last}`
}

export const CLASSIFY_SYSTEM_PROMPT = `
You are an image classifier for a home remodeling portfolio.

For each image, classify it into exactly ONE of these phases:
- "hero": The best showcase image — a dramatic, beautiful result shot. Pick only 1 per project.
- "before": Shows the space BEFORE remodeling. Signs: dated fixtures, damage, wear, mess, old materials.
- "during": Shows active construction. Signs: tools visible, demolition, exposed framing, workers, dust, plastic sheeting.
- "after": Shows the completed result. Signs: clean, finished, new materials, styled/staged, good lighting.
- "main": General project photo that doesn't clearly fit another category.

Respond as JSON: { "classifications": [{ "index": number, "phase": string }] }
`
