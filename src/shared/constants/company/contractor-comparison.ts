import { companyInfo } from './company-info'
import { insurances } from './insurances'
import { reviews } from './reviews'
import { teamInfo } from './team-info'

export const primaryLicense = companyInfo.licenses[0]
// e.g. '$2M per project' -> '$2M'
export const liabilityCoverage = insurances.find(i => i.label === 'General Liability Insurance')!.coverage.split(' ')[0]
export const supportStaff = `${teamInfo.numSupportStaff}+`
const supervisors = `${teamInfo.minSupervisorsPerJob}+`

export interface ContractorComparisonRow {
  label: string
  triPros: string
  others: string
}

/** How Tri Pros answers each thing a homeowner should check, against what other contractors offer. */
export const CONTRACTOR_COMPARISON_ROWS = {
  lic: {
    label: 'Licensing and insurance',
    triPros: `CA #${primaryLicense.licenseNumber} · ${liabilityCoverage} per project · bonded`,
    others: 'Unlicensed or underinsured, and you carry the risk',
  },
  sow: { label: 'Scope of work', triPros: 'Detailed and in writing before work starts', others: 'A one-line estimate or a handshake' },
  sup: { label: 'Supervision', triPros: `${supervisors} sets of eyes on every job`, others: 'The crew, unsupervised' },
  com: { label: 'Communication', triPros: 'One direct contact · same-day replies · weekly updates', others: 'Chasing calls for days' },
  team: { label: 'Team and support', triPros: `A senior partner and ${supportStaff} support staff`, others: 'One person and a truck' },
  proof: {
    label: 'Proof of performance',
    triPros: `${companyInfo.numProjects}+ projects · Google ${reviews.google.rating.toFixed(1)} · ${reviews.bbb.platform} ${reviews.bbb.rating}`,
    others: '“Trust me”',
  },
  war: { label: 'Product warranties', triPros: 'Lifetime warranties on many of our products', others: 'Whatever the box says, if it’s still valid' },
  exp: { label: 'Experience', triPros: `${companyInfo.combinedYearsExperience}+ years of combined experience`, others: 'Learning on your house' },
  ops: { label: 'Operations', triPros: 'Office, field crew, and you on one live system', others: 'Lost paperwork and “let me check with the guys”' },
  prog: { label: 'Progress', triPros: 'Every phase photographed and on record', others: 'You drive by to check' },
  fin: { label: 'Financing', triPros: 'Financing and payment programs', others: 'Cash or check up front' },
  chg: { label: 'Change orders', triPros: 'Any change is priced and signed before it happens', others: 'A surprise bill at the end' },
  pay: { label: 'Payments', triPros: 'You pay as work is completed', others: 'A big deposit, then silence' },
  reb: { label: 'Rebates', triPros: 'We find and file your energy rebates and tax credits', others: 'You’re on your own' },
} as const satisfies Record<string, ContractorComparisonRow>

export type ContractorRowId = keyof typeof CONTRACTOR_COMPARISON_ROWS

/** The rows of the meeting's two comparison slides, in their order. */
export const CONTRACTOR_COMPARISON_SLIDE_ROWS = {
  comparison: ['lic', 'sow', 'sup', 'com', 'team', 'proof'],
  extras: ['war', 'exp', 'ops', 'prog', 'fin', 'chg', 'pay', 'reb'],
} as const satisfies Record<string, readonly ContractorRowId[]>

/** The same rows grouped by the question a homeowner asks of a contractor. */
export const CONTRACTOR_QUESTIONS = [
  { id: 'protected', title: 'You’re protected', shortTitle: 'Protected', rowIds: ['lic', 'war', 'chg', 'pay'] },
  { id: 'done-right', title: 'It’s done right', shortTitle: 'Done right', rowIds: ['sow', 'sup', 'prog', 'exp', 'proof'] },
  { id: 'in-the-loop', title: 'You’re kept in the loop', shortTitle: 'In the loop', rowIds: ['com', 'team', 'ops'] },
  { id: 'paying', title: 'Paying for it', shortTitle: 'Paying for it', rowIds: ['fin', 'reb'] },
] as const satisfies readonly { id: string, title: string, shortTitle: string, rowIds: readonly ContractorRowId[] }[]
