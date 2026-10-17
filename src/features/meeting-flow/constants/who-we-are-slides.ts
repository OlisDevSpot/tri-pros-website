import type { PresentationDocument, WhoWeAreSlide } from '@/features/meeting-flow/types'
import { BadgeCheckIcon, CameraIcon, ClockIcon, FileTextIcon, HeartIcon, HomeIcon, ShieldCheckIcon, UserIcon, UsersIcon } from 'lucide-react'
import { DUE_DILIGENCE_ITEMS } from '@/features/meeting-flow/constants/due-diligence'
import { groupSlides } from '@/shared/components/presentation/group-slides'
import { COMPANY_DOCUMENTS, companyInfo, CONTRACTOR_COMPARISON_ROWS, CONTRACTOR_COMPARISON_SLIDE_ROWS, liabilityCoverage, primaryLicense, REPUTATION_MARKS, supportStaff } from '@/shared/constants/company'

const partner = companyInfo.teamInfo.owners[0]
const partnerFirstName = partner.name.split(' ')[0]
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
 * `sample-scope-of-work/page-N.jpg`.
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

// e.g. 9_000_000 -> '$9M'; truncated, not rounded, so $9.5M never reads as the unearned '$10M'.
const valueDelivered = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', notation: 'compact', maximumFractionDigits: 0, roundingMode: 'trunc' }).format(companyInfo.valueOfProjectsInDollars)
const clientSatisfaction = `${Math.floor(companyInfo.clientSatisfaction * 100)}%`
// A non-breaking hyphen: a narrow record tile must not split 'family-owned' across lines.
const ownershipLabel = `Generations, ${companyInfo.ownership.toLowerCase().replaceAll('-', '\u2011')}`

/**
 * The Who We Are slides (spec C §3). The hook and the closing are `full`; the eight slides
 * between them are `column` and so form one run with one heading column.
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
      documents: [COMPANY_DOCUMENTS.license, COMPANY_DOCUMENTS.insurance],
      rail: {
        eyebrow: 'What protects you',
        tiles: [
          // Focus points are fractions of the current scans: re-measure them when a document is replaced.
          { kicker: 'License', icon: ShieldCheckIcon, value: `#${primaryLicense.licenseNumber}`, label: 'CA contractor license', opens: { document: 0, focus: { x: 0.29, y: 0.35 } } },
          { kicker: 'Insurance', icon: FileTextIcon, value: liabilityCoverage, label: 'Insurance per project', opens: { document: 1, focus: { x: 0.62, y: 0.45 } } },
          { kicker: 'Bond', icon: BadgeCheckIcon, value: 'Bonded', label: 'Most contractors aren’t' },
        ],
      },
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
      timelineLabel: 'From today to the final walkthrough',
      timeline: [
        { when: 'Today', caption: firstName => `You meet ${firstName}` },
        { when: 'Before work starts', caption: () => 'Walk the job together' },
        { when: 'During the job', caption: firstName => `${firstName} keeps you posted` },
        { when: 'Final walkthrough', caption: firstName => `Still ${firstName}` },
      ],
      rail: {
        eyebrow: 'What you can count on',
        tiles: [
          { kicker: 'Contact', icon: UserIcon, value: communication.stat, label: 'Dedicated contact, start to finish' },
          { kicker: 'Replies', icon: ClockIcon, value: 'Same day', label: 'Calls and texts answered' },
          { kicker: 'Updates', icon: CameraIcon, value: 'Weekly', label: 'Progress update with photos' },
        ],
      },
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
      teamPhotoLabel: 'Team photo, to be shot',
    },
  },
  {
    id: 'performance',
    heading: { number: 6, title: 'Proof of performance', subheading: { text: performance.short } },
    content: {
      kind: 'performance',
      media: { before: IMAGES.bathroomBefore, after: IMAGES.bathroomAfter, alt: 'Bathroom remodel', width: 1280, height: 714 },
      rail: {
        eyebrow: 'The record',
        tiles: [
          { kicker: 'Projects', icon: HomeIcon, value: performance.stat, label: performance.statLabel },
          { kicker: 'Delivered', icon: FileTextIcon, value: valueDelivered, label: 'In projects delivered' },
          { kicker: 'Ownership', icon: UsersIcon, value: String(companyInfo.generations), label: ownershipLabel },
          { kicker: 'Satisfaction', icon: HeartIcon, value: clientSatisfaction, label: 'Client satisfaction' },
        ],
      },
      // The public review standing proves performance, so it sits on the Performance slide.
      reputation: REPUTATION_MARKS,
    },
  },
  {
    id: 'comparison',
    heading: { title: `${COMPARISON_COLUMNS.triPros} vs other contractors`, subheading: { text: 'The six, side by side.' } },
    content: {
      kind: 'comparison',
      rows: CONTRACTOR_COMPARISON_SLIDE_ROWS.comparison.map(id => CONTRACTOR_COMPARISON_ROWS[id]),
    },
  },
  {
    id: 'extras',
    heading: { title: '…and what most homeowners never think to ask.' },
    content: {
      kind: 'comparison',
      rows: CONTRACTOR_COMPARISON_SLIDE_ROWS.extras.map(id => CONTRACTOR_COMPARISON_ROWS[id]),
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
