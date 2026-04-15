import type { PainPointCategory, PainPointEmotionalDriver } from '@/shared/types/enums'

// ---------------------------------------------------------------------------
// Fear templates: keyed by pain point category, each with a generic fear
// statement and a trade-contextualized variant map. The builder picks the
// trade-specific variant when a matching trade is found, else falls back to
// the generic.
// ---------------------------------------------------------------------------

interface FearTemplate {
  generic: string
  byTrade: Record<string, string>
}

export const FEAR_TEMPLATES: Record<PainPointCategory, FearTemplate> = {
  'Thermal Inefficiencies & Discomfort': {
    generic: 'Your home is losing conditioned air, making it harder to stay comfortable and driving up energy costs',
    byTrade: {
      'Windows & doors': 'Drafty windows and doors are letting outside air in — dust, allergens, and temperature swings follow',
      'Attic & Basement': 'Without proper insulation, your attic is radiating heat in summer and losing it in winter — your HVAC can\'t keep up',
      'HVAC': 'An aging HVAC system is working overtime to compensate for thermal loss — risking a breakdown when you need it most',
    },
  },
  'Financial Leak': {
    generic: 'Money is leaving your home every month through inefficiency — and utility rates only go up',
    byTrade: {
      'Solar': 'Without solar, every rate hike hits you directly — and EV or pool loads amplify the damage',
      'Windows & doors': 'Old windows are one of the biggest sources of energy loss — you\'re paying to heat and cool the outdoors',
      'Attic & Basement': 'Inadequate insulation means your energy dollars are escaping through the attic — the #1 source of heat loss',
      'HVAC': 'An inefficient HVAC system is the single largest line item on your utility bill',
    },
  },
  'Structural Risk': {
    generic: 'Structural issues don\'t wait — they get worse and more expensive the longer they\'re deferred',
    byTrade: {
      'Roof & Gutters': 'A compromised roof exposes everything underneath — water damage, mold, and structural decay follow',
      'Foundation & Crawl Space': 'Foundation movement threatens the entire structure — cracks only widen over time',
      'Windows & doors': 'Leaking windows allow water infiltration that can damage framing, drywall, and insulation behind the walls',
    },
  },
  'Health (IAQ) And Safety': {
    generic: 'Your family\'s health may be affected by the air quality inside your home',
    byTrade: {
      'Attic & Basement': 'Poor attic sealing pulls pollutants, allergens, and particulates into your living space',
      'Windows & doors': 'Gaps around windows allow dust, pollen, and outdoor pollutants to infiltrate — worsening allergies and respiratory issues',
      'HVAC': 'An old HVAC system may be recirculating dust, mold spores, and stale air throughout your home',
      'Hazardous Materials': 'Hazardous materials like asbestos or lead paint pose serious health risks if disturbed during renovation',
    },
  },
  'Missed Aesthetics And Resale Potential': {
    generic: 'An outdated home loses value every year — buyers notice what you\'ve learned to look past',
    byTrade: {
      'Bathroom Remodel': 'A dated bathroom is the #1 thing buyers judge — and the #1 reason they negotiate down',
      'Kitchen Remodel': 'The kitchen is the heart of the home — an outdated one signals "this house needs work" to every buyer',
      'Exterior Paint, Stucco & Siding': 'Your exterior is the first thing people see — faded or damaged siding says "deferred maintenance"',
      'Flooring': 'Worn flooring makes the entire home feel neglected, even if everything else is updated',
    },
  },
  'Deferred Lifestyle Upgrades': {
    generic: 'Your home should support the life you want — not hold it back',
    byTrade: {
      'Exterior Upgrades & Lot Layout': 'Your outdoor space is an unused asset — the right setup creates a second living area',
      'Dryscaping': 'Traditional landscaping wastes water and money — drought-resistant design pays for itself',
    },
  },
  'Life Trigger': {
    generic: 'A life change is the ideal time to invest in your home — the motivation is real and the timing is right',
    byTrade: {
      'Roof & Gutters': 'After storm damage, acting quickly prevents secondary damage and may be covered by insurance',
    },
  },
}

// ---------------------------------------------------------------------------
// Benefit templates: keyed by pain point category with trade-specific copy.
// ---------------------------------------------------------------------------

interface BenefitTemplate {
  headline: string
  genericBody: string
  byTrade: Record<string, string>
}

export const BENEFIT_TEMPLATES: Record<PainPointCategory, BenefitTemplate> = {
  'Thermal Inefficiencies & Discomfort': {
    headline: 'Year-round comfort in every room',
    genericBody: 'Proper thermal upgrades eliminate hot/cold spots and create consistent comfort throughout your home',
    byTrade: {
      'Windows & doors': 'New high-performance windows seal out drafts, reduce noise, and keep every room at the temperature you set',
      'Attic & Basement': 'Proper attic insulation is the single most cost-effective upgrade — it stops heat transfer where it matters most',
      'HVAC': 'A modern HVAC system delivers precise temperature control room-by-room, with whisper-quiet operation',
    },
  },
  'Financial Leak': {
    headline: 'Lower your monthly bills permanently',
    genericBody: 'Energy-efficient upgrades reduce utility costs from day one — and the savings compound every month',
    byTrade: {
      'Solar': 'Solar locks in your energy rate for 25+ years — no more rate hikes, and potential tax credits reduce the upfront cost',
      'Windows & doors': 'ENERGY STAR windows can reduce heating/cooling costs by 12-33%, depending on your climate zone',
      'Attic & Basement': 'Insulation upgrades typically pay for themselves within 2-4 years through energy savings alone',
      'HVAC': 'A high-efficiency system can cut your heating and cooling costs by 30-50% compared to an aging unit',
    },
  },
  'Structural Risk': {
    headline: 'Protect your biggest investment',
    genericBody: 'Addressing structural issues now prevents exponentially more expensive repairs later',
    byTrade: {
      'Roof & Gutters': 'A new roof with proper gutters is the ultimate shield — protecting every other investment you\'ve made in your home',
      'Foundation & Crawl Space': 'Foundation stabilization stops the problem and prevents cascading damage to floors, walls, and framing',
      'Windows & doors': 'Properly sealed and flashed windows stop water infiltration before it can cause hidden structural damage',
    },
  },
  'Health (IAQ) And Safety': {
    headline: 'A healthier home for your family',
    genericBody: 'Improved air quality reduces allergens, pollutants, and respiratory triggers inside your home',
    byTrade: {
      'Attic & Basement': 'Sealing and insulating the attic prevents pollutants from being pulled into your living space through the stack effect',
      'Windows & doors': 'Tight-sealing windows dramatically reduce dust, pollen, and outdoor pollutant infiltration',
      'HVAC': 'Modern HVAC systems with advanced filtration actively clean the air your family breathes',
    },
  },
  'Missed Aesthetics And Resale Potential': {
    headline: 'Maximize your home\'s value',
    genericBody: 'Strategic upgrades deliver the highest ROI at resale while improving your daily experience',
    byTrade: {
      'Bathroom Remodel': 'A modern bathroom remodel returns 60-70% at resale — and you get to enjoy it every single day until then',
      'Kitchen Remodel': 'Kitchen upgrades are the #1 ROI driver in real estate — buyers pay a premium for a move-in-ready kitchen',
      'Exterior Paint, Stucco & Siding': 'Fresh exterior finish delivers instant curb appeal and signals a well-maintained home to buyers',
      'Flooring': 'New flooring transforms the look and feel of every room it touches — one of the highest-impact upgrades',
    },
  },
  'Deferred Lifestyle Upgrades': {
    headline: 'Live the way you\'ve been imagining',
    genericBody: 'Your home should be your retreat — not a list of things you wish were different',
    byTrade: {
      'Exterior Upgrades & Lot Layout': 'A designed outdoor living area extends your usable square footage and becomes the heart of your entertaining',
      'Dryscaping': 'Drought-resistant landscaping cuts water bills by 50-75% and eliminates maintenance headaches',
    },
  },
  'Life Trigger': {
    headline: 'The timing is right — act on the momentum',
    genericBody: 'Life transitions create natural windows for home investment — the motivation and urgency are already there',
    byTrade: {
      'Roof & Gutters': 'Post-damage repair is time-sensitive — acting quickly maximizes insurance coverage and prevents secondary issues',
    },
  },
}

// ---------------------------------------------------------------------------
// Risk factor rules: conditions from meeting context + customer profile
// that signal potential deal-killers with recommended mitigations.
// ---------------------------------------------------------------------------

interface RiskFactorRule {
  risk: string
  mitigation: string
  severity: 'high' | 'medium' | 'low'
}

export const RISK_FACTOR_RULES: Record<string, RiskFactorRule> = {
  budgetResistant: {
    risk: 'Budget resistance detected',
    mitigation: 'Lead with monthly payment framing, not total cost. Emphasize ROI and financing options.',
    severity: 'high',
  },
  missingDMs: {
    risk: 'Not all decision makers present',
    mitigation: 'Do not push for a close today. Build rapport, offer to schedule a second visit when everyone can attend.',
    severity: 'high',
  },
  guardedDemeanor: {
    risk: 'Customer is guarded or skeptical',
    mitigation: 'Slow down. Lead with the due diligence story — let them feel in control of the evaluation.',
    severity: 'medium',
  },
  skepticalSpouse: {
    risk: 'Spouse dynamic is one-skeptical',
    mitigation: 'Address the skeptical partner directly. Ask what their concerns are and validate them before presenting solutions.',
    severity: 'high',
  },
  shoppingAround: {
    risk: 'Customer has received 3+ competing quotes',
    mitigation: 'Use the contrast effect — walk the due diligence checklist and let them evaluate competitors against it.',
    severity: 'medium',
  },
  longTimeline: {
    risk: 'Decision timeline is 6+ months out',
    mitigation: 'Focus on education and relationship building, not closing. Plant seeds and schedule a future check-in.',
    severity: 'low',
  },
  lowNecessity: {
    risk: 'Customer rates project necessity as low',
    mitigation: 'Shift from necessity to aspiration — focus on lifestyle benefits, not urgency.',
    severity: 'medium',
  },
  anxiousDemeanor: {
    risk: 'Customer demeanor is anxious',
    mitigation: 'Reassure with process clarity — explain exactly what happens next, timelines, and warranty protections.',
    severity: 'medium',
  },
}

// ---------------------------------------------------------------------------
// Household amplified concerns: maps household types to concerns that are
// heightened for that demographic.
// ---------------------------------------------------------------------------

export const HOUSEHOLD_AMPLIFIED_CONCERNS: Record<string, string[]> = {
  'Single man': [
    'Efficiency-driven — wants clear scope, fair price, minimal back-and-forth',
    'May prioritize function over aesthetics — lead with ROI and durability',
    'Decision authority is clear — no second visit needed if rapport is built',
  ],
  'Single woman': [
    'Safety and trust are heightened priorities — licensing, supervision, and accountability matter extra',
    'Attention to detail in communication — be thorough and transparent',
    'Decision authority is clear — but may want a second opinion from family/friend',
  ],
  'Couple': [
    'Both partners may have different priorities — identify who cares about what early',
    'Alignment check is critical — if one is skeptical, address their concerns directly',
    'Financing conversations should include both — avoid talking past one partner',
  ],
  'Family': [
    'Child safety is a powerful motivator — lead paint, mold, air quality',
    'Budget consciousness is high — financing options are key',
    'Disruption tolerance is low — clear timeline and phasing matter',
  ],
  'Senior(s)': [
    'Fixed income vulnerability — financing and monthly payment framing critical',
    'Health and safety are top priorities — emphasize IAQ, accessibility, non-slip surfaces',
    'Trust is paramount — due diligence story resonates strongly',
  ],
  'Empty nester(s)': [
    'Resale ROI matters — they may be downsizing soon',
    'Lifestyle upgrades appeal — they have time and space to enjoy improvements',
    'Less tolerance for construction disruption — emphasize timeline and project management',
  ],
  'Multi-gen home': [
    'Multiple stakeholder needs — address comfort, safety, and accessibility for all generations',
    'Health concerns span generations — IAQ, temperature consistency matter for elderly and children',
    'Space optimization is valued — ADU or layout changes may resonate',
  ],
}

// ---------------------------------------------------------------------------
// Emotional lever descriptions: maps driver codes to human-readable context
// for the agent.
// ---------------------------------------------------------------------------

export const EMOTIONAL_LEVER_DESCRIPTIONS: Record<PainPointEmotionalDriver, string> = {
  fear: 'Customer is motivated by avoiding negative outcomes — use protective framing and risk scenarios',
  lossAversion: 'Customer feels the pain of losing money/value more than the joy of gaining it — emphasize what they\'re losing by waiting',
  maximizeGain: 'Customer is focused on positive outcomes and ROI — frame upgrades as investments with measurable returns',
  prideOfOwnership: 'Customer takes pride in their home — appeal to their identity as someone who maintains a quality home',
  socialProof: 'Customer is influenced by what neighbors and peers are doing — reference local projects and testimonials',
  trust: 'Customer needs to trust before buying — the due diligence story is your best tool, lead with credentials and proof',
}

// ---------------------------------------------------------------------------
// Severity weight map for sorting fears by impact.
// ---------------------------------------------------------------------------

export const SEVERITY_WEIGHT: Record<string, number> = {
  critical: 4,
  high: 3,
  medium: 2,
  low: 1,
  variable: 2,
}
