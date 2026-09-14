import type { PinnedSummary, PresentationDocument, WhoWeAreSection } from '@/features/meeting-flow/types'
import { DUE_DILIGENCE_ITEMS } from '@/features/meeting-flow/constants/due-diligence'
import { companyInfo, insurances, reviews } from '@/shared/constants/company'
import { R2_BUCKETS, R2_PUBLIC_DOMAINS } from '@/shared/services/providers/r2/types'

const DOCS_BASE = R2_PUBLIC_DOMAINS[R2_BUCKETS.companyDocs]!
const license = companyInfo.licenses[0]
const partner = companyInfo.teamInfo.owners[0]
const partnerFirstName = partner.name.split(' ')[0]
const supportStaff = `${companyInfo.teamInfo.numSupportStaff}+`
// e.g. '$2M per project' -> '$2M'
const liabilityCoverage = insurances.find(i => i.label === 'General Liability Insurance')!.coverage.split(' ')[0]
const [licensing, scope, supervision, communication, office, performance] = DUE_DILIGENCE_ITEMS

/** Stand-in imagery from the public site until the step gets its own shoot. */
const IMAGES = {
  hook: '/hero-photos/modern-house-5.jpg',
  supervision: '/process/construction-stage.jpeg',
  before: '/portfolio-photos/projects/Riviera/hero-before.jpeg',
  after: '/portfolio-photos/projects/Riviera/hero-after.jpeg',
} as const

/**
 * Placeholder until the real sample scope is uploaded to R2 at
 * `sample-scope-of-work/page-N.jpg`; the steps are in
 * docs/superpowers/specs/2026-09-13-who-we-are-corrections-design.md §4.
 */
const SAMPLE_SCOPE: PresentationDocument = {
  title: 'Sample scope of work',
  alt: `${companyInfo.name} sample scope of work`,
  pages: Array.from({ length: 6 }, () => '/meeting-flow/placeholders/sample-scope-page.jpg'),
  width: 1700,
  height: 2200,
}

export const COMPARISON_COLUMNS = {
  triPros: companyInfo.nickname,
  others: 'Other contractors',
} as const

export const WHO_WE_ARE_SECTIONS: WhoWeAreSection[] = [
  {
    kind: 'hook',
    id: 'hook',
    title: 'A successful project doesn’t start on demolition day.',
    subtitle: 'It starts when you do your',
    accent: 'due diligence.',
    image: IMAGES.hook,
    imageAlt: 'Finished home exterior at dusk',
  },
  {
    kind: 'credentials',
    id: 'licensing',
    number: 1,
    title: 'Proper licensing and permits',
    line: licensing.short,
    documents: [
      {
        title: 'Contractor license',
        alt: `${companyInfo.name} contractor license`,
        pages: [`${DOCS_BASE}/tpr-license.jpg`],
        width: 1800,
        height: 1200,
      },
      {
        title: 'Certificate of insurance',
        alt: `${companyInfo.name} certificate of liability insurance`,
        pages: [`${DOCS_BASE}/tpr-coi-2026.jpg`],
        width: 2550,
        height: 3300,
      },
    ],
    protection: [
      { value: `#${license.licenseNumber}`, label: 'CA contractor license' },
      { value: liabilityCoverage, label: 'Insurance per project' },
      { value: 'Bonded', label: 'Most contractors aren’t' },
    ],
    reputation: [
      { kind: 'fact', value: companyInfo.ownership, label: `${companyInfo.generations} generations` },
      { kind: 'rating', platform: reviews.google.platform, rating: reviews.google.rating.toFixed(1), count: reviews.google.count },
      { kind: 'rating', platform: reviews.yelp.platform, rating: reviews.yelp.rating.toFixed(1), count: reviews.yelp.count },
      { kind: 'fact', value: reviews.bbb.rating, label: `${reviews.bbb.platform} rating` },
    ],
  },
  {
    kind: 'sample',
    id: 'scope',
    number: 2,
    title: 'A clear scope of work',
    line: scope.short,
    proof: { value: scope.stat, label: scope.statLabel },
    document: SAMPLE_SCOPE,
    openLabel: 'Read a sample scope',
  },
  {
    kind: 'point',
    id: 'supervision',
    number: 3,
    title: 'Proper supervision',
    line: supervision.short,
    proof: { value: supervision.stat, label: supervision.statLabel },
    media: { type: 'photo', src: IMAGES.supervision, alt: 'Crew pouring a driveway while a supervisor watches' },
  },
  {
    kind: 'agent',
    id: 'communication',
    number: 4,
    title: 'Communication',
    line: communication.short,
    cardRole: 'Your point of contact',
    commitments: [
      'Calls and texts answered the same business day',
      'A progress update with photos, every week of the job',
      'A walk through the job with you before work starts',
    ],
  },
  {
    kind: 'team',
    id: 'team',
    number: 5,
    title: 'Team and support staff',
    line: office.short,
    proof: { value: supportStaff, label: 'Support staff behind every project' },
    partner: {
      name: partner.name,
      title: partner.title,
      image: `/${partner.image}`,
      points: [
        `${partnerFirstName} reviews every scope before it reaches you`,
        `You can reach ${partnerFirstName} directly if something isn’t right`,
        `${partnerFirstName} puts a licensed contractor’s eyes on your project`,
      ],
    },
    teamPhotoLabel: 'Team photo, to be shot',
  },
  {
    kind: 'point',
    id: 'performance',
    number: 6,
    title: 'Proof of performance',
    line: performance.short,
    proof: { value: performance.stat, label: performance.statLabel },
    media: { type: 'pair', before: IMAGES.before, after: IMAGES.after, alt: 'Riviera project' },
  },
  {
    kind: 'comparison',
    id: 'comparison',
    title: 'The six you now know to ask.',
    rows: [
      {
        label: 'Licensing and insurance',
        triPros: `CA #${license.licenseNumber} · ${liabilityCoverage} per project · bonded`,
        others: 'Unlicensed or underinsured, and you carry the risk',
      },
      { label: 'Scope of work', triPros: 'Detailed and in writing before work starts', others: 'A one-line estimate or a handshake' },
      { label: 'Supervision', triPros: `${supervision.stat} sets of eyes on every job`, others: 'The crew, unsupervised' },
      { label: 'Communication', triPros: 'One direct contact · same-day replies · weekly updates', others: 'Chasing calls for days' },
      { label: 'Team and support', triPros: `A senior partner and ${supportStaff} support staff`, others: 'One person and a truck' },
      {
        label: 'Proof of performance',
        triPros: `${companyInfo.numProjects}+ projects · Google ${reviews.google.rating.toFixed(1)} · ${reviews.bbb.platform} ${reviews.bbb.rating}`,
        others: '“Trust me”',
      },
    ],
  },
  {
    kind: 'truth',
    id: 'truth',
    tableTitle: '…and what most homeowners never think to ask.',
    rows: [
      { label: 'Product warranties', triPros: 'Lifetime warranties on many of our products', others: 'Whatever the box says, if it’s still valid' },
      { label: 'Experience', triPros: `${companyInfo.combinedYearsExperience}+ years of combined experience`, others: 'Learning on your house' },
      { label: 'Operations', triPros: 'Office, field crew, and you on one live system', others: 'Lost paperwork and “let me check with the guys”' },
      { label: 'Progress', triPros: 'Every phase photographed and on record', others: 'You drive by to check' },
      { label: 'Financing', triPros: 'Financing and payment programs', others: 'Cash or check up front' },
      { label: 'Change orders', triPros: 'Any change is priced and signed before it happens', others: 'A surprise bill at the end' },
      { label: 'Payments', triPros: 'You pay as work is completed', others: 'A big deposit, then silence' },
      { label: 'Rebates', triPros: 'We find and file your energy rebates and tax credits', others: 'You’re on your own' },
    ],
    title: 'Success isn’t about the finishes.',
    quote: 'Many times it boils down to communication, supervision, leadership, and accountability. That is what makes it the real deal.',
    ctaLabel: 'Continue to Specialties',
  },
]

const POINT_COUNT = WHO_WE_ARE_SECTIONS.filter(section => 'number' in section).length

export const WHO_WE_ARE_PINNED: PinnedSummary[] = WHO_WE_ARE_SECTIONS.map((section) => {
  switch (section.kind) {
    case 'hook':
      return { title: 'Navigating the construction industry', line: 'What a legitimate project actually requires.' }
    case 'credentials':
    case 'sample':
    case 'point':
    case 'agent':
    case 'team':
      return { number: section.number, title: section.title, line: section.line, count: `${section.number} of ${POINT_COUNT}` }
    case 'comparison':
      return { title: `${COMPARISON_COLUMNS.triPros} vs other contractors`, line: 'The six, side by side.' }
    case 'truth':
      return { title: 'The real deal', line: 'Done once. Done right.' }
    default:
      throw new Error(`Unknown section kind: ${section satisfies never}`)
  }
})
