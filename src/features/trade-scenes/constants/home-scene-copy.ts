import type { ReadingId } from '@/features/trade-scenes/constants/home-anchors'
import type { LOOK_INSIDE_SYSTEM_IDS } from '@/features/trade-scenes/constants/home-systems'
import type { BuildRowPartId, FactsTab, HomeSystemId, HomeView, SavingsCategory, SlotGroup, SystemPieceId, TradeSceneInputs } from '@/features/trade-scenes/types'
import type { CustomerAgeGroup, HouseholdType, YearBuiltRange } from '@/shared/constants/enums/customers'
import type { Climate } from '@/shared/modules/construction/core/constants/climate-presets'
import type { EfficiencyUpgradeId } from '@/shared/modules/construction/core/constants/efficiency-upgrades'
import type { AcTons, CrawlInsulation, DuctMaterial, ExteriorPaint, FoundationType, GutterOption, HVACComponent, HVACType, InsulationLevel, PaintWearKind, PaintWearLevel, RoofType, Wear, WindowsType } from '@/shared/modules/construction/core/constants/enums'
import type { HomeMaterialId } from '@/shared/modules/construction/core/constants/home-material-ids'
import type { InstallStyleId } from '@/shared/modules/construction/core/constants/install-styles'
import type { RoofForm } from '@/shared/modules/construction/core/constants/roof-forms'
import type { HeatWeather, PartCondition, ShingleColor, Weather } from '@/shared/modules/construction/core/types'

import { BILL_CATEGORY_LABELS } from '@/shared/modules/construction/core/constants/bill-categories'

export const SCENE_VIEW_LABELS = { existing: 'Today', proposed: 'Tri Pros build' } as const satisfies Record<TradeSceneInputs['view'], string>

export const WEATHER_LABELS = { normal: 'Normal', summer: 'Summer', winter: 'Winter', rain: 'Rain' } as const satisfies Record<Weather, string>

export const HOME_VIEW_LABELS = { 'complete': 'Complete', 'partly-open': 'Partly open' } as const satisfies Record<HomeView, string>

// Placeholder copy until the owner's copy pass.
export const PANEL_COPY = {
  efficiencyUpgradeHints: { 'cool-roof': 'Preview a shingle or flat roof to add a cool roof.', 'r8-ducts': 'Preview new ducts to step up to R-8.', 'cool-paint': 'Preview a repaint to add Cool Life paint.', 'r38-insulation': 'Preview insulation to step up to R-38.' },
} as const

export const DOCK_COPY = {
  weather: 'Weather',
  homeView: 'Home view',
  thermal: 'Thermal',
  thermalHint: 'See the heat the way an inspector\'s camera does.',
} as const satisfies { weather: string, homeView: string, thermal: string, thermalHint: string }

export const PROFILE_COPY = {
  yearBuilt: 'Built',
  foundationType: 'Foundation',
  hvacComponents: 'Equipment',
  windowsType: 'Windows',
  householdType: 'Household',
  ageGroup: 'Age group',
  unknown: 'Not sure',
} as const

export const ROOF_TYPE_LABELS = { shingle: 'Shingle', tile: 'Tile', woodshake: 'Wood shake', flat: 'Torch down', metal: 'Metal' } as const satisfies Record<RoofType, string>
export const YEAR_BUILT_LABELS = { 'Pre-1950': 'Before 1950', '1950-1978': '1950–1978', '1978-1998': '1978–1998', '1998-2014': '1998–2014', 'Post-2014': 'After 2014' } as const satisfies Record<YearBuiltRange, string>
export const FOUNDATION_TYPE_LABELS = { raised: 'Raised', slab: 'Slab' } as const satisfies Record<FoundationType, string>
export const HVAC_TYPE_LABELS = { 'central': 'Central', 'wall-mounted': 'Wall unit', 'portable': 'Portable', 'package-unit': 'Package unit' } as const satisfies Record<HVACType, string>
export const HVAC_COMPONENT_LABELS = { furnace: 'Furnace', ac: 'AC', both: 'Both' } as const satisfies Record<HVACComponent, string>
export const WINDOWS_TYPE_LABELS = { single: 'Single pane', double: 'Double pane' } as const satisfies Record<WindowsType, string>
export const HOUSEHOLD_TYPE_LABELS = { 'Single man': 'Single man', 'Single woman': 'Single woman', 'Couple': 'Couple', 'Family': 'Family', 'Relatives': 'Relatives' } as const satisfies Record<HouseholdType, string>
export const AGE_GROUP_LABELS = { 'under-25': 'Under 25', '25-45': '25–45', '45-65': '45–65', '65-75': '65–75', '75-or-older': '75+' } as const satisfies Record<CustomerAgeGroup, string>

export const SCENE_COPY = {
  label: 'The home, drawn from its profile',
  fallback: 'The 3D home cannot start on this device. The controls below still work.',
  stillAlt: (weather: Weather) => `A still of the home in ${WEATHER_LABELS[weather].toLowerCase()} weather`,
  loading: 'Loading the home…',
  recenter: 'Recenter',
} as const

// Placeholder copy until the owner's copy pass. What a system card says about the parts up close.
export const PART_COPY = {
  listLabel: 'What is up there',
  peel: 'Peel it apart',
  open: 'Open it up',
  close: 'Close it up',
  // Shown beside each part: what the work does to it, in the homeowner's terms.
  condition: { retained: 'Kept', worn: 'Original', installed: 'New', absent: 'Missing' } satisfies Record<PartCondition, string>,
} as const

// Placeholder copy until the owner's copy pass and the disclosure sign-off. The figures are claims made to a homeowner, so
// each carries an asterisk, and no line says "your": the bill is typed in the room, not read from a record.
export const SAVINGS_COPY = {
  billLabel: (category: SavingsCategory) => `${BILL_CATEGORY_LABELS[category]} bill`,
  billHint: 'Monthly average. Kept on this screen only.',
  billSuffix: '/mo',
  nothingLanded: 'Pick work under Upgrades to see what it saves.',
  nothingSaved: 'The previewed work saves nothing on the amounts below.',
  // A trade with no cut in this bill shows no figure rather than $0.
  noCut: (category: SavingsCategory) => `None of the previewed work cuts the ${BILL_CATEGORY_LABELS[category].toLowerCase()} bill.`,
  cutGroup: (category: SavingsCategory) => `${BILL_CATEGORY_LABELS[category]} cut`,
  cutSuffix: { percent: '%', amount: 'less/mo' },
  cutValue: { percent: 'Cut in percent', amount: 'Cut in dollars a month' },
  repairsLabel: 'Repairs & upkeep',
  repairsSuffix: '/yr',
  repairsBar: 'Roof upkeep',
  readAmounts: 'Change these in Today › Living situation',
  total: 'Together',
  figure: { before: 'about', after: 'a month less' },
  disclosureTrigger: 'How this estimate is made',
  disclosure: {
    tradesSource: 'Estimated from Tri Pros customer bills.',
    typedSource: 'Uses the cut typed here in place of the Tri Pros estimate.',
    repairsSource: 'Estimated from typical yearly repair and upkeep costs for what the work replaces.',
    vary: 'Savings vary.',
    // PENDING VERIFICATION: the FTC R-value Rule's savings-claim wording (16 CFR 460.19), quoted from memory. It must be checked
    // against the rule's text and signed off before release. It already says "Savings vary", so it stands in for that line.
    rValue: 'Savings vary. Find out why in the seller\'s fact sheet on R-values. Higher R-value means greater insulating power.',
  },
} as const

const READING_CLIMATE_PHRASE = { coastal: 'coastal', inland: 'inland' } as const satisfies Record<Climate, string>
const READING_SEASON_PHRASE = { normal: 'mild afternoon', summer: 'summer afternoon', winter: 'winter night' } as const satisfies Record<HeatWeather, string>

const WALL_AND_WINDOW_LABELS = { 'exterior-wall': 'Exterior wall', 'window': 'Window glass' } as const

// Placeholder until the disclosure sign-off. Every reading is an estimate: the asterisk always opens this.
export const READING_COPY = {
  labels: {
    'pitched': { roof: 'Roof', attic: 'Attic', ceiling: 'Ceiling', ...WALL_AND_WINDOW_LABELS },
    // A flat roof has no attic, only the joists' depth between the deck and the ceiling.
    'low-slope': { roof: 'Roof', attic: 'Joist space', ceiling: 'Ceiling', ...WALL_AND_WINDOW_LABELS },
  } satisfies Record<RoofForm, Record<ReadingId, string>>,
  unit: '°F',
  disclosureTrigger: 'How this temperature is estimated',
  disclosure: (climate: Climate, weather: HeatWeather) => `Estimate for a typical ${READING_CLIMATE_PHRASE[climate]} ${READING_SEASON_PHRASE[weather]}. Real temperatures vary.`,
} as const

// Placeholders until the owner's copy pass.
export const REPAIRS_COPY = {
  notSet: 'not set',
  wearNotSet: 'Condition not set',
  perYear: '/yr',
  total: 'Running and keeping up this home today',
  perMonth: 'a month*',
  lead: 'The build\'s savings start from these.',
} as const

export const PART_LABELS: Record<string, string> = {
  'covering': 'Roof covering',
  'deck': 'Roof redeck',
  'radiant-barrier': 'Radiant barrier',
  'attic-fan': 'Attic fan',
  'attic-insulation': 'Attic insulation',
  'air-sealing': 'Air sealing',
  'gutter': 'Gutters',
  'glazing': 'Window glass',
  'frame': 'Window frames',
  'paint': 'Exterior paint',
  'air-handler': 'Air handler',
  'package-unit': 'Package unit',
  'duct-runs': 'Ducts',
  'floor-insulation': 'Floor insulation',
}

export const SCOPES_AND_ADDONS_COPY = {
  noChange: 'No change',
  verbs: { overlay: 'Overlay', torchDown: 'Torch down', tearOff: 'Tear-off', tileReset: 'Tile reset', redeck: 'Redeck', add: 'Add', topOff: 'Top off', replace: 'Replace', seal: 'Seal', new: 'New', repaint: 'Repaint' },
  blocked: { 'roof-not-set': 'Set the roof under Home facts', 'nothing-on-roof': 'Nothing offered on a metal roof yet', 'needs-tear-off': 'Needs a tear-off: an overlay keeps the old roof on', 'needs-redeck': 'Needs a redeck: the insulation is under the deck', 'already-new': 'Already new' },
  unitBlocked: { 'wall-mounted': 'Nothing offered for a wall unit yet', 'portable': 'Nothing offered for a portable unit yet' },
  notSet: 'Not set',
} as const

export const ROOF_FORM_LABELS = { 'pitched': 'Pitched', 'low-slope': 'Flat' } as const satisfies Record<RoofForm, string>

export const BUILD_SWITCH_COPY = { compact: { existing: 'Today', proposed: 'Build' } } as const

export const SHORTCUT_COPY = { title: 'Shortcut keys', lines: { weather: 'Weather: Normal, Summer, Winter, Rain', homeView: 'Complete or Partly open', thermal: 'Thermal on or off', build: 'Today or the Tri Pros build', modify: 'Modify: search a change', wholeHome: 'Step back: a menu, a Benefits detail, Look inside, the system, then the window', recenter: 'Recenter the camera', sheet: 'These keys' }, keyNames: { escape: 'Esc' } } as const

export const EFFICIENCY_UPGRADE_LABELS = { 'cool-roof': 'Cool roof', 'r8-ducts': 'Step up to R-8', 'cool-paint': 'Cool Life paint', 'r38-insulation': 'Step up to R-38' } as const satisfies Partial<Record<EfficiencyUpgradeId, string>>

export const WEAR_LABELS = { new: 'New', good: 'Good', fair: 'Fair', worn: 'Worn', failing: 'Failing' } as const satisfies Record<Wear, string>
export const HOME_MATERIAL_LABELS = { 'roof': 'Roof & gutters', 'attic-insulation': 'Attic insulation', 'windows': 'Windows', 'exterior-paint': 'Exterior paint', 'heating-cooling': 'Heating & cooling', 'ducts': 'Ducts', 'crawl-insulation': 'Crawl space insulation' } as const satisfies Record<HomeMaterialId, string>
export const EXTERIOR_PAINT_LABELS = { regular: 'Water-based paint', cool: 'Cool Life reflective paint' } as const satisfies Record<ExteriorPaint, string>
export const GUTTER_LABELS = { present: 'Gutters', none: 'No gutters' } as const satisfies Record<GutterOption, string>
export const DUCT_LABELS = { 'original-flex': 'Original', 'r6-silver-flex': 'R-6 silver flex', 'r8-flex': 'R-8 flex' } as const satisfies Record<DuctMaterial, string>
export const CRAWL_INSULATION_LABELS = { none: 'None', insulated: 'Insulated' } as const satisfies Record<CrawlInsulation, string>
export const AC_TON_LABELS = { 3: '3 ton', 4: '4 ton', 5: '5 ton' } as const satisfies Record<AcTons, string>

export const HOME_SYSTEM_LABELS = { 'roof': 'Roof & gutters', 'attic': 'Attic', 'windows': 'Windows', 'walls': 'Walls', 'heating-cooling': 'Heating & cooling', 'foundation': 'Foundation' } as const satisfies Record<HomeSystemId, string>

export const HOME_MATERIALS_COPY = {
  gutters: 'Gutters',
  acSize: 'AC size',
  dotLabel: (material: string, wear: string, years: string) => `${material}: ${wear}, ${years}`,
  years: (from: string, to: string) => `${from}–${to} years`,
  yearsFrom: (from: string) => `${from}+ years`,
} as const

export const SHINGLE_LINE_LABELS = { 'cool': 'Duration COOL', 'cool-plus': 'Duration COOL Plus' } as const satisfies Record<ShingleColor['line'], string>

export const SHINGLE_COPY = {
  label: 'Shingle line',
  notPicked: 'Colour not picked',
  sriMeetsLa: (sri: string) => `Aged SRI ${sri}: meets Title 24 and the City of LA's 20`,
  sriMeetsTitle24: (sri: string) => `Aged SRI ${sri}: meets Title 24`,
} as const

export const PAINT_WEAR_LABELS = { cracks: 'Cracks', stains: 'Stains', peeling: 'Peeling' } as const satisfies Record<PaintWearKind, string>
export const PAINT_WEAR_LEVEL_LABELS = { none: 'None', light: 'Light', moderate: 'Moderate', heavy: 'Heavy' } as const satisfies Record<PaintWearLevel, string>

// Placeholder copy until the owner's copy pass.
export const CONTROLS_COPY = {
  label: 'Scene controls',
  close: 'Close',
  sections: { facts: 'Home facts', systems: 'Systems', modify: 'Modify', benefits: 'Benefits' },
  factsMissing: (count: number) => `Home facts, ${count} missing`,
  toggleName: (build: boolean) => build ? 'Showing the Tri Pros build; tap to show today' : 'Showing today; tap to show the Tri Pros build',
  facts: {
    tabs: { main: 'Main home', household: 'Household', area: 'Area', lot: 'Lot' } satisfies Record<FactsTab, string>,
    roofForm: 'Roof form',
    climate: 'Coastal or inland',
    missing: 'Missing',
    soon: 'soon',
    tabName: (tab: string, missing: number) => missing > 0 ? `${tab}, ${missing} missing` : tab,
    soonName: (tab: string) => `${tab}, soon`,
    soonTiles: {
      area: [{ title: 'Utility', hint: 'LADWP, SCE and the rest.' }, { title: 'Wind', hint: 'The wind zone the home sits in.' }],
      lot: [{ title: 'Lot size, fence, driveway', hint: 'For fencing and an ADU.' }, { title: 'Landscape and hardscape', hint: 'For dryscaping.' }],
    },
  },
  systems: {
    title: 'Systems',
    yearBuilt: 'Year built',
    setsToday: 'Sets today’s materials',
    showing: { existing: 'Showing today', proposed: 'Showing the build' } satisfies Record<TradeSceneInputs['view'], string>,
    noneOnSlab: 'Nothing to add on a slab',
    condition: 'Condition',
    eraAttic: { none: 'No attic insulation', r11: 'R-11 attic', r19: 'R-19 attic', r30: 'R-30 attic', r38: 'R-38 attic' } as const satisfies Record<InsulationLevel, string>,
    // DUCT_LABELS reads "Original", which loses the noun in the line; the era guesses never give R-8.
    eraDucts: { 'original-flex': 'Original ducts', 'r6-silver-flex': 'R-6 ducts' } as const satisfies Record<Exclude<DuctMaterial, 'r8-flex'>, string>,
    eraLine: (eraLabel: string, guessed: boolean) => guessed ? `Not sure, so ${eraLabel}:` : `${eraLabel} code:`,
    kept: (names: string, count: number) => `${names} kept as you set ${count > 1 ? 'them' : 'it'}`,
    keptJoin: ' and ',
    // Between the parts of a chip's value, and between the era's codes.
    valueJoin: ' · ',
    useCode: 'Use code',
    noCrawlSpace: 'Slab, no crawl space',
    foundationFirst: 'Set the foundation first',
    // A rail chip's name where its dot shows.
    changedByBuild: (system: string) => `${system}, changed by the build`,
    // By part: what a build chip says before a pick, and once picked, from the picked way's verb.
    buildChips: {
      'covering': { add: 'New roof', short: (verb: string) => verb },
      'deck': { add: 'Redeck', short: () => 'Redeck' },
      'gutter': { add: 'Gutters', short: () => 'New gutters' },
      'radiant-barrier': { add: 'Radiant barrier', short: () => 'Radiant barrier' },
      // The way, never an R-value: the R-38 chip beside it says which level goes in.
      'attic-insulation': { add: 'Insulation', short: (verb: string) => verb },
      'air-sealing': { add: 'Air sealing', short: () => 'Air sealing' },
      'attic-fan': { add: 'Attic fan', short: () => 'Attic fan' },
      'glazing': { add: 'New windows', short: () => 'Dual-pane windows' },
      'paint': { add: 'Repaint', short: () => 'Repaint' },
      'air-handler': { add: 'New system', short: () => 'New system' },
      // No chip words of its own yet, so it reads its part's name.
      'package-unit': { add: PART_LABELS['package-unit'], short: () => PART_LABELS['package-unit'] },
      'duct-runs': { add: 'New ducts', short: () => 'New ducts' },
      'floor-insulation': { add: 'Crawl insulation', short: () => 'Crawl insulation' },
    } satisfies Record<BuildRowPartId, { add: string, short: (verb: string) => string }>,
  },
  modify: {
    placeholder: { wide: 'Search a change: tile, attic fan, 4 ton…', phone: 'Search a change' },
    search: 'Search a change',
    clear: 'Clear search',
    groupTags: { facts: 'Home facts', area: 'Area', systems: 'Systems', existing: 'Today', proposed: 'Build', bills: 'Bills' } as const satisfies Record<SlotGroup, string>,
    enter: 'Enter',
    noResults: (query: string) => `Nothing matches “${query}”. Try a material, a system or a value: tile, attic fan, 4 ton.`,
    matches: (count: number) => `${count} changes match`,
    // The roof slot is the covering alone; gutters has its own.
    roofName: 'Roof',
    wearName: (material: string) => `${material} condition`,
    upgradeChoices: { on: 'Add', off: 'No' },
  },
} as const

export const BENEFITS_COPY = {
  tag: SCENE_VIEW_LABELS.proposed,
  areaMissing: 'Area missing',
  toast: 'Showing the Tri Pros build',
  head: {
    todayCosts: 'Today\'s costs',
    // The area leads the line in its own span, so a missing one can take the attention tone.
    parts: (electric: string, gas: string, repairs: string) => ` · $${electric} electric · $${gas} gas · $${repairs} repairs`,
    editCosts: 'Edit costs',
    why: 'What are future savings?',
  },
  editor: {
    label: 'Today\'s costs',
    bills: 'The bills, a month',
    repairs: 'Repairs, a year',
    area: 'Area',
    missing: 'missing',
    missingNote: 'Until it is set the bills use the inland defaults.',
    setNote: 'From Home facts → Area; change it there.',
    billName: (bill: string) => `${bill} bill a month`,
    repairsName: (material: string) => `${material} repairs a year`,
    tags: { working: 'Working number', typed: 'Typed' },
    foot: 'Working numbers are the team\'s, not yet sourced; a typed figure wins. A material\'s condition is set in Systems.',
  },
  savings: {
    clause: (bill: string, claim: string) => `${bill.toLowerCase()} ${claim}`,
    title: (clauses: string) => `${clauses.charAt(0).toUpperCase()}${clauses.slice(1)} lower`,
    billAmount: (bill: string, amount: string) => `$${amount} ${bill.toLowerCase()}`,
    detail: (saved: string, bills: string) => `About $${saved} a month off ${bills}, on the team's working numbers.`,
    and: ' and ',
  },
  upkeep: {
    materials: {
      'roof': { title: 'Roof upkeep ends', old: 'the old roof' },
      'windows': { title: 'Window upkeep ends', old: 'the old windows' },
      'exterior-paint': { title: 'Paint upkeep ends', old: 'the old paint' },
      'heating-cooling': { title: 'Heating & cooling upkeep ends', old: 'the old system' },
    },
    typed: 'typed',
    cost: (amount: string) => `about $${amount} a year`,
    costTyped: (amount: string) => `$${amount} a year`,
    condition: (label: string) => ` (${label})`,
    detail: (old: string, cost: string, condition: string) => `Keeping up ${old} costs ${cost}${condition}. The new one starts that at zero.`,
  },
  planet: {
    title: 'CO₂ saved and trees equivalent',
    detail: 'Figures come soon after launch.',
  },
  matrix: {
    noChange: 'No change',
    upgradesJoin: ', ',
    soon: 'soon',
    count: (count: number) => count === 1 ? '1 benefit' : `${count} benefits`,
    none: 'none',
    cellName: (system: string, kind: string, count: string) => `${system}, ${kind}: ${count}`,
    headName: (head: string, count: string) => `${head}: ${count}`,
  },
  rail: {
    back: 'All benefits',
    join: ' · ',
    across: (kind: string) => `${kind} across the home`,
    savings: (amount: string) => `${amount}${SAVINGS_COPY.billSuffix} in savings`,
    soon: 'Coming soon',
  },
  empty: {
    title: 'Nothing picked for the build yet',
    body: 'Pick upgrades in Modify or Systems, and every benefit they bring appears here.',
    openModify: 'Open Modify',
  },
  futures: {
    by: (year: string) => `By ${year}`,
    without: 'Without',
    with: 'With',
    // Dropped on the phone, where the three figures share one row.
    theBuild: ' the build',
    saves: 'Saves',
    today: { lead: 'Today ', to: ' → ', saves: ', saves ', tail: ' a month' },
    axis: 'Look ahead to',
  },
  why: {
    answer: {
      without: (today: string, then: string, when: string) => `Without the build the costs would be $${today} a month today and $${then} by ${when}.`,
      with: (today: string, then: string, when: string) => ` With it they could be $${today}, and $${then} by ${when}.`,
      withoutNow: (today: string) => `Without the build the costs would be $${today} a month today.`,
      withNow: (today: string) => ` With it they could be $${today}.`,
      saves: ' The difference is the saving: about ',
      savesNow: (amount: string) => `$${amount} a month now`,
      and: ' and ',
      savesBy: (amount: string, when: string) => `$${amount} by ${when}`,
      end: '.',
    },
    heads: { uses: 'What it uses', method: 'How it’s worked out', math: 'The math' },
    tags: { working: 'Working number', typed: 'Typed', calculated: 'Calculated' },
    uses: {
      bill: (bill: string) => `${bill} bill`,
      cut: (bill: string) => `The build’s ${bill.toLowerCase()} cut`,
      rise: (bill: string) => `${bill} rates rise`,
      repairs: (material: string) => `${material} repairs`,
      repairsEnded: (material: string) => `${material} repairs, ended by the build`,
      construction: 'Construction prices rise',
      rate: (rate: string) => `${rate}%/yr`,
    },
    methodText: 'Without the build is what the home costs to run and keep up: the two bills and the repairs on each material at its condition. With the build, the bills drop by the build’s cuts and the repairs end on every material the build replaces; the others keep theirs. The saving is the difference. Ahead, the bills rise at their rates and the repairs with construction prices.',
    methodYear: (when: string, year: string) => ` The coming twelve months are year 1 at today’s figures, so ${when} is year ${year}.`,
    methodNow: ' The coming twelve months are year 1, at today’s figures.',
    methodRates: ' The rates are the team’s working numbers, not yet sourced, the same ones the ROI calculator uses.',
    blocks: {
      today: 'Today, year 1',
      year: (when: string, year: string) => `${when}, year ${year}`,
    },
    rows: {
      without: 'Without the build',
      with: 'With the build',
      saves: 'Saves',
      equals: '=',
      parts: (electric: string, gas: string, repairs: string) => `$${electric} electric + $${gas} gas + $${repairs} repairs`,
      cutOf: (claim: string, bill: string) => `${claim} of ${bill.toLowerCase()}`,
      repairsEnded: 'the repairs on what the build replaces',
      growthLead: 'today’s figures',
      times: ' × ',
      next: ',',
      repairs: 'repairs',
    },
  },
} as const

// Placeholder copy until the owner's copy pass.
export const INSTALL_STYLE_LABELS = { batts: 'Batts' } as const satisfies Record<InstallStyleId, string>
export const INSTALL_STYLE_HINTS = { batts: 'Preview an insulation replace to lay batts.' } as const satisfies Record<InstallStyleId, string>

// Placeholder copy until the owner's copy pass. An upgrade a pick cannot go without, as Modify lists it and the card says why.
export const REQUIRED_UPGRADE_COPY = {
  included: 'Included',
  reason: 'Included: without it the build would not beat or match what the home already has.',
} as const

// The pieces a construction part opens into up close; a whole system part reads its resolved part's label.
export const SYSTEM_PART_LABELS = {
  'pane': 'Glass',
  'outer-pane': 'Outer pane',
  'low-e': 'Low-E coating',
  'argon': 'Argon gas',
  'air-gap': 'Air gap',
  'inner-pane': 'Inner pane',
  'seals': 'Seals',
  'flashing': 'Flashing',
  'jacket': 'Silver mylar jacket',
  'blanket': 'Insulation blanket',
  'core': 'Inner core on its wire coil',
} as const satisfies Record<SystemPieceId, string>

// Placeholder copy until the owner's copy pass.
export const LOOK_INSIDE_COPY = { open: 'Look inside', close: 'Back to the system' } as const

export const SYSTEM_PIN_LABELS = {
  'roof': 'Look inside the roof',
  'attic': 'Look inside the attic',
  'windows': 'Look inside the window',
  'heating-cooling': 'Look inside heating & cooling',
} as const satisfies Record<(typeof LOOK_INSIDE_SYSTEM_IDS)[number], string>
