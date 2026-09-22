import type { PresentationDocument, WhoWeAreSlide } from '@/features/meeting-flow/types'
import { DUE_DILIGENCE_ITEMS } from '@/features/meeting-flow/constants/due-diligence'
import { groupSlides } from '@/shared/components/presentation/group-slides'
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
  // Tracked, unlike the portfolio pair this replaced, which is gitignored and missing in production (U12).
  bathroomBefore: '/funnels/bathrooms/before-1.webp',
  bathroomAfter: '/funnels/bathrooms/after-1.webp',
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

/** The visible cue on documents the homeowner can open (U11). */
const TAP_TO_VIEW = 'Tap to view'

/**
 * The Who We Are slides (spec C §3). The hook and the closing are `full`; the eight slides
 * between them are `column` and so form one run with one heading column.
 * Deck rules: see src/features/meeting-flow/DOCS.md#who-we-are-deck
 */
export const WHO_WE_ARE_SLIDES: WhoWeAreSlide[] = [
  {
    id: 'hook',
    frame: 'full',
    heading: {
      title: 'A successful project doesn’t start on demolition day.',
      subheading: { text: 'It starts when you do your', accent: 'due diligence.' },
    },
    background: { kind: 'image', src: IMAGES.hook, alt: 'Finished home exterior at dusk' },
    content: { kind: 'hero' },
  },
  {
    id: 'licensing',
    heading: { number: 1, title: 'Proper licensing and permits', subheading: { text: licensing.short } },
    content: {
      kind: 'credentials',
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
      openLabel: TAP_TO_VIEW,
    },
  },
  {
    id: 'scope',
    heading: { number: 2, title: 'A clear scope of work', subheading: { text: scope.short } },
    content: { kind: 'sample', proof: { value: scope.stat, label: scope.statLabel }, document: SAMPLE_SCOPE, openLabel: TAP_TO_VIEW },
  },
  {
    id: 'supervision',
    heading: { number: 3, title: 'Proper supervision', subheading: { text: supervision.short } },
    background: { kind: 'image', src: IMAGES.supervision, alt: 'Crew pouring a driveway while a supervisor watches' },
    content: { kind: 'point', proof: { value: supervision.stat, label: supervision.statLabel } },
  },
  {
    id: 'communication',
    heading: { number: 4, title: 'Communication', subheading: { text: communication.short } },
    content: {
      kind: 'agent',
      cardRole: 'Your point of contact',
      commitments: [
        'Calls and texts answered the same business day',
        'A progress update with photos, every week of the job',
        'A walk through the job with you before work starts',
      ],
    },
  },
  {
    id: 'team',
    heading: { number: 5, title: 'Team and support staff', subheading: { text: office.short } },
    content: {
      kind: 'team',
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
    },
  },
  {
    id: 'performance',
    heading: { number: 6, title: 'Proof of performance', subheading: { text: performance.short } },
    content: {
      kind: 'point',
      proof: { value: performance.stat, label: performance.statLabel },
      media: { before: IMAGES.bathroomBefore, after: IMAGES.bathroomAfter, alt: 'Bathroom remodel', width: 1280, height: 714 },
    },
  },
  {
    id: 'comparison',
    heading: { title: `${COMPARISON_COLUMNS.triPros} vs other contractors`, subheading: { text: 'The six, side by side.' } },
    content: {
      kind: 'comparison',
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
  },
  {
    id: 'extras',
    heading: { title: '…and what most homeowners never think to ask.' },
    content: {
      kind: 'comparison',
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
    },
  },
  {
    id: 'closing',
    frame: 'full',
    heading: { title: 'Success isn’t about the finishes.' },
    background: { kind: 'image', src: IMAGES.hook, alt: 'Finished home exterior at dusk' },
    content: {
      kind: 'closing',
      quote: 'Many times it boils down to communication, supervision, leadership, and accountability. That is what makes it the real deal.',
      cta: { label: 'Continue to Specialties' },
    },
  },
]

/** How many slides carry a number: the "of 6" in the heading column's "3 of 6". */
export const PROOF_POINT_COUNT = WHO_WE_ARE_SLIDES.filter(slide => slide.heading.number !== undefined).length

/** The slides grouped once, at module scope: the hook, one run of eight, the closing. */
export const WHO_WE_ARE_GROUPS = groupSlides(WHO_WE_ARE_SLIDES)
