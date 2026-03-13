/**
 * Tri Pros Remodeling — Pain Point Library
 *
 * A structured database of homeowner pain points, organized by category and annotated
 * with sales psychology metadata drawn from the TPR discovery playbook.
 *
 * Design intent:
 *  - Each pain point maps to the emotional drivers from customer/decision-psychology.md
 *  - Discovery questions are Phase 1-ready (see sales/in-home-meeting-playbook.md)
 *  - Outcome statements and loss frames are agent-ready scripts
 *  - Program fit and natural pairings drive upsell and program selection logic
 *  - Household resonance guides tone and priority during the meeting
 *
 * Usage: import `painPoints` (nested by category) or `allPainPoints` (flat array)
 */

// ─── Trade & Program Accessors ────────────────────────────────────────────────

export const tradeAccessors = [
  'roofing',
  'hvac',
  'windows',
  'insulation',
  'solar',
  'foundation',
  'bathroom',
  'kitchen',
  'flooring',
  'paint',
  'decking',
] as const

export type TradeAccessor = (typeof tradeAccessors)[number]

export const programAccessors = [
  'energy-saver',
  'tpr-monthly-special',
  'existing-customer-savings-plus',
] as const

export type ProgramAccessor = (typeof programAccessors)[number]

// ─── Pain Point Taxonomy ──────────────────────────────────────────────────────

/**
 * Categories map to the primary problem domain the homeowner experiences.
 * These are intentionally customer-facing (how they feel), not trade-facing.
 */
export const painPointCategories = [
  'thermalComfort',
  'financialLeak',
  'structuralRisk',
  'healthAndIaq',
  'aestheticsAndResale',
  'lifestyleAndComfort',
  'energyInefficiency',
  'lifeTrigger',
] as const

export type PainPointCategory = (typeof painPointCategories)[number]

// ─── Supporting Types ─────────────────────────────────────────────────────────

/**
 * The five emotional drivers that govern home improvement decisions.
 * Source: docs/customer/decision-psychology.md
 *
 * fear            — "What happens if I don't fix this?"
 * lossAversion    — "I'm losing money every month I wait."
 * prideOfOwnership — "This is my home. I want it to be right."
 * socialProof     — "Other people in my situation did this."
 * trust           — "I need to know this company won't disappear."
 */
export type EmotionalDriver
  = | 'fear'
    | 'lossAversion'
    | 'prideOfOwnership'
    | 'socialProof'
    | 'trust'

/**
 * How strongly this pain point accelerates a same-day close.
 *
 * critical — active leak, safety issue, or structural emergency; close today or lose trust
 * high     — documented financial drain or hard deadline (seasonal, rebate window)
 * medium   — clear discomfort but no immediate consequence to waiting
 * low      — aspirational improvement; nice-to-have framing needed
 */
export type UrgencyMultiplier = 'critical' | 'high' | 'medium' | 'low'

/**
 * Household types from meetingHouseholdTypes enum.
 * Used to prioritize which pain points resonate most in the room.
 */
export type HouseholdResonance
  = | 'Senior(s)'
    | 'Empty nester(s)'
    | 'Family'
    | 'Non-senior(s)'
    | 'Multi-gen home'

export interface PainPoint {
  /** Unique machine-readable identifier. Use camelCase. */
  accessor: string

  /** Human-readable label shown to the agent. */
  label: string

  /**
   * How severe this issue is for the homeowner's home or finances.
   * 'variable' = context-dependent (e.g., depends on how long it's been ignored)
   */
  severity: 'critical' | 'high' | 'medium' | 'low' | 'variable'

  /**
   * The primary emotional lever this pain point pulls.
   * First entry is dominant; subsequent entries are supporting.
   * Source: docs/customer/decision-psychology.md
   */
  emotionalDrivers: [EmotionalDriver, ...EmotionalDriver[]]

  /** How much this pain point, when confirmed, accelerates the close. */
  urgencyMultiplier: UrgencyMultiplier

  /**
   * Observable symptoms — what the homeowner says, shows, or complains about.
   * These are the discovery signals the agent listens for in Phase 1.
   */
  symptoms: string[]

  /** Root causes that explain why this problem exists. */
  likelyCauses: string[]

  /** Primary trades that address this pain point. */
  trades: TradeAccessor[]

  /**
   * Trade complements — natural cross-sell pairings.
   * Presenting these together increases contract size and delivers compounding ROI.
   * Source: docs/company/services-catalog.md — "Natural Scope Pairings"
   */
  naturalPairings: TradeAccessor[]

  /**
   * Which programs this pain point fits best.
   * Used to auto-suggest the right program during meeting intake.
   */
  programFit: ProgramAccessor[]

  /**
   * Household types where this pain point resonates most strongly.
   * Guides tone and prioritization in Phase 1 discovery.
   */
  householdResonance: HouseholdResonance[]

  /**
   * Phase 1 discovery questions the agent asks to surface and confirm this pain point.
   * Source: docs/sales/in-home-meeting-playbook.md — Discovery Questions
   */
  discoveryQuestions: string[]

  /**
   * The agent's outcome statement for this pain point — what life looks like after the fix.
   * Uses outcome language, not technical specs.
   * Source: docs/sales/in-home-meeting-playbook.md — Outcome Statements
   */
  outcomeStatement: string

  /**
   * Loss-aversion frame: how to present inaction as an ongoing, measurable loss.
   * Source: docs/customer/decision-psychology.md — Loss Aversion
   */
  lossFrame: string

  /**
   * Close trigger: what the agent says when this pain point is the primary driver
   * and it's time to ask for the business.
   * Source: docs/sales/closing-strategies.md
   */
  closeTrigger: string

  /** Searchable tags for filtering and grouping pain points in the UI. */
  tags: string[]
}

// ─── Pain Point Data ──────────────────────────────────────────────────────────

export const painPoints = {

  // ── Thermal Comfort ───────────────────────────────────────────────────────
  // The home doesn't hold temperature. Rooms are too hot, too cold, or uneven.
  // These are the most common first-call complaints and gateway into the Energy-Saver program.

  thermalComfort: [
    {
      accessor: 'homeTooColdInWinter',
      label: 'Home is too cold in winter',
      severity: 'variable',
      emotionalDrivers: ['fear', 'lossAversion'],
      urgencyMultiplier: 'high',
      symptoms: [
        'Keeps thermostat very high but still feels cold',
        'Uses space heaters in addition to central heat',
        'Gas bill spikes in winter',
        'Drafts near windows, doors, or baseboards',
        'Sleeping with extra blankets even with heat on',
      ],
      likelyCauses: [
        'Little or no attic insulation (heat rising and escaping)',
        'Air leaks around windows and doors',
        'Old or undersized furnace',
        'Single-pane windows radiating cold inward',
        'Duct leaks losing conditioned air before it reaches the room',
      ],
      trades: ['insulation', 'hvac', 'windows'],
      naturalPairings: ['windows', 'hvac'],
      programFit: ['energy-saver'],
      householdResonance: ['Senior(s)', 'Family', 'Multi-gen home'],
      discoveryQuestions: [
        'Do you ever feel drafts in certain rooms — especially near windows or along the floor?',
        'What does your heating bill look like in January and February?',
        'Are there rooms that just never seem to warm up, no matter how high the thermostat is?',
      ],
      outcomeStatement:
        'Once we seal the envelope — attic, windows, and duct system — your home holds temperature. Most families tell us their heating bill drops 25–40% and they stop reaching for the thermostat entirely.',
      lossFrame:
        'Every month your insulation is inadequate, you\'re paying to heat the attic — not your home. That\'s money that\'s gone forever. Most customers, when they calculate two or three years of that gap, realize the upgrade more than pays for itself in what they\'ve already lost.',
      closeTrigger:
        'You\'ve been cold in your own home for years. Let\'s fix that permanently — and lock in today\'s pricing before the rebate window closes.',
      tags: ['comfort', 'energy', 'winter', 'heating', 'insulation'],
    },
    {
      accessor: 'homeTooHotInSummer',
      label: 'Home is too hot in summer',
      severity: 'variable',
      emotionalDrivers: ['lossAversion', 'fear'],
      urgencyMultiplier: 'high',
      symptoms: [
        '"Our AC runs all day in summer"',
        'Electric bill spikes June through September',
        'Family stays in one cool room and avoids the rest of the house',
        'Ceiling feels warm to the touch in the afternoon',
        'AC cools to 78 degrees but won\'t go lower',
      ],
      likelyCauses: [
        'Dark or old roof radiating heat into the attic',
        'No radiant barrier or inadequate attic insulation',
        'AC system undersized or >10 years old',
        'Single-pane windows admitting solar heat gain',
        'Duct system running through hot attic losing efficiency',
      ],
      trades: ['insulation', 'hvac', 'roofing', 'windows'],
      naturalPairings: ['hvac', 'roofing'],
      programFit: ['energy-saver'],
      householdResonance: ['Family', 'Senior(s)', 'Non-senior(s)'],
      discoveryQuestions: [
        'How bad does it get in July and August — are there rooms you basically can\'t use?',
        'What does your SCE or LADWP bill look like in summer?',
        'Does the ceiling or the second floor ever feel noticeably hotter than the rest of the house?',
      ],
      outcomeStatement:
        'A properly sealed attic and efficient AC system keeps your home 10–18 degrees cooler in summer without the system working harder. Families typically cut their cooling bill nearly in half — and actually enjoy their whole home again.',
      lossFrame:
        'At $[utility bill]/month in summer, you\'re spending $[X] a year fighting the heat instead of living in it. That cost compounds every year the roof, insulation, and AC stay the same. Three years of that buys the upgrade.',
      closeTrigger:
        'You mentioned you\'re heading into summer. If we get started this week, you\'ll be comfortable in your home by the time it gets hot. Let\'s lock this in.',
      tags: ['comfort', 'energy', 'summer', 'cooling', 'ac', 'attic'],
    },
    {
      accessor: 'unevenTemperaturesRoomToRoom',
      label: 'Some rooms are always much hotter or colder than others',
      severity: 'medium',
      emotionalDrivers: ['lossAversion', 'prideOfOwnership'],
      urgencyMultiplier: 'medium',
      symptoms: [
        'Master bedroom always cold; living room comfortable',
        'Back bedroom overheats in summer',
        'Guest room unusable in extreme seasons',
        '"The AC is on but the far rooms just don\'t get it"',
        'Kids complain one room is always different',
      ],
      likelyCauses: [
        'Duct system not balanced — uneven airflow distribution',
        'Leaking ducts dropping conditioned air before reaching far rooms',
        'Inadequate insulation in certain walls or areas',
        'Window orientation causing solar imbalance (south/west-facing)',
        'HVAC undersized for the actual square footage',
      ],
      trades: ['hvac', 'insulation', 'windows'],
      naturalPairings: ['insulation', 'windows'],
      programFit: ['energy-saver'],
      householdResonance: ['Family', 'Non-senior(s)', 'Multi-gen home'],
      discoveryQuestions: [
        'Are there specific rooms that are noticeably different from the rest of the house — always colder or always hotter?',
        'When the AC or heat is on full blast, do all the rooms feel it equally?',
        'Has anyone ever looked at your ductwork or done an assessment on why certain rooms are off?',
      ],
      outcomeStatement:
        'When we address the duct system and envelope together, every room in your house will feel the same — no more avoiding the back bedroom or the guest room. Consistent temperature throughout is one of the first things families notice after the upgrade.',
      lossFrame:
        'Unused rooms in your own home cost you twice — once in the energy wasted trying to cool or heat them, and again in the square footage you\'re paying a mortgage on but not actually living in.',
      closeTrigger:
        'You shouldn\'t have rooms in your own home that you avoid. Let\'s fix that. One conversation, one project, every room livable again.',
      tags: ['comfort', 'hvac', 'insulation', 'duct-balance'],
    },
    {
      accessor: 'draftAroundWindowsAndDoors',
      label: 'Drafts near windows, doors, or baseboards',
      severity: 'medium',
      emotionalDrivers: ['lossAversion', 'fear'],
      urgencyMultiplier: 'medium',
      symptoms: [
        'Can feel cold or warm air near window frames',
        'Candle flame flickers near closed windows',
        'Cold floors near exterior walls',
        'Whistling sound when wind blows',
        'Windows foggy or condensing on the interior',
      ],
      likelyCauses: [
        'Failed window seals or aged weatherstripping',
        'Original single-pane windows with no thermal break',
        'Old door frames that have settled or warped',
        'Gaps in wall penetrations from original construction',
      ],
      trades: ['windows', 'insulation'],
      naturalPairings: ['insulation', 'hvac'],
      programFit: ['energy-saver'],
      householdResonance: ['Senior(s)', 'Family'],
      discoveryQuestions: [
        'Do you notice cold or warm air coming in around your windows or the front door when it\'s sealed?',
        'Have you ever held your hand near a window frame on a cold or windy day — what do you feel?',
        'Do your windows fog up or get condensation on the inside during winter?',
      ],
      outcomeStatement:
        'New dual-pane windows eliminate drafts entirely — you stop feeling outside air come through sealed windows. Families tell us the noise reduction is often the first thing they notice, and the comfort difference is immediate.',
      lossFrame:
        'A single-pane window is essentially a hole in your wall as far as your HVAC is concerned. Every degree it lets in or out is paid for on your utility bill — month after month, year after year.',
      closeTrigger:
        'You\'ve been paying to condition air that\'s leaking straight out of your windows. Today we stop that. Ready to get started?',
      tags: ['comfort', 'windows', 'air-sealing', 'energy'],
    },
  ] satisfies PainPoint[],

  // ── Financial Leak ────────────────────────────────────────────────────────
  // The homeowner is hemorrhaging money through inefficiency, missed incentives,
  // or ongoing repair costs. Pure loss-aversion framing — the most powerful close lever.

  financialLeak: [
    {
      accessor: 'highElectricBill',
      label: 'Electric bill is too high',
      severity: 'high',
      emotionalDrivers: ['lossAversion', 'fear'],
      urgencyMultiplier: 'high',
      symptoms: [
        '"Our SCE bill was $340 last August"',
        'Bill goes up every year without adding appliances',
        'Compares unfavorably to neighbor\'s bill for similar home',
        'Dreads opening the utility bill in summer',
        '"We\'ve been fighting this for years"',
      ],
      likelyCauses: [
        'Inefficient or aging AC system',
        'No attic insulation — AC fighting the attic heat',
        'Single-pane windows admitting solar heat gain',
        'No solar — paying full retail rate for every kWh',
        'EV charging or pool pump amplifying base consumption',
      ],
      trades: ['solar', 'insulation', 'hvac', 'windows'],
      naturalPairings: ['insulation', 'hvac'],
      programFit: ['energy-saver'],
      householdResonance: ['Non-senior(s)', 'Family', 'Empty nester(s)'],
      discoveryQuestions: [
        'What does your average monthly utility bill look like — particularly in summer?',
        'Has it gone up noticeably over the last couple of years?',
        'Are you with SCE, LADWP, or SoCalGas — or a combination?',
        'Do you have an EV at home or a pool or spa? Those can really amplify the bill.',
      ],
      outcomeStatement:
        'With a complete energy upgrade — insulation, windows, and a high-efficiency system — families with similar homes and bills like yours typically drop their monthly cost by 35–55%. Some, when we layer in solar, eliminate the bill entirely.',
      lossFrame:
        'At $[monthly bill]/month, you\'re spending $[annual] a year on energy that an efficient home wouldn\'t need. That\'s $[5-year total] over five years — most of which could have been offset or eliminated. The upgrade pays for itself in that window.',
      closeTrigger:
        'The rebate programs are active right now. The math works today. Every month we wait, that\'s another month of excess billing you can\'t recover. Let\'s lock this in.',
      tags: ['financial', 'energy', 'utility-bill', 'sce', 'ladwp', 'solar'],
    },
    {
      accessor: 'highGasBill',
      label: 'Gas bill is too high',
      severity: 'medium',
      emotionalDrivers: ['lossAversion'],
      urgencyMultiplier: 'high',
      symptoms: [
        '"Our SoCalGas bill doubled this winter"',
        'Furnace runs constantly and home still feels cold',
        'Older furnace (>12 years) — agent can suspect inefficiency',
        '"We heat the whole house but only live in part of it"',
      ],
      likelyCauses: [
        'Inadequate attic insulation — heat escaping upward constantly',
        'Old furnace well below current SEER/AFUE standards',
        'Leaking duct system losing 20–30% of heat before reaching rooms',
        'Single-pane windows acting as thermal sinks',
      ],
      trades: ['insulation', 'hvac', 'windows'],
      naturalPairings: ['hvac', 'insulation'],
      programFit: ['energy-saver'],
      householdResonance: ['Senior(s)', 'Family', 'Empty nester(s)'],
      discoveryQuestions: [
        'Does your gas bill spike significantly in winter?',
        'How old is your furnace — do you know?',
        'Does the house still feel cold even when the heat has been running for a while?',
      ],
      outcomeStatement:
        'A modern high-efficiency furnace paired with proper attic insulation reduces heating load dramatically. Most families see their winter gas bill cut by 30–50% — and the system cycles less, meaning it lasts longer.',
      lossFrame:
        'An old furnace at 70% AFUE is burning 30 cents on every dollar straight up the flue. You\'re paying SoCalGas for heat that never reaches your family. That gap adds up to hundreds of dollars every winter.',
      closeTrigger:
        'Winter is coming. The longer your system runs at that efficiency level, the more you\'re paying for heat your family never feels. Let\'s fix it before the season.',
      tags: ['financial', 'energy', 'gas', 'heating', 'furnace'],
    },
    {
      accessor: 'missingEnergyRebates',
      label: 'Homeowner is leaving rebates and tax credits on the table',
      severity: 'high',
      emotionalDrivers: ['lossAversion', 'fear'],
      urgencyMultiplier: 'high',
      symptoms: [
        'Has energy-inefficient home but never looked into rebates',
        'Unaware of IRA (Inflation Reduction Act) credits',
        'Does not know about LADWP / SCE / SoCalGas utility programs',
        'Has completed taxes for a prior year without claiming energy credits',
        'Financially motivated but hasn\'t run the numbers',
      ],
      likelyCauses: [
        'General unawareness of federal IRA incentive structure',
        'Misperception that rebates are "complicated" or don\'t apply to them',
        'Advisor (accountant, contractor) never mentioned it',
        'Utility rebate caps fill quickly and miss window due to inaction',
      ],
      trades: ['insulation', 'windows', 'hvac', 'solar'],
      naturalPairings: ['solar', 'insulation'],
      programFit: ['energy-saver'],
      householdResonance: ['Non-senior(s)', 'Empty nester(s)', 'Family'],
      discoveryQuestions: [
        'Have you heard about the federal tax credits available right now for energy upgrades — through the Inflation Reduction Act?',
        'Do you know what utility rebate programs your provider offers? LADWP and SCE both run programs that offset a significant portion of this.',
        'Are you working with a tax preparer who\'s flagged these credits for you?',
      ],
      outcomeStatement:
        'The IRA provides up to $3,200 per year in federal tax credits for exactly the work we\'re talking about. Combined with LADWP, SCE, and SoCalGas rebates, qualifying families offset 25–45% of the project cost. We handle the paperwork — you just sign.',
      lossFrame:
        'LADWP hit its 2024 rebate cap in October. Families who had qualifying projects but hadn\'t started lost $600 they were entitled to — gone, permanently. These programs reset, but they fill up fast. The ones active right now are open. After they fill, they\'re gone until next year.',
      closeTrigger:
        'The rebate application takes 10 minutes and we do it together today. If we wait, the window might close. Let\'s file it now.',
      tags: ['financial', 'rebates', 'ira', 'tax-credit', 'ladwp', 'sce', 'urgency'],
    },
    {
      accessor: 'evOrPoolAmplifiesElectricityCost',
      label: 'EV or pool/spa is dramatically increasing electricity costs',
      severity: 'high',
      emotionalDrivers: ['lossAversion'],
      urgencyMultiplier: 'high',
      symptoms: [
        'Recently purchased EV and electric bill spiked $80–$150/month',
        'Has pool or spa running pump year-round',
        'Describes electric bill as "ridiculous" or "shocking"',
        '"The EV was supposed to save us money but our bill is through the roof"',
      ],
      likelyCauses: [
        'EV adds 300–500 kWh/month at full retail utility rate',
        'Pool pump adds 150–250 kWh/month seasonally',
        'No solar to offset the new load',
        'Paying SCE Tier 2+ rates for all the additional consumption',
      ],
      trades: ['solar'],
      naturalPairings: ['insulation', 'hvac'],
      programFit: ['energy-saver'],
      householdResonance: ['Non-senior(s)', 'Family', 'Empty nester(s)'],
      discoveryQuestions: [
        'Do you have an EV at home? When did you get it?',
        'Do you have a pool or spa with a pump running?',
        'Have you noticed your electric bill change significantly since adding those?',
        'Have you looked into solar since your consumption went up?',
      ],
      outcomeStatement:
        'For a home with an EV and a pool, solar doesn\'t just make sense — it\'s transformative. You\'re essentially locking in your combined energy and fuel cost for 25 years while your neighbors\' bills keep rising. Most families in your situation pay $0 to the utility within the first year of installation.',
      lossFrame:
        'Right now you\'re paying retail rate to SCE for every kilowatt that charges your car and runs your pool. At your usage level, that\'s $[calculated] a year going to the utility that solar would eliminate. Every year without panels is a year of that cost you can\'t recover.',
      closeTrigger:
        'You already have the consumption that makes solar a guaranteed ROI. The question isn\'t whether it makes sense — it\'s how fast you want to stop paying SCE. Let\'s get you started today.',
      tags: ['financial', 'solar', 'ev', 'pool', 'electricity'],
    },
    {
      accessor: 'risingUtilityRates',
      label: 'Utility rates keep going up with no end in sight',
      severity: 'medium',
      emotionalDrivers: ['lossAversion', 'fear'],
      urgencyMultiplier: 'medium',
      symptoms: [
        '"Our bill has gone up every year even when we use less"',
        'Aware of rate increase announcements from SCE / LADWP',
        'Talks about feeling "at the mercy of the utility company"',
        'Has been in the home 10+ years and remembers when bills were lower',
      ],
      likelyCauses: [
        'SCE, LADWP, and SoCalGas rate increases (historically 4–8% annually)',
        'No hedge in place — fully exposed to rate fluctuations',
        'No solar to lock in energy cost',
        'Home efficiency hasn\'t improved to offset rising rates',
      ],
      trades: ['solar', 'insulation', 'windows'],
      naturalPairings: ['insulation', 'hvac'],
      programFit: ['energy-saver'],
      householdResonance: ['Senior(s)', 'Empty nester(s)', 'Non-senior(s)'],
      discoveryQuestions: [
        'Has your utility bill gone up over the years even when your usage felt the same?',
        'Have you ever looked at solar as a way to lock in your energy rate and stop being subject to those increases?',
        'Do you know what SCE has done to rates over the last 5 years in your area?',
      ],
      outcomeStatement:
        'Solar locks your energy rate for 25 years. Your neighbors will keep opening utility bills that go up every year. Yours won\'t. That fixed cost — knowing exactly what you\'ll pay — is something people on fixed incomes especially value. It\'s financial certainty in an uncertain category.',
      lossFrame:
        'SCE rates have increased an average of 6% per year for the last decade. At that rate, what costs $3,000 today in annual bills costs $5,370 in 10 years. Solar doesn\'t just reduce your bill — it removes you from that escalator entirely.',
      closeTrigger:
        'The rate is going up whether you do this or not. The question is whether next year\'s increase affects you or not. Let\'s lock in your rate today.',
      tags: ['financial', 'solar', 'utility-rates', 'long-term'],
    },
  ] satisfies PainPoint[],

  // ── Structural Risk ───────────────────────────────────────────────────────
  // Active or imminent physical damage. Highest urgency category.
  // Fear is the primary driver — risk of catastrophic loss if not addressed.

  structuralRisk: [
    {
      accessor: 'activeRoofLeak',
      label: 'Active or recent roof leak',
      severity: 'critical',
      emotionalDrivers: ['fear', 'trust'],
      urgencyMultiplier: 'critical',
      symptoms: [
        'Water stains or rings on the ceiling',
        'Dripping during or after rain',
        'Soft or warped drywall near the ceiling',
        'Musty odor in the attic or upper rooms',
        '"We put a bucket down when it rains"',
      ],
      likelyCauses: [
        'Roof past its service life — granules gone, shingles brittle',
        'Flashing failure at chimney, vent pipes, or roof-to-wall joints',
        'Storm damage — missing or displaced shingles',
        'Improper original installation allowing water infiltration',
        'Valley or flat section failure from ponding water',
      ],
      trades: ['roofing'],
      naturalPairings: ['insulation', 'solar'],
      programFit: ['tpr-monthly-special'],
      householdResonance: ['Senior(s)', 'Family', 'Non-senior(s)', 'Empty nester(s)'],
      discoveryQuestions: [
        'Have you noticed any water stains on the ceiling, or any areas that get wet when it rains?',
        'How old is your roof — do you know roughly when it was last replaced?',
        'Has a roofer or inspector looked at it recently?',
      ],
      outcomeStatement:
        'A full roof replacement with architectural shingles protects your home for 30+ years. Every rain event from the moment we finish is one less thing you have to worry about. And if you qualify for a cool-roof system, you also pick up the energy savings on top.',
      lossFrame:
        'An active roof leak is not a roofing problem — it\'s a water intrusion problem. Water in the attic causes mold in 48–72 hours. It soaks insulation, rots decking, and eventually damages drywall, framing, and everything below. A roof replacement today costs a fraction of what interior water damage costs after a season. Every storm that comes through is money you\'re risking.',
      closeTrigger:
        'You have an active leak. The next rain event is not a matter of "if." We can have a crew out within the week and your roof sealed before the next storm. Let\'s protect your home today.',
      tags: ['structural', 'urgent', 'roofing', 'water', 'leak', 'safety'],
    },
    {
      accessor: 'roofAgingOrNearingEol',
      label: 'Roof is aging and approaching or past end of service life',
      severity: 'high',
      emotionalDrivers: ['fear', 'lossAversion'],
      urgencyMultiplier: 'high',
      symptoms: [
        'Roof is 15–25+ years old',
        'Granule loss visible in gutters or downspouts',
        'Curling, cracked, or missing shingles',
        'Visible moss or algae growth',
        '"We know we need to do it — just haven\'t pulled the trigger"',
      ],
      likelyCauses: [
        'Normal material aging — shingles have finite lifespan',
        'Thermal cycling — Southern California heat accelerates degradation',
        'Improper ventilation baking shingles from below',
      ],
      trades: ['roofing'],
      naturalPairings: ['solar', 'insulation'],
      programFit: ['tpr-monthly-special', 'energy-saver'],
      householdResonance: ['Empty nester(s)', 'Senior(s)', 'Family'],
      discoveryQuestions: [
        'Do you know approximately when your roof was last replaced?',
        'Have you noticed granules accumulating in your gutters?',
        'Has anyone walked the roof recently and given you an assessment?',
      ],
      outcomeStatement:
        'A new roof today means zero worry for 30 years. With a cool-roof system, you also drop attic temperatures significantly — which compounds with insulation and AC savings. And if you\'re considering solar at any point, a new roof is the time to do it — panels on a 20-year-old roof require a costly re-roof later.',
      lossFrame:
        'A roof that fails costs you the replacement anyway — but now adds $20,000–$40,000 in interior water damage, mold remediation, and drywall repair on top. The question isn\'t whether you\'ll replace the roof. It\'s whether you do it proactively on your terms, or reactively after a failure.',
      closeTrigger:
        'Your roof is past its expected life. The risk of waiting is fully on you — we can eliminate that risk this month. Let\'s get your home protected.',
      tags: ['structural', 'roofing', 'aging', 'risk'],
    },
    {
      accessor: 'foundationCracksOrSettling',
      label: 'Foundation cracks, settling, or structural movement',
      severity: 'critical',
      emotionalDrivers: ['fear', 'trust'],
      urgencyMultiplier: 'critical',
      symptoms: [
        'Cracks in walls, floors, or the exterior foundation',
        'Doors that stick or no longer close flush',
        'Floors that slope or feel uneven underfoot',
        'Visible separation at ceiling-wall junctions',
        'Windows that no longer operate smoothly',
        '"We\'ve had this crack for years — it keeps getting bigger"',
      ],
      likelyCauses: [
        'Soil movement or shrinkage — common in Southern California clay soils',
        'Hydrostatic pressure from poor drainage',
        'Seismic activity causing differential settlement',
        'Tree root infiltration',
        'Original construction on unstable fill material',
      ],
      trades: ['foundation'],
      naturalPairings: ['paint'],
      programFit: ['tpr-monthly-special'],
      householdResonance: ['Senior(s)', 'Family', 'Empty nester(s)'],
      discoveryQuestions: [
        'Have you noticed any cracks in your walls, floors, or the outside of the house?',
        'Are any of your doors or windows sticking, or not closing the way they used to?',
        'Do any of your floors feel uneven or sloped when you walk across them?',
      ],
      outcomeStatement:
        'Foundation stabilization stops the movement permanently. With helical or push piers, we arrest any further settling — and we repair the visible cracking and cosmetic damage on top. Your home is structurally sound, and that\'s documented for your own peace of mind and any future sale.',
      lossFrame:
        'Foundation movement doesn\'t stop on its own. A crack that\'s "been there for years" has almost certainly grown. Every year you wait, the differential settlement increases — and so does the repair cost. Addressed now, this is a contained scope. Left another five years, it can compromise the entire structure and become uninsurable.',
      closeTrigger:
        'Foundation issues are the one problem where waiting is always more expensive than acting. Every year costs you more and the damage is less reversible. Let\'s stop it now.',
      tags: ['structural', 'foundation', 'safety', 'critical', 'settling'],
    },
    {
      accessor: 'windowLeaksOrWaterInfiltration',
      label: 'Windows leaking or allowing water infiltration',
      severity: 'high',
      emotionalDrivers: ['fear', 'lossAversion'],
      urgencyMultiplier: 'high',
      symptoms: [
        'Water on the windowsill after rain',
        'Soft or stained drywall under windows',
        'Fogged glass between panes (seal failure)',
        'Visible water tracks down interior walls from windows',
        'Musty smell in rooms with problematic windows',
      ],
      likelyCauses: [
        'Failed window seals or deteriorated flashing',
        'Original aluminum windows with no thermal or moisture barrier',
        'Settling of the window frame over time opening gaps',
        'Missing or failed caulking on exterior',
      ],
      trades: ['windows'],
      naturalPairings: ['insulation', 'paint'],
      programFit: ['energy-saver', 'tpr-monthly-special'],
      householdResonance: ['Family', 'Senior(s)'],
      discoveryQuestions: [
        'Do any of your windows get water on the inside during rain, or have you noticed moisture or staining on the drywall underneath?',
        'Are any of your windows fogged up on the inside of the glass — between the panes?',
        'How old are your windows — do you know?',
      ],
      outcomeStatement:
        'New dual-pane windows with proper flashing seal the envelope completely — no more water intrusion, no more fogging, no more drafts. You get the comfort and energy savings on top of solving the water problem.',
      lossFrame:
        'Water intrusion at windows causes mold in the wall cavity — which you can\'t see until it\'s expensive. A $12,000 window replacement today costs a fraction of what a molded wall cavity plus remediation plus window replacement costs later.',
      closeTrigger:
        'Water is getting in right now. Every rain event it\'s happening. The longer the wall cavity stays wet, the more expensive the repair becomes. Let\'s close that window and protect your walls.',
      tags: ['structural', 'windows', 'water', 'moisture', 'leak'],
    },
  ] satisfies PainPoint[],

  // ── Health & Indoor Air Quality ───────────────────────────────────────────
  // Physical health impacts from poor home conditions.
  // Fear is strong here — especially for households with children, seniors, or allergies.

  healthAndIaq: [
    {
      accessor: 'moldOrMildewPresent',
      label: 'Mold or mildew is present in the home',
      severity: 'critical',
      emotionalDrivers: ['fear', 'trust'],
      urgencyMultiplier: 'critical',
      symptoms: [
        'Musty smell in bathrooms, attic, or basement areas',
        'Visible dark spots on walls, ceilings, or grout',
        'Condensation building up regularly on windows or walls',
        'Family member with unexplained respiratory symptoms',
        '"We had a leak and we\'re worried about mold"',
      ],
      likelyCauses: [
        'Water intrusion from roof, windows, or plumbing',
        'Poor ventilation trapping humidity',
        'Oversized AC cycling too fast — not dehumidifying properly',
        'Crawlspace moisture migrating upward',
        'Previous water damage not fully dried or remediated',
      ],
      trades: ['roofing', 'windows', 'hvac'],
      naturalPairings: ['insulation', 'hvac'],
      programFit: ['tpr-monthly-special'],
      householdResonance: ['Family', 'Multi-gen home', 'Senior(s)'],
      discoveryQuestions: [
        'Have you noticed any musty smells in certain areas of the house — especially the attic, bathroom, or around windows?',
        'Has anyone in the household had unexplained respiratory issues or allergies that seem to be worse at home?',
        'Have you had any prior water intrusion — a roof leak, a plumbing incident — that may not have been fully resolved?',
      ],
      outcomeStatement:
        'Addressing the source — whether that\'s the roof, windows, or ventilation — stops the mold condition at the root. We don\'t just treat the symptom. We eliminate what\'s causing it and restore proper airflow so it doesn\'t recur.',
      lossFrame:
        'Mold doesn\'t stop on its own. It spreads. What starts as a small patch in a wet corner becomes a remediation project costing $5,000–$20,000 plus health consequences you can\'t price. The source is almost always a fixable water intrusion or ventilation problem. Address the source now.',
      closeTrigger:
        'Mold is a health issue for your family. The source is fixable. Let\'s get this done — your family\'s health is not something to defer.',
      tags: ['health', 'iaq', 'mold', 'moisture', 'safety'],
    },
    {
      accessor: 'excessiveDustOrAllergens',
      label: 'Home feels dusty — family has allergies or respiratory issues',
      severity: 'medium',
      emotionalDrivers: ['fear', 'prideOfOwnership'],
      urgencyMultiplier: 'medium',
      symptoms: [
        '"No matter how much we clean, it\'s dusty again in two days"',
        'Family members sneeze frequently indoors',
        'Visible dust on surfaces within days of cleaning',
        'Allergy or asthma symptoms are worse at home than elsewhere',
        '"The filters seem to clog really fast"',
      ],
      likelyCauses: [
        'Leaky duct system pulling unfiltered attic air into living space',
        'Old or inadequate air filtration in HVAC system',
        'Air infiltration through windows and doors bringing outdoor particles',
        'Inadequate ventilation causing particle buildup',
      ],
      trades: ['hvac', 'insulation', 'windows'],
      naturalPairings: ['insulation', 'windows'],
      programFit: ['energy-saver'],
      householdResonance: ['Family', 'Multi-gen home', 'Senior(s)'],
      discoveryQuestions: [
        'Does your home seem to get dusty quickly after you clean it?',
        'Does anyone in the family have allergies or asthma that seems worse at home?',
        'Have you ever had your ductwork inspected — ducts can draw air straight from the attic past your filters if they\'re leaking?',
      ],
      outcomeStatement:
        'A properly sealed duct system combined with upgraded filtration dramatically reduces the particulate load in your home. Families with allergies consistently report that this is one of the most life-changing improvements — the air quality difference is immediate and noticeable.',
      lossFrame:
        'Leaky ducts aren\'t just an energy problem — they\'re pulling air directly from your attic, where insulation fibers, rodent droppings, and years of accumulated particulates live. Every time the system runs, that\'s what\'s circulating through your home.',
      closeTrigger:
        'Your family is breathing what\'s in your ductwork. We can fix that — and you\'ll notice the difference from the first day. Let\'s get started.',
      tags: ['health', 'iaq', 'dust', 'allergies', 'hvac'],
    },
    {
      accessor: 'familyMemberWithRespiratorySensitivity',
      label: 'Family member with asthma, allergies, or respiratory condition',
      severity: 'high',
      emotionalDrivers: ['fear', 'prideOfOwnership'],
      urgencyMultiplier: 'high',
      symptoms: [
        'Child with asthma prescribed inhalers that\'s used frequently at home',
        'Elderly parent with COPD or respiratory sensitivity living in the home',
        '"The doctor said to look at the home environment"',
        'Family member who feels noticeably better when not at home',
      ],
      likelyCauses: [
        'Poor IAQ from duct leakage, mold, or inadequate filtration',
        'High particulate load from aged HVAC system',
        'Humidity imbalance creating conditions for dust mites or mold',
      ],
      trades: ['hvac', 'insulation'],
      naturalPairings: ['windows', 'insulation'],
      programFit: ['energy-saver'],
      householdResonance: ['Family', 'Multi-gen home', 'Senior(s)'],
      discoveryQuestions: [
        'Does anyone in the household have asthma, allergies, or any respiratory condition that is particularly noticeable at home?',
        'Has a doctor or allergist ever mentioned the home environment as a potential factor?',
        'Have you noticed that the person with respiratory issues feels better when they\'re somewhere else?',
      ],
      outcomeStatement:
        'Improving the ventilation and filtration in your HVAC system creates a measurably cleaner indoor environment. For households with respiratory conditions, this is often the single highest-impact home improvement — more than any cosmetic upgrade.',
      lossFrame:
        'Every night your [child/parent] sleeps in a home with unfiltered, recirculated air from a leaking duct system is a night you\'re asking their respiratory system to work harder than it should. The fix is not expensive. The cost of the current situation is measured in medication, doctor visits, and quality of life.',
      closeTrigger:
        'This is about [their family member\'s] health. We can make a measurable difference. Let\'s do that.',
      tags: ['health', 'iaq', 'asthma', 'respiratory', 'safety', 'family'],
    },
  ] satisfies PainPoint[],

  // ── Aesthetics & Resale ───────────────────────────────────────────────────
  // The home looks dated, is behind the neighborhood, or is being prepared for sale.
  // Pride of ownership and financial motivations blend here.

  aestheticsAndResale: [
    {
      accessor: 'planningToSellThisHome',
      label: 'Planning to sell — needs maximum resale ROI',
      severity: 'high',
      emotionalDrivers: ['lossAversion', 'fear'],
      urgencyMultiplier: 'high',
      symptoms: [
        '"We\'re thinking about selling in the next 1–2 years"',
        '"We want to make sure we get top dollar"',
        'Recently had a realtor walk through with ROI comments',
        '"The kitchen and bathrooms are the ones they always say matter"',
        'Comparing to similar homes that sold recently in neighborhood',
      ],
      likelyCauses: [
        'Life transition — retirement, relocation, downsizing, divorce',
        'Market timing consideration',
        'Children have grown up and home is too large',
      ],
      trades: ['bathroom', 'kitchen', 'flooring', 'paint', 'roofing'],
      naturalPairings: ['flooring', 'paint'],
      programFit: ['tpr-monthly-special'],
      householdResonance: ['Empty nester(s)', 'Senior(s)', 'Non-senior(s)'],
      discoveryQuestions: [
        'Are you thinking about selling this home at some point in the next few years?',
        'Have you had a realtor or appraiser give you a sense of what the home would need to be competitive?',
        'What areas did they identify as the highest return for the investment?',
      ],
      outcomeStatement:
        'The right upgrades — kitchen, bathrooms, and flooring — return 60–80% of their cost at resale while making the home dramatically easier to sell. More importantly, they attract buyers and reduce days on market. A home that shows well commands asking price; one that looks dated negotiates down.',
      lossFrame:
        'A dated kitchen costs you at the negotiating table — buyers mentally subtract far more than the actual cost to update it. The $15,000 kitchen you don\'t do becomes a $25,000 price reduction when they make an offer. The math favors acting before you list.',
      closeTrigger:
        'Buyers are already doing the math in their heads when they walk through. Let\'s make sure the math works in your favor. We can start this month and be done well before you list.',
      tags: ['resale', 'financial', 'kitchen', 'bathroom', 'selling'],
    },
    {
      accessor: 'outdatedExteriorCurbAppeal',
      label: 'Exterior looks dated — curb appeal is poor',
      severity: 'medium',
      emotionalDrivers: ['prideOfOwnership', 'socialProof'],
      urgencyMultiplier: 'medium',
      symptoms: [
        'Paint is faded, peeling, or an outdated color scheme',
        'Feels embarrassed when guests arrive',
        '"The neighborhood is getting nicer — ours looks like the worst one on the block"',
        'Comparing to recently updated neighboring homes',
        'HOA notice about exterior condition',
      ],
      likelyCauses: [
        'Paint past its functional lifespan (exterior paint: 5–7 years in SoCal)',
        'Dated architectural trim or color choices from prior decades',
        'Deferred maintenance compounding visual deterioration',
        'Neighbors investing and raising neighborhood standard',
      ],
      trades: ['paint', 'decking', 'roofing'],
      naturalPairings: ['decking', 'roofing'],
      programFit: ['tpr-monthly-special'],
      householdResonance: ['Non-senior(s)', 'Family', 'Empty nester(s)'],
      discoveryQuestions: [
        'How do you feel about the way your home looks from the street right now?',
        'Have you noticed the neighboring homes being painted or updated recently?',
        'Is there a specific part of the exterior — the paint, the entry, the roofline — that you think needs the most attention?',
      ],
      outcomeStatement:
        'A fresh exterior paint job is the highest ROI home improvement per dollar — it transforms the perception of the entire property. Combined with a new deck or updated roofline, it makes the home feel completely new from the street.',
      lossFrame:
        'Every year the exterior paint deteriorates, you\'re losing curb appeal and exposing the substrate to SoCal UV and moisture. What\'s a repaint today becomes substrate repair and repaint later. And in a neighborhood where other homes are being updated, yours standing out negatively affects perceived value.',
      closeTrigger:
        'Your home should make you proud every time you pull into the driveway. We can make that happen this month — and the neighborhood will notice.',
      tags: ['aesthetics', 'curb-appeal', 'paint', 'exterior', 'resale'],
    },
    {
      accessor: 'datedBathroomEmbarrassment',
      label: 'Bathroom is dated, embarrassing, or non-functional',
      severity: 'medium',
      emotionalDrivers: ['prideOfOwnership', 'socialProof'],
      urgencyMultiplier: 'medium',
      symptoms: [
        'Cracked tile, pink or avocado fixtures from prior decades',
        '"We don\'t let guests use the hall bathroom"',
        'Shower doesn\'t work well — weak pressure, leaking fixture',
        'Single sink in a two-person household',
        '"It\'s functional but we\'ve hated it for 10 years"',
      ],
      likelyCauses: [
        'Original construction — bathroom was never updated',
        'Prior owner\'s tastes frozen in time',
        'Deferred maintenance reaching aesthetic threshold',
      ],
      trades: ['bathroom'],
      naturalPairings: ['flooring', 'paint'],
      programFit: ['tpr-monthly-special', 'existing-customer-savings-plus'],
      householdResonance: ['Non-senior(s)', 'Family', 'Empty nester(s)'],
      discoveryQuestions: [
        'How do you feel about your bathrooms — is there one that\'s been on your list for a while?',
        'If you could change one thing about the house tomorrow, would the bathroom be on that list?',
        'Are there any functional issues — a fixture that doesn\'t work right, a shower that leaks — beyond just the aesthetics?',
      ],
      outcomeStatement:
        'A full bathroom renovation — new tile, new fixtures, frameless glass if you want it — turns the room you use every single day into something you\'re proud of. It\'s the highest-frequency room in your home. You\'ll feel it every morning.',
      lossFrame:
        'You\'ve been tolerating that bathroom for 10 years. That\'s 3,650 days of starting your morning in a space you\'re not happy in. The renovation you\'ve been putting off is a week of construction for a decade of satisfaction.',
      closeTrigger:
        'You\'ve been putting this off long enough. You\'re already sold on needing it. The only question is whether we do it this month or in another year. Let\'s do it this month.',
      tags: ['aesthetics', 'bathroom', 'comfort', 'lifestyle'],
    },
    {
      accessor: 'datedKitchenLimitingLifestyle',
      label: 'Kitchen is outdated and limiting daily quality of life',
      severity: 'medium',
      emotionalDrivers: ['prideOfOwnership', 'lossAversion'],
      urgencyMultiplier: 'medium',
      symptoms: [
        'Laminate countertops or cabinets from the 1990s',
        '"We love to cook but the kitchen makes it miserable"',
        'Not enough counter space or storage',
        'Doesn\'t match the rest of the home\'s current quality',
        '"Every time I see the kitchen I think about how much I want it redone"',
      ],
      likelyCauses: [
        'Original construction — kitchen was never updated',
        'Home purchased with planned renovation that never happened',
        'Growing family outpacing kitchen functionality',
      ],
      trades: ['kitchen'],
      naturalPairings: ['flooring', 'paint'],
      programFit: ['tpr-monthly-special', 'existing-customer-savings-plus'],
      householdResonance: ['Family', 'Non-senior(s)', 'Empty nester(s)'],
      discoveryQuestions: [
        'How do you feel about your kitchen — is it working well for how you actually use it?',
        'Do you cook at home regularly? Does the kitchen support that?',
        'If you were going to prioritize one interior project, would the kitchen make the top of the list?',
      ],
      outcomeStatement:
        'A kitchen remodel delivers 60–80% ROI at resale and transforms the most-used room in the home. Soft-close cabinets, quartz countertops, a new backsplash — it\'s a total shift in how you experience the space. Families consistently say it was the best investment they made in the home.',
      lossFrame:
        'The kitchen is the room you spend the most time in. Every meal, every morning, every gathering. Tolerating a kitchen you don\'t enjoy isn\'t saving money — it\'s paying for discomfort every single day.',
      closeTrigger:
        'You\'ve wanted this kitchen for years. The only thing that changes if you wait is the price and the schedule. Let\'s get this done.',
      tags: ['aesthetics', 'kitchen', 'lifestyle', 'resale'],
    },
  ] satisfies PainPoint[],

  // ── Lifestyle & Comfort ───────────────────────────────────────────────────
  // Quality-of-life improvements — functionality, daily experience, and space utilization.
  // Pride of ownership is the primary driver. These close best on emotional framing.

  lifestyleAndComfort: [
    {
      accessor: 'noOutdoorLivingSpace',
      label: 'Backyard is unused — no deck or outdoor living area',
      severity: 'low',
      emotionalDrivers: ['prideOfOwnership', 'socialProof'],
      urgencyMultiplier: 'low',
      symptoms: [
        '"We have the backyard but we never use it"',
        'Kids or grandkids have no outdoor space to use',
        'Wants to entertain outside but has no structure to do it',
        'Neighbor recently built a deck and they see it over the fence',
        '"We\'ve been saying we\'d do the deck for five years"',
      ],
      likelyCauses: [
        'Original construction included no deck',
        'Prior deck removed and not replaced',
        'Never prioritized but always wanted',
      ],
      trades: ['decking'],
      naturalPairings: ['paint', 'flooring'],
      programFit: ['tpr-monthly-special'],
      householdResonance: ['Family', 'Non-senior(s)', 'Empty nester(s)'],
      discoveryQuestions: [
        'Do you use your backyard much? Is there space out there that you feel like you\'re not making the most of?',
        'Have you ever thought about adding a deck or some kind of outdoor structure?',
        'Do you entertain at home or have family over regularly?',
      ],
      outcomeStatement:
        'A composite deck adds usable living space to your home — literally expanding where you can live, eat, and entertain. Families tell us it changes how they use their home entirely. Kids go outside. Dinners happen outdoors. The space goes from unused to the favorite part of the house.',
      lossFrame:
        'You\'re paying property taxes on a backyard you don\'t use. Every summer that passes without a deck is a season of outdoor living that\'s gone. The deck you build this spring is ready by summer.',
      closeTrigger:
        'Let\'s get you ready for summer. A deck installed this month means your family is using it by June. Let\'s get started.',
      tags: ['lifestyle', 'decking', 'outdoor', 'comfort'],
    },
    {
      accessor: 'wornOrDamagedFlooring',
      label: 'Flooring is worn, damaged, or outdated',
      severity: 'medium',
      emotionalDrivers: ['prideOfOwnership', 'socialProof'],
      urgencyMultiplier: 'low',
      symptoms: [
        'Old carpet that shows wear or stains despite cleaning',
        'Scratched hardwood that\'s been refinished twice already',
        'Tile that\'s cracked or grout that\'s perpetually discolored',
        '"We have guests coming and I\'m embarrassed about the floors"',
        '"We\'ve been putting down rugs to cover them for years"',
      ],
      likelyCauses: [
        'Flooring past its service life',
        'Pets, children, or heavy traffic compounding wear',
        'Original builder-grade material that never held up well',
      ],
      trades: ['flooring'],
      naturalPairings: ['paint', 'bathroom', 'kitchen'],
      programFit: ['tpr-monthly-special', 'existing-customer-savings-plus'],
      householdResonance: ['Family', 'Non-senior(s)', 'Empty nester(s)'],
      discoveryQuestions: [
        'How are your floors holding up — any areas that are worn, stained, or that you\'ve been covering up?',
        'Is flooring something that\'s been on your renovation list?',
        'Do you have pets or kids — those really accelerate floor wear.',
      ],
      outcomeStatement:
        'New luxury vinyl plank or hardwood transforms the feel of every room it touches. It\'s the single highest-visibility change you can make to an interior short of a full gut renovation. One day of installation, completely different home.',
      lossFrame:
        'Flooring you\'re embarrassed by is flooring that\'s depressing the perceived value of your entire interior — in your own eyes and your guests\'. You\'ve been covering it up. The right time to fix it was last year. The next best time is now.',
      closeTrigger:
        'You\'ve had rugs on those floors for how long? Let\'s just fix it. One week of work and it\'s done for the next 20 years.',
      tags: ['lifestyle', 'flooring', 'aesthetics', 'comfort'],
    },
  ] satisfies PainPoint[],

  // ── Energy Inefficiency ───────────────────────────────────────────────────
  // The home's systems or envelope are inefficient — aging, wrong-sized, or absent.
  // These are the core Energy-Saver program pain points.

  energyInefficiency: [
    {
      accessor: 'oldOrFailingHvacSystem',
      label: 'HVAC system is old, failing, or inefficient',
      severity: 'high',
      emotionalDrivers: ['fear', 'lossAversion'],
      urgencyMultiplier: 'high',
      symptoms: [
        'System is 12–20+ years old',
        '"It\'s been repaired twice in the last two years"',
        'Uneven cooling or heating despite system running constantly',
        'Strange noises — rattling, grinding, or banging',
        '"The technician said it\'s on its last legs"',
        'Bill is high but comfort is still poor',
      ],
      likelyCauses: [
        'Normal system lifecycle — residential HVAC lasts 12–18 years',
        'Improper sizing at original installation',
        'Poor maintenance history accelerating wear',
        'Refrigerant type (R-22) now discontinued and expensive to service',
      ],
      trades: ['hvac'],
      naturalPairings: ['insulation', 'windows'],
      programFit: ['energy-saver'],
      householdResonance: ['Senior(s)', 'Family', 'Empty nester(s)', 'Non-senior(s)'],
      discoveryQuestions: [
        'How old is your HVAC system — do you know roughly when it was installed?',
        'Have you had any service calls or repairs on it recently?',
        'Does the system run a long time to reach temperature, or cycle frequently without reaching it?',
        'Have you noticed higher bills without any change in how you use it?',
      ],
      outcomeStatement:
        'A modern high-SEER heat pump or split system is dramatically more efficient than a system from 10 years ago — often 40–60% more efficient at the same comfort level. You\'ll notice the difference in both comfort and your bill immediately. And with federal IRA credits, a portion of the cost comes back as a tax credit.',
      lossFrame:
        'An aging HVAC system is a mechanical time bomb with no off switch. Every repair buys you months, not years. And every month it runs at 60% efficiency is money out of your pocket for comfort you\'re not fully getting. A system failure on the hottest day of August in Southern California is not a comfortable situation.',
      closeTrigger:
        'Your system is past its expected life. A failure isn\'t a question of if — it\'s when. Let\'s replace it on your schedule, with your choice of equipment and the rebates active right now. Next year the rebates may change. Today they\'re open.',
      tags: ['energy', 'hvac', 'efficiency', 'aging', 'comfort'],
    },
    {
      accessor: 'noOrLowInsulation',
      label: 'Home has no or inadequate insulation',
      severity: 'high',
      emotionalDrivers: ['lossAversion', 'fear'],
      urgencyMultiplier: 'high',
      symptoms: [
        'Home built pre-1980 — original insulation minimal or absent',
        'Attic feels like an oven in summer or freezer in winter',
        'High utility bill with no explanation',
        '"We had an inspector say we were R-8 when we need R-38"',
        'HVAC runs constantly and barely keeps up',
      ],
      likelyCauses: [
        'Original construction with inadequate insulation standards (pre-Title 24)',
        'Prior insulation settled, compacted, or degraded over decades',
        'Attic additions or modifications that bypassed original insulation',
        'No air sealing performed — insulation without sealing is ineffective',
      ],
      trades: ['insulation'],
      naturalPairings: ['hvac', 'windows'],
      programFit: ['energy-saver'],
      householdResonance: ['Senior(s)', 'Family', 'Empty nester(s)'],
      discoveryQuestions: [
        'Do you know if your attic has been insulated — or when it was last updated?',
        'Have you noticed that no matter what you do with the thermostat, certain parts of the house don\'t respond?',
        'Has anyone done an energy audit on the home?',
      ],
      outcomeStatement:
        'Bringing your attic to R-38 with proper air sealing is the single most cost-effective energy upgrade you can make. Most families see 20–40% reductions in their heating and cooling costs from insulation alone. It\'s the foundation that makes everything else work better.',
      lossFrame:
        'An uninsulated attic is an open duct to the outside. In summer, the sun turns your attic into a 150-degree oven that your AC fights all day. In winter, your heat rises straight up and out. You\'ve been paying to condition your attic for years without knowing it.',
      closeTrigger:
        'Insulation has the fastest payback of any energy upgrade. Most customers break even in under three years — and then it\'s pure savings from there. Let\'s get this scheduled.',
      tags: ['energy', 'insulation', 'efficiency', 'attic', 'comfort'],
    },
    {
      accessor: 'singleOrAgedPaneWindows',
      label: 'Single-pane or very old windows wasting energy',
      severity: 'medium',
      emotionalDrivers: ['lossAversion', 'prideOfOwnership'],
      urgencyMultiplier: 'medium',
      symptoms: [
        'Aluminum-frame windows with no thermal break (original 1970s–80s construction)',
        'Visible condensation or frost on the inside of the glass in winter',
        'Can feel cold radiating from the glass standing near it',
        '"You can see daylight around the frame when it\'s closed"',
        'Noise from outside is very loud — no sound dampening',
      ],
      likelyCauses: [
        'Original single-pane aluminum windows never replaced',
        'Prior replacement windows now at end of their own service life',
        'Seal failure on older double-pane units reducing effectiveness',
      ],
      trades: ['windows'],
      naturalPairings: ['insulation', 'hvac'],
      programFit: ['energy-saver'],
      householdResonance: ['Senior(s)', 'Family', 'Non-senior(s)'],
      discoveryQuestions: [
        'Do you know what type of windows you have — are they single-pane or double-pane?',
        'Do you notice the windows fogging up between the panes? That means the seal has failed.',
        'When you stand near the windows in winter, can you feel cold coming off the glass?',
      ],
      outcomeStatement:
        'Dual-pane Low-E windows are dramatically more effective than single-pane — they block heat in summer and retain it in winter. Beyond the energy savings, families notice the noise reduction immediately. The outside world goes quiet. That alone is life-changing for most homeowners.',
      lossFrame:
        'A single-pane window has roughly the same insulating value as a piece of cardboard. Every single-pane window in your home is a thermal short-circuit in your building envelope. Your AC and heater are fighting the windows year-round — and losing.',
      closeTrigger:
        'Your windows are costing you every month and lowering your quality of life every day. Let\'s fix that this month and pick up the tax credit while it\'s available.',
      tags: ['energy', 'windows', 'efficiency', 'comfort'],
    },
    {
      accessor: 'noSolarWithHighConsumption',
      label: 'No solar — paying full retail electricity rates',
      severity: 'high',
      emotionalDrivers: ['lossAversion', 'fear'],
      urgencyMultiplier: 'medium',
      symptoms: [
        'Monthly electric bill over $180',
        'Home has EV, pool, or both amplifying usage',
        '"We\'ve talked about solar for years but never pulled the trigger"',
        'Has heard neighbors talking about $0 electric bills',
        'Has solar on their list but hasn\'t gotten to it',
      ],
      likelyCauses: [
        'No solar installation — fully dependent on utility',
        'High base consumption from modern household (EV, pool, AC)',
        'NEM 3.0 changes — the longer you wait, the less the export value',
        'Rising SCE/LADWP rates making payback period shorter',
      ],
      trades: ['solar'],
      naturalPairings: ['insulation', 'roofing'],
      programFit: ['energy-saver'],
      householdResonance: ['Non-senior(s)', 'Family', 'Empty nester(s)'],
      discoveryQuestions: [
        'Are you on solar? Or have you thought about it?',
        'What does your average monthly electricity bill run?',
        'Do you have an EV, a pool, or are you expecting your usage to go up?',
        'Have you heard about NEM 3.0 — the rate change that affects solar export credits?',
      ],
      outcomeStatement:
        'Solar is the only home improvement that generates a monthly return from day one of installation. Families with your usage level typically offset or eliminate their electric bill entirely. Over 25 years, the math is overwhelming — you\'re essentially paying the utility forever, or locking in your rate today.',
      lossFrame:
        'Under NEM 3.0, the value of solar export credits is lower than it was under NEM 2.0 — meaning the earlier you got in, the better the economics. Every year you wait, you pay full retail rates AND lock in with a slightly less favorable export structure. The best time to go solar was last year. The next best time is today.',
      closeTrigger:
        'The rate structure is only going to get less favorable over time. The federal ITC is 30% today — that\'s guaranteed through 2032, but the utility incentive landscape shifts. The system that makes sense today may cost more and earn less in two years. Let\'s lock in the favorable economics now.',
      tags: ['energy', 'solar', 'financial', 'nem3', 'electricity'],
    },
  ] satisfies PainPoint[],

  // ── Life Triggers ─────────────────────────────────────────────────────────
  // Event-driven motivators — not problems per se, but catalysts that create a
  // window of receptivity. The homeowner is ALREADY in motion; our job is to
  // match their energy and provide a path forward quickly.

  lifeTrigger: [
    {
      accessor: 'neighborJustCompletedProject',
      label: 'Neighbor just completed a home improvement project',
      severity: 'variable',
      emotionalDrivers: ['socialProof', 'prideOfOwnership'],
      urgencyMultiplier: 'medium',
      symptoms: [
        '"Our neighbor just had their roof done and it looks amazing"',
        '"The house next door just got new windows — we\'ve been thinking about it too"',
        '"The whole street has been getting done — we feel like the holdout"',
        'Visible construction recently completed nearby',
      ],
      likelyCauses: [
        'Social proof is already established — the neighbor eliminated the "is this worth it?" question',
        'Competition and neighborhood pride creating action pressure',
        'The contractor in the neighborhood also created awareness',
      ],
      trades: ['roofing', 'windows', 'insulation', 'solar', 'paint', 'decking', 'bathroom', 'kitchen'],
      naturalPairings: [],
      programFit: ['tpr-monthly-special'],
      householdResonance: ['Non-senior(s)', 'Family', 'Empty nester(s)'],
      discoveryQuestions: [
        'What made you decide to look into this now — was there a specific trigger?',
        'Have you seen any projects in the neighborhood recently?',
        'What did you think of how [neighbor\'s project] came out?',
      ],
      outcomeStatement:
        'Your neighbors made the decision for a reason — and they\'re already living with the results. You know their home, their street, their situation. If it worked for them, it\'ll work for you — and we can tell you exactly what it looked like on their project.',
      lossFrame:
        'Your neighbor\'s project is already done. Every week you wait, their upgrade is compounding — lower bills, higher value, better comfort. This is a decision that only gets more favorable the earlier you make it.',
      closeTrigger:
        'Your neighbor already made this decision. Now it\'s your turn. We\'re already working in the area — scheduling is fast right now. Let\'s get you on the calendar.',
      tags: ['social-proof', 'trigger', 'neighborhood', 'urgency'],
    },
    {
      accessor: 'recentDamageOrStormEvent',
      label: 'Recent storm or damage event created urgency',
      severity: 'critical',
      emotionalDrivers: ['fear', 'trust'],
      urgencyMultiplier: 'critical',
      symptoms: [
        '"We had a bad storm last month and noticed some damage"',
        'Insurance adjuster has already visited or is scheduled',
        'Visible storm damage to roof, windows, or exterior',
        '"We\'ve been putting off calling because we don\'t know where to start"',
      ],
      likelyCauses: [
        'Recent wind, hail, rain, or wildfire event',
        'Pre-existing weakness revealed by the storm event',
        'Insurance claim underway or anticipated',
      ],
      trades: ['roofing', 'windows', 'foundation', 'paint'],
      naturalPairings: ['insulation', 'paint'],
      programFit: ['tpr-monthly-special'],
      householdResonance: ['Senior(s)', 'Family', 'Non-senior(s)', 'Empty nester(s)'],
      discoveryQuestions: [
        'Have you had any damage to the home recently — from a storm, a wind event, anything like that?',
        'Is there an insurance claim involved, or are you handling this out of pocket?',
        'What areas of the home were affected — and have you had anyone look at it since?',
      ],
      outcomeStatement:
        'We work with insurance claims regularly. If you have coverage that applies, we help you navigate the process — our documentation supports your claim, and we coordinate directly with adjusters when needed. You don\'t have to manage this alone.',
      lossFrame:
        'Storm damage that isn\'t addressed gets worse — water infiltrates, structures weaken, mold takes hold. The longer the exposure window, the more secondary damage accumulates. And in an insurance claim scenario, delay can complicate or reduce the payout.',
      closeTrigger:
        'You have a legitimate need and a timeline. Let\'s assess the damage properly, document it for your claim if applicable, and get your home back to where it should be. We can start this week.',
      tags: ['urgent', 'storm', 'damage', 'insurance', 'trigger'],
    },
    {
      accessor: 'newlyPurchasedHome',
      label: 'Recently purchased home — wants to upgrade before moving in or shortly after',
      severity: 'medium',
      emotionalDrivers: ['prideOfOwnership', 'lossAversion'],
      urgencyMultiplier: 'high',
      symptoms: [
        '"We just bought the place and there are a few things we want to fix before we move in"',
        '"The inspection flagged some things we want to address"',
        '"We want to make it ours before we get comfortable"',
        'Home was a probate sale or inherited property with deferred maintenance',
      ],
      likelyCauses: [
        'New ownership creates natural update window before furniture and life fills the space',
        'Inspection report created a prioritized list of concerns',
        'Desire to start fresh and not inherit the prior owner\'s choices',
      ],
      trades: ['roofing', 'hvac', 'insulation', 'windows', 'bathroom', 'kitchen', 'flooring', 'paint'],
      naturalPairings: ['flooring', 'paint'],
      programFit: ['tpr-monthly-special'],
      householdResonance: ['Non-senior(s)', 'Family'],
      discoveryQuestions: [
        'When did you close on the home?',
        'Did the inspection flag anything that you\'re prioritizing?',
        'Is there a timeline you\'re working with — are you trying to get things done before you move in?',
      ],
      outcomeStatement:
        'New ownership is the best time to address deferred maintenance and cosmetic updates — the home is empty or transitional, which makes the work faster, cleaner, and less disruptive. You get to move into exactly the home you want instead of inheriting the prior owner\'s decisions.',
      lossFrame:
        'Every month you live in the home before addressing the deferred maintenance, the problems compound — and the work becomes more disruptive. A roof, HVAC, or window project done before you move in is a fraction of the inconvenience of doing it later.',
      closeTrigger:
        'You have the ideal window right now — before life fills in around the project. Let\'s take advantage of it and get your home exactly where you want it from day one.',
      tags: ['trigger', 'new-home', 'renovation', 'fresh-start'],
    },
    {
      accessor: 'retirementOrFixedIncome',
      label: 'Retired or approaching retirement — wants to lock in costs and comfort',
      severity: 'medium',
      emotionalDrivers: ['fear', 'lossAversion'],
      urgencyMultiplier: 'medium',
      symptoms: [
        '"We\'re retired and on a fixed income — we need our bills to be predictable"',
        '"We\'re home all day so we really feel the heat"',
        '"We want to get things done while we can manage the project"',
        '"We don\'t want to deal with a big repair in a few years"',
      ],
      likelyCauses: [
        'Transition to fixed income creates heightened sensitivity to variable costs',
        'Being home full-time amplifies comfort issues that were previously masked',
        'Desire to "lock in" the home before health or mobility changes',
        'Planning horizon shifts — want long-lasting solutions, not deferred maintenance',
      ],
      trades: ['insulation', 'hvac', 'windows', 'solar', 'bathroom'],
      naturalPairings: ['solar', 'hvac'],
      programFit: ['energy-saver', 'tpr-monthly-special'],
      householdResonance: ['Senior(s)', 'Empty nester(s)'],
      discoveryQuestions: [
        'Are you retired or planning to retire soon?',
        'Do you find you\'re home much more now than you used to be — and feeling the temperature more because of it?',
        'Is having predictable monthly costs something that\'s important to you going forward?',
      ],
      outcomeStatement:
        'Energy upgrades on a fixed income are especially powerful: insulation and a new system create a comfortable home that costs the same every month instead of spiking with the weather. Solar, particularly, locks your energy rate for 25 years — so as rates keep rising, your cost stays flat.',
      lossFrame:
        'On a fixed income, an HVAC failure in August is not just an inconvenience — it\'s a financial emergency. Addressing aging systems proactively now, while you have flexibility, eliminates the risk of a forced emergency replacement at the worst possible time.',
      closeTrigger:
        'You want your home to take care of you in retirement — not surprise you with big repair bills. Let\'s set it up right. A predictable, comfortable home is what this investment delivers.',
      tags: ['trigger', 'retirement', 'fixed-income', 'comfort', 'senior'],
    },
    {
      accessor: 'sellingHomeSoon',
      label: 'Selling this home within the next 6–18 months',
      severity: 'high',
      emotionalDrivers: ['lossAversion', 'fear'],
      urgencyMultiplier: 'high',
      symptoms: [
        '"We\'re thinking of downsizing in the next year or two"',
        '"We\'re moving for work and need to list by spring"',
        '"The kids moved out — this place is too big"',
        '"We want to sell at top of market"',
        'Has started talking to realtors',
      ],
      likelyCauses: [
        'Life transition: empty nest, divorce, relocation, retirement, estate',
        'Market timing — wants to capture current values',
        'Proactive resale preparation',
      ],
      trades: ['roofing', 'bathroom', 'kitchen', 'flooring', 'paint'],
      naturalPairings: ['flooring', 'paint'],
      programFit: ['tpr-monthly-special'],
      householdResonance: ['Empty nester(s)', 'Senior(s)', 'Non-senior(s)'],
      discoveryQuestions: [
        'Are you thinking about selling this home at any point in the next couple of years?',
        'Have you talked to a realtor about what the home would need to be competitive?',
        'Is there a timeline driving this — a move, a retirement date, a life change?',
      ],
      outcomeStatement:
        'The right pre-sale upgrades — kitchen, bathrooms, flooring, and paint — deliver 60–80% of their cost back at closing while dramatically reducing days on market. A home that shows well sells faster and negotiates less. We help you spend strategically on what moves the needle.',
      lossFrame:
        'Buyers doing walkthroughs are mentally subtracting. A dated kitchen: "-$20,000." A bathroom with old tile: "-$15,000." Worn carpet: "-$10,000." Those mental discounts often exceed the actual cost of the upgrades. The seller who updates before listing closes better deals.',
      closeTrigger:
        'You have a finite window before you list. The work needs to be done before the photos are taken. Let\'s start now — we can be done well before your target date.',
      tags: ['trigger', 'selling', 'resale', 'financial', 'timeline'],
    },
  ] satisfies PainPoint[],

} as const satisfies Record<PainPointCategory, PainPoint[]>

// ─── Flat Array Export ────────────────────────────────────────────────────────

/**
 * All pain points as a flat array — useful for search, filtering, and
 * runtime selection logic in the meetings flow.
 */
export const allPainPoints: PainPoint[] = (
  Object.values(painPoints) as PainPoint[][]
).flat()

/**
 * Accessor → PainPoint lookup map for O(1) retrieval by ID.
 */
export const painPointByAccessor: Record<string, PainPoint> = Object.fromEntries(
  allPainPoints.map(p => [p.accessor, p]),
)
