// Display constants for TPR Monthly Special step components.
// Extracted here per project convention: file-level constants never live in component files.

import { BoxIcon, CalendarIcon, ClockIcon, CreditCardIcon, GiftIcon, LeafIcon, SearchIcon, ShieldCheckIcon, StarIcon } from 'lucide-react'

import { getCurrentMonth, getMonthEnd } from '@/features/meetings/lib/buy-triggers'

const month = getCurrentMonth()
const monthEnd = getMonthEnd()

// ── Package Step (Step 2) ────────────────────────────────────────────────────

export const packageItems = [
  {
    body: 'Standard 3-tab shingles upgraded to premium architectural shingles — included at the same price. Architectural shingles last 25–30 years vs. 15–20 for standard, carry stronger wind ratings, and have better curb appeal for resale.',
    Icon: StarIcon,
    id: 'shingles',
    trigger: 'Material Upgrade: Architectural Shingles',
    value: '$800 value',
    valueCls: 'border-amber-500/30 bg-amber-500/15 text-amber-400',
  },
  {
    body: 'Standard warranty extended from 3 years to 5 years on all workmanship — included. Every project is already backed by manufacturer warranties on materials; this adds 2 extra years of coverage on our labor, at no cost.',
    Icon: ShieldCheckIcon,
    id: 'warranty',
    trigger: 'Warranty Extension: 5-Year Workmanship',
    value: '$400 value',
    valueCls: 'border-sky-500/30 bg-sky-500/15 text-sky-400',
  },
  {
    body: 'A licensed inspector walks your attic before installation — documenting ventilation, insulation levels, and any moisture or pest issues. Most families discover an insulation gap that qualifies them for the IRA 25C credit they didn\'t know they could claim.',
    Icon: SearchIcon,
    id: 'inspection',
    trigger: 'Free Attic Inspection with Any Roof Scope',
    value: '$200 value',
    valueCls: 'border-emerald-500/30 bg-emerald-500/15 text-emerald-400',
  },
] as const

export const packageStackingRows = [
  { amount: '$1,400 included', label: `${month} Priority Package`, note: 'at no additional cost' },
  { amount: 'up to 30%', label: 'IRA Section 25C Credit', note: 'federal tax credit at filing' },
  { amount: 'up to $3,000', label: 'LADWP Home Upgrade Rebate', note: 'when program is open' },
] as const

// ── Financing Step (Step 3) ──────────────────────────────────────────────────

export const financingRows = [
  {
    highlight: true,
    monthly: '$140–$220/mo',
    note: 'Lowest monthly payment',
    term: '180-month (15 yr)',
  },
  {
    highlight: false,
    monthly: '$185–$290/mo',
    note: 'Pay off faster',
    term: '120-month (10 yr)',
  },
  {
    highlight: false,
    monthly: '0% interest',
    note: 'Best with cash or HELOC',
    term: '18-month same-as-cash',
  },
] as const

export const iraQualifiers = [
  'Central air conditioners and heat pumps',
  'Attic and wall insulation + air sealing',
  'Exterior windows and skylights (Energy Star)',
  'Gas or oil furnaces and boilers',
] as const

export const packageSavingsNote = `${month} Priority Package reduces your starting cost by $1,400 — which lowers your monthly payment before financing even begins.`

// ── Stories Step (Step 4) ────────────────────────────────────────────────────

export const stories = [
  {
    context: '22-year-old roof with an active leak in the master bedroom. Summer AC bills averaging $320/month.',
    family: 'The Ramirez Family',
    id: 'ramirez',
    location: 'Whittier, CA',
    quote: `"We'd been putting this off for two years. Wish we hadn't waited."`,
    results: [
      { color: 'sky', label: 'Roof replaced — passed city & HOA inspection' },
      { color: 'emerald', label: 'Energy bill dropped $130/month' },
      { color: 'amber', label: 'IRA 25C credit: $2,800 back at tax time' },
    ],
    scope: 'Roofing + Insulation',
  },
  {
    context: '18-year-old roof with visible granule loss and 8 windows leaking condensation. Both handled in one mobilization.',
    family: 'The Gutierrez Family',
    id: 'gutierrez',
    location: 'Cerritos, CA',
    quote: `"I kept thinking I had to choose between the roof and the windows. Turns out I didn't."`,
    results: [
      { color: 'sky', label: 'One crew, one permit, one inspection' },
      { color: 'emerald', label: 'Monthly payment: $198 over 180 months' },
      { color: 'amber', label: 'Saved $780 vs. scheduling separately' },
    ],
    scope: 'Roofing + 8 Windows',
  },
  {
    context: 'Running AC 12+ hours/day during summer. Average utility bill: $290/month.',
    family: 'The Kim Family',
    id: 'kim',
    location: 'Downey, CA',
    quote: `"The AC barely runs now. In August. In Downey."`,
    results: [
      { color: 'sky', label: 'Electric bill dropped $95/month' },
      { color: 'emerald', label: 'IRA 25C credit: $1,400 back' },
      { color: 'amber', label: 'Monthly payment: $160 over 120 months' },
    ],
    scope: 'Insulation + HVAC',
  },
] as const

export const resultColorMap: Record<string, string> = {
  amber: 'border-amber-700/30 bg-amber-950/40 text-amber-300',
  emerald: 'border-emerald-700/30 bg-emerald-950/40 text-emerald-300',
  sky: 'border-sky-700/30 bg-sky-950/40 text-sky-300',
}

// ── Close Step (Step 6) ──────────────────────────────────────────────────────

export const closeSummaryRows = [
  {
    accent: 'text-sky-400',
    Icon: BoxIcon,
    id: 'scope',
    label: 'Scope',
    value: 'Roofing, insulation, windows, qualifying HVAC — all eligible',
  },
  {
    accent: 'text-amber-400',
    Icon: GiftIcon,
    id: 'package',
    label: 'Incentive',
    value: `${month} Priority Package — architectural shingle upgrade + 5-yr warranty + free attic inspection ($1,400 combined)`,
  },
  {
    accent: 'text-emerald-400',
    Icon: CreditCardIcon,
    id: 'financing',
    label: 'Financing',
    value: '9.99% APR via GreenSky — 180-mo or 120-mo terms. 18-month same-as-cash available.',
  },
  {
    accent: 'text-emerald-400',
    Icon: LeafIcon,
    id: 'credit',
    label: 'Tax Credit',
    value: '30% IRA Section 25C for qualifying energy upgrades — applied at tax time',
  },
  {
    accent: 'text-violet-400',
    Icon: CalendarIcon,
    id: 'timeline',
    label: 'Timeline',
    value: 'Install within 3–4 weeks of signing. Most projects complete in 10–14 business days.',
  },
  {
    accent: 'text-rose-400',
    Icon: ClockIcon,
    id: 'expiry',
    label: 'Expiration',
    value: monthEnd,
  },
] as const
